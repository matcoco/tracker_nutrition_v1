// tests/unit/features-food-comparison.test.js
// Tests de js/features/food-comparison.js : initialisation, comparaison,
// tableau de résultats et réinitialisation.
//
// Le module mémorise son état (isInitialized, selectedFoods, cache) : on importe
// donc une instance neuve à chaque test via vi.resetModules().

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { foodsFixture, composedMeal, simpleFood } from '../helpers/fixtures.js';

const FOODS = foodsFixture; // raccourci lisible

beforeEach(() => {
    loadAppDom();
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

async function loadComparison() {
    return import('../../js/features/food-comparison.js');
}

/** Sélectionne deux (ou trois) valeurs puis lance la comparaison. */
function selectAndCompare(cmp, id1, id2, id3 = null) {
    el('comparisonFood1').value = id1;
    el('comparisonFood2').value = id2;
    if (id3) el('comparisonFood3').value = id3;
    cmp.performComparison();
}

// ─────────────────────────────────────────────────────────────────────────────
// initComparison
// ─────────────────────────────────────────────────────────────────────────────

describe('foodComparison.initComparison', () => {
    it('ne jette pas et remplit les trois selects avec les aliments', async () => {
        const cmp = await loadComparison();
        const foods = FOODS();
        expect(() => cmp.initComparison(foods)).not.toThrow();

        const options = [...el('comparisonFood1').options].map((o) => o.value);
        expect(options).toEqual(['', 'poulet', 'riz', 'pates', 'pomme']);
        expect([...el('comparisonFood2').options]).toHaveLength(5);
        expect([...el('comparisonFood3').options]).toHaveLength(5);
    });

    it('désactive le bouton Comparer tant que 2 éléments ne sont pas choisis', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        expect(el('compareBtn').disabled).toBe(true);

        el('comparisonFood1').value = 'poulet';
        el('comparisonFood1').dispatchEvent(new Event('change'));
        expect(el('compareBtn').disabled).toBe(true);

        el('comparisonFood2').value = 'riz';
        el('comparisonFood2').dispatchEvent(new Event('change'));
        expect(el('compareBtn').disabled).toBe(false);
    });

    it('est idempotent : un second appel ne duplique ni les écouteurs ni les options', async () => {
        const cmp = await loadComparison();
        const foods = FOODS();
        const addSpy = vi.spyOn(el('compareBtn'), 'addEventListener');

        cmp.initComparison(foods);
        cmp.initComparison(foods);

        expect(addSpy).toHaveBeenCalledTimes(1);
        expect([...el('comparisonFood1').options]).toHaveLength(5);
    });

    it('met à jour le cache quand les aliments changent', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        cmp.initComparison({ uniquement: simpleFood({ name: 'Unique' }) });
        expect([...el('comparisonFood1').options].map((o) => o.value)).toEqual(['', 'uniquement']);
    });

    it('bascule entre aliments et repas via le toggle', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS(), { 'poulet-riz': composedMeal() });

        document.querySelector('.mode-toggle-btn[data-mode="meals"]').click();
        expect([...el('comparisonFood1').options].map((o) => o.value)).toEqual(['', 'poulet-riz']);
        expect(el('comparisonTitle').textContent).toContain('repas');
        expect(el('comparisonLabel1').textContent).toContain('Premier repas');
        expect(el('comparisonResults').style.display).toBe('none');

        document.querySelector('.mode-toggle-btn[data-mode="foods"]').click();
        expect([...el('comparisonFood1').options].map((o) => o.value)).toContain('poulet');
        expect(el('comparisonTitle').textContent).toContain('aliments');
    });

    it('filtre les options visibles via les champs de recherche', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());

        const search = el('comparisonSearch1');
        search.value = 'poulet';
        search.dispatchEvent(new Event('input'));

        const options = [...el('comparisonFood1').options];
        const visible = options.filter((o) => o.style.display !== 'none').map((o) => o.value);
        expect(visible).toEqual(['', 'poulet']);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// performComparison
// ─────────────────────────────────────────────────────────────────────────────

describe('foodComparison.performComparison', () => {
    it('ne fait rien sans sélection', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        cmp.performComparison();
        expect(el('comparisonResults').style.display).toBe('none');
    });

    it('ne fait rien si les éléments ne sont pas dans le cache', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        el('comparisonFood2').innerHTML += '<option value="fantome">Fantôme</option>';
        selectAndCompare(cmp, 'poulet', 'fantome');
        expect(el('comparisonResults').style.display).toBe('none');
        expect(console.error).toHaveBeenCalled();
    });

    it('affiche les résultats pour deux aliments', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        selectAndCompare(cmp, 'poulet', 'riz');

        expect(el('comparisonResults').style.display).toBe('block');
        expect(el('header1').textContent).toBe('Poulet');
        expect(el('header2').textContent).toBe('Riz');
        expect(el('header3').style.display).toBe('none');
    });

    it('construit le graphique en barres empilées', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        selectAndCompare(cmp, 'poulet', 'riz');

        const instances = globalThis.Chart.instances;
        expect(instances).toHaveLength(1);
        const chart = instances[0];
        expect(chart.config.type).toBe('bar');
        expect(chart.config.data.labels).toEqual(['Poulet', 'Riz']);
        expect(chart.config.data.datasets.map((d) => d.label)).toEqual([
            'Protéines (g)', 'Glucides (g)', 'Lipides (g)', 'Fibres (g)',
        ]);
        expect(chart.config.data.datasets[0].data).toEqual([31, 7]);
        expect(chart.options.indexAxis).toBe('y');
    });

    it('détruit le graphique précédent avant d’en recréer un', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        selectAndCompare(cmp, 'poulet', 'riz');
        const first = globalThis.Chart.instances[0];
        selectAndCompare(cmp, 'poulet', 'pomme');
        expect(first.destroyed).toBe(true);
        expect(globalThis.Chart.instances).toHaveLength(2);
    });

    it('met à jour les cartes de résumé', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        selectAndCompare(cmp, 'poulet', 'riz');

        expect(el('bestOverall').textContent).toBe('Poulet'); // meilleur ratio P/calories
        expect(el('bestProtein').textContent).toBe('Poulet (31.0g)');
        expect(el('lowestCalorie').textContent).toBe('Poulet (165 kcal)');
        expect(el('bestPrice').textContent).toBe('Riz (0.30€/100g)');
    });

    it('affiche "Prix non renseigné" quand aucun aliment n’a de prix', async () => {
        const cmp = await loadComparison();
        cmp.initComparison({ a: simpleFood({ name: 'A' }), b: simpleFood({ name: 'B', calories: 50 }) });
        selectAndCompare(cmp, 'a', 'b');
        expect(el('bestPrice').textContent).toBe('Prix non renseigné');
    });

    it('remplit le tableau comparatif (6 nutriments + prix + ligne quantité)', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        selectAndCompare(cmp, 'poulet', 'riz');

        const tbody = el('comparisonTableBody');
        expect(tbody.querySelectorAll('tr')).toHaveLength(8);
        expect(tbody.querySelector('.reference-row')).toBeTruthy();
        expect(tbody.querySelector('.reference-row').textContent).toContain('100g');
        const labels = [...tbody.querySelectorAll('.metric-label')].map((n) => n.textContent);
        expect(labels.some((l) => l.includes('Calories'))).toBe(true);
        expect(labels.some((l) => l.includes('Prix'))).toBe(true);
    });

    it('affiche la troisième colonne quand un troisième aliment est choisi', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        selectAndCompare(cmp, 'poulet', 'riz', 'pomme');

        expect(el('header3').textContent).toBe('Pomme');
        expect(el('header3').style.display).toBe('');
        const chart = globalThis.Chart.instances[0];
        expect(chart.config.data.labels).toEqual(['Poulet', 'Riz', 'Pomme']);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modes d'ajustement
// ─────────────────────────────────────────────────────────────────────────────

describe('foodComparison — modes calories et prix', () => {
    it('mode 100g : les quantités de référence valent 100g', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        el('comparisonMode').value = '100g';
        selectAndCompare(cmp, 'poulet', 'riz');

        const ref = el('comparisonTableBody').querySelector('.reference-row');
        expect(ref.children[1].textContent).toBe('100g');
        expect(ref.children[2].textContent).toBe('100g');
        expect(el('comparisonChartTitle').textContent).toContain('100g');
    });

    it('mode calories : ramène chaque aliment à 200 kcal', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        el('comparisonMode').value = 'calories';
        selectAndCompare(cmp, 'poulet', 'riz');

        expect(el('comparisonChartTitle').textContent).toContain('200 kcal');
        const ref = el('comparisonTableBody').querySelector('.reference-row');
        expect(ref.children[1].textContent).toBe('121g'); // 200 / 165 × 100
        expect(ref.children[2].textContent).toBe('57g'); // 200 / 350 × 100
        const chart = globalThis.Chart.instances[0];
        expect(chart.config.data.datasets[0].data[0]).toBeCloseTo(200 / 165 * 31, 6);
    });

    it('mode prix : ramène chaque aliment à 2 €', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        el('comparisonMode').value = 'price';
        selectAndCompare(cmp, 'poulet', 'riz');

        expect(el('comparisonChartTitle').textContent).toContain('2€');
        const ref = el('comparisonTableBody').querySelector('.reference-row');
        // Poulet sans prix : non ajusté
        expect(ref.children[1].textContent).toBe('100g');
        // Riz : 0.30 €/100g → 2 € = 666.7 g
        expect(ref.children[2].textContent).toBe('667g');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Repas composés
// ─────────────────────────────────────────────────────────────────────────────

describe('foodComparison — repas composés', () => {
    it('normalise un repas composé sur 100 g', async () => {
        const cmp = await loadComparison();
        cmp.initComparison({ meal: composedMeal(), poulet: simpleFood() });
        selectAndCompare(cmp, 'meal', 'poulet');

        const chart = globalThis.Chart.instances[0];
        expect(chart.config.data.labels).toEqual(['Poulet riz', 'Poulet']);
        // composedMeal : 40 g de protéines pour 400 g → 10 g / 100 g
        expect(chart.config.data.datasets[0].data).toEqual([10, 31]);
        expect(chart.config.data.datasets[2].data).toEqual([2, 3.6]); // lipides 8 → 2
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// resetComparison / copie
// ─────────────────────────────────────────────────────────────────────────────

describe('foodComparison.resetComparison', () => {
    it('vide les sélections, cache les résultats et désactive le bouton', async () => {
        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        el('comparisonSearch1').value = 'pou';
        selectAndCompare(cmp, 'poulet', 'riz');
        expect(el('comparisonResults').style.display).toBe('block');

        cmp.resetComparison();

        expect(el('comparisonFood1').value).toBe('');
        expect(el('comparisonFood2').value).toBe('');
        expect(el('comparisonFood3').value).toBe('');
        expect(el('comparisonSearch1').value).toBe('');
        expect(el('comparisonSearch2').value).toBe('');
        expect(el('comparisonSearch3').value).toBe('');
        expect(el('comparisonResults').style.display).toBe('none');
        expect(el('compareBtn').disabled).toBe(true);
    });
});

describe('foodComparison — copie dans le presse-papier', () => {
    it('écrit un récapitulatif texte et affiche le feedback', async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });

        const cmp = await loadComparison();
        cmp.initComparison(FOODS());
        selectAndCompare(cmp, 'poulet', 'riz');
        el('copyComparisonBtn').click();

        await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
        const text = writeText.mock.calls[0][0];
        expect(text).toContain('COMPARAISON');
        expect(text).toContain('Poulet');
        expect(text).toContain('Riz');
        expect(text).toContain('0.30€/100g');
        expect(el('copyComparisonBtn').innerHTML).toContain('Copié');
    });
});
