// tests/unit/data-backup-format.test.js
// Validation de sauvegarde, migration des objectifs historiques, et
// compatibilité réelle des sauvegardes du dossier divers/.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asArray, validateBackupPayload, planBackupImport } from '../../js/data/backup-format.js';
import * as db from '../../js/core/db.js';
import { loadAppDom } from '../helpers/dom.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(here, '../..');

const BACKUPS = {
    '2025-10-28': 'divers/nutrition-tracker-backup-2025-10-28.json',
    '2025-11-16': 'divers/nutrition-tracker-backup-2025-11-16.json',
    '2026-05-18': 'nutrition-tracker-backup-2026-05-18.json',
};

function readBackup(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8'));
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

    it('les sauvegardes réelles du projet préservent toutes les données de santé', () => {
        for (const [label, relativePath] of Object.entries(BACKUPS)) {
            const plan = planBackupImport(readBackup(relativePath));
            expect(plan.ok, label).toBe(true);
            // Aucune des trois sauvegardes ne contient healthEvents : il ne doit
            // jamais être vidé lors d'un import.
            expect(plan.preservedStores, label).toContain('healthEvents');
            expect(plan.storesToReplace, label).not.toContain('healthEvents');
            // Les fichiers contiennent bien ces stores : ils sont remplacés.
            expect(plan.storesToReplace, label).toContain('goals');
            expect(plan.storesToReplace, label).toContain('meals');
        }
    });
});

describe('compatibilité des sauvegardes réelles du projet', () => {
    it('les trois sauvegardes sont acceptées par l’import actuel', () => {
        for (const [label, relativePath] of Object.entries(BACKUPS)) {
            const data = readBackup(relativePath);
            const result = validateBackupPayload(data);
            expect(result.ok, `sauvegarde ${label} refusée : ${result.error}`).toBe(true);
            expect(result.foods.length, label).toBeGreaterThan(0);
            expect(result.dailyMeals.length, label).toBeGreaterThan(0);
        }
    });

    it('la sauvegarde d’octobre 2025 utilise bien l’ancien schéma d’objectifs', () => {
        const goals = readBackup(BACKUPS['2025-10-28']).goals;
        const objectifs = Array.isArray(goals) ? goals[0] : goals;
        expect(objectifs).toHaveProperty('deficitPercent');
        expect(objectifs.adjustmentPercent).toBeUndefined();
        expect(objectifs.goalProfile).toBeUndefined();
    });

    it('les sauvegardes plus récentes utilisent le schéma actuel', () => {
        for (const label of ['2025-11-16', '2026-05-18']) {
            const goals = readBackup(BACKUPS[label]).goals;
            const objectifs = Array.isArray(goals) ? goals[0] : goals;
            expect(objectifs.adjustmentPercent, label).toBeTypeOf('number');
            expect(objectifs.goalProfile, label).toBeTruthy();
        }
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
            const goals = readBackup(BACKUPS['2025-10-28']).goals;
            const objectifs = Array.isArray(goals) ? goals[0] : goals;

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
