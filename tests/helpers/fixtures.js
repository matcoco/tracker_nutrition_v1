// tests/helpers/fixtures.js
// Jeux de données réutilisables par les tests.

/** Aliment simple, valeurs pour 100 g. */
export function simpleFood(overrides = {}) {
    return {
        name: 'Poulet',
        calories: 165,
        proteins: 31,
        carbs: 0,
        fats: 3.6,
        sugars: 0,
        fibers: 0,
        ...overrides,
    };
}

/** Aliment avec prix au gramme (nouveau format). */
export function pricedFood(overrides = {}) {
    return {
        name: 'Riz',
        calories: 350,
        proteins: 7,
        carbs: 78,
        fats: 0.6,
        sugars: 0.1,
        fibers: 1.3,
        price: 3,
        priceQuantity: 1000,
        priceUnit: 'grams',
        ...overrides,
    };
}

/** Aliment avec prix à l'ancien format (priceGrams). */
export function legacyPricedFood(overrides = {}) {
    return {
        name: 'Pâtes',
        calories: 350,
        proteins: 12,
        carbs: 70,
        fats: 1.5,
        sugars: 2,
        fibers: 3,
        price: 2,
        priceGrams: 500,
        ...overrides,
    };
}

/**
 * Repas composé ajustable, conforme au modèle réel produit par meals.js :
 * les valeurs nutritionnelles et le prix sont ceux de la RECETTE COMPLÈTE,
 * et `priceQuantity` vaut `totalWeight` (et non 100).
 * @param {object} overrides
 */
export function composedMeal(overrides = {}) {
    return {
        name: 'Poulet riz',
        totalWeight: 400,
        isPortionAdjustable: true,
        calories: 400,
        proteins: 40,
        carbs: 50,
        fats: 8,
        sugars: 1,
        fibers: 2,
        price: 5,
        priceQuantity: 400,
        priceUnit: 'grams',
        ingredients: [
            { foodId: 'poulet', weight: 200 },
            { foodId: 'riz', weight: 200 },
        ],
        ...overrides,
    };
}

/**
 * Repas composé NON ajustable : les valeurs sont pour 100 g et
 * `priceQuantity` vaut 100 (modèle produit par meals.js).
 */
export function nonAdjustableMeal(overrides = {}) {
    return {
        name: 'Salade composée',
        totalWeight: 500,
        isPortionAdjustable: false,
        calories: 120,
        proteins: 6,
        carbs: 10,
        fats: 6,
        sugars: 3,
        fibers: 2,
        price: 1.2,
        priceQuantity: 100,
        priceUnit: 'grams',
        ingredients: [
            { foodId: 'poulet', weight: 300 },
            { foodId: 'pomme', weight: 200 },
        ],
        ...overrides,
    };
}

/** Dictionnaire d'aliments standard. */
export function foodsFixture() {
    return {
        poulet: simpleFood(),
        riz: pricedFood(),
        pates: legacyPricedFood(),
        pomme: simpleFood({ name: 'Pomme', calories: 52, proteins: 0.3, carbs: 14, fats: 0.2, sugars: 10, fibers: 2.4, price: 2.5, priceQuantity: 1000, priceUnit: 'grams' }),
    };
}

/** Journée type. */
export function dayFixture() {
    return {
        'petit-dej': [{ id: 'pomme', weight: 150, time: '08:00' }],
        dejeuner: [{ id: 'poulet', weight: 200, time: '12:30' }],
        diner: [{ id: 'riz', weight: 100, time: '19:30' }],
        snack: [],
    };
}

/** Objectifs type. */
export function goalsFixture(overrides = {}) {
    return {
        calories: 2000,
        proteins: 150,
        carbs: 200,
        fats: 70,
        ...overrides,
    };
}

/** Construit une date locale à midi pour éviter les décalages de fuseau. */
export function localDate(year, month, day) {
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}
