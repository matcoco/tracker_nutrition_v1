// tests/unit/data-backup-format.test.js
// Validation de sauvegarde, planification d'import et migration des objectifs
// historiques.
//
// Les sauvegardes personnelles ne sont volontairement PAS versionnées : les
// tests s'appuient sur des sauvegardes SYNTHÉTIQUES reproduisant fidèlement
// les schémas rencontrés (actuel et hérité). Si une sauvegarde réelle est
// présente localement, quelques tests supplémentaires s'exécutent.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asArray, validateBackupPayload, planBackupImport } from '../../js/data/backup-format.js';
import * as db from '../../js/core/db.js';
import { loadAppDom } from '../helpers/dom.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(here, '../..');

/**
 * Sauvegarde synthétique au schéma ACTUEL (v1.6) : les objectifs portent
 * `goalProfile` et `adjustmentPercent`.
 */
function currentSchemaBackup() {
    return {
        version: '1.6.0',
        exportDate: '2026-01-15T10:00:00.000Z',
        foods: [
            { id: 'poulet', name: 'Poulet', category: 'proteins', calories: 165, proteins: 31, carbs: 0, sugars: 0, fibers: 0, fats: 3.6, price: 12.9, priceQuantity: 1000, priceUnit: 'grams' },
            { id: 'riz', name: 'Riz', category: 'starches', calories: 350, proteins: 7, carbs: 78, sugars: 0.1, fibers: 1.3, fats: 0.6, price: 3, priceQuantity: 1000, priceUnit: 'grams' },
        ],
        meals: [
            { id: 'poulet-riz', name: 'Poulet riz', totalWeight: 400, isPortionAdjustable: true, calories: 400, proteins: 40, carbs: 50, fats: 8, sugars: 1, fibers: 2, price: 5, priceQuantity: 400, priceUnit: 'grams', ingredients: [{ foodId: 'poulet', weight: 200 }, { foodId: 'riz', weight: 200 }] },
        ],
        dailyMeals: [
            { date: '2026-01-14', meals: { 'petit-dej': [], dejeuner: [{ id: 'poulet', weight: 150, uniqueId: 1 }], diner: [], snack: [] }, weight: 80, belly: null, bedtime: null, sleepDuration: null, events: [], calorieGoal: 2100, proteinGoal: 160, carbGoal: 200, fatGoal: 70 },
            { date: '2026-01-15', meals: { 'petit-dej': [], dejeuner: [], diner: [{ id: 'riz', weight: 100, uniqueId: 2 }], snack: [] }, weight: 79.8, belly: null, bedtime: null, sleepDuration: null, events: [], calorieGoal: 2100, proteinGoal: 160, carbGoal: 200, fatGoal: 70 },
        ],
        goals: [{ id: 'current', calories: 2100, proteins: 160, carbs: 200, fats: 70, goalProfile: 'cut', sexe: 'homme', age: 40, weight: 80, taille: 177, activite: 1.55, adjustmentPercent: 0.2, waterGoal: 2000, stepsGoal: 10000, sugarsMax: 25, fibersMin: 25 }],
        dailyWater: [{ date: '2026-01-15', totalMl: 1500, history: [] }],
        dailySteps: [{ date: '2026-01-15', steps: 8500 }],
        dailyActivities: [{ date: '2026-01-15', activities: [{ id: 1, type: '🚶 Marche', time: '08:00', duration: 45, calories: 250 }] }],
        customActivities: [],
        healthEvents: [],
    };
}

/**
 * Sauvegarde synthétique au schéma HÉRITÉ (avant novembre 2025) :
 * `deficitPercent` au lieu de `adjustmentPercent`, pas de `goalProfile`,
 * et des lignes de repas au format `foodId`/`uid`.
 */
function legacySchemaBackup() {
    const backup = currentSchemaBackup();
    backup.version = '1.4.0';
    backup.exportDate = '2025-10-28T10:00:00.000Z';
    delete backup.healthEvents;
    backup.goals = [{ id: 'current', calories: 2186, proteins: 171, carbs: 200, fats: 78, mb: 1690, det: 2916, sexe: 'homme', age: 40, weight: 77.9, taille: 177, activite: 1.725, deficitPercent: 0.25, waterGoal: 2000, stepsGoal: 10000, sugarsMax: 50, fibersMin: 25 }];
    backup.dailyMeals = backup.dailyMeals.map((day, index) => ({
        ...day,
        meals: {
            'petit-dej': [],
            dejeuner: [{ foodId: index === 0 ? 'poulet' : 'riz', uid: `uid-${index}`, weight: 120, time: '12:30' }],
            diner: [],
            snack: [],
        },
    }));
    return backup;
}

/** Sauvegardes de test, indexées par étiquette. */
const BACKUPS = {
    'schema actuel': currentSchemaBackup,
    'schema hérité': legacySchemaBackup,
};

// Sauvegardes personnelles éventuellement présentes localement (non versionnées).
const LOCAL_BACKUP_DIRS = [PROJECT_ROOT, path.join(PROJECT_ROOT, 'divers')];

/** Liste les sauvegardes réelles trouvées sur le disque, s'il y en a. */
function localBackups() {
    const found = [];
    for (const dir of LOCAL_BACKUP_DIRS) {
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
            if (/^nutrition-tracker-backup-.*\.json$/.test(name)) {
                found.push({ label: name, fullPath: path.join(dir, name) });
            }
        }
    }
    return found;
}

describe('backup-format.asArray', () => {
    it('renvoie le tableau tel quel', () => {
        expect(asArray([1, 2])).toEqual([1, 2]);
    });

    it('convertit un dictionnaire en tableau de valeurs', () => {
        expect(asArray({ a: 1, b: 2 })).toEqual([1, 2]);
    });

    it('renvoie null pour les valeurs non exploitables', () => {
        expect(asArray(null)).toBeNull();
        expect(asArray(undefined)).toBeNull();
        expect(asArray('texte')).toBeNull();
        expect(asArray(42)).toBeNull();
        expect(asArray(true)).toBeNull();
    });
});

describe('backup-format.validateBackupPayload', () => {
    const journee = { date: '2026-01-01', meals: { 'petit-dej': [], dejeuner: [], diner: [], snack: [] } };
    const aliment = { id: 'poulet', name: 'Poulet', calories: 165 };

    it('accepte une sauvegarde minimale valide', () => {
        const result = validateBackupPayload({ foods: [aliment], dailyMeals: [journee] });
        expect(result.ok).toBe(true);
        expect(result.foods).toHaveLength(1);
        expect(result.dailyMeals).toHaveLength(1);
    });

    it('accepte les anciens exports où foods est un dictionnaire, en rétablissant l’id depuis la clé', () => {
        const result = validateBackupPayload({ foods: { poulet: { name: 'Poulet' } }, dailyMeals: [journee] });
        expect(result.ok).toBe(true);
        expect(result.foods).toEqual([{ name: 'Poulet', id: 'poulet' }]);
    });

    it('accepte les anciens exports où dailyMeals est un dictionnaire, en rétablissant la date', () => {
        const result = validateBackupPayload({
            foods: [aliment],
            dailyMeals: { '2026-01-01': { meals: { 'petit-dej': [], dejeuner: [], diner: [], snack: [] } } },
        });
        expect(result.ok).toBe(true);
        expect(result.dailyMeals[0].date).toBe('2026-01-01');
    });

    it('ne remplace pas un id existant lors de la conversion d’un dictionnaire', () => {
        const result = validateBackupPayload({
            foods: { cle: { id: 'identifiant-interne', name: 'X' } },
            dailyMeals: [journee],
        });
        expect(result.foods[0].id).toBe('identifiant-interne');
    });

    it('refuse un contenu qui n’est pas un objet', () => {
        for (const value of [null, undefined, 'texte', 42, [1, 2, 3]]) {
            const result = validateBackupPayload(value);
            expect(result.ok, JSON.stringify(value)).toBe(false);
            expect(result.error).toBeTruthy();
        }
    });

    it('refuse une sauvegarde sans foods ou sans dailyMeals', () => {
        expect(validateBackupPayload({ dailyMeals: [journee] }).ok).toBe(false);
        expect(validateBackupPayload({ foods: [aliment] }).ok).toBe(false);
    });

    it('refuse une journée sans date exploitable', () => {
        const result = validateBackupPayload({ foods: [aliment], dailyMeals: [journee, { meals: {} }] });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/date exploitable/);

        const result2 = validateBackupPayload({ foods: [aliment], dailyMeals: [{ date: '' }] });
        expect(result2.ok).toBe(false);
    });

    it('refuse un aliment sans identifiant', () => {
        const result = validateBackupPayload({ foods: [{ name: 'Poulet' }], dailyMeals: [journee] });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/identifiant/);
    });

    it('refuse un partage d’aliments/repas (ce n’est pas une sauvegarde)', () => {
        const result = validateBackupPayload({
            appName: 'Nutrition Tracker',
            data: { foods: [aliment] },
            foods: [aliment],
            dailyMeals: [journee],
        });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/partage/i);
    });

    it('accepte une sauvegarde sans dailyMeals vide', () => {
        expect(validateBackupPayload({ foods: [], dailyMeals: [] }).ok).toBe(true);
    });
});

describe('backup-format.planBackupImport', () => {
    const journee = { date: '2026-01-01', meals: {} };
    const aliment = { id: 'poulet', name: 'Poulet' };

    it('remplace les stores présents et préserve les stores absents', () => {
        const plan = planBackupImport({
            foods: [aliment],
            dailyMeals: [journee],
            goals: [{ id: 'current', calories: 2000 }],
        });

        expect(plan.ok).toBe(true);
        expect(plan.storesToReplace).toContain('foods');
        expect(plan.storesToReplace).toContain('dailyMeals');
        expect(plan.storesToReplace).toContain('goals');
        // Absents du fichier -> conservés
        expect(plan.storesToReplace).not.toContain('healthEvents');
        expect(plan.preservedStores).toContain('healthEvents');
        expect(plan.preservedStores).toContain('meals');
        expect(plan.preservedStores).toContain('dailyWater');
    });

    it('remplace un store présent mais vide (le fichier fait foi)', () => {
        const plan = planBackupImport({ foods: [aliment], dailyMeals: [journee], healthEvents: [] });
        expect(plan.storesToReplace).toContain('healthEvents');
        expect(plan.preservedStores).not.toContain('healthEvents');
        expect(plan.optional.healthEvents).toEqual([]);
    });

    it('propage les erreurs de validation', () => {
        const plan = planBackupImport({ foods: [aliment] });
        expect(plan.ok).toBe(false);
        expect(plan.error).toBeTruthy();
        expect(plan.storesToReplace).toBeUndefined();
    });

    it('couvre les 7 stores optionnels du schéma', () => {
        const plan = planBackupImport({ foods: [aliment], dailyMeals: [journee] });
        expect(plan.preservedStores.sort()).toEqual([
            'customActivities', 'dailyActivities', 'dailySteps', 'dailyWater', 'goals', 'healthEvents', 'meals',
        ]);
    });

    it('une sauvegarde SANS healthEvents ne provoque jamais sa suppression', () => {
        // Cas le plus important : les sauvegardes antérieures à la v1.6 ne
        // contiennent pas `healthEvents`. L'import doit conserver l'existant.
        const plan = planBackupImport(legacySchemaBackup());
        expect(plan.ok).toBe(true);
        expect(plan.preservedStores).toContain('healthEvents');
        expect(plan.storesToReplace).not.toContain('healthEvents');
    });

    it('une sauvegarde AVEC healthEvents (même vide) remplace le store', () => {
        const plan = planBackupImport(currentSchemaBackup());
        expect(plan.ok).toBe(true);
        expect(plan.storesToReplace).toContain('healthEvents');
        expect(plan.preservedStores).not.toContain('healthEvents');
    });

    it('les deux schémas remplacent bien les stores qu’ils contiennent', () => {
        for (const [label, fabrique] of Object.entries(BACKUPS)) {
            const plan = planBackupImport(fabrique());
            expect(plan.storesToReplace, label).toContain('goals');
            expect(plan.storesToReplace, label).toContain('meals');
            expect(plan.storesToReplace, label).toContain('foods');
            expect(plan.storesToReplace, label).toContain('dailyMeals');
        }
    });
});

describe('compatibilité des sauvegardes (schémas actuel et hérité)', () => {
    it('les sauvegardes des deux schémas sont acceptées par l’import actuel', () => {
        for (const [label, fabrique] of Object.entries(BACKUPS)) {
            const data = fabrique();
            const result = validateBackupPayload(data);
            expect(result.ok, `sauvegarde ${label} refusée : ${result.error}`).toBe(true);
            expect(result.foods.length, label).toBeGreaterThan(0);
            expect(result.dailyMeals.length, label).toBeGreaterThan(0);
        }
    });

    it('le schéma hérité utilise bien l’ancien nom d’ajustement calorique', () => {
        const objectifs = legacySchemaBackup().goals[0];
        expect(objectifs).toHaveProperty('deficitPercent');
        expect(objectifs.adjustmentPercent).toBeUndefined();
        expect(objectifs.goalProfile).toBeUndefined();
    });

    it('le schéma actuel utilise adjustmentPercent et goalProfile', () => {
        const objectifs = currentSchemaBackup().goals[0];
        expect(objectifs.adjustmentPercent).toBeTypeOf('number');
        expect(objectifs.goalProfile).toBeTruthy();
    });

    it('le schéma hérité contient des lignes de repas au format foodId/uid', () => {
        const lignes = legacySchemaBackup().dailyMeals.flatMap((day) => Object.values(day.meals).flat());
        expect(lignes.length).toBeGreaterThan(0);
        expect(lignes.every((ligne) => ligne.id === undefined && ligne.foodId !== undefined)).toBe(true);
        expect(lignes.every((ligne) => ligne.uniqueId === undefined && ligne.uid !== undefined)).toBe(true);
    });

    it('les sauvegardes personnelles ne sont pas versionnées', () => {
        // Garde-fou de confidentialité : aucun fichier de sauvegarde ne doit
        // être suivi par Git (le dépôt est public).
        const suivi = localBackups().filter(({ label }) => label.includes('backup'));
        expect(Array.isArray(suivi)).toBe(true);
        // Le test réel est fait par `git ls-files` dans docs-consistency.test.js.
    });
});

describe('migration des objectifs historiques', () => {
    beforeAll(async () => { await db.initDB(); });
    beforeEach(async () => { await db.clearStore('goals'); });

    describe('normalizeLegacyGoals (fonction pure)', () => {
        it('renvoie null pour une entrée invalide', () => {
            expect(db.normalizeLegacyGoals(null)).toBeNull();
            expect(db.normalizeLegacyGoals(undefined)).toBeNull();
            expect(db.normalizeLegacyGoals('texte')).toBeNull();
        });

        it('renvoie null quand les objectifs sont déjà au format actuel', () => {
            const actuel = {
                goalProfile: 'cut', adjustmentPercent: 0.2, sexe: 'homme', age: 40,
                weight: 80, taille: 177, activite: 1.55,
                waterGoal: 2000, stepsGoal: 10000, sugarsMax: 25, fibersMin: 25,
            };
            expect(db.normalizeLegacyGoals(actuel)).toBeNull();
        });

        it('renomme deficitPercent en adjustmentPercent', () => {
            const migrated = db.normalizeLegacyGoals({ deficitPercent: 0.25, sexe: 'homme' });
            expect(migrated.adjustmentPercent).toBe(0.25);
            expect(migrated).not.toHaveProperty('deficitPercent');
        });

        it('déduit le profil d’objectif à partir de l’ajustement', () => {
            expect(db.normalizeLegacyGoals({ adjustmentPercent: 0.25 }).goalProfile).toBe('cut');
            expect(db.normalizeLegacyGoals({ adjustmentPercent: 0.2 }).goalProfile).toBe('cut');
            expect(db.normalizeLegacyGoals({ adjustmentPercent: 0.1 }).goalProfile).toBe('weightloss');
            expect(db.normalizeLegacyGoals({ adjustmentPercent: 0 }).goalProfile).toBe('maintenance');
            expect(db.normalizeLegacyGoals({ adjustmentPercent: 0.02 }).goalProfile).toBe('maintenance');
            expect(db.normalizeLegacyGoals({ adjustmentPercent: -0.1 }).goalProfile).toBe('bulk');
        });

        it('corrige un profil d’objectif inconnu', () => {
            const migrated = db.normalizeLegacyGoals({ goalProfile: 'profil-inexistant', adjustmentPercent: 0.2 });
            expect(migrated.goalProfile).toBe('cut');
        });

        it('complète les objectifs bien-être manquants sans écraser les existants', () => {
            const migrated = db.normalizeLegacyGoals({ adjustmentPercent: 0.1, sugarsMax: 50, waterGoal: 2500 });
            expect(migrated.sugarsMax).toBe(50);
            expect(migrated.waterGoal).toBe(2500);
            expect(migrated.stepsGoal).toBe(10000);
            expect(migrated.fibersMin).toBe(25);
        });

        it('supprime les champs numériques corrompus', () => {
            const migrated = db.normalizeLegacyGoals({
                adjustmentPercent: 0.2, goalProfile: 'cut', age: 'beaucoup', weight: null, taille: 177,
            });
            expect(migrated).not.toHaveProperty('age');
            expect(migrated).not.toHaveProperty('weight');
            expect(migrated.taille).toBe(177);
        });
    });

    describe('migrateLegacyGoals (persistance)', () => {
        it('ne fait rien quand aucun objectif n’est enregistré', async () => {
            expect(await db.migrateLegacyGoals()).toBeNull();
        });

        it('ne réécrit pas des objectifs déjà au format actuel', async () => {
            const actuel = {
                goalProfile: 'cut', adjustmentPercent: 0.2, sexe: 'homme', age: 40,
                weight: 80, taille: 177, activite: 1.55,
                waterGoal: 2000, stepsGoal: 10000, sugarsMax: 25, fibersMin: 25,
            };
            await db.saveGoals(actuel);
            expect(await db.migrateLegacyGoals()).toBeNull();
        });

        it('migre et persiste les objectifs hérités', async () => {
            await db.saveGoals({
                calories: 2186, proteins: 171, carbs: 200, fats: 78, mb: 1690, det: 2916,
                sexe: 'homme', age: 40, weight: 77.9, taille: 177, activite: 1.725,
                deficitPercent: 0.25, waterGoal: 2000, stepsGoal: 10000, sugarsMax: 50, fibersMin: 25,
            });

            const migrated = await db.migrateLegacyGoals();
            expect(migrated.goalProfile).toBe('cut');
            expect(migrated.adjustmentPercent).toBe(0.25);

            const stored = await db.loadGoals();
            expect(stored.goalProfile).toBe('cut');
            expect(stored.adjustmentPercent).toBe(0.25);
            expect(stored).not.toHaveProperty('deficitPercent');
        });

        it('est idempotente', async () => {
            await db.saveGoals({ deficitPercent: 0.25, sexe: 'homme', ajustement: true });
            expect(await db.migrateLegacyGoals()).not.toBeNull();
            expect(await db.migrateLegacyGoals()).toBeNull();
        });
    });

    describe('réparation de bout en bout : les objectifs migrés redeviennent calculables', () => {
        let calculateGoalsFromInputs;

        beforeAll(async () => {
            loadAppDom();
            ({ calculateGoalsFromInputs } = await import('../../js/handlers/goals-handlers.js'));
        });

        it('un profil d’octobre 2025 permet à nouveau de recalculer les objectifs', async () => {
            const objectifs = legacySchemaBackup().goals[0];

            // Sans migration, les champs requis manquent.
            expect(calculateGoalsFromInputs({ ...objectifs, weight: 77.9 })).toBeNull();

            const migrated = db.normalizeLegacyGoals(objectifs);
            const recalcules = calculateGoalsFromInputs({ ...migrated, weight: 77.9 });

            expect(recalcules).not.toBeNull();
            expect(Number.isFinite(recalcules.calories)).toBe(true);
            expect(recalcules.calories).toBeGreaterThan(0);
            expect(recalcules.goalProfile).toBe('cut');
        });
    });
});

describe('sauvegardes personnelles présentes localement (optionnel)', () => {
    const locales = localBackups();

    it.skipIf(locales.length === 0)('une sauvegarde réelle est acceptée par l’import', () => {
        for (const { label, fullPath } of locales) {
            const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            const result = validateBackupPayload(data);
            expect(result.ok, `${label} refusée : ${result.error}`).toBe(true);
        }
    });
});
