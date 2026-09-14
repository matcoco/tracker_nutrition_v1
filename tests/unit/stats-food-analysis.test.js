// tests/unit/stats-food-analysis.test.js
// Tests unitaires de js/stats/food-analysis.js : analyse par aliment,
// tri, colonnes, copie presse-papier et export CSV.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { ChartStub } from '../setup/setup.js';
import * as db from '../../js/core/db.js';
import { calculateDayCost } from '../../js/core/utils.js';
import { foodsFixture, dayFixture } from '../helpers/fixtures.js';
import {
    updateFoodAnalysis,
    handleTableSort,
    toggleColumn,
    copyFoodAnalysisToClipboard,
    exportFoodAnalysisToCSV,
} from '../../js/stats/food-analysis.js';

const STORES = [
    'foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps',
    'dailyActivities', 'customActivities', 'healthEvents',
];

function todayNoon() {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
}

async function seedToday() {
    await db.saveDayMeals(todayNoon(), dayFixture(), 70);
}

function rows() {
    return [...el('foodAnalysisTableBody').querySelectorAll('tr')];
}

function rowFor(name) {
    return rows().find((row) => row.textContent.includes(name));
}

/** Installe un presse-papier factice (jsdom ne l'implémente pas). */
function installClipboard() {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        writable: true,
        value: { writeText },
    });
    return writeText;
}

/** Lit un Blob en texte (jsdom n'implémente pas Blob.prototype.text). */
function readBlobAsText(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
    });
}

beforeAll(async () => {
    await db.initDB();
});

beforeEach(async () => {
    loadAppDom();
    for (const store of STORES) {
        await db.clearStore(store);
    }
    await seedToday();
});

afterEach(() => {
    document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// updateFoodAnalysis
// ---------------------------------------------------------------------------
describe('foodAnalysis.updateFoodAnalysis — cartes de synthèse', () => {
    it('compte les aliments, le poids total et le coût total', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});

        expect(el('foodAnalysisTotalFoods').textContent).toBe('3');
        expect(el('foodAnalysisFoodsPeriod').textContent).toBe('7 derniers jours');

        // 150 g de pomme + 200 g de poulet + 100 g de riz = 450 g.
        expect(el('foodAnalysisTotalWeight').textContent).toBe('0.45 kg');
        expect(el('foodAnalysisWeightPeriod').textContent).toBe('7 derniers jours');

        expect(el('foodAnalysisTotalCost').textContent).toBe(`${calculateDayCost(dayFixture(), foodsFixture()).toFixed(2)} €`);
        expect(el('foodAnalysisCostPeriod').textContent).toBe('7 derniers jours');
    });

    it('adapte le libellé de période à 30 et 365 jours', async () => {
        await updateFoodAnalysis(30, foodsFixture(), {});
        expect(el('foodAnalysisFoodsPeriod').textContent).toBe('30 derniers jours');

        await updateFoodAnalysis(365, foodsFixture(), {});
        expect(el('foodAnalysisFoodsPeriod').textContent).toBe('365 derniers jours');
    });

    it('met à zéro les cartes sans données', async () => {
        await updateFoodAnalysis(7, {}, {});
        expect(el('foodAnalysisTotalFoods').textContent).toBe('0');
        expect(el('foodAnalysisTotalWeight').textContent).toBe('0.00 kg');
        expect(el('foodAnalysisTotalCost').textContent).toBe('0.00 €');
    });
});

describe('foodAnalysis.updateFoodAnalysis — tableau', () => {
    it('liste une ligne par aliment consommé', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        expect(rows()).toHaveLength(3);

        const lignePoulet = rowFor('Poulet');
        expect(lignePoulet).toBeTruthy();
        expect(lignePoulet.textContent).toContain('0.20 kg');
        expect(lignePoulet.textContent).toContain('62.0 g'); // 31 g / 100 g × 200 g
    });

    it('calcule le prix pour 100 g de protéines', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        // Riz : 3 €/kg => 0,30 €/100 g ; 7 g de protéines /100 g => 4,2857 €.
        const ligneRiz = rowFor('Riz');
        expect(ligneRiz.textContent).toContain('4.29 €');

        // Poulet sans prix : N/A.
        const lignePoulet = rowFor('Poulet');
        expect(lignePoulet.textContent).toContain('N/A');
    });

    it('affiche un message quand aucune donnée n’existe', async () => {
        await updateFoodAnalysis(7, {}, {});
        expect(el('foodAnalysisTableBody').textContent).toContain('Aucune donnée disponible');
        expect(rows()).toHaveLength(1);
    });

    it('cache par défaut les colonnes non cochées (fibres, sucres)', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        expect(document.querySelector('th[data-column="fibers"]').style.display).toBe('none');
        expect(document.querySelector('td[data-column="fibers"]').style.display).toBe('none');
        expect(document.querySelector('th[data-column="proteins"]').style.display).toBe('table-cell');
    });
});

describe('foodAnalysis.updateFoodAnalysis — graphiques', () => {
    it('crée les deux graphiques d’analyse', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});

        const weightChart = ChartStub.instances.find((c) => c.ctx && c.ctx.id === 'foodAnalysisWeightChart');
        const costChart = ChartStub.instances.find((c) => c.ctx && c.ctx.id === 'foodAnalysisCostChart');
        expect(weightChart).toBeTruthy();
        expect(costChart).toBeTruthy();
    });

    it('classe les aliments par poids décroissant', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        const weightChart = ChartStub.instances.find((c) => c.ctx && c.ctx.id === 'foodAnalysisWeightChart');
        expect(weightChart.data.labels).toEqual(['Poulet', 'Pomme', 'Riz']);
        expect(weightChart.data.datasets[0].data).toEqual(['0.20', '0.15', '0.10']);
    });

    it('classe les aliments par coût décroissant', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        const costChart = ChartStub.instances.find((c) => c.ctx && c.ctx.id === 'foodAnalysisCostChart');
        // Pomme 0,375 € puis riz 0,30 € puis poulet 0 €.
        expect(costChart.data.labels).toEqual(['Pomme', 'Riz', 'Poulet']);
        expect(costChart.data.datasets[0].data).toEqual(['0.38', '0.30', '0.00']);
    });

    it('détruit les graphiques précédents au second appel', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        const first = ChartStub.instances.slice();
        expect(first).toHaveLength(2);

        await updateFoodAnalysis(7, foodsFixture(), {});
        for (const instance of first) {
            expect(instance.destroyed).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// handleTableSort
// ---------------------------------------------------------------------------
describe('foodAnalysis.handleTableSort', () => {
    it('trie par poids décroissant puis croissant en alternant', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        handleTableSort('name'); // remet l'état de tri dans un état connu

        handleTableSort('weight');
        const thWeight = document.querySelector('[data-sort="weight"]');
        expect(thWeight.classList.contains('sorted-desc')).toBe(true);
        expect(rows()[0].textContent).toContain('Poulet'); // 200 g

        handleTableSort('weight');
        expect(thWeight.classList.contains('sorted-asc')).toBe(true);
        expect(rows()[0].textContent).toContain('Riz'); // 100 g
    });

    it('revient à un tri alphabétique croissant par défaut', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        handleTableSort('weight');
        handleTableSort('name');

        const thName = document.querySelector('[data-sort="name"]');
        expect(thName.classList.contains('sorted-asc')).toBe(true);
        expect(rows()[0].textContent).toContain('Pomme');
    });

    it('retire les classes de tri des autres colonnes', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        handleTableSort('cost');

        const sorted = [...document.querySelectorAll('.food-analysis-table th.sorted-asc, .food-analysis-table th.sorted-desc')];
        expect(sorted).toHaveLength(1);
        expect(sorted[0].dataset.sort).toBe('cost');
    });

    it('trie par coût décroissant', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        handleTableSort('name');
        handleTableSort('cost');

        expect(rows()[0].textContent).toContain('Pomme'); // 0,375 €
    });

    it('ne jette pas pour une colonne inconnue', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        expect(() => handleTableSort('colonne-inexistante')).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// toggleColumn
// ---------------------------------------------------------------------------
describe('foodAnalysis.toggleColumn', () => {
    it('masque puis réaffiche une colonne (en-têtes et cellules)', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});

        toggleColumn('proteins', false);
        expect(document.querySelector('th[data-column="proteins"]').style.display).toBe('none');
        expect(document.querySelector('td[data-column="proteins"]').style.display).toBe('none');

        toggleColumn('proteins', true);
        expect(document.querySelector('th[data-column="proteins"]').style.display).toBe('table-cell');
        expect(document.querySelector('td[data-column="proteins"]').style.display).toBe('table-cell');
    });

    it('ne jette pas pour une colonne absente du DOM', () => {
        expect(() => toggleColumn('inexistante', false)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// copyFoodAnalysisToClipboard
// ---------------------------------------------------------------------------
describe('foodAnalysis.copyFoodAnalysisToClipboard', () => {
    it('copie les colonnes visibles dans le presse-papier', async () => {
        const writeText = installClipboard();
        await updateFoodAnalysis(7, foodsFixture(), {});

        copyFoodAnalysisToClipboard();

        expect(writeText).toHaveBeenCalledTimes(1);
        const text = writeText.mock.calls[0][0];
        expect(text).toContain('Aliment\tPoids Total (kg)\tPrix Total (€)');
        expect(text).toContain('Protéines (g)');
        expect(text).toContain('Prix/100g prot (€)');
        expect(text).toContain('Poulet');
        // Fibres et sucres ne sont pas cochés par défaut.
        expect(text).not.toContain('Fibres (g)');
        expect(text).not.toContain('Sucres (g)');
    });

    it('inclut une colonne après activation', async () => {
        const writeText = installClipboard();
        await updateFoodAnalysis(7, foodsFixture(), {});
        document.querySelector('.column-toggle[data-column="fibers"]').checked = true;

        copyFoodAnalysisToClipboard();

        expect(writeText.mock.calls[0][0]).toContain('Fibres (g)');
    });

    it('alerte sans données et ne copie rien', async () => {
        const writeText = installClipboard();
        await updateFoodAnalysis(7, {}, {});

        copyFoodAnalysisToClipboard();

        expect(writeText).not.toHaveBeenCalled();
        expect(globalThis.alert).toHaveBeenCalledWith('Aucune donnée à copier');
    });

    it('alerte si l’écriture presse-papier échoue', async () => {
        const writeText = vi.fn(() => Promise.reject(new Error('refus')));
        Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value: { writeText } });
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        await updateFoodAnalysis(7, foodsFixture(), {});

        copyFoodAnalysisToClipboard();
        await Promise.resolve();
        await Promise.resolve();

        expect(consoleError).toHaveBeenCalled();
        expect(globalThis.alert).toHaveBeenCalledWith('Erreur lors de la copie');
    });
});

// ---------------------------------------------------------------------------
// exportFoodAnalysisToCSV
// ---------------------------------------------------------------------------
describe('foodAnalysis.exportFoodAnalysisToCSV', () => {
    it('génère et télécharge un CSV des colonnes visibles', async () => {
        await updateFoodAnalysis(7, foodsFixture(), {});
        const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-csv');
        const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const realCreateElement = document.createElement.bind(document);
        const anchors = [];
        vi.spyOn(document, 'createElement').mockImplementation((tag, ...rest) => {
            const created = realCreateElement(tag, ...rest);
            if (tag === 'a') anchors.push(created);
            return created;
        });

        exportFoodAnalysisToCSV();

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        const blob = createObjectURL.mock.calls[0][0];
        const csv = await readBlobAsText(blob);
        expect(csv.split('\n')[0]).toBe('Aliment,Poids Total (kg),Prix Total (€),Protéines (g),Glucides (g),Lipides (g),Prot/100g (g),Prix/100g prot (€)');
        expect(csv).toContain('"Poulet",0.20,0.00');
        expect(csv).toContain('"Riz",0.10,0.30,7.0,78.0,0.6,7.0,4.29');
        expect(csv).not.toContain('Fibres');

        expect(click).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-csv');
        expect(anchors).toHaveLength(1);
        expect(anchors[0].download).toMatch(/^analyse-aliments-7j-\d{4}-\d{2}-\d{2}\.csv$/);
        expect(anchors[0].href).toContain('blob:mock-csv');
    });

    it('alerte sans données et ne télécharge rien', async () => {
        await updateFoodAnalysis(7, {}, {});
        const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        exportFoodAnalysisToCSV();

        expect(globalThis.alert).toHaveBeenCalledWith('Aucune donnée à exporter');
        expect(createObjectURL).not.toHaveBeenCalled();
        expect(click).not.toHaveBeenCalled();
    });
});
