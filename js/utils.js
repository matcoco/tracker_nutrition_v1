// js/utils.js

/**
 * Formate une date en une chaîne de caractères 'YYYY-MM-DD' pour servir de clé.
 * @param {Date} d - L'objet Date à formater.
 * @returns {string}
 */
export function formatDateKey(d) {
    return d.toISOString().split('T')[0];
}

/**
 * Formate une date en une chaîne lisible et localisée en français pour l'affichage.
 * @param {Date} d - L'objet Date à formater.
 * @returns {string}
 */
export function formatDateDisplay(d) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Calcule les totaux nutritionnels pour une journée donnée.
 * @param {object} meals - L'objet représentant les repas du jour.
 * @param {object} foods - Le dictionnaire de tous les aliments disponibles.
 * @returns {{calories: number, proteins: number, carbs: number, fats: number, sugars: number, fibers: number}}
 */
export function calculateDayTotals(meals, foods) {
    const totals = { calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, fibers: 0 };
    if (!meals || !foods) return totals;

    for (const mealType in meals) {
        if (Array.isArray(meals[mealType])) {
            meals[mealType].forEach(item => {
                const food = foods[item.id];
                if (food) {
                    const factor = (item.weight || 0) / 100;
                    totals.calories += (food.calories || 0) * factor;
                    totals.proteins += (food.proteins || 0) * factor;
                    totals.carbs += (food.carbs || 0) * factor;
                    totals.fats += (food.fats || 0) * factor;
                    totals.sugars += (food.sugars || 0) * factor;
                    totals.fibers += (food.fibers || 0) * factor;
                }
            });
        }
    }
    return totals;
}

/**
 * Calcule les totaux nutritionnels pour un seul repas (un tableau d'aliments).
 * @param {Array<object>} mealItems - Le tableau d'aliments pour un repas.
 * @param {object} foods - Le dictionnaire de tous les aliments disponibles.
 * @returns {{calories: number, proteins: number, carbs: number, fats: number, sugars: number, fibers: number}}
 */
export function calculateMealTotals(mealItems, foods) {
    const totals = { calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, fibers: 0 };
    if (!mealItems || !foods) return totals;

    mealItems.forEach(item => {
        const food = foods[item.id];
        if (food) {
            const factor = (item.weight || 0) / 100;
            totals.calories += (food.calories || 0) * factor;
            totals.proteins += (food.proteins || 0) * factor;
            totals.carbs += (food.carbs || 0) * factor;
            totals.fats += (food.fats || 0) * factor;
            totals.sugars += (food.sugars || 0) * factor;
            totals.fibers += (food.fibers || 0) * factor;
        }
    });
    return totals;
}

/**
 * Génère un identifiant unique et normalisé pour un nouvel aliment à partir de son nom.
 * @param {string} name - Le nom de l'aliment.
 * @returns {string} L'identifiant normalisé.
 */
export function generateFoodId(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9-]/g, '');
}

/**
 * Calcule le coût d'une journée
 * @param {object} meals - Les repas de la journée
 * @param {object} foods - Dictionnaire des aliments
 * @returns {number} Le coût total en euros
 */
export function calculateDayCost(meals, foods) {
    let cost = 0;
    if (!meals || !foods) return cost;

    for (const mealType in meals) {
        if (Array.isArray(meals[mealType])) {
            meals[mealType].forEach(item => {
                const food = foods[item.id];
                if (food && food.price && food.priceGrams) {
                    const itemCost = (food.price / food.priceGrams) * item.weight;
                    cost += itemCost;
                }
            });
        }
    }
    return cost;
}

/**
 * Calcule les coûts par repas pour une journée
 * @param {object} meals - Les repas de la journée
 * @param {object} foods - Dictionnaire des aliments
 * @returns {object} Objet avec coûts par type de repas
 */
export function calculateCostsByMeal(meals, foods) {
    const costs = {
        'petit-dej': 0,
        'dejeuner': 0,
        'diner': 0,
        'snack': 0
    };
    
    if (!meals || !foods) return costs;

    for (const mealType in costs) {
        if (Array.isArray(meals[mealType])) {
            meals[mealType].forEach(item => {
                const food = foods[item.id];
                if (food && food.price && food.priceGrams) {
                    const itemCost = (food.price / food.priceGrams) * item.weight;
                    costs[mealType] += itemCost;
                }
            });
        }
    }
    return costs;
}