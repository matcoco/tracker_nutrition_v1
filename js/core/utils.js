// js/utils.js

/**
 * Formate une date en une chaîne de caractères 'YYYY-MM-DD' pour servir de clé.
 * @param {Date} d - L'objet Date à formater.
 * @returns {string}
 */
export function formatDateKey(d) {
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) {
        throw new TypeError(`formatDateKey: date invalide (${String(d)})`);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
 * Identifiant de l'aliment référencé par une ligne de repas.
 * Tolère l'ancienne forme `foodId` utilisée par certaines données historiques.
 * @param {object} item - Ligne du repas.
 * @returns {string|undefined}
 */
export function getMealItemId(item) {
    if (!item) return undefined;
    return item.id !== undefined ? item.id : item.foodId;
}

/**
 * Identifiant unique d'une ligne de repas.
 * Tolère l'ancienne forme `uid` utilisée par certaines données historiques.
 * @param {object} item - Ligne du repas.
 * @returns {string|number|undefined}
 */
export function getMealItemUniqueId(item) {
    if (!item) return undefined;
    return item.uniqueId !== undefined ? item.uniqueId : item.uid;
}

/**
 * Calcule les valeurs nutritionnelles d'une ligne du suivi quotidien.
 * Cette fonction sert de source de vérité pour éviter les divergences entre
 * les totaux de journée, les totaux de repas et l'affichage détaillé.
 * @param {object} item - Ligne du repas.
 * @param {object} foods - Le dictionnaire de tous les aliments disponibles.
 * @param {object} composedMeals - Le dictionnaire des repas composés (optionnel).
 * @returns {{calories: number, proteins: number, carbs: number, fats: number, sugars: number, fibers: number}}
 */
export function calculateMealItemNutrition(item, foods, composedMeals = {}) {
    const totals = { calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, fibers: 0 };
    if (!item || !foods) return totals;

    const itemId = getMealItemId(item);
    const food = item.isMeal && composedMeals[itemId] ? composedMeals[itemId] : foods[itemId];
    if (!food) return totals;

    // CAS 1 : repas composé avec portions personnalisées.
    if (item.isMeal && item.customPortions && Array.isArray(food.ingredients)) {
        let customTotalWeight = 0;

        food.ingredients.forEach(ing => {
            const ingredientFood = foods[ing.foodId];
            const weight = Number(item.customPortions[ing.foodId]) || 0;
            customTotalWeight += weight;

            if (ingredientFood && weight > 0) {
                const factor = weight / 100;
                totals.calories += (Number(ingredientFood.calories) || 0) * factor;
                totals.proteins += (Number(ingredientFood.proteins) || 0) * factor;
                totals.carbs += (Number(ingredientFood.carbs) || 0) * factor;
                totals.fats += (Number(ingredientFood.fats) || 0) * factor;
                totals.sugars += (Number(ingredientFood.sugars) || 0) * factor;
                totals.fibers += (Number(ingredientFood.fibers) || 0) * factor;
            }
        });

        const totalRecipeWeight = Number(food.totalWeight) || customTotalWeight || 1;
        const consumedWeight = Number(item.weight) || totalRecipeWeight;
        const ratio = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;

        totals.calories *= ratio;
        totals.proteins *= ratio;
        totals.carbs *= ratio;
        totals.fats *= ratio;
        totals.sugars *= ratio;
        totals.fibers *= ratio;
        return totals;
    }

    // CAS 2 : repas ajustable sans portions personnalisées.
    if (item.isMeal && food.isPortionAdjustable) {
        const totalRecipeWeight = Number(food.totalWeight) || 100;
        // Un poids explicitement à 0 doit donner 0 kcal, pas la recette entière.
        const rawWeight = Number(item.weight);
        const consumedWeight = Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : totalRecipeWeight;
        const factor = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;

        totals.calories = (Number(food.calories) || 0) * factor;
        totals.proteins = (Number(food.proteins) || 0) * factor;
        totals.carbs = (Number(food.carbs) || 0) * factor;
        totals.fats = (Number(food.fats) || 0) * factor;
        totals.sugars = (Number(food.sugars) || 0) * factor;
        totals.fibers = (Number(food.fibers) || 0) * factor;
        return totals;
    }

    // CAS 3 : aliment simple ou repas non ajustable enregistré pour 100g.
    const factor = Math.max(0, Number(item.weight) || 0) / 100;
    totals.calories = (Number(food.calories) || 0) * factor;
    totals.proteins = (Number(food.proteins) || 0) * factor;
    totals.carbs = (Number(food.carbs) || 0) * factor;
    totals.fats = (Number(food.fats) || 0) * factor;
    totals.sugars = (Number(food.sugars) || 0) * factor;
    totals.fibers = (Number(food.fibers) || 0) * factor;
    return totals;
}

function addNutritionTotals(totals, itemTotals) {
    totals.calories += itemTotals.calories;
    totals.proteins += itemTotals.proteins;
    totals.carbs += itemTotals.carbs;
    totals.fats += itemTotals.fats;
    totals.sugars += itemTotals.sugars;
    totals.fibers += itemTotals.fibers;
}

/**
 * Calcule les totaux nutritionnels pour une journée.
 * @param {{petit_dejeuner: Array, dejeuner: Array, diner: Array, collations: Array}} meals - Les repas de la journée.
 * @param {object} foods - Le dictionnaire de tous les aliments disponibles.
 * @param {object} composedMeals - Le dictionnaire des repas composés (optionnel).
 * @returns {{calories: number, proteins: number, carbs: number, fats: number, sugars: number, fibers: number}}
 */
export function calculateDayTotals(meals, foods, composedMeals = {}) {
    const totals = { calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, fibers: 0 };
    if (!meals || !foods) return totals;

    for (const mealType in meals) {
        if (Array.isArray(meals[mealType])) {
            meals[mealType].forEach(item => {
                addNutritionTotals(totals, calculateMealItemNutrition(item, foods, composedMeals));
            });
        }
    }
    return totals;
}

/**
 * Calcule les totaux nutritionnels pour un seul repas (un tableau d'aliments).
 * @param {Array<object>} mealItems - Le tableau d'aliments pour un repas.
 * @param {object} foods - Le dictionnaire de tous les aliments disponibles.
 * @param {object} composedMeals - Le dictionnaire des repas composés (optionnel).
 * @returns {{calories: number, proteins: number, carbs: number, fats: number, sugars: number, fibers: number}}
 */
export function calculateMealTotals(mealItems, foods, composedMeals = {}) {
    const totals = { calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, fibers: 0 };
    if (!mealItems || !foods) return totals;

    mealItems.forEach(item => {
        addNutritionTotals(totals, calculateMealItemNutrition(item, foods, composedMeals));
    });
    return totals;
}

/**
 * Génère un identifiant unique et normalisé pour un nouvel aliment à partir de son nom.
 * @param {string} name - Le nom de l'aliment.
 * @returns {string} L'identifiant normalisé.
 */
export function generateFoodId(name) {
    if (name === null || name === undefined) return '';
    const base = String(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // supprime les diacritiques combinés
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (base) return base;

    // Nom sans caractère latin exploitable (emoji, alphabet non latin) :
    // renvoyer '' créerait un aliment avec une clé vide en base.
    const raw = String(name).trim();
    if (!raw) return '';
    let hash = 0;
    for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    return `food-${hash.toString(36)}`;
}

/**
 * Calcule le prix pour 100g d'un aliment
 * Gère les anciennes données (priceGrams) et les nouvelles (priceQuantity + priceUnit)
 * @param {object} food - L'aliment
 * @returns {number|null} - Prix pour 100g ou null si non disponible
 */
export function getPricePer100g(food) {
    const price = Number(food?.price);
    if (!Number.isFinite(price) || price <= 0) return null;

    // Nouveau format : priceQuantity + priceUnit
    const priceQuantity = Number(food?.priceQuantity);
    if (Number.isFinite(priceQuantity) && priceQuantity > 0) {
        const priceUnit = food.priceUnit || 'grams';
        if (priceUnit === 'grams') {
            return (price / priceQuantity) * 100;
        } else if (priceUnit === 'portions') {
            const portionWeight = Number(food.portionWeight) || 100;
            const totalGrams = priceQuantity * portionWeight;
            return totalGrams > 0 ? (price / totalGrams) * 100 : null;
        }
        // priceUnit inconnu : on tente l'ancien format ci-dessous.
    }

    // Ancien format (rétrocompatibilité) : priceGrams
    const priceGrams = Number(food?.priceGrams);
    if (Number.isFinite(priceGrams) && priceGrams > 0) {
        return (price / priceGrams) * 100;
    }

    return null;
}

/**
 * Indique si un prix exploitable est disponible pour un aliment.
 * @param {object} food - L'aliment
 * @returns {boolean}
 */
export function hasPrice(food) {
    return getPricePer100g(food) !== null;
}

export function calculateMealItemCost(item, foods, composedMeals = {}) {
    if (!item || !foods) return 0;

    const itemId = getMealItemId(item);
    const food = item.isMeal && composedMeals[itemId] ? composedMeals[itemId] : foods[itemId];
    if (!food) return 0;

    if (item.customPrice !== undefined && item.customPrice !== null) {
        const customPrice = Number(item.customPrice);
        return Number.isFinite(customPrice) && customPrice >= 0 ? customPrice : 0;
    }

    if (item.isMeal && item.customPortions && Array.isArray(food.ingredients)) {
        let recipeCost = 0;
        let customTotalWeight = 0;

        food.ingredients.forEach(ing => {
            const ingredientFood = foods[ing.foodId];
            const weight = Number(item.customPortions[ing.foodId]) || 0;
            customTotalWeight += weight;
            if (ingredientFood && weight > 0) {
                const pricePer100g = getPricePer100g(ingredientFood);
                if (pricePer100g !== null) recipeCost += (pricePer100g / 100) * weight;
            }
        });

        const totalRecipeWeight = Number(food.totalWeight) || customTotalWeight || 1;
        const consumedWeight = Number(item.weight) || totalRecipeWeight;
        return totalRecipeWeight > 0 ? recipeCost * (consumedWeight / totalRecipeWeight) : 0;
    }

    if (item.isMeal && food.isPortionAdjustable) {
        const totalRecipeWeight = Number(food.totalWeight) || 100;
        const rawWeight = Number(item.weight);
        const consumedWeight = Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : totalRecipeWeight;
        if (hasPrice(food)) {
            const fullRecipeCost = Number(food.price) || 0;
            return totalRecipeWeight > 0 ? fullRecipeCost * (consumedWeight / totalRecipeWeight) : 0;
        }
        return 0;
    }

    const pricePer100g = getPricePer100g(food);
    if (pricePer100g === null) return 0;
    return (pricePer100g / 100) * Math.max(0, Number(item.weight) || 0);
}

/**
 * Calcule le coût d'une journée
 * @param {object} meals - Les repas de la journée
 * @param {object} foods - Dictionnaire des aliments
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel)
 * @returns {number} Le coût total en euros
 */
export function calculateDayCost(meals, foods, composedMeals = {}) {
    let cost = 0;
    if (!meals || !foods) return cost;

    for (const mealType in meals) {
        if (Array.isArray(meals[mealType])) {
            meals[mealType].forEach(item => {
                let food;
                
                // Vérifier si c'est un repas composé
                if (item.isMeal && composedMeals[item.id]) {
                    food = composedMeals[item.id];
                } else {
                    food = foods[item.id];
                }
                
                if (food) {
                    cost += calculateMealItemCost(item, foods, composedMeals);
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
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel)
 * @returns {object} Objet avec coûts par type de repas
 */
export function calculateCostsByMeal(meals, foods, composedMeals = {}) {
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
                let food;
                
                // Vérifier si c'est un repas composé
                if (item.isMeal && composedMeals[item.id]) {
                    food = composedMeals[item.id];
                } else {
                    food = foods[item.id];
                }
                
                if (food) {
                    costs[mealType] += calculateMealItemCost(item, foods, composedMeals);
                }
            });
        }
    }
    return costs;
}
