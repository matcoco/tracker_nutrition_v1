// tests/unit/core-misc.test.js
// Tests de js/config.js, js/core/state.js et js/core/db-utils.js

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { DB_NAME, DB_VERSION, defaultActivities, defaultFoods } from '../../js/config.js';
import state from '../../js/core/state.js';
import * as db from '../../js/core/db.js';
import * as dbUtils from '../../js/core/db-utils.js';
import { foodsFixture } from '../helpers/fixtures.js';

const STORES = ['foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps', 'dailyActivities', 'customActivities', 'healthEvents'];

describe('config.js', () => {
    it('expose un nom et une version de base de données', () => {
        expect(typeof DB_NAME).toBe('string');
        expect(DB_NAME.length).toBeGreaterThan(0);
        expect(Number.isInteger(DB_VERSION)).toBe(true);
    });

    it('expose une liste d’activités par défaut non vide et sans doublon', () => {
        expect(Array.isArray(defaultActivities)).toBe(true);
        expect(defaultActivities.length).toBeGreaterThan(0);
        expect(new Set(defaultActivities).size).toBe(defaultActivities.length);
    });

    it('defaultFoods est un objet (base vide au premier lancement)', () => {
        expect(typeof defaultFoods).toBe('object');
        expect(defaultFoods).not.toBeNull();
    });
});

describe('state.js — état global', () => {
    it('expose les clés attendues avec leurs valeurs par défaut', () => {
        for (const key of [
            'foods', 'meals', 'currentPeriod', 'currentAveragePeriod', 'currentCostPeriod',
            'currentActivityPeriod', 'currentFoodAnalysisPeriod', 'goals', 'activities',
            'customActivities', 'allActivities', 'selectedCategory', 'selectedCategoryManage',
        ]) {
            expect(state, `clé manquante : ${key}`).toHaveProperty(key);
        }
    });

    it('currentDate est une Date valide', () => {
        expect(state.currentDate).toBeInstanceOf(Date);
        expect(Number.isNaN(state.currentDate.getTime())).toBe(false);
    });

    it('les périodes par défaut sont des nombres ou des valeurs connues', () => {
        expect(state.currentPeriod).toBe(7);
        expect(state.currentAveragePeriod).toBe('week');
        expect(state.currentCostPeriod).toBe(7);
        expect(state.maxFoodsPerLoad).toBeGreaterThan(0);
    });

    it('le module expose un objet unique et mutable (singleton)', async () => {
        const again = (await import('../../js/core/state.js')).default;
        expect(again).toBe(state);
        again.selectedCategory = 'test-mutation';
        expect(state.selectedCategory).toBe('test-mutation');
        state.selectedCategory = 'all';
    });
});

describe('db-utils.js', () => {
    beforeAll(async () => { await db.initDB(); });
    beforeEach(async () => { for (const s of STORES) await db.clearStore(s); });

    describe('diagnoseBD', () => {
        beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

        it('compte les aliments et distingue ceux avec ou sans prix', async () => {
            await db.saveFood('avec-prix', { name: 'A', price: 3, priceGrams: 1000 });
            await db.saveFood('sans-prix', { name: 'B', calories: 100 });

            const result = await dbUtils.diagnoseBD();

            expect(result.total).toBe(2);
            expect(result.withPrice).toBe(1);
            expect(result.withoutPrice).toBe(1);
        });

        it('retourne un total de 0 sur une base vide', async () => {
            const result = await dbUtils.diagnoseBD();
            expect(result.total).toBe(0);
        });

        it('compte les aliments au format de prix ACTUEL comme ayant un prix', async () => {
            // L'ancienne implémentation ne regardait que `priceGrams` : tous les
            // aliments saisis via l'interface étaient comptés « sans prix ».
            await db.saveFood('nouveau', { name: 'Nouveau', price: 3, priceQuantity: 1000, priceUnit: 'grams' });
            await db.saveFood('portions', { name: 'Portions', price: 3, priceQuantity: 6, priceUnit: 'portions', portionWeight: 50 });
            await db.saveFood('ancien', { name: 'Ancien', price: 2, priceGrams: 500 });
            await db.saveFood('sans', { name: 'Sans' });

            const result = await dbUtils.diagnoseBD();

            expect(result.withPrice).toBe(3);
            expect(result.withoutPrice).toBe(1);
        });

        it('retourne null si la base n’est pas accessible', async () => {
            const spy = vi.spyOn(db, 'loadFoods').mockRejectedValueOnce(new Error('boom'));
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await dbUtils.diagnoseBD();
            expect(result).toBeNull();
            spy.mockRestore();
        });
    });

    describe('ajouterPrix', () => {
        beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

        it('écrit le format de prix actuel (priceQuantity + priceUnit)', async () => {
            await db.saveFood('poulet', { name: 'Poulet' });
            const ok = await dbUtils.ajouterPrix('poulet', '2.5', '1000');
            expect(ok).toBe(true);
            const foods = await db.loadFoods();
            expect(foods.poulet.price).toBe(2.5);
            expect(foods.poulet.priceQuantity).toBe(1000);
            expect(foods.poulet.priceUnit).toBe('grams');
            // L'ancien champ n'est plus écrit (il reste lu en secours).
            expect(foods.poulet.priceGrams).toBeUndefined();
        });

        it('supprime l’ancien champ priceGrams lors de la migration', async () => {
            await db.saveFood('poulet', { name: 'Poulet', price: 2, priceGrams: 500 });
            await dbUtils.ajouterPrix('poulet', 3, 1000);
            const foods = await db.loadFoods();
            expect(foods.poulet.priceQuantity).toBe(1000);
            expect(foods.poulet.priceGrams).toBeUndefined();
        });

        it('refuse un prix ou une quantité invalide', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            await db.saveFood('poulet', { name: 'Poulet' });
            expect(await dbUtils.ajouterPrix('poulet', 'abc', 1000)).toBe(false);
            expect(await dbUtils.ajouterPrix('poulet', 3, 0)).toBe(false);
            expect((await db.loadFoods()).poulet.price).toBeUndefined();
        });

        it('retourne false pour un aliment inconnu', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            expect(await dbUtils.ajouterPrix('inconnu', 1, 100)).toBe(false);
        });
    });

    describe('verifierIntegrite', () => {
        it('parcourt tous les stores sans lever', async () => {
            const log = vi.spyOn(console, 'log').mockImplementation(() => {});
            await expect(dbUtils.verifierIntegrite()).resolves.toBeUndefined();
            const messages = log.mock.calls.map((c) => c.join(' ')).join('\n');
            for (const store of ['foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps', 'dailyActivities', 'customActivities', 'healthEvents']) {
                expect(messages, store).toContain(store);
            }
        });
    });

    describe('ajouterChampsPrix', () => {
        beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

        it('ajoute les champs de prix du format actuel aux aliments qui en manquent', async () => {
            await db.saveFood('sans', { name: 'Sans' });
            await db.saveFood('complet', { name: 'Complet', price: 2, priceQuantity: 500, priceUnit: 'grams' });

            const result = await dbUtils.ajouterChampsPrix();

            expect(result.updated).toBe(1);
            expect(result.alreadyHad).toBe(1);
            const foods = await db.loadFoods();
            expect(foods.sans.price).toBeNull();
            expect(foods.sans.priceQuantity).toBeNull();
            expect(foods.sans.priceUnit).toBe('grams');
            expect(foods.complet.price).toBe(2);
            expect(foods.complet.priceQuantity).toBe(500);
        });

        it('n’écrase jamais un prix existant', async () => {
            await db.saveFood('poulet', { name: 'Poulet', price: 3, priceQuantity: 1000, priceUnit: 'grams' });
            await dbUtils.ajouterChampsPrix();
            const foods = await db.loadFoods();
            expect(foods.poulet.price).toBe(3);
            expect(foods.poulet.priceQuantity).toBe(1000);
        });

        it('tolère un aliment portant une clé hasOwnProperty', async () => {
            // L'appel direct `food.hasOwnProperty(...)` levait un TypeError.
            await db.saveFood('piege', { name: 'Piège', hasOwnProperty: 'valeur' });
            await expect(dbUtils.ajouterChampsPrix()).resolves.not.toBeNull();
        });
    });

    describe('mettreAJourPrixEnLot', () => {
        beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

        it('met à jour les prix existants et compte les aliments introuvables', async () => {
            await db.saveFood('a', { name: 'A' });
            const result = await dbUtils.mettreAJourPrixEnLot({
                a: { price: '1.5', priceGrams: '250' },
                inconnu: { price: 9, priceGrams: 100 },
            });
            expect(result).toEqual({ updated: 1, notFound: 1 });
            const foods = await db.loadFoods();
            expect(foods.a.price).toBe(1.5);
            expect(foods.a.priceQuantity).toBe(250);
            expect(foods.a.priceUnit).toBe('grams');
            expect(foods.a.priceGrams).toBeUndefined();
        });
    });

    describe('exporterAliments', () => {
        beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

        it('produit un tableau plat avec les champs attendus et déclenche un téléchargement', async () => {
            const click = vi.fn();
            vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
            vi.spyOn(console, 'table').mockImplementation(() => {});
            await db.saveFood('p', foodsFixture().poulet);

            const rows = await dbUtils.exporterAliments();

            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ id: 'p', name: 'Poulet', calories: 165 });
            expect(rows[0]).toHaveProperty('price');
            expect(click).toHaveBeenCalled();
        });

        it('retourne null en cas d’erreur', async () => {
            vi.spyOn(db, 'loadFoods').mockRejectedValueOnce(new Error('boom'));
            vi.spyOn(console, 'error').mockImplementation(() => {});
            expect(await dbUtils.exporterAliments()).toBeNull();
        });
    });

    it('expose les fonctions de diagnostic sur window', () => {
        expect(typeof window.dbDiagnose).toBe('function');
        expect(typeof window.dbCheck).toBe('function');
        expect(typeof window.dbExport).toBe('function');
        expect(typeof window.dbFixStructure).toBe('function');
        expect(typeof window.dbAddPrice).toBe('function');
        expect(typeof window.dbBulkPrices).toBe('function');
    });
});
