// tests/unit/data-import-export.test.js
// Tests de js/data/import-export.js (export sélectif, import de fichier, init UI).
//
// initImportExport() n'attache ses listeners qu'UNE seule fois (flag module
// isExportImportInitialized). On charge donc le DOM une seule fois (beforeAll)
// et on ne réinjecte plus le body ensuite : on se contente de remettre à zéro
// les conteneurs et les classes entre les tests.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import * as db from '../../js/core/db.js';
import { foodsFixture, composedMeal, simpleFood, pricedFood } from '../helpers/fixtures.js';

let ie;

beforeAll(async () => {
    loadAppDom();
    await db.initDB();
    ie = await import('../../js/data/import-export.js');
});

beforeEach(async () => {
    await db.clearStore('foods');
    await db.clearStore('meals');

    document.querySelectorAll('.notification').forEach((n) => n.remove());
    el('exportListContainer').innerHTML = '';
    el('exportModal').classList.remove('show');
    el('importFileInput').value = '';
    const selectAll = document.getElementById('selectAllExportBtn');
    if (selectAll) selectAll.textContent = '✓ Tout sélectionner';

    // Le test du <input type="file"> définit une propriété `files` sur l'instance.
    const fileInput = document.getElementById('importFileInput');
    if (fileInput && Object.prototype.hasOwnProperty.call(fileInput, 'files')) {
        delete fileInput.files;
    }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construit un File JSON comme le ferait un vrai import utilisateur. */
function makeFile(content) {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return new File([text], 'import.json', { type: 'application/json' });
}

/** Payload au format « sélectif » accepté par importFromFile. */
function selectivePayload(foods = {}, meals = {}) {
    return { version: '1.5.0', data: { foods, meals } };
}

/** Lit un Blob en texte (jsdom n'implémente pas Blob.prototype.text). */
function readBlobText(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Lecture du blob impossible'));
        reader.readAsText(blob);
    });
}

/**
 * Exécute exportSelectedItems en interceptant le Blob produit et le clic de
 * téléchargement. Renvoie { blob, download, href, link }.
 */
function runExport(run) {
    const captured = { blob: null, download: null, href: null, link: null };
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
        captured.blob = blob;
        return 'blob:test-url';
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
        captured.download = this.getAttribute('download');
        captured.href = this.getAttribute('href');
        captured.link = this;
    });
    try {
        run();
    } finally {
        createSpy.mockRestore();
        clickSpy.mockRestore();
    }
    return captured;
}

// ---------------------------------------------------------------------------
// exportSelectedItems
// ---------------------------------------------------------------------------

describe('import-export.exportSelectedItems', () => {
    it('exporte les aliments sélectionnés avec toutes les métadonnées', async () => {
        const captured = runExport(() => ie.exportSelectedItems(['poulet', 'riz'], [], foodsFixture(), {}));
        const payload = JSON.parse(await readBlobText(captured.blob));

        expect(payload.version).toBe('1.5.0');
        expect(payload.appName).toBe('Nutrition Tracker');
        expect(Number.isNaN(Date.parse(payload.exportDate))).toBe(false);
        expect(Object.keys(payload.data.foods).sort()).toEqual(['poulet', 'riz']);
        expect(payload.data.meals).toEqual({});
        expect(payload.metadata).toEqual({ totalFoods: 2, totalMeals: 0, autoDependencies: 0 });
        expect(payload.data.foods.poulet.calories).toBe(165);
        expect(captured.blob.type).toBe('application/json');
    });

    it('inclut automatiquement les aliments dépendances d’un repas', async () => {
        const foods = foodsFixture();
        const meals = { 'poulet-riz': composedMeal() };
        const captured = runExport(() => ie.exportSelectedItems([], ['poulet-riz'], foods, meals));
        const payload = JSON.parse(await readBlobText(captured.blob));

        expect(Object.keys(payload.data.meals)).toEqual(['poulet-riz']);
        expect(Object.keys(payload.data.foods).sort()).toEqual(['poulet', 'riz']);
        expect(payload.metadata.totalFoods).toBe(2);
        expect(payload.metadata.totalMeals).toBe(1);
        expect(payload.metadata.autoDependencies).toBe(2);
    });

    it('ne duplique pas un aliment déjà inclus comme dépendance', async () => {
        const captured = runExport(() =>
            ie.exportSelectedItems(['poulet'], ['poulet-riz'], foodsFixture(), { 'poulet-riz': composedMeal() })
        );
        const payload = JSON.parse(await readBlobText(captured.blob));

        expect(payload.metadata.totalFoods).toBe(2);
        expect(payload.metadata.autoDependencies).toBe(2);
        expect(Object.keys(payload.data.foods).sort()).toEqual(['poulet', 'riz']);
    });

    it('ignore les identifiants inconnus', async () => {
        const captured = runExport(() => ie.exportSelectedItems(['inconnu'], ['repas-inconnu'], foodsFixture(), {}));
        const payload = JSON.parse(await readBlobText(captured.blob));

        expect(payload.metadata.totalFoods).toBe(0);
        expect(payload.metadata.totalMeals).toBe(0);
        expect(payload.data.foods).toEqual({});
        expect(payload.data.meals).toEqual({});
    });

    it('déclenche le téléchargement d’un fichier JSON nommé puis retire l’ancre', () => {
        const captured = runExport(() => ie.exportSelectedItems(['poulet'], [], foodsFixture(), {}));

        expect(captured.href).toBe('blob:test-url');
        expect(captured.download).toMatch(/^nutrition-data-\d+\.json$/);
        expect(captured.link).not.toBeNull();
        // L'ancre temporaire a été retirée du DOM après le clic.
        expect(captured.link.isConnected).toBe(false);
        expect(captured.link.parentNode).toBeNull();
    });

    it('affiche une notification de succès avec le décompte', () => {
        runExport(() => ie.exportSelectedItems(['poulet', 'riz'], [], foodsFixture(), {}));
        const notif = document.querySelector('.notification');
        expect(notif).not.toBeNull();
        expect(notif.textContent).toContain('Export réussi');
        expect(notif.textContent).toContain('2 aliment(s) exporté(s)');
        expect(notif.textContent).toContain('0 repas exporté(s)');
    });

    it('mentionne les dépendances incluses automatiquement', () => {
        runExport(() => ie.exportSelectedItems([], ['poulet-riz'], foodsFixture(), { 'poulet-riz': composedMeal() }));
        const notif = document.querySelector('.notification');
        expect(notif.textContent).toContain('2 aliment(s) inclus automatiquement');
    });
});

// ---------------------------------------------------------------------------
// importFromFile
// ---------------------------------------------------------------------------

describe('import-export.importFromFile', () => {
    it('importe de nouveaux aliments et repas dans IndexedDB', async () => {
        const result = await ie.importFromFile(
            makeFile(selectivePayload({ poulet: simpleFood() }, { 'poulet-riz': composedMeal() })),
            {},
            {}
        );

        expect(result.foodsAdded).toBe(1);
        expect(result.mealsAdded).toBe(1);
        expect(result.foodsMatched).toBe(0);
        expect(result.foodsRenamed).toBe(0);
        expect(result.mealsIgnored).toBe(0);
        expect(result.details).toContainEqual({ type: 'food-added', name: 'Poulet' });
        expect(result.details).toContainEqual({ type: 'meal-added', name: 'Poulet riz' });

        const storedFoods = await db.loadFoods();
        expect(storedFoods.poulet.name).toBe('Poulet');
        const storedMeals = await db.loadMeals();
        expect(storedMeals['poulet-riz'].name).toBe('Poulet riz');
    });

    it('réutilise un aliment existant aux valeurs identiques', async () => {
        await db.saveFood('poulet', simpleFood());
        const result = await ie.importFromFile(
            makeFile(selectivePayload({ poulet: simpleFood() })),
            { poulet: simpleFood() },
            {}
        );

        expect(result.foodsAdded).toBe(0);
        expect(result.foodsMatched).toBe(1);
        expect(result.foodsRenamed).toBe(0);
        expect(result.details[0]).toEqual({ type: 'food-matched', name: 'Poulet' });
        expect(Object.keys(await db.loadFoods())).toEqual(['poulet']);
    });

    it('tolère un faible écart (≤ 0,1) entre deux aliments', async () => {
        const result = await ie.importFromFile(
            makeFile(selectivePayload({ poulet: simpleFood({ calories: 165.05 }) })),
            { poulet: simpleFood() },
            {}
        );
        expect(result.foodsMatched).toBe(1);
        expect(result.foodsRenamed).toBe(0);
    });

    it('renomme un aliment en conflit (valeurs différentes) avec un nouvel id', async () => {
        const result = await ie.importFromFile(
            makeFile(selectivePayload({ poulet: simpleFood() })),
            { poulet: simpleFood({ calories: 200 }) },
            {}
        );

        expect(result.foodsRenamed).toBe(1);
        expect(result.foodsMatched).toBe(0);
        expect(result.details[0]).toMatchObject({
            type: 'food-renamed',
            oldName: 'Poulet',
            newName: 'Poulet (importé)',
        });

        const stored = await db.loadFoods();
        const ids = Object.keys(stored);
        expect(ids).toHaveLength(1);
        expect(ids[0]).toMatch(/^poulet-imported-\d+$/);
        expect(stored[ids[0]].name).toBe('Poulet (importé)');
    });

    it('met à jour les références d’ingrédients quand un aliment est renommé', async () => {
        const existing = { poulet: simpleFood({ calories: 200 }), riz: pricedFood() };
        await ie.importFromFile(
            makeFile(selectivePayload({ poulet: simpleFood(), riz: pricedFood() }, { 'poulet-riz': composedMeal() })),
            existing,
            {}
        );

        const storedFoods = await db.loadFoods();
        const renamedId = Object.keys(storedFoods).find((id) => id.startsWith('poulet-imported-'));
        expect(renamedId).toBeTruthy();

        const storedMeals = await db.loadMeals();
        const ingredientIds = storedMeals['poulet-riz'].ingredients.map((i) => i.foodId);
        expect(ingredientIds).toContain(renamedId);
        expect(ingredientIds).not.toContain('poulet');
        expect(ingredientIds).toContain('riz');
    });

    it('ignore un repas déjà existant', async () => {
        const result = await ie.importFromFile(
            makeFile(selectivePayload({}, { 'poulet-riz': composedMeal() })),
            {},
            { 'poulet-riz': composedMeal() }
        );

        expect(result.mealsAdded).toBe(0);
        expect(result.mealsIgnored).toBe(1);
        expect(result.details[0]).toEqual({ type: 'meal-ignored', name: 'Poulet riz' });
        expect(await db.loadMeals()).toEqual({});
    });

    it('refuse une sauvegarde complète (format global)', async () => {
        await expect(ie.importFromFile(makeFile({ foods: {}, dailyMeals: {} }), {}, {})).rejects.toThrow(/sauvegarde complète/);
    });

    it('refuse un format non reconnu', async () => {
        await expect(ie.importFromFile(makeFile({ foo: 'bar' }), {}, {})).rejects.toThrow(/Format de fichier non reconnu/);
    });

    it('refuse un JSON invalide', async () => {
        await expect(ie.importFromFile(makeFile('{ ceci nest pas du json'), {}, {})).rejects.toBeInstanceOf(SyntaxError);
    });

    it('refuse un conteneur data.foods non objet', async () => {
        await expect(ie.importFromFile(makeFile({ data: { foods: 'nope', meals: {} } }), {}, {})).rejects.toThrow(/invalide/);
    });

    it('rejette quand le fichier n’est pas lisible', async () => {
        // jsdom lève un TypeError (d'un autre realm, donc on teste le message).
        await expect(ie.importFromFile({}, {}, {})).rejects.toThrow(/readAsText|Blob/);
    });

    it('ne modifie rien si le fichier est invalide', async () => {
        await expect(ie.importFromFile(makeFile({ foo: 'bar' }), {}, {})).rejects.toThrow();
        expect(await db.loadFoods()).toEqual({});
        expect(await db.loadMeals()).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// initImportExport
// ---------------------------------------------------------------------------

describe('import-export.initImportExport', () => {
    const foods = () => foodsFixture();
    const meals = () => ({ 'poulet-riz': composedMeal() });

    it('ouvre la modale d’export et liste les aliments', () => {
        ie.initImportExport(foods(), meals());
        el('exportDataBtn').click();

        expect(el('exportModal').classList.contains('show')).toBe(true);
        const items = el('exportListContainer').querySelectorAll('.export-item');
        expect(items).toHaveLength(4);
        const checkboxes = [...el('exportListContainer').querySelectorAll('.export-checkbox')];
        expect(checkboxes.map((cb) => cb.dataset.id)).toEqual(['poulet', 'riz', 'pates', 'pomme']);
        expect(checkboxes.every((cb) => cb.dataset.type === 'food')).toBe(true);
        expect(el('exportListContainer').textContent).toContain('Poulet');
    });

    it('bascule entre l’affichage des aliments et celui des repas', () => {
        ie.initImportExport(foods(), meals());
        el('exportDataBtn').click();

        // Aliments (état initial).
        let checkboxes = [...el('exportListContainer').querySelectorAll('.export-checkbox')];
        expect(checkboxes).toHaveLength(4);

        // Bascule vers les repas.
        const mealsToggle = el('exportModal').querySelector('.export-toggle-btn[data-mode="meals"]');
        mealsToggle.click();
        checkboxes = [...el('exportListContainer').querySelectorAll('.export-checkbox')];
        expect(checkboxes).toHaveLength(1);
        expect(checkboxes[0].dataset.id).toBe('poulet-riz');
        expect(checkboxes[0].dataset.type).toBe('meal');
        expect(mealsToggle.classList.contains('active')).toBe(true);
        // Les dépendances du repas sont annoncées.
        expect(el('exportListContainer').textContent).toContain('Poulet');
        expect(el('exportListContainer').textContent).toContain('Riz');

        // Retour aux aliments.
        el('exportModal').querySelector('.export-toggle-btn[data-mode="foods"]').click();
        checkboxes = [...el('exportListContainer').querySelectorAll('.export-checkbox')];
        expect(checkboxes).toHaveLength(4);
        expect(checkboxes.every((cb) => cb.dataset.type === 'food')).toBe(true);
    });

    it('coche puis décoche tous les éléments', () => {
        ie.initImportExport(foods(), meals());
        el('exportDataBtn').click();
        const selectAll = el('selectAllExportBtn');

        selectAll.click();
        let checkboxes = [...el('exportListContainer').querySelectorAll('.export-checkbox')];
        expect(checkboxes.every((cb) => cb.checked)).toBe(true);

        selectAll.click();
        checkboxes = [...el('exportListContainer').querySelectorAll('.export-checkbox')];
        expect(checkboxes.every((cb) => !cb.checked)).toBe(true);
    });

    it('refuse de confirmer un export sans sélection', () => {
        ie.initImportExport(foods(), meals());
        el('exportDataBtn').click();
        el('confirmExportBtn').click();

        const notif = document.querySelector('.notification');
        expect(notif).not.toBeNull();
        expect(notif.textContent).toContain('sélectionner au moins un élément');
        expect(notif.style.background).toBe('var(--gradient-danger)');
        // La modale reste ouverte.
        expect(el('exportModal').classList.contains('show')).toBe(true);
    });

    it('exporte les éléments cochés quand on confirme', async () => {
        ie.initImportExport(foods(), meals());
        el('exportDataBtn').click();
        el('exportListContainer').querySelector('.export-checkbox[data-id="poulet"]').checked = true;

        let blob = null;
        const createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
            blob = b;
            return 'blob:x';
        });
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        try {
            el('confirmExportBtn').click();
        } finally {
            createSpy.mockRestore();
            clickSpy.mockRestore();
        }

        const payload = JSON.parse(await readBlobText(blob));
        expect(Object.keys(payload.data.foods)).toEqual(['poulet']);
        expect(payload.data.meals).toEqual({});
        expect(el('exportModal').classList.contains('show')).toBe(false);
    });

    it('ouvre le sélecteur de fichier au clic sur « Importer »', () => {
        ie.initImportExport(foods(), meals());
        const clickSpy = vi.spyOn(el('importFileInput'), 'click').mockImplementation(() => {});
        el('importDataBtn').click();
        expect(clickSpy).toHaveBeenCalledTimes(1);
        clickSpy.mockRestore();
    });

    it('importe le fichier choisi et notifie l’erreur d’un fichier invalide', async () => {
        ie.initImportExport(foods(), meals());
        const input = el('importFileInput');
        const badFile = new File(['pas du json'], 'bad.json', { type: 'application/json' });
        Object.defineProperty(input, 'files', { value: [badFile], configurable: true });

        input.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(document.querySelector('.notification')).not.toBeNull();
        });
        expect(document.querySelector('.notification').textContent).toContain("Erreur lors de l'import");
        expect(input.value).toBe('');
    });
});
