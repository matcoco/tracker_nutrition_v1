// tests/unit/features-meals.test.js
// Tests de js/features/meals.js : calcul nutritionnel pur + intégration DOM/DB.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as db from '../../js/core/db.js';
import { loadAppDom, el } from '../helpers/dom.js';
import {
    simpleFood,
    pricedFood,
    legacyPricedFood,
    composedMeal,
    foodsFixture,
} from '../helpers/fixtures.js';

let meals;

beforeAll(async () => {
    loadAppDom();
    await db.initDB();
    meals = await import('../../js/features/meals.js');
});

beforeEach(async () => {
    loadAppDom();
    // Le module mémorise son initialisation : on repart d'un état vierge.
    meals.resetInitialization();
    await db.clearStore('meals');
    // Silence les notifications parasites dans la sortie
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateMealNutrition — fonction pure
// ─────────────────────────────────────────────────────────────────────────────

describe('meals.calculateMealNutrition — valeurs nutritionnelles', () => {
    const foods = foodsFixture();

    it('met à l’échelle les valeurs d’un aliment simple (pour 100 g)', () => {
        const totals = meals.calculateMealNutrition([{ foodId: 'poulet', weight: 200 }], foods);
        expect(totals.calories).toBeCloseTo(330, 6);
        expect(totals.proteins).toBeCloseTo(62, 6);
        expect(totals.carbs).toBeCloseTo(0, 6);
        expect(totals.fats).toBeCloseTo(7.2, 6);
    });

    it('additionne plusieurs ingrédients', () => {
        const totals = meals.calculateMealNutrition(
            [
                { foodId: 'poulet', weight: 100 },
                { foodId: 'riz', weight: 100 },
            ],
            foods
        );
        expect(totals.calories).toBeCloseTo(165 + 350, 6);
        expect(totals.proteins).toBeCloseTo(31 + 7, 6);
    });

    it('accepte des poids décimaux', () => {
        const totals = meals.calculateMealNutrition([{ foodId: 'poulet', weight: 50.5 }], foods);
        expect(totals.calories).toBeCloseTo(165 * 0.505, 6);
    });

    it('renvoie des zéros pour une liste d’ingrédients vide', () => {
        const totals = meals.calculateMealNutrition([], foods);
        expect(totals).toEqual({ calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, fibers: 0 });
    });

    it('ignore un ingrédient inconnu', () => {
        const totals = meals.calculateMealNutrition([{ foodId: 'inconnu', weight: 100 }], foods);
        expect(totals.calories).toBe(0);
    });

    it('ignore un ingrédient sans aliment correspondant mais garde les autres', () => {
        const totals = meals.calculateMealNutrition(
            [
                { foodId: 'inconnu', weight: 100 },
                { foodId: 'poulet', weight: 100 },
            ],
            foods
        );
        expect(totals.calories).toBeCloseTo(165, 6);
    });

    it('traite un poids absent ou nul comme zéro', () => {
        expect(meals.calculateMealNutrition([{ foodId: 'poulet' }], foods).calories).toBe(0);
        expect(meals.calculateMealNutrition([{ foodId: 'poulet', weight: 0 }], foods).calories).toBe(0);
    });

    it('traite les valeurs non numériques d’un aliment comme 0', () => {
        const custom = {
            x: { name: 'X', calories: 'abc', proteins: '10', carbs: null, fats: undefined, sugars: 1, fibers: 2 },
        };
        const totals = meals.calculateMealNutrition([{ foodId: 'x', weight: 100 }], custom);
        expect(totals.calories).toBe(0);
        expect(totals.proteins).toBe(10);
        expect(totals.sugars).toBe(1);
        expect(totals.fibers).toBe(2);
    });

    it('ne plante pas avec null/undefined en ingrédients', () => {
        // Corrigé : calculateMealNutrition() normalise désormais ses entrées.
        expect(meals.calculateMealNutrition(null, foods).calories).toBe(0);
        expect(meals.calculateMealNutrition(undefined, foods).calories).toBe(0);
    });

    it('ne plante pas avec une liste vide et des aliments null', () => {
        expect(meals.calculateMealNutrition([], null).calories).toBe(0);
    });
});

describe('meals.calculateMealNutrition — prix', () => {
    it('n’ajoute aucune information de prix sans prix connu', () => {
        const totals = meals.calculateMealNutrition([{ foodId: 'poulet', weight: 200 }], foodsFixture());
        expect(totals.price).toBeUndefined();
        expect(totals.priceQuantity).toBeUndefined();
    });

    it('calcule un prix au gramme (priceQuantity / priceUnit: grams)', () => {
        const totals = meals.calculateMealNutrition([{ foodId: 'riz', weight: 250 }], foodsFixture());
        // riz : 3 € pour 1000 g → 0.75 € pour 250 g
        expect(totals.price).toBeCloseTo(0.75, 6);
        expect(totals.priceQuantity).toBe(100);
        expect(totals.priceUnit).toBe('grams');
    });

    it('calcule un prix à l’ancien format priceGrams', () => {
        const foods = { pates: legacyPricedFood() };
        const totals = meals.calculateMealNutrition([{ foodId: 'pates', weight: 250 }], foods);
        // 2 € pour 500 g → 1.00 € pour 250 g
        expect(totals.price).toBeCloseTo(1, 6);
    });

    it('gère le format "portions" avec portionWeight', () => {
        const foods = {
            oeuf: { name: 'Œuf', calories: 70, price: 3, priceQuantity: 12, priceUnit: 'portions', portionWeight: 50 },
        };
        // 3 € pour 12 portions de 50 g = 600 g → 0.5 € pour 100 g
        const totals = meals.calculateMealNutrition([{ foodId: 'oeuf', weight: 100 }], foods);
        expect(totals.price).toBeCloseTo(0.5, 6);
    });

    it('utilise 100 g par portion par défaut si portionWeight est absent', () => {
        const foods = {
            oeuf: { name: 'Œuf', calories: 70, price: 3, priceQuantity: 12, priceUnit: 'portions' },
        };
        // 3 € pour 12 × 100 g = 1200 g → 0.25 € pour 100 g
        const totals = meals.calculateMealNutrition([{ foodId: 'oeuf', weight: 100 }], foods);
        expect(totals.price).toBeCloseTo(0.25, 6);
    });

    it('n’ajoute pas de prix quand priceQuantity/priceGrams sont absents', () => {
        const foods = { x: { name: 'X', calories: 100, price: 5 } };
        const totals = meals.calculateMealNutrition([{ foodId: 'x', weight: 100 }], foods);
        expect(totals.price).toBeUndefined();
    });

    it('additionne les prix de plusieurs ingrédients', () => {
        const totals = meals.calculateMealNutrition(
            [
                { foodId: 'riz', weight: 100 }, // 0.30
                { foodId: 'pates', weight: 100 }, // 0.40
            ],
            foodsFixture()
        );
        expect(totals.price).toBeCloseTo(0.7, 6);
    });

    it('documente un pricePer100g nul si priceUnit est inconnu (BUG CONNU)', () => {
        // BUG CONNU : avec priceQuantity mais un priceUnit != 'grams'/'portions',
        // aucun calcul n'est fait, hasPriceInfo reste vrai et un prix de 0 est exposé.
        const foods = { x: { name: 'X', calories: 100, price: 5, priceQuantity: 1000, priceUnit: 'litres' } };
        const totals = meals.calculateMealNutrition([{ foodId: 'x', weight: 100 }], foods);
        expect(totals.price).toBe(0);
        expect(totals.priceQuantity).toBe(100);
    });

    it('ignore un prix à 0 (falsy) plutôt que de l’exposer', () => {
        const foods = { x: { name: 'X', calories: 100, price: 0, priceQuantity: 1000, priceUnit: 'grams' } };
        const totals = meals.calculateMealNutrition([{ foodId: 'x', weight: 100 }], foods);
        expect(totals.price).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// initMeals / getMealsData / refreshMealsDisplay / reloadMeals / resetInitialization
// ─────────────────────────────────────────────────────────────────────────────

describe('meals.initMeals', () => {
    it('ne jette pas avec le vrai DOM et affiche les repas de la base', async () => {
        await db.saveMeal('poulet-riz', composedMeal());
        await expect(meals.initMeals(foodsFixture())).resolves.toBeUndefined();
        expect(document.querySelectorAll('.meal-item')).toHaveLength(1);
        expect(el('mealsListContainer').querySelector('.meal-name').textContent).toContain('Poulet riz');
    });

    it('affiche le message vide quand aucun repas n’existe', async () => {
        await meals.initMeals(foodsFixture());
        expect(el('mealsListContainer').textContent).toContain('Aucun repas créé pour le moment');
    });

    it('branche les écouteurs une seule fois et ne duplique pas les lignes (idempotent)', async () => {
        await db.saveMeal('poulet-riz', composedMeal());
        const addSpy = vi.spyOn(el('createMealBtn'), 'addEventListener');

        await meals.initMeals(foodsFixture());
        expect(addSpy).toHaveBeenCalledTimes(1);

        await meals.initMeals(foodsFixture());
        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.meal-item')).toHaveLength(1);
    });

    it('expose les repas chargés via getMealsData', async () => {
        await db.saveMeal('poulet-riz', composedMeal());
        await meals.initMeals(foodsFixture());
        expect(meals.getMealsData()).toHaveProperty('poulet-riz');
    });

    it('ouvre le formulaire au clic sur le bouton de création', async () => {
        await meals.initMeals(foodsFixture());
        el('createMealBtn').click();
        expect(el('mealFormSection').style.display).toBe('block');
        expect(el('mealFormTitle').textContent).toBe('Créer un nouveau repas');
        expect(document.querySelectorAll('.ingredient-row')).toHaveLength(1);
    });

    it('ferme le formulaire au clic sur Annuler', async () => {
        await meals.initMeals(foodsFixture());
        el('createMealBtn').click();
        expect(el('mealFormSection').style.display).toBe('block');
        el('cancelMealBtn').click();
        expect(el('mealFormSection').style.display).toBe('none');
    });
});

describe('meals.resetInitialization', () => {
    it('permet de rebrancher les écouteurs après réinitialisation', async () => {
        const addSpy = vi.spyOn(el('createMealBtn'), 'addEventListener');
        await meals.initMeals(foodsFixture());
        expect(addSpy).toHaveBeenCalledTimes(1);
        // Un second init sans reset ne rebranche rien
        await meals.initMeals(foodsFixture());
        expect(addSpy).toHaveBeenCalledTimes(1);
        // Après reset, le module rebranche
        meals.resetInitialization();
        await meals.initMeals(foodsFixture());
        expect(addSpy).toHaveBeenCalledTimes(2);
    });
});

describe('meals.refreshMealsDisplay', () => {
    it('affiche le dictionnaire fourni et le mémorise', () => {
        const custom = {
            a: composedMeal({ name: 'Recette A' }),
            b: composedMeal({ name: 'Recette B' }),
        };
        meals.refreshMealsDisplay(custom, foodsFixture());
        expect(document.querySelectorAll('.meal-item')).toHaveLength(2);
        expect(meals.getMealsData()).toBe(custom);
    });

    it('réutilise les données courantes si aucun dictionnaire n’est fourni', async () => {
        await meals.initMeals(foodsFixture());
        meals.refreshMealsDisplay(undefined, foodsFixture());
        // mealsData était vide → message vide
        expect(el('mealsListContainer').textContent).toContain('Aucun repas créé pour le moment');
    });

    it('ne fait rien si le conteneur est absent du DOM', () => {
        el('mealsListContainer').remove();
        expect(() => meals.refreshMealsDisplay({ a: composedMeal() }, foodsFixture())).not.toThrow();
    });

    it('affiche le prix et le badge AJUSTABLE pour un repas ajustable', () => {
        meals.refreshMealsDisplay({ 'poulet-riz': composedMeal() }, foodsFixture());
        const item = document.querySelector('.meal-item');
        expect(item.querySelector('.meal-badge')?.textContent).toBe('REPAS');
        expect(item.textContent).toContain('AJUSTABLE');
        expect(item.textContent).toContain('(valeurs TOTALES)');
        expect(item.textContent).toContain('400g');
    });

    it('affiche les valeurs pour 100 g pour un repas non ajustable', () => {
        const meal = composedMeal({ isPortionAdjustable: false, totalWeight: 500 });
        meals.refreshMealsDisplay({ m: meal }, foodsFixture());
        expect(document.querySelector('.meal-item').textContent).toContain('(valeurs pour 100g)');
    });

    it('affiche les ingrédients connus et ignore les inconnus', () => {
        const meal = composedMeal({
            ingredients: [
                { foodId: 'poulet', weight: 200 },
                { foodId: 'inconnu', weight: 50 },
            ],
        });
        meals.refreshMealsDisplay({ m: meal }, foodsFixture());
        const text = document.querySelector('.meal-ingredients').textContent;
        expect(text).toContain('Poulet (200g)');
        expect(text).not.toContain('inconnu');
    });

    it('filtre par recherche via le champ de recherche', async () => {
        await db.saveMeal('a', composedMeal({ name: 'Poulet riz' }));
        await db.saveMeal('b', composedMeal({ name: 'Salade verte' }));
        await meals.initMeals(foodsFixture());
        expect(document.querySelectorAll('.meal-item')).toHaveLength(2);

        el('mealSearchInput').value = 'salade';
        el('mealSearchInput').dispatchEvent(new Event('input'));
        expect(document.querySelectorAll('.meal-item')).toHaveLength(1);
        expect(document.querySelector('.meal-name').textContent).toContain('Salade verte');

        el('mealSearchInput').value = 'zzz';
        el('mealSearchInput').dispatchEvent(new Event('input'));
        expect(el('mealsListContainer').textContent).toContain('Aucun repas trouvé');
    });
});

describe('meals.reloadMeals', () => {
    it('recharge les repas depuis IndexedDB et met à jour mealsData', async () => {
        await db.saveMeal('a', composedMeal({ name: 'A' }));
        await db.saveMeal('b', composedMeal({ name: 'B' }));
        const loaded = await meals.reloadMeals();
        expect(Object.keys(loaded).sort()).toEqual(['a', 'b']);
        expect(meals.getMealsData()).toBe(loaded);
    });

    it('retourne un objet vide si aucun repas n’est stocké', async () => {
        await expect(meals.reloadMeals()).resolves.toEqual({});
    });
});

describe('meals — édition, duplication et suppression', () => {
    beforeEach(async () => {
        await db.saveMeal('poulet-riz', composedMeal());
        await meals.initMeals(foodsFixture());
    });

    it('pré-remplit le formulaire en mode édition', () => {
        document.querySelector('.meal-edit-btn').click();
        expect(el('mealFormTitle').textContent).toBe('Modifier le repas');
        expect(el('mealName').value).toBe('Poulet riz');
        expect(el('mealTotalWeight').value).toBe('400');
        expect(el('mealIsPortionAdjustable').checked).toBe(true);
        expect(document.querySelectorAll('.ingredient-row')).toHaveLength(2);
    });

    it('duplique un repas en mode création', () => {
        document.querySelector('.meal-duplicate-btn').click();
        expect(el('mealFormTitle').textContent).toBe('Créer un nouveau repas (copie)');
        expect(el('mealName').value).toBe('Poulet riz - Copie');
    });

    it('supprime un repas via la modal de confirmation', async () => {
        document.querySelector('.meal-delete-btn').click();
        expect(el('deleteMealModal').classList.contains('show')).toBe(true);
        expect(el('deleteMealName').textContent).toContain('Poulet riz');

        el('confirmDeleteMealBtn').click();
        await vi.waitFor(async () => {
            expect(await db.loadMeals()).toEqual({});
        });
        expect(el('deleteMealModal').classList.contains('show')).toBe(false);
        expect(document.querySelectorAll('.meal-item')).toHaveLength(0);
    });

    it('annule la suppression via la modal', async () => {
        document.querySelector('.meal-delete-btn').click();
        el('cancelDeleteMealBtn').click();
        expect(el('deleteMealModal').classList.contains('show')).toBe(false);
        expect(await db.loadMeals()).toHaveProperty('poulet-riz');
    });
});

describe('meals — création via le formulaire', () => {
    beforeEach(async () => {
        await meals.initMeals(foodsFixture());
        el('createMealBtn').click();
    });

    function fillIngredient(rowIndex, foodId, weight) {
        const row = document.querySelectorAll('.ingredient-row')[rowIndex];
        row.querySelector('.ingredient-select').value = foodId;
        row.querySelector('.ingredient-weight').value = String(weight);
        return row;
    }

    it('enregistre un repas non ajustable avec les valeurs pour 100 g', async () => {
        el('mealName').value = 'Ma Recette';
        fillIngredient(0, 'poulet', 200);
        el('mealTotalWeight').value = '200';
        el('mealIsPortionAdjustable').checked = false;

        el('mealForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        await vi.waitFor(async () => {
            expect(await db.loadMeals()).toHaveProperty('ma-recette');
        });
        const saved = (await db.loadMeals())['ma-recette'];
        expect(saved.name).toBe('Ma Recette');
        expect(saved.isPortionAdjustable).toBe(false);
        expect(saved.totalWeight).toBe(200);
        expect(saved.calories).toBeCloseTo(165, 6); // 330 kcal ramené sur 100 g
        expect(saved.proteins).toBeCloseTo(31, 6); // 62 g ramenés sur 100 g
        expect(saved.price).toBeUndefined();
        expect(saved.ingredients).toEqual([{ foodId: 'poulet', weight: 200 }]);
    });

    it('enregistre un repas ajustable avec les valeurs TOTALES de la recette', async () => {
        el('mealName').value = 'Riz complet';
        fillIngredient(0, 'riz', 200);
        el('mealTotalWeight').value = '200';
        el('mealIsPortionAdjustable').checked = true;

        el('mealForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        await vi.waitFor(async () => {
            expect(await db.loadMeals()).toHaveProperty('riz-complet');
        });
        const saved = (await db.loadMeals())['riz-complet'];
        expect(saved.calories).toBeCloseTo(700, 6); // 350 kcal/100 g × 200 g
        expect(saved.price).toBeCloseTo(0.6, 6);
        expect(saved.priceQuantity).toBe(200);
        expect(saved.priceUnit).toBe('grams');
    });

    it('refuse un repas sans nom', () => {
        el('mealName').value = '';
        el('mealForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        expect(document.querySelector('.notification').textContent).toContain('nom');
    });

    it('refuse un repas sans ingrédient valide', () => {
        el('mealName').value = 'Vide';
        // Aucune ligne renseignée : foodId vide et/ou poids 0
        document.querySelector('.ingredient-select').value = '';
        el('mealForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        expect(document.querySelector('.notification').textContent).toContain('ingrédient');
    });

    it('déduit le poids total des ingrédients si le champ est vide', async () => {
        el('mealName').value = 'Auto Poids';
        fillIngredient(0, 'poulet', 100);
        el('addIngredientBtn').click();
        fillIngredient(1, 'riz', 50);
        el('mealTotalWeight').value = '';

        el('mealForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        await vi.waitFor(async () => {
            expect(await db.loadMeals()).toHaveProperty('auto-poids');
        });
        const saved = (await db.loadMeals())['auto-poids'];
        expect(saved.totalWeight).toBe(150);
        expect(saved.ingredients).toEqual([
            { foodId: 'poulet', weight: 100 },
            { foodId: 'riz', weight: 50 },
        ]);
    });

    it('met à jour l’aperçu nutritionnel quand un ingrédient est renseigné', () => {
        fillIngredient(0, 'poulet', 100);
        document.querySelector('.ingredient-weight').dispatchEvent(new Event('input'));
        expect(el('mealNutritionPreview').textContent).toContain('kcal');
        expect(el('mealNutritionPreview').textContent).toContain('Protéines');
    });
});
