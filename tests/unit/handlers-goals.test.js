// tests/unit/handlers-goals.test.js
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadAppDom } from '../helpers/dom.js';

let goalsHandlers;
let db;
let state;
let STORES = ['goals', 'dailyMeals', 'foods', 'meals'];

beforeAll(async () => {
    loadAppDom();
    db = await import('../../js/core/db.js');
    state = (await import('../../js/core/state.js')).default;
    goalsHandlers = await import('../../js/handlers/goals-handlers.js');
    await db.initDB();
});

beforeEach(async () => {
    for (const s of STORES) await db.clearStore(s);
    state.goals = null;
    state.currentDate = new Date(2026, 4, 15, 12, 0, 0);
    goalsHandlers.initGoalsHandlers({ loadCurrentDay: vi.fn() });
});

describe('calculateGoalsFromInputs — formule de Mifflin-St Jeor', () => {
    const base = { goalProfile: 'cut', sexe: 'homme', age: 30, weight: 80, taille: 180, activite: 1.55, adjustmentPercent: 0.2 };

    it('calcule le métabolisme de base homme', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs(base);
        expect(goals.mb).toBe(Math.round(10 * 80 + 6.25 * 180 - 5 * 30 + 5));
        expect(goals.mb).toBe(1780);
    });

    it('calcule le métabolisme de base femme', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs({ ...base, sexe: 'femme' });
        expect(goals.mb).toBe(Math.round(10 * 80 + 6.25 * 180 - 5 * 30 - 161));
    });

    it('applique le coefficient d’activité puis l’ajustement', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs(base);
        expect(goals.det).toBe(Math.round(1780 * 1.55));
        expect(goals.calories).toBe(Math.round(1780 * 1.55 * 0.8));
    });

    it('gère un ajustement négatif (surplus, profil prise de masse)', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs({ ...base, goalProfile: 'bulk', adjustmentPercent: -0.1 });
        expect(goals.calories).toBe(Math.round(1780 * 1.55 * 1.1));
    });

    it('applique les ratios de protéines et lipides propres à chaque profil', () => {
        const attendus = {
            cut: [2.2, 1.0], weightloss: [1.8, 0.9], bulk: [2.0, 1.1],
            maintenance: [1.6, 1.0], recomp: [2.4, 0.9],
        };
        for (const [profil, [pRatio, fRatio]] of Object.entries(attendus)) {
            const goals = goalsHandlers.calculateGoalsFromInputs({ ...base, goalProfile: profil });
            expect(goals.proteins, profil).toBe(Math.round(80 * pRatio));
            expect(goals.fats, profil).toBe(Math.round(80 * fRatio));
        }
    });

    it('déduit les glucides du reste des calories', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs(base);
        const attendu = Math.round((goals.calories - goals.proteins * 4 - goals.fats * 9) / 4);
        expect(goals.carbs).toBe(Math.max(attendu, 0));
    });

    it('ne produit jamais de glucides négatifs', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs({
            ...base, weight: 200, goalProfile: 'recomp', adjustmentPercent: 0.25,
        });
        expect(goals.carbs).toBeGreaterThanOrEqual(0);
    });
});

describe('calculateGoalsFromInputs — formule de Harris-Benedict', () => {
    it('calcule le MB homme avec la formule de Harris', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs({
            goalProfile: 'maintenance', bmrFormula: 'harris', sexe: 'homme',
            age: 30, weight: 80, taille: 180, activite: 1.55, adjustmentPercent: 0,
        });
        expect(goals.mb).toBe(Math.round(66.5 + 13.75 * 80 + 5.003 * 180 - 6.75 * 30));
        expect(goals.bmrFormula).toBe('harris');
    });

    it('calcule le MB femme avec la formule de Harris', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs({
            goalProfile: 'maintenance', bmrFormula: 'harris', sexe: 'femme',
            age: 30, weight: 80, taille: 180, activite: 1.55, adjustmentPercent: 0,
        });
        expect(goals.mb).toBe(Math.round(655.1 + 9.563 * 80 + 1.85 * 180 - 4.676 * 30));
    });

    it('retombe sur Mifflin si la formule est inconnue', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs({
            goalProfile: 'cut', bmrFormula: 'inconnue', sexe: 'homme',
            age: 30, weight: 80, taille: 180, activite: 1.55, adjustmentPercent: 0.2,
        });
        expect(goals.mb).toBe(1780);
        expect(goals.bmrFormula).toBe('mifflin');
    });
});

describe('calculateGoalsFromInputs — validation des saisies', () => {
    const base = { goalProfile: 'cut', sexe: 'homme', age: 30, weight: 80, taille: 180, activite: 1.55, adjustmentPercent: 0.2 };

    it('retourne null si un champ numérique est vide (NaN)', () => {
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, weight: NaN })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, age: NaN })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, taille: NaN })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, activite: NaN })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, adjustmentPercent: NaN })).toBeNull();
    });

    it('retourne null si un champ est absent ou indéfini', () => {
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, weight: undefined })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, age: undefined })).toBeNull();
    });

    it('retourne null si un champ vaut null, chaîne vide ou booléen', () => {
        // Number(null) et Number('') valent 0 : sans garde explicite, un champ
        // vide serait interprété comme 0 au lieu d'être refusé.
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, weight: null })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, weight: '' })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, age: null })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, activite: '' })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, taille: true })).toBeNull();
    });

    it('accepte les nombres fournis sous forme de chaînes', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs({
            ...base, age: '30', weight: '80', taille: '180', activite: '1.55', adjustmentPercent: '0.2',
        });
        expect(goals).not.toBeNull();
        expect(goals.mb).toBe(1780);
    });

    it('retourne null si le sexe n’est pas reconnu', () => {
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, sexe: 'autre' })).toBeNull();
        expect(goalsHandlers.calculateGoalsFromInputs({ ...base, sexe: undefined })).toBeNull();
    });

    it('ne produit jamais NaN dans les objectifs retournés', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs(base);
        for (const key of ['calories', 'proteins', 'carbs', 'fats', 'mb', 'det']) {
            expect(Number.isFinite(goals[key]), key).toBe(true);
        }
    });

    it('propage les objectifs bien-être avec leurs valeurs par défaut', () => {
        const goals = goalsHandlers.calculateGoalsFromInputs(base);
        expect(goals.waterGoal).toBe(2000);
        expect(goals.stepsGoal).toBe(10000);
        expect(goals.sugarsMax).toBe(25);
        expect(goals.fibersMin).toBe(25);

        const custom = goalsHandlers.calculateGoalsFromInputs({ ...base, waterGoal: 3000, stepsGoal: 12000 });
        expect(custom.waterGoal).toBe(3000);
        expect(custom.stepsGoal).toBe(12000);
    });
});

describe('handleSaveMacros / handleSaveWellness', () => {
    it('enregistre les macros et recalcule les calories', async () => {
        state.goals = { calories: 2000, proteins: 100, carbs: 200, fats: 60 };
        document.getElementById('goalProteinsInput').value = '150';
        document.getElementById('goalCarbsInput').value = '180';
        document.getElementById('goalFatsInput').value = '70';

        await goalsHandlers.handleSaveMacros();

        const stored = await db.loadGoals();
        expect(stored.proteins).toBe(150);
        expect(stored.calories).toBe(150 * 4 + 180 * 4 + 70 * 9);
        expect(stored.calories).toBe(1950);
    });

    it('refuse des macros invalides sans écrire en base', async () => {
        state.goals = { calories: 2000, proteins: 100, carbs: 200, fats: 60 };
        await db.saveGoals(state.goals);
        document.getElementById('goalProteinsInput').value = '';
        document.getElementById('goalCarbsInput').value = '180';
        document.getElementById('goalFatsInput').value = '70';

        await goalsHandlers.handleSaveMacros();

        const stored = await db.loadGoals();
        expect(stored.proteins).toBe(100);
    });

    it('met à jour les objectifs bien-être', async () => {
        state.goals = { calories: 2000, proteins: 100, carbs: 200, fats: 60 };
        await db.saveGoals(state.goals);
        document.getElementById('goalWaterEditInput').value = '2500';
        document.getElementById('goalStepsEditInput').value = '11000';

        await goalsHandlers.handleSaveWellness();

        const stored = await db.loadGoals();
        expect(stored.waterGoal).toBe(2500);
        expect(stored.stepsGoal).toBe(11000);
    });

    it('refuse un objectif d’eau sous le minimum', async () => {
        state.goals = { calories: 2000 };
        await db.saveGoals(state.goals);
        document.getElementById('goalWaterEditInput').value = '100';
        document.getElementById('goalStepsEditInput').value = '11000';

        await goalsHandlers.handleSaveWellness();

        const stored = await db.loadGoals();
        expect(stored.waterGoal).toBeUndefined();
    });
});

describe('handleEditMacros / handleCancelMacrosEdit / bien-être', () => {
    it('bascule l’affichage des macros en mode édition puis retour', () => {
        goalsHandlers.handleEditMacros();
        expect(document.getElementById('macroEditActions').style.display).toBe('block');
        expect(document.getElementById('editMacrosBtn').style.display).toBe('none');

        goalsHandlers.handleCancelMacrosEdit();
        expect(document.getElementById('macroEditActions').style.display).toBe('none');
        expect(document.getElementById('editMacrosBtn').style.display).toBe('inline-block');
    });

    it('bascule l’affichage du bien-être en mode édition puis retour', () => {
        goalsHandlers.handleEditWellness();
        expect(document.getElementById('wellnessEditActions').style.display).toBe('block');

        goalsHandlers.handleCancelWellnessEdit();
        expect(document.getElementById('wellnessEditActions').style.display).toBe('none');
    });
});

describe('updateGoalsWeight', () => {
    it('retourne null si aucun objectif n’est défini', async () => {
        state.goals = null;
        expect(await goalsHandlers.updateGoalsWeight(75)).toBeNull();
    });

    it('retourne null pour un poids invalide', async () => {
        state.goals = { goalProfile: 'cut', sexe: 'homme', age: 30, weight: 80, taille: 180, activite: 1.55, adjustmentPercent: 0.2 };
        expect(await goalsHandlers.updateGoalsWeight(0)).toBeNull();
        expect(await goalsHandlers.updateGoalsWeight(-5)).toBeNull();
        expect(await goalsHandlers.updateGoalsWeight(null)).toBeNull();
    });

    it('recalcule et enregistre les objectifs pour un nouveau poids', async () => {
        state.goals = { goalProfile: 'cut', sexe: 'homme', age: 30, weight: 80, taille: 180, activite: 1.55, adjustmentPercent: 0.2 };
        await db.saveGoals(state.goals);

        const goals = await goalsHandlers.updateGoalsWeight(75);

        expect(goals.weight).toBe(75);
        expect(goals.mb).toBe(Math.round(10 * 75 + 6.25 * 180 - 5 * 30 + 5));
        const stored = await db.loadGoals();
        expect(stored.weight).toBe(75);
    });

    it('retourne null sans lever si les objectifs stockés sont incomplets', async () => {
        state.goals = { goalProfile: 'cut' };
        expect(await goalsHandlers.updateGoalsWeight(75)).toBeNull();
    });
});
