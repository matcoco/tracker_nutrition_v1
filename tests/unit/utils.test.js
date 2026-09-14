// tests/unit/utils.test.js
import { describe, it, expect } from 'vitest';
import {
    formatDateKey,
    formatDateDisplay,
    calculateMealItemNutrition,
    calculateDayTotals,
    calculateMealTotals,
    generateFoodId,
    calculateMealItemCost,
    calculateDayCost,
    calculateCostsByMeal,
} from '../../js/core/utils.js';
import {
    simpleFood,
    pricedFood,
    legacyPricedFood,
    composedMeal,
    foodsFixture,
    dayFixture,
    localDate,
} from '../helpers/fixtures.js';

describe('utils.formatDateKey', () => {
    it('formate une date locale en YYYY-MM-DD avec zéro de remplissage', () => {
        expect(formatDateKey(localDate(2026, 1, 5))).toBe('2026-01-05');
        expect(formatDateKey(localDate(2026, 12, 31))).toBe('2026-12-31');
    });

    it('utilise la date LOCALE et non UTC (pas de décalage de jour)', () => {
        // 1er janvier à 00:30 local : toISOString() donnerait le 31/12 en France
        const d = new Date(2026, 0, 1, 0, 30, 0);
        expect(formatDateKey(d)).toBe('2026-01-01');
    });
});

describe('utils.formatDateDisplay', () => {
    it('produit une date française lisible', () => {
        const result = formatDateDisplay(localDate(2026, 2, 3));
        expect(result).toContain('2026');
        expect(result).toContain('février');
        expect(result).toContain('3');
    });
});

describe('utils.generateFoodId', () => {
    it('normalise casse, espaces et accents', () => {
        expect(generateFoodId('Poulet Rôti')).toBe('poulet-roti');
        expect(generateFoodId('  Crème   fraîche ')).toBe('creme-fraiche');
        expect(generateFoodId('Œufs brouillés')).toBe('ufs-brouilles');
    });

    it('supprime la ponctuation et les apostrophes', () => {
        expect(generateFoodId("Lait d'amande")).toBe('lait-damande');
        expect(generateFoodId('Yaourt (nature)')).toBe('yaourt-nature');
    });

    it('renvoie une chaîne vide pour une entrée vide ou absente', () => {
        expect(generateFoodId('')).toBe('');
        expect(generateFoodId(null)).toBe('');
        expect(generateFoodId(undefined)).toBe('');
        expect(generateFoodId('   ')).toBe('');
    });

    it('produit le même identifiant pour des noms équivalents', () => {
        expect(generateFoodId('Filet de Poulet')).toBe(generateFoodId('filet de poulet'));
    });
});

describe('utils.calculateMealItemNutrition — aliment simple (pour 100 g)', () => {
    const foods = foodsFixture();

    it('met à l’échelle les valeurs selon le poids consommé', () => {
        const totals = calculateMealItemNutrition({ id: 'poulet', weight: 200 }, foods);
        expect(totals.calories).toBeCloseTo(330, 6);
        expect(totals.proteins).toBeCloseTo(62, 6);
        expect(totals.fats).toBeCloseTo(7.2, 6);
    });

    it('gère un poids décimal', () => {
        const totals = calculateMealItemNutrition({ id: 'poulet', weight: 50.5 }, foods);
        expect(totals.calories).toBeCloseTo(165 * 0.505, 6);
    });

    it('retourne des zéros pour un poids nul ou absent', () => {
        expect(calculateMealItemNutrition({ id: 'poulet' }, foods).calories).toBe(0);
        expect(calculateMealItemNutrition({ id: 'poulet', weight: 0 }, foods).calories).toBe(0);
    });

    it('retourne des zéros si l’aliment est inconnu', () => {
        const totals = calculateMealItemNutrition({ id: 'inconnu', weight: 100 }, foods);
        expect(totals).toEqual({ calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, fibers: 0 });
    });

    it('ne plante pas sur des entrées invalides', () => {
        expect(calculateMealItemNutrition(null, foods).calories).toBe(0);
        expect(calculateMealItemNutrition({ id: 'poulet', weight: 100 }, null).calories).toBe(0);
    });

    it('traite les valeurs manquantes de l’aliment comme 0', () => {
        const foods2 = { minimal: { name: 'X' } };
        const totals = calculateMealItemNutrition({ id: 'minimal', weight: 100 }, foods2);
        expect(totals.calories).toBe(0);
        expect(Number.isNaN(totals.proteins)).toBe(false);
    });

    it('ignore les valeurs textuelles non numériques', () => {
        const foods2 = { x: { calories: 'abc', proteins: '10', carbs: null, fats: undefined, sugars: 1, fibers: 2 } };
        const totals = calculateMealItemNutrition({ id: 'x', weight: 100 }, foods2);
        expect(totals.calories).toBe(0);
        expect(totals.proteins).toBe(10);
        expect(totals.carbs).toBe(0);
        expect(totals.fats).toBe(0);
    });
});

describe('utils.calculateMealItemNutrition — repas composé ajustable', () => {
    const foods = foodsFixture();
    const meals = { 'poulet-riz': composedMeal() };

    it('applique le ratio poids consommé / poids total de la recette', () => {
        const totals = calculateMealItemNutrition(
            { id: 'poulet-riz', isMeal: true, weight: 200 },
            foods,
            meals
        );
        expect(totals.calories).toBeCloseTo(200, 6);
        expect(totals.proteins).toBeCloseTo(20, 6);
    });

    it('renvoie la recette entière quand le poids consommé est absent', () => {
        const totals = calculateMealItemNutrition({ id: 'poulet-riz', isMeal: true }, foods, meals);
        expect(totals.calories).toBeCloseTo(400, 6);
    });

    it('retombe sur les aliments simples si le repas composé est absent', () => {
        const totals = calculateMealItemNutrition({ id: 'poulet', weight: 100 }, foods, {});
        expect(totals.calories).toBeCloseTo(165, 6);
    });
});

describe('utils.calculateMealItemNutrition — repas composé avec portions personnalisées', () => {
    const foods = foodsFixture();

    it('recalcule à partir des ingrédients et des portions personnalisées', () => {
        const meals = { 'poulet-riz': composedMeal({ totalWeight: 400 }) };
        const item = {
            id: 'poulet-riz',
            isMeal: true,
            weight: 400,
            customPortions: { poulet: 100, riz: 300 },
        };
        const totals = calculateMealItemNutrition(item, foods, meals);
        // poulet 100 g = 165 kcal ; riz 300 g = 1050 kcal
        expect(totals.calories).toBeCloseTo(1215, 6);
        expect(totals.proteins).toBeCloseTo(31 + 21, 6);
    });

    it('met à l’échelle la recette personnalisée selon le poids consommé', () => {
        const meals = { 'poulet-riz': composedMeal({ totalWeight: 400 }) };
        const item = {
            id: 'poulet-riz',
            isMeal: true,
            weight: 200,
            customPortions: { poulet: 100, riz: 300 },
        };
        const totals = calculateMealItemNutrition(item, foods, meals);
        expect(totals.calories).toBeCloseTo(1215 / 2, 6);
    });

    it('ignore les ingrédients à poids nul', () => {
        const meals = { 'poulet-riz': composedMeal({ totalWeight: 400 }) };
        const item = {
            id: 'poulet-riz',
            isMeal: true,
            weight: 400,
            customPortions: { poulet: 0, riz: 0 },
        };
        const totals = calculateMealItemNutrition(item, foods, meals);
        expect(totals.calories).toBe(0);
    });
});

describe('utils.calculateDayTotals & calculateMealTotals', () => {
    const foods = foodsFixture();

    it('additionne toutes les catégories de repas', () => {
        const totals = calculateDayTotals(dayFixture(), foods);
        // pomme 150 g : 78 kcal ; poulet 200 g : 330 kcal ; riz 100 g : 350 kcal
        expect(totals.calories).toBeCloseTo(52 * 1.5 + 330 + 350, 6);
    });

    it('ignore les entrées non-tableaux', () => {
        const totals = calculateDayTotals({ dejeuner: 'pas un tableau' }, foods);
        expect(totals.calories).toBe(0);
    });

    it('renvoie des zéros pour des entrées invalides', () => {
        expect(calculateDayTotals(null, foods).calories).toBe(0);
        expect(calculateDayTotals(dayFixture(), null).calories).toBe(0);
        expect(calculateMealTotals(null, foods).calories).toBe(0);
    });

    it('donne le même résultat qu’un calcul manuel repas par repas', () => {
        const meals = dayFixture();
        const parRepas = Object.values(meals)
            .map((items) => calculateMealTotals(items, foods).calories)
            .reduce((a, b) => a + b, 0);
        expect(calculateDayTotals(meals, foods).calories).toBeCloseTo(parRepas, 6);
    });
});

describe('utils.calculateMealItemCost', () => {
    const foods = foodsFixture();

    it('accepte un prix personnalisé tel quel', () => {
        expect(calculateMealItemCost({ id: 'poulet', weight: 100, customPrice: 3.5 }, foods)).toBe(3.5);
    });

    it('accepte un prix personnalisé à zéro', () => {
        expect(calculateMealItemCost({ id: 'poulet', weight: 100, customPrice: 0 }, foods)).toBe(0);
    });

    it('renvoie 0 plutôt qu’un prix faux si le prix personnalisé est corrompu', () => {
        // Comportement défensif documenté : une valeur non numérique n’est jamais
        // interprétée comme un prix, mais elle n’est pas non plus ignorée silencieusement
        // au profit du prix calculé (choix conservateur).
        const cost = calculateMealItemCost({ id: 'riz', weight: 100, customPrice: 'abc' }, foods);
        expect(cost).toBe(0);
        expect(Number.isNaN(cost)).toBe(false);
    });

    it('ne produit jamais NaN, même avec des données corrompues', () => {
        const cost = calculateMealItemCost({ id: 'riz', weight: 'beaucoup', customPrice: {} }, foods);
        expect(Number.isFinite(cost)).toBe(true);
    });

    it('calcule le coût au gramme (nouveau format priceQuantity/priceUnit)', () => {
        // riz : 3 € pour 1000 g => 0.3 € / 100 g
        expect(calculateMealItemCost({ id: 'riz', weight: 250 }, foods)).toBeCloseTo(0.75, 6);
    });

    it('calcule le coût à l’ancien format priceGrams', () => {
        // pâtes : 2 € pour 500 g => 0.4 € / 100 g
        expect(calculateMealItemCost({ id: 'pates', weight: 200 }, foods)).toBeCloseTo(0.8, 6);
    });

    it('gère le format "portions"', () => {
        const foods2 = {
            oeuf: { name: 'Œuf', calories: 70, price: 3, priceQuantity: 12, priceUnit: 'portions', portionWeight: 50 },
        };
        // 3 € pour 12 portions de 50 g = 600 g => 0.5 € / 100 g => 100 g = 0.5 €
        expect(calculateMealItemCost({ id: 'oeuf', weight: 100 }, foods2)).toBeCloseTo(0.5, 6);
    });

    it('renvoie 0 si aucun prix n’est connu', () => {
        expect(calculateMealItemCost({ id: 'poulet', weight: 200 }, foods)).toBe(0);
    });

    it('renvoie 0 pour un aliment inconnu ou une entrée invalide', () => {
        expect(calculateMealItemCost({ id: 'inconnu', weight: 100 }, foods)).toBe(0);
        expect(calculateMealItemCost(null, foods)).toBe(0);
        expect(calculateMealItemCost({ id: 'riz', weight: 100 }, null)).toBe(0);
    });

    it('calcule le coût d’un repas composé ajustable au prorata', () => {
        // Modèle réel : price = prix TOTAL de la recette, priceQuantity = totalWeight
        const meals = { 'poulet-riz': composedMeal({ price: 5, priceQuantity: 400, totalWeight: 400 }) };
        const cost = calculateMealItemCost({ id: 'poulet-riz', isMeal: true, weight: 200 }, foods, meals);
        expect(cost).toBeCloseTo(2.5, 6);
    });

    it('renvoie le prix total de la recette pour une portion complète', () => {
        const meals = { 'poulet-riz': composedMeal({ price: 5, priceQuantity: 400, totalWeight: 400 }) };
        const cost = calculateMealItemCost({ id: 'poulet-riz', isMeal: true, weight: 400 }, foods, meals);
        expect(cost).toBeCloseTo(5, 6);
    });

    it('calcule le coût d’un repas composé à portions personnalisées', () => {
        const meals = { 'poulet-riz': composedMeal({ totalWeight: 400 }) };
        const item = { id: 'poulet-riz', isMeal: true, weight: 400, customPortions: { poulet: 100, riz: 300 } };
        // poulet sans prix ; riz 300 g => 0.9 €
        expect(calculateMealItemCost(item, foods, meals)).toBeCloseTo(0.9, 6);
    });
});

describe('utils.calculateDayCost & calculateCostsByMeal', () => {
    const foods = foodsFixture();

    it('additionne les coûts de la journée', () => {
        const cost = calculateDayCost(dayFixture(), foods);
        // pomme 150 g : 2.5 €/kg => 0.375 ; poulet 0 ; riz 100 g : 0.3
        expect(cost).toBeCloseTo(0.375 + 0.3, 6);
    });

    it('ventile les coûts par type de repas', () => {
        const costs = calculateCostsByMeal(dayFixture(), foods);
        expect(costs['petit-dej']).toBeCloseTo(0.375, 6);
        expect(costs.dejeuner).toBe(0);
        expect(costs.diner).toBeCloseTo(0.3, 6);
        expect(costs.snack).toBe(0);
    });

    it('la somme des coûts par repas égale le coût total', () => {
        const jour = dayFixture();
        const total = calculateDayCost(jour, foods);
        const somme = Object.values(calculateCostsByMeal(jour, foods)).reduce((a, b) => a + b, 0);
        expect(somme).toBeCloseTo(total, 6);
    });

    it('renvoie 0 / des zéros pour des entrées invalides', () => {
        expect(calculateDayCost(null, foods)).toBe(0);
        expect(calculateCostsByMeal(null, foods)).toEqual({ 'petit-dej': 0, dejeuner: 0, diner: 0, snack: 0 });
    });
});

describe('utils — cas limites corrigés par l’audit', () => {
    const foods = foodsFixture();
    const meals = { 'poulet-riz': composedMeal({ totalWeight: 400, price: 5, priceQuantity: 400 }) };

    it('formatDateKey lève sur une date invalide au lieu de produire "NaN-NaN-NaN"', () => {
        expect(() => formatDateKey(new Date('invalide'))).toThrow(TypeError);
        expect(() => formatDateKey('pas une date')).toThrow(TypeError);
    });

    it('formatDateKey accepte une chaîne de date valide', () => {
        expect(formatDateKey('2026-06-06')).toBe('2026-06-06');
    });

    it('generateFoodId ne renvoie jamais une chaîne vide pour un nom non vide', () => {
        const id = generateFoodId('🍦');
        expect(id).not.toBe('');
        expect(id.length).toBeGreaterThan(0);
    });

    it('generateFoodId est déterministe pour un même nom non latin', () => {
        expect(generateFoodId('🍦')).toBe(generateFoodId('🍦'));
    });

    it('generateFoodId ne laisse pas de tiret en début ou en fin', () => {
        const id = generateFoodId('Stracciatella 🍦');
        expect(id.startsWith('-')).toBe(false);
        expect(id.endsWith('-')).toBe(false);
    });

    it('un repas ajustable consommé à 0 g compte 0 kcal (et non la recette entière)', () => {
        const totals = calculateMealItemNutrition({ id: 'poulet-riz', isMeal: true, weight: 0 }, foods, meals);
        expect(totals.calories).toBe(0);
        expect(calculateMealItemCost({ id: 'poulet-riz', isMeal: true, weight: 0 }, foods, meals)).toBe(0);
    });

    it('un poids négatif ne produit pas de totaux négatifs', () => {
        const totals = calculateMealItemNutrition({ id: 'poulet', weight: -100 }, foods);
        expect(totals.calories).toBe(0);
        expect(calculateMealItemCost({ id: 'riz', weight: -100 }, foods)).toBe(0);
    });

    it('tolère l’ancienne forme de ligne foodId/uid', () => {
        const totals = calculateMealItemNutrition({ foodId: 'poulet', uid: 42, weight: 100 }, foods);
        expect(totals.calories).toBeCloseTo(165, 6);
        expect(calculateMealItemCost({ foodId: 'riz', uid: 42, weight: 100 }, foods)).toBeCloseTo(0.3, 6);
    });
});

describe('utils — cohérence nutrition / coût', () => {
    it('un aliment sans prix ne contribue pas au coût mais contribue aux calories', () => {
        const foods = { poulet: simpleFood() };
        const item = { id: 'poulet', weight: 100 };
        expect(calculateMealItemNutrition(item, foods).calories).toBeGreaterThan(0);
        expect(calculateMealItemCost(item, foods)).toBe(0);
    });

    it('legacyPricedFood et pricedFood exposent bien leurs champs de prix', () => {
        expect(legacyPricedFood().priceGrams).toBe(500);
        expect(pricedFood().priceQuantity).toBe(1000);
    });
});
