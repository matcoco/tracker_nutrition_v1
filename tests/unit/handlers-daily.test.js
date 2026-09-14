// tests/unit/handlers-daily.test.js
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadAppDom } from '../helpers/dom.js';
import { foodsFixture, dayFixture, goalsFixture } from '../helpers/fixtures.js';

let daily;
let db;
let state;

beforeAll(async () => {
    loadAppDom();                                  // doit précéder l'import de ui-core
    db = await import('../../js/core/db.js');
    state = (await import('../../js/core/state.js')).default;
    // ui-core met en cache les éléments du DOM à l'import : on le charge en premier.
    await import('../../js/ui/ui-core.js');
    daily = await import('../../js/handlers/daily-handlers.js');
    await db.initDB();

    if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn(() => Promise.resolve()) },
            configurable: true,
        });
    }
});

beforeEach(async () => {
    for (const s of ['foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps', 'dailyActivities']) {
        await db.clearStore(s);
    }
    state.currentDate = new Date(2026, 4, 15, 12, 0, 0);
    state.foods = foodsFixture();
    state.meals = {};
    state.goals = goalsFixture();
    state.activities = [];
    state.draggedFoodId = null;
    state.draggedMealItem = null;
});

function dropEvent(mealType) {
    const column = document.querySelector(`.meal-column[data-meal="${mealType}"]`);
    return { preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: column };
}

describe('generateMealItemId', () => {
    it('produit des identifiants uniques même appelé dans la même milliseconde', () => {
        const ids = new Set();
        for (let i = 0; i < 500; i++) ids.add(daily.generateMealItemId());
        expect(ids.size).toBe(500);
    });

    it('produit des identifiants croissants dans le temps', () => {
        const a = daily.generateMealItemId();
        const b = daily.generateMealItemId();
        expect(b).toBeGreaterThan(a);
    });
});

describe('handleQuickAdd', () => {
    it('ajoute un aliment simple au repas ciblé et persiste', async () => {
        const load = vi.fn();
        await daily.handleQuickAdd('poulet', 'dejeuner', load);

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner).toHaveLength(1);
        expect(meals.dejeuner[0].id).toBe('poulet');
        expect(meals.dejeuner[0].weight).toBe(100);
        expect(meals.dejeuner[0].uniqueId).toBeDefined();
        expect(load).toHaveBeenCalled();
    });

    it('ajoute un repas composé avec son poids de recette par défaut', async () => {
        state.meals = { 'poulet-riz': { name: 'Poulet riz', totalWeight: 400, isPortionAdjustable: true } };
        await daily.handleQuickAdd('poulet-riz', 'diner', vi.fn());

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.diner[0].isMeal).toBe(true);
        expect(meals.diner[0].weight).toBe(400);
    });

    it('utilise le poids de portion pour un aliment basé sur des portions', async () => {
        state.foods.oeuf = { name: 'Œuf', calories: 70, isPortionBased: true, portionWeight: 50 };
        await daily.handleQuickAdd('oeuf', 'petit-dej', vi.fn());

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals['petit-dej'][0].weight).toBe(50);
    });

    it('ne fait rien pour un identifiant inconnu', async () => {
        const load = vi.fn();
        await daily.handleQuickAdd('inconnu', 'dejeuner', load);
        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner).toHaveLength(0);
        expect(load).not.toHaveBeenCalled();
    });

    it('attribue des identifiants distincts à deux ajouts successifs', async () => {
        await daily.handleQuickAdd('poulet', 'dejeuner', vi.fn());
        await daily.handleQuickAdd('poulet', 'dejeuner', vi.fn());
        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner).toHaveLength(2);
        expect(meals.dejeuner[0].uniqueId).not.toBe(meals.dejeuner[1].uniqueId);
    });
});

describe('handleRemoveMealItem / handleUpdateWeight', () => {
    beforeEach(async () => {
        state.currentDate = new Date(2026, 4, 15, 12, 0, 0);
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [],
            dejeuner: [
                { id: 'poulet', weight: 100, uniqueId: 1 },
                { id: 'riz', weight: 200, uniqueId: 2 },
            ],
            diner: [], snack: [],
        });
    });

    it('supprime uniquement la ligne ciblée', async () => {
        await daily.handleRemoveMealItem('dejeuner', 1, vi.fn());
        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner).toHaveLength(1);
        expect(meals.dejeuner[0].id).toBe('riz');
    });

    it('supprime correctement même avec des identifiants de types différents', async () => {
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [], dejeuner: [{ id: 'poulet', weight: 100, uniqueId: 'abc' }], diner: [], snack: [],
        });
        await daily.handleRemoveMealItem('dejeuner', 'abc', vi.fn());
        expect((await db.loadDayMeals(state.currentDate)).dejeuner).toHaveLength(0);
    });

    it('met à jour le poids de la bonne ligne', async () => {
        await daily.handleUpdateWeight('dejeuner', 2, '250', vi.fn());
        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner.find((i) => i.uniqueId === 2).weight).toBe(250);
        expect(meals.dejeuner.find((i) => i.uniqueId === 1).weight).toBe(100);
    });

    it('conserve l’ancien poids si la nouvelle valeur est invalide', async () => {
        await daily.handleUpdateWeight('dejeuner', 2, 'abc', vi.fn());
        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner.find((i) => i.uniqueId === 2).weight).toBe(200);
    });

    it('ne lève pas pour un type de repas inconnu', async () => {
        await expect(daily.handleRemoveMealItem('collation', 1, vi.fn())).resolves.toBeUndefined();
        await expect(daily.handleUpdateWeight('collation', 1, 100, vi.fn())).resolves.toBeUndefined();
    });
});

describe('handleUpdateMealItemTime / handleUpdateMealTime', () => {
    beforeEach(async () => {
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [], dejeuner: [{ id: 'poulet', weight: 100, uniqueId: 1 }], diner: [], snack: [],
        });
    });

    it('change l’heure d’une seule ligne', async () => {
        await daily.handleUpdateMealItemTime('dejeuner', 1, '13:15', vi.fn());
        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner[0].time).toBe('13:15');
    });

    it('applique une heure à toutes les lignes d’un repas', async () => {
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [], dejeuner: [
                { id: 'poulet', weight: 100, uniqueId: 1 },
                { id: 'riz', weight: 100, uniqueId: 2 },
            ], diner: [], snack: [],
        });
        await daily.handleUpdateMealTime('dejeuner', '12:45', vi.fn());
        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner.every((i) => i.time === '12:45')).toBe(true);
    });

    it('ne lève pas pour un repas inconnu', async () => {
        await expect(daily.handleUpdateMealTime('collation', '12:00', vi.fn())).resolves.toBeUndefined();
    });
});

describe('handleDuplicateMealItem', () => {
    it('duplique la ligne avec un nouvel identifiant unique', async () => {
        const item = { id: 'poulet', weight: 150, uniqueId: 7 };
        await db.saveDayMeals(state.currentDate, { 'petit-dej': [], dejeuner: [item], diner: [], snack: [] });

        await daily.handleDuplicateMealItem('dejeuner', item, vi.fn());

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner).toHaveLength(2);
        expect(meals.dejeuner[1].id).toBe('poulet');
        expect(meals.dejeuner[1].weight).toBe(150);
        expect(meals.dejeuner[1].uniqueId).not.toBe(7);
    });

    it('duplique un repas composé en conservant ses portions personnalisées', async () => {
        state.meals = { 'poulet-riz': { name: 'Poulet riz', isPortionAdjustable: true, totalWeight: 400 } };
        const item = { id: 'poulet-riz', isMeal: true, weight: 200, uniqueId: 8, customPortions: { poulet: 100, riz: 100 } };
        await db.saveDayMeals(state.currentDate, { 'petit-dej': [], dejeuner: [item], diner: [], snack: [] });

        await daily.handleDuplicateMealItem('dejeuner', item, vi.fn());

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner[1].customPortions).toEqual({ poulet: 100, riz: 100 });
    });
});

describe('handleDrop', () => {
    it('déplace une ligne d’un repas vers un autre', async () => {
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [], dejeuner: [{ id: 'poulet', weight: 100, uniqueId: 1 }], diner: [], snack: [],
        });
        state.draggedMealItem = { sourceMeal: 'dejeuner', uniqueId: 1 };

        await daily.handleDrop(dropEvent('diner'), vi.fn());

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner).toHaveLength(0);
        expect(meals.diner).toHaveLength(1);
        expect(meals.diner[0].id).toBe('poulet');
    });

    it('ignore un dépôt sur le repas d’origine', async () => {
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [], dejeuner: [{ id: 'poulet', weight: 100, uniqueId: 1 }], diner: [], snack: [],
        });
        state.draggedMealItem = { sourceMeal: 'dejeuner', uniqueId: 1 };

        await daily.handleDrop(dropEvent('dejeuner'), vi.fn());

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner).toHaveLength(1);
    });

    it('ajoute un aliment glissé depuis la liste', async () => {
        state.draggedFoodId = 'poulet';
        await daily.handleDrop(dropEvent('dejeuner'), vi.fn());

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner).toHaveLength(1);
        expect(meals.dejeuner[0].id).toBe('poulet');
    });

    it('réinitialise l’état de glisser-déposer après le dépôt', async () => {
        state.draggedFoodId = 'poulet';
        await daily.handleDrop(dropEvent('dejeuner'), vi.fn());
        expect(state.draggedFoodId).toBeNull();
        expect(state.draggedMealItem).toBeNull();
    });

    it('ne lève pas si la ligne glissée n’existe plus', async () => {
        state.draggedMealItem = { sourceMeal: 'dejeuner', uniqueId: 999 };
        await expect(daily.handleDrop(dropEvent('diner'), vi.fn())).resolves.toBeUndefined();
    });
});

describe('hydratation', () => {
    it('additionne les ajouts d’eau et historise chaque apport', async () => {
        await daily.handleAddWater(250);
        await daily.handleAddWater(500);

        const water = await db.loadDayWater(state.currentDate);
        expect(water.totalMl).toBe(750);
        expect(water.history).toHaveLength(2);
        expect(water.history[0].ml).toBe(250);
    });

    it('refuse une quantité d’eau invalide', async () => {
        await daily.handleAddWater(NaN);
        await daily.handleAddWater(0);
        await daily.handleAddWater(-100);
        const water = await db.loadDayWater(state.currentDate);
        expect(water.totalMl).toBe(0);
    });

    it('réinitialise l’hydratation après confirmation', async () => {
        await daily.handleAddWater(500);
        globalThis.confirm = vi.fn(() => true);
        await daily.handleResetWater();
        const water = await db.loadDayWater(state.currentDate);
        expect(water.totalMl).toBe(0);
        expect(water.history).toEqual([]);
    });

    it('ne réinitialise pas si l’utilisateur refuse', async () => {
        await daily.handleAddWater(500);
        globalThis.confirm = vi.fn(() => false);
        await daily.handleResetWater();
        expect((await db.loadDayWater(state.currentDate)).totalMl).toBe(500);
    });
});

describe('pas', () => {
    it('enregistre un nombre de pas valide', async () => {
        document.getElementById('stepsInput').value = '8500';
        await daily.handleUpdateSteps();
        expect(await db.loadDaySteps(state.currentDate)).toBe(8500);
    });

    it('refuse une valeur de pas invalide ou négative', async () => {
        document.getElementById('stepsInput').value = 'abc';
        await daily.handleUpdateSteps();
        expect(await db.loadDaySteps(state.currentDate)).toBe(0);

        document.getElementById('stepsInput').value = '-10';
        await daily.handleUpdateSteps();
        expect(await db.loadDaySteps(state.currentDate)).toBe(0);
    });

    it('réinitialise les pas après confirmation', async () => {
        document.getElementById('stepsInput').value = '5000';
        await daily.handleUpdateSteps();
        globalThis.confirm = vi.fn(() => true);
        await daily.handleResetSteps();
        expect(await db.loadDaySteps(state.currentDate)).toBe(0);
    });
});

describe('poids, ventre, coucher, sommeil', () => {
    it('enregistre un poids valide et recalcule les objectifs', async () => {
        state.goals = {
            goalProfile: 'cut', sexe: 'homme', age: 30, weight: 80, taille: 180,
            activite: 1.55, adjustmentPercent: 0.2,
        };
        await db.saveGoals(state.goals);
        document.getElementById('weightInput').value = '78.5';

        await daily.handleSaveWeight(vi.fn());

        expect(await db.loadDayWeight(state.currentDate)).toBe(78.5);
        expect((await db.loadGoals()).weight).toBe(78.5);
    });

    it('efface le poids quand le champ est vidé', async () => {
        await db.saveDayWeight(state.currentDate, 80);
        document.getElementById('weightInput').value = '';

        await daily.handleSaveWeight(vi.fn());

        expect(await db.loadDayWeight(state.currentDate)).toBeNull();
    });

    it('refuse un poids négatif sans écraser la valeur existante', async () => {
        await db.saveDayWeight(state.currentDate, 80);
        // NB : un <input type="number"> rejette 'abc' (value devient ''), on teste donc -5.
        document.getElementById('weightInput').value = '-5';

        await daily.handleSaveWeight(vi.fn());

        expect(await db.loadDayWeight(state.currentDate)).toBe(80);
    });

    it('enregistre et efface le tour de ventre', async () => {
        document.getElementById('bellyInput').value = '84';
        await daily.handleSaveBelly();
        expect(await db.loadDayBelly(state.currentDate)).toBe(84);

        document.getElementById('bellyInput').value = '';
        await daily.handleSaveBelly();
        expect(await db.loadDayBelly(state.currentDate)).toBeNull();
    });

    it('enregistre et efface l’heure de coucher', async () => {
        document.getElementById('bedtimeInput').value = '23:10';
        await daily.handleSaveBedtime(vi.fn());
        expect(await db.loadDayBedtime(state.currentDate)).toBe('23:10');

        document.getElementById('bedtimeInput').value = '';
        await daily.handleSaveBedtime(vi.fn());
        expect(await db.loadDayBedtime(state.currentDate)).toBeNull();
    });

    it('convertit heures + minutes en durée décimale', async () => {
        document.getElementById('sleepDurationHoursInput').value = '7';
        document.getElementById('sleepDurationMinutesInput').value = '30';

        await daily.handleSaveSleepDuration(vi.fn());

        expect(await db.loadDaySleepDuration(state.currentDate)).toBe(7.5);
    });

    it('gère une durée avec heures vides', async () => {
        document.getElementById('sleepDurationHoursInput').value = '';
        document.getElementById('sleepDurationMinutesInput').value = '45';

        await daily.handleSaveSleepDuration(vi.fn());

        expect(await db.loadDaySleepDuration(state.currentDate)).toBe(0.75);
    });

    it('efface la durée quand les deux champs sont vides (sans enregistrer 0)', async () => {
        await db.saveDaySleepDuration(state.currentDate, 8);
        document.getElementById('sleepDurationHoursInput').value = '';
        document.getElementById('sleepDurationMinutesInput').value = '';

        await daily.handleSaveSleepDuration(vi.fn());

        expect(await db.loadDaySleepDuration(state.currentDate)).toBeNull();
    });

    it('refuse une durée de sommeil hors bornes', async () => {
        document.getElementById('sleepDurationHoursInput').value = '30';
        document.getElementById('sleepDurationMinutesInput').value = '0';

        await daily.handleSaveSleepDuration(vi.fn());

        expect(await db.loadDaySleepDuration(state.currentDate)).toBeNull();
    });
});

describe('résumé', () => {
    it('bascule l’état replié du résumé', () => {
        const content = document.getElementById('dailySummaryContent');
        const btn = document.getElementById('toggleSummaryBtn');
        content.classList.remove('collapsed');
        btn.classList.remove('expanded');

        daily.handleToggleSummary();

        expect(content.classList.contains('collapsed')).toBe(true);
        expect(btn.classList.contains('expanded')).toBe(true);

        daily.handleToggleSummary();
        expect(content.classList.contains('collapsed')).toBe(false);
    });

    it('copie le résumé dans le presse-papiers', async () => {
        const writeText = vi.fn(() => Promise.resolve());
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        await db.saveDayMeals(state.currentDate, dayFixture(), 70);

        await daily.handleCopySummary();

        expect(writeText).toHaveBeenCalledTimes(1);
        const texte = writeText.mock.calls[0][0];
        expect(typeof texte).toBe('string');
        expect(texte.length).toBeGreaterThan(0);
    });

    it('affiche une erreur si la copie échoue, sans lever', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn(() => Promise.reject(new Error('refus'))) },
            configurable: true,
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(daily.handleCopySummary()).resolves.toBeUndefined();
    });
});
