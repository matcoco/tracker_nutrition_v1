// js/ui.js

import { formatDateDisplay } from './utils.js';
import { calculateMealTotals } from './utils.js';

// --- Fonctions helper pour les prix ---

/**
 * Calcule le prix pour 100g d'un aliment
 * Gère les anciennes données (priceGrams) et les nouvelles (priceQuantity + priceUnit)
 * @param {object} food - L'aliment
 * @returns {number|null} - Prix pour 100g ou null si non disponible
 */
function getPricePer100g(food) {
    if (!food.price) return null;
    
    // Nouveau format : priceQuantity + priceUnit
    if (food.priceQuantity && food.priceUnit) {
        if (food.priceUnit === 'grams') {
            return (food.price / food.priceQuantity) * 100;
        } else if (food.priceUnit === 'portions') {
            // Utiliser le poids réel de la portion si disponible, sinon 100g par défaut
            const portionWeight = food.portionWeight || 100;
            const totalGrams = food.priceQuantity * portionWeight;
            return (food.price / totalGrams) * 100;
        }
    }
    
    // Ancien format (rétrocompatibilité) : priceGrams
    if (food.priceGrams) {
        return (food.price / food.priceGrams) * 100;
    }
    
    return null;
}

/**
 * Vérifie si un aliment a des informations de prix
 * @param {object} food - L'aliment
 * @returns {boolean}
 */
function hasPrice(food) {
    return food.price && (food.priceQuantity || food.priceGrams);
}

// --- Éléments du DOM ---
// On met en cache les éléments fréquemment utilisés pour de meilleures performances.
const elements = {
    currentDate: document.getElementById('currentDate'),
    datePicker: document.getElementById('datePicker'),
    totalCalories: document.getElementById('totalCalories'),
    totalProteins: document.getElementById('totalProteins'),
    totalCarbs: document.getElementById('totalCarbs'),
    totalFats: document.getElementById('totalFats'),
    totalSugars: document.getElementById('totalSugars'),
    weightInput: document.getElementById('weightInput'),
    saveWeightBtn: document.getElementById('saveWeightBtn'),
    bellyInput: document.getElementById('bellyInput'),
    saveBellyBtn: document.getElementById('saveBellyBtn'),
    foodsList: document.getElementById('foodsList'),
    foodsListManage: document.getElementById('foodsListManage'),
    addFoodForm: document.getElementById('addFoodForm'),
    
    // Éléments de la modale de modification
    editModal: document.getElementById('editFoodModal'),
    editForm: document.getElementById('editFoodForm'),
    editFoodId: document.getElementById('editFoodId'),
    editFoodName: document.getElementById('editFoodName'),
    editFoodCalories: document.getElementById('editFoodCalories'),
    editFoodProteins: document.getElementById('editFoodProteins'),
    editFoodCarbs: document.getElementById('editFoodCarbs'),
    editFoodSugars: document.getElementById('editFoodSugars'),
    editFoodFibers: document.getElementById('editFoodFibers'),
    editFoodFats: document.getElementById('editFoodFats'),
    editFoodPrice: document.getElementById('editFoodPrice'),
    editFoodPriceQuantity: document.getElementById('editFoodPriceQuantity')
};

/**
 * Affiche une notification temporaire à l'écran.
 * @param {string} msg - Le message à afficher.
 * @param {string} type - 'success' (vert) ou 'error' (rouge).
 */
export function showNotification(msg, type = 'success') {
    const notification = document.createElement('div');
    // On change la couleur en fonction du type
    notification.style.background = type === 'error' ? 'var(--gradient-danger)' : 'var(--color-success)';
    notification.className = 'notification';
    notification.textContent = msg;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3500);
}

/**
 * Met à jour le texte de la date affichée dans l'en-tête.
 * @param {Date} date - La date à afficher.
 */
export function updateDateDisplay(date) {
    if (elements.currentDate) {
        elements.currentDate.textContent = formatDateDisplay(date);
    }
    if (elements.datePicker) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        elements.datePicker.value = `${year}-${month}-${day}`;
    }
}

/**
 * Met à jour le résumé des totaux nutritionnels de la journée avec barres de progression.
 * @param {object} totals - Objet avec les totaux (calories, proteins, etc.).
 * @param {object|null} goals - Les objectifs nutritionnels (optionnel).
 */
export function updateSummary(totals, goals = null) {
    // Fonction pour déterminer la classe de couleur en fonction du pourcentage
    const getProgressClass = (current, goal) => {
        if (!goal) return '';
        const percentage = (current / goal) * 100;
        if (percentage >= 100) return 'danger';
        if (percentage >= 90) return 'warning';
        return 'success';
    };

    // Fonction pour calculer le pourcentage
    const getPercentage = (current, goal) => {
        if (!goal) return 100;
        return Math.min((current / goal) * 100, 100);
    };

    // Calories
    const caloriesCurrent = totals.calories.toFixed(0);
    const caloriesGoal = goals?.calories || 0;
    document.getElementById('totalCalories').textContent = goals 
        ? `${caloriesCurrent} / ${caloriesGoal} kcal`
        : `${caloriesCurrent} kcal`;
    const caloriesProgress = document.getElementById('caloriesProgress');
    if (caloriesProgress) {
        caloriesProgress.style.width = `${getPercentage(totals.calories, caloriesGoal)}%`;
        caloriesProgress.className = `progress-fill ${getProgressClass(totals.calories, caloriesGoal)}`;
    }

    // Protéines
    const proteinsCurrent = totals.proteins.toFixed(1);
    const proteinsGoal = goals?.proteins || 0;
    document.getElementById('totalProteins').textContent = goals 
        ? `${proteinsCurrent} / ${proteinsGoal} g`
        : `${proteinsCurrent} g`;
    const proteinsProgress = document.getElementById('proteinsProgress');
    if (proteinsProgress) {
        proteinsProgress.style.width = `${getPercentage(totals.proteins, proteinsGoal)}%`;
        proteinsProgress.className = `progress-fill ${getProgressClass(totals.proteins, proteinsGoal)}`;
    }

    // Glucides
    const carbsCurrent = totals.carbs.toFixed(1);
    const carbsGoal = goals?.carbs || 0;
    document.getElementById('totalCarbs').textContent = goals 
        ? `${carbsCurrent} / ${carbsGoal} g`
        : `${carbsCurrent} g`;
    const carbsProgress = document.getElementById('carbsProgress');
    if (carbsProgress) {
        carbsProgress.style.width = `${getPercentage(totals.carbs, carbsGoal)}%`;
        carbsProgress.className = `progress-fill ${getProgressClass(totals.carbs, carbsGoal)}`;
    }

    // Lipides
    const fatsCurrent = totals.fats.toFixed(1);
    const fatsGoal = goals?.fats || 0;
    document.getElementById('totalFats').textContent = goals 
        ? `${fatsCurrent} / ${fatsGoal} g`
        : `${fatsCurrent} g`;
    const fatsProgress = document.getElementById('fatsProgress');
    if (fatsProgress) {
        fatsProgress.style.width = `${getPercentage(totals.fats, fatsGoal)}%`;
        fatsProgress.className = `progress-fill ${getProgressClass(totals.fats, fatsGoal)}`;
    }

    // Sucres (avec seuil max)
    const sugarsCurrent = totals.sugars.toFixed(1);
    const sugarsMax = goals?.sugarsMax || 25;
    document.getElementById('totalSugars').textContent = goals
        ? `${sugarsCurrent} / ${sugarsMax} g`
        : `${sugarsCurrent} g`;
    const sugarsProgress = document.getElementById('sugarsProgress');
    if (sugarsProgress) {
        const sugarsPercentage = Math.min((totals.sugars / sugarsMax) * 100, 100);
        sugarsProgress.style.width = `${sugarsPercentage}%`;
        // Classe de couleur inversée : rouge si > objectif
        if (totals.sugars > sugarsMax) {
            sugarsProgress.className = 'progress-fill danger';
        } else if (totals.sugars > sugarsMax * 0.8) {
            sugarsProgress.className = 'progress-fill warning';
        } else {
            sugarsProgress.className = 'progress-fill success';
        }
    }

    // Fibres (avec seuil min)
    const fibersCurrent = totals.fibers.toFixed(1);
    const fibersMin = goals?.fibersMin || 25;
    document.getElementById('totalFibers').textContent = goals
        ? `${fibersCurrent} / ${fibersMin} g`
        : `${fibersCurrent} g`;
    const fibersProgress = document.getElementById('fibersProgress');
    if (fibersProgress) {
        const fibersPercentage = Math.min((totals.fibers / fibersMin) * 100, 100);
        fibersProgress.style.width = `${fibersPercentage}%`;
        // Classe de couleur : rouge si < objectif, vert si >= objectif
        if (totals.fibers < fibersMin * 0.5) {
            fibersProgress.className = 'progress-fill danger';
        } else if (totals.fibers < fibersMin) {
            fibersProgress.className = 'progress-fill warning';
        } else {
            fibersProgress.className = 'progress-fill success';
        }
    }
}

/**
 * Met à jour l'affichage du poids pour la journée.
 * @param {number|null} weight - Le poids en kg, ou null si non renseigné.
 */
export function updateWeightDisplay(weight) {
    if (weight !== null && weight !== undefined) {
        elements.weightInput.value = weight;
    } else {
        elements.weightInput.value = '';
    }
}

/**
 * Met à jour l'affichage du tour de ventre pour la journée.
 * @param {number|null} belly - Le tour de ventre en cm, ou null si non renseigné.
 */
export function updateBellyDisplay(belly) {
    if (belly !== null && belly !== undefined) {
        elements.bellyInput.value = belly;
    } else {
        elements.bellyInput.value = '';
    }
}

/**
 * Affiche les aliments disponibles dans l'onglet Suivi Quotidien.
 * @param {object} foods - Dictionnaire des aliments.
 * @param {Function} dragStartHandler - La fonction à appeler lors du début de drag.
 * @param {Function} quickAddHandler - La fonction à appeler pour l'ajout rapide.
 * @param {number} maxItems - Nombre maximum d'aliments à afficher (0 = tous).
 * @param {object} meals - Dictionnaire des repas composés (optionnel).
 * @param {string} category - Catégorie de filtre ('all' ou catégorie spécifique).
 */
export function displayFoods(foods, dragStartHandler, quickAddHandler, maxItems = 20, meals = {}, category = 'all') {
    elements.foodsList.innerHTML = '';
    
    // Combiner repas et aliments
    const mealsArray = Object.entries(meals).map(([id, meal]) => [id, { ...meal, isMeal: true }]);
    const foodsArray = Object.entries(foods);
    
    // Filtrer par catégorie
    let allItems;
    if (category === 'all') {
        // Afficher tous les repas et tous les aliments
        allItems = [...mealsArray, ...foodsArray];
    } else if (category === 'meals') {
        // Afficher UNIQUEMENT les repas composés
        allItems = mealsArray;
    } else {
        // Afficher uniquement les aliments de cette catégorie (pas de repas)
        const filteredFoods = foodsArray.filter(([id, food]) => food.category === category);
        allItems = filteredFoods;
    }
    
    const itemsToShow = maxItems > 0 ? Math.min(maxItems, allItems.length) : allItems.length;
    
    for (let i = 0; i < itemsToShow; i++) {
        const [id, item] = allItems[i];
        const el = item.isMeal 
            ? createMealElement(id, item, dragStartHandler, quickAddHandler)
            : createFoodElement(id, item, dragStartHandler, quickAddHandler);
        elements.foodsList.appendChild(el);
    }
    
    // Gérer le bouton "Voir plus"
    updateLoadMoreButton(allItems.length, itemsToShow);
}

/**
 * Obtenir l'icône de catégorie d'un aliment
 */
function getCategoryIcon(category) {
    const icons = {
        'proteins': '🥩',
        'vegetables': '🥗',
        'starches': '🍚',
        'fruits': '🍎',
        'dairy': '🧀',
        'fats': '🥑',
        'beverages': '🥤',
        'snacks': '🍪',
        'condiments': '🧂',
        'sauces': '🍯',
        'other': '📦'
    };
    return icons[category] || '📦';
}

/**
 * Crée un élément d'aliment
 */
function createFoodElement(id, food, dragStartHandler, quickAddHandler) {
    const el = document.createElement('div');
    el.className = 'food-item';
    el.draggable = true;
    el.dataset.foodId = id;
    el.dataset.foodName = food.name;
    
    // Icône de catégorie
    const categoryIcon = getCategoryIcon(food.category);
    
    // Calculer prix au 100g si disponible
    let priceInfo = '';
    if (hasPrice(food)) {
        const pricePer100g = getPricePer100g(food).toFixed(2);
        priceInfo = ` | 💰 ${pricePer100g}€/100g`;
    }
    
    el.innerHTML = `
        <span class="food-category-icon">${categoryIcon}</span>
        <div class="food-item-header">
            <div class="food-name">${food.name}</div>
            <button class="quick-action-btn" data-food-id="${id}" title="Ajouter rapidement">+</button>
        </div>
        <div class="food-calories">${parseFloat(food.calories).toFixed(1)} kcal | P: ${parseFloat(food.proteins).toFixed(1)}g | G: ${parseFloat(food.carbs).toFixed(1)}g | F: ${parseFloat(food.fibers || 0).toFixed(1)}g | L: ${parseFloat(food.fats).toFixed(1)}g${priceInfo}</div>
    `;
    
    el.addEventListener('dragstart', dragStartHandler);
    
    // Bouton d'action rapide
    const quickBtn = el.querySelector('.quick-action-btn');
    quickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showMealSelector(e.target, id, quickAddHandler, el);
    });
    
    return el;
}

/**
 * Crée un élément de repas composé
 */
function createMealElement(id, meal, dragStartHandler, quickAddHandler) {
    const el = document.createElement('div');
    el.className = 'food-item meal-item-display';
    el.draggable = true;
    el.dataset.foodId = id; // Utiliser foodId pour compatibilité avec le drag & drop
    el.dataset.foodName = meal.name;
    
    // Calculer prix total si disponible
    let priceInfo = '';
    if (meal.price) {
        priceInfo = ` | 💰 ${meal.price.toFixed(2)}€`;
    }
    
    // Nombre d'ingrédients
    const ingredientCount = meal.ingredients ? meal.ingredients.length : 0;
    
    el.innerHTML = `
        <div class="food-item-header">
            <div class="food-name">
                <span class="meal-badge-small">REPAS</span>
                ${meal.name}
            </div>
            <button class="quick-action-btn" data-food-id="${id}" title="Ajouter rapidement">+</button>
        </div>
        <div class="food-calories">
            ${parseFloat(meal.calories).toFixed(1)} kcal | 
            P: ${parseFloat(meal.proteins).toFixed(1)}g | 
            G: ${parseFloat(meal.carbs).toFixed(1)}g | 
            L: ${parseFloat(meal.fats).toFixed(1)}g${priceInfo}
            <br><small style="color: #999;">📝 ${ingredientCount} ingrédient${ingredientCount > 1 ? 's' : ''}</small>
        </div>
    `;
    
    el.addEventListener('dragstart', dragStartHandler);
    
    // Bouton d'action rapide
    const quickBtn = el.querySelector('.quick-action-btn');
    quickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showMealSelector(e.target, id, quickAddHandler, el);
    });
    
    return el;
}

/**
 * Met à jour le bouton "Voir plus"
 */
function updateLoadMoreButton(totalItems, displayedItems) {
    const loadMoreBtn = document.getElementById('loadMoreFoodsBtn');
    const remainingCount = document.getElementById('remainingFoodsCount');
    
    if (loadMoreBtn && remainingCount) {
        const remaining = totalItems - displayedItems;
        if (remaining > 0) {
            loadMoreBtn.style.display = 'inline-block';
            remainingCount.textContent = remaining;
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
}

/**
 * Affiche le menu de sélection du repas
 */
function showMealSelector(button, foodId, quickAddHandler, foodItemElement) {
    // Fermer les menus existants et retirer la classe menu-open
    document.querySelectorAll('.meal-selector-menu').forEach(m => m.remove());
    document.querySelectorAll('.food-item.menu-open').forEach(f => f.classList.remove('menu-open'));
    
    const menu = document.createElement('div');
    menu.className = 'meal-selector-menu show';
    menu.innerHTML = `
        <div class="meal-selector-item" data-meal="petit-dej">
            <span class="meal-icon">🌅</span> Petit Déjeuner
        </div>
        <div class="meal-selector-item" data-meal="dejeuner">
            <span class="meal-icon">☀️</span> Déjeuner
        </div>
        <div class="meal-selector-item" data-meal="diner">
            <span class="meal-icon">🌙</span> Dîner
        </div>
        <div class="meal-selector-item" data-meal="snack">
            <span class="meal-icon">🍎</span> Snack
        </div>
    `;
    
    // Positionner le menu
    const foodItem = button.closest('.food-item');
    foodItem.style.position = 'relative';
    foodItem.classList.add('menu-open'); // Augmenter le z-index
    foodItem.appendChild(menu);
    
    // Ajouter les event listeners
    menu.querySelectorAll('.meal-selector-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const mealType = e.currentTarget.dataset.meal;
            quickAddHandler(foodId, mealType);
            menu.remove();
            foodItem.classList.remove('menu-open');
        });
    });
    
    // Fermer le menu en cliquant ailleurs
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                foodItem.classList.remove('menu-open');
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

/**
 * Affiche les aliments dans la section de gestion.
 * @param {object} foods - Dictionnaire des aliments.
 * @param {Function} editClickHandler - La fonction à appeler lors d'un clic sur un aliment.
 * @param {Function} deleteClickHandler - La fonction à appeler lors d'un clic sur le bouton supprimer.
 * @param {string} category - Catégorie de filtre ('all' ou catégorie spécifique).
 */
export function displayFoodsManage(foods, editClickHandler, deleteClickHandler, category = 'all') {
    elements.foodsListManage.innerHTML = '';
    
    // Filtrer les aliments par catégorie
    let filteredFoods = Object.entries(foods);
    if (category !== 'all') {
        filteredFoods = filteredFoods.filter(([id, food]) => food.category === category);
    }
    
    for (const [id, food] of filteredFoods) {
        const el = document.createElement('div');
        el.className = 'food-item';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.dataset.foodId = id;
        el.dataset.foodName = food.name;
        
        // Icône de catégorie
        const categoryIcon = getCategoryIcon(food.category);
        
        let priceInfo = '';
        if (hasPrice(food)) {
            const pricePer100g = getPricePer100g(food).toFixed(2);
            priceInfo = ` | 💰 ${pricePer100g}€/100g`;
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-food-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Supprimer cet aliment';
        deleteBtn.dataset.foodId = id;
        deleteBtn.dataset.foodName = food.name;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteClickHandler(e);
        });
        
        el.innerHTML = `
            <span class="food-category-icon">${categoryIcon}</span>
            <div class="food-name">${food.name}</div>
            <div class="food-calories">${parseFloat(food.calories).toFixed(1)} kcal | P: ${parseFloat(food.proteins).toFixed(1)}g | G: ${parseFloat(food.carbs).toFixed(1)}g | F: ${parseFloat(food.fibers || 0).toFixed(1)}g | L: ${parseFloat(food.fats).toFixed(1)}g${priceInfo}</div>
        `;
        el.addEventListener('click', editClickHandler);
        el.appendChild(deleteBtn);
        elements.foodsListManage.appendChild(el);
    }
}

/**
 * Affiche les éléments dans chaque repas.
 * @param {{petit_dejeuner: Array, dejeuner: Array, diner: Array, collations: Array}} meals - Les repas de la journée.
 * @param {object} foods - Dictionnaire des aliments.
 * @param {Function} removeHandler - Fonction à appeler pour supprimer un aliment.
 * @param {Function} weightChangeHandler - Fonction à appeler pour changer le poids.
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel).
 */
export function displayMeals(meals, foods, removeHandler, weightChangeHandler, composedMeals = {}) {
    for (const [type, items] of Object.entries(meals)) {
        const container = document.getElementById(type);
        const summaryEl = document.getElementById(`summary-${type}`);
        if (!container || !summaryEl) continue;

        container.innerHTML = '';
        const totals = calculateMealTotals(items, foods, composedMeals);
        
        // Calculer le coût total du repas
        let mealCost = 0;
        items.forEach(item => {
            let food;
            
            // Vérifier si c'est un repas composé
            if (item.isMeal && composedMeals[item.id]) {
                food = composedMeals[item.id];
            } else {
                food = foods[item.id];
            }
            
            if (food) {
                // Utiliser customPrice si défini (priorité absolue)
                if (item.customPrice !== undefined && item.customPrice !== null) {
                    mealCost += item.customPrice;
                }
                // CAS 1 : Repas avec customPortions -> calculer à partir des ingrédients
                else if (item.isMeal && item.customPortions && food.ingredients) {
                    food.ingredients.forEach(ing => {
                        const ingredientFood = foods[ing.foodId];
                        const weight = item.customPortions[ing.foodId] || 0;
                        
                        if (ingredientFood && weight > 0 && hasPrice(ingredientFood)) {
                            const pricePer100g = getPricePer100g(ingredientFood);
                            mealCost += (pricePer100g / 100) * weight;
                        }
                    });
                }
                // CAS 2 : Repas ajustable sans customPortions -> appliquer le prorata du prix de la recette
                else if (item.isMeal && food.isPortionAdjustable && hasPrice(food)) {
                    const totalRecipeWeight = food.totalWeight || 100;
                    const consumedWeight = item.weight || totalRecipeWeight;
                    const factor = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;
                    mealCost += food.price * factor;
                }
                // CAS 3 : Calcul normal
                else if (hasPrice(food)) {
                    const pricePer100g = getPricePer100g(food);
                    mealCost += (pricePer100g / 100) * item.weight;
                }
            }
        });
        
        // Générer le HTML du résumé avec le coût si disponible
        let costHTML = '';
        if (mealCost > 0) {
            costHTML = `<div><strong>💰 Coût:</strong> ${mealCost.toFixed(2)} €</div>`;
        }
        
        summaryEl.innerHTML = `
            <div><strong>Calories:</strong> ${totals.calories.toFixed(0)} kcal</div>
            <div><strong>Protéines:</strong> ${totals.proteins.toFixed(1)} g</div>
            <div><strong>Glucides:</strong> ${totals.carbs.toFixed(1)} g</div>
            <div><strong>Lipides:</strong> ${totals.fats.toFixed(1)} g</div>
            <div><strong>Sucres:</strong> ${totals.sugars.toFixed(1)} g</div>
            <div><strong>Fibres:</strong> ${totals.fibers.toFixed(1)} g</div>
            ${costHTML}
        `;

        items.forEach(item => {
            // Vérifier si c'est un repas composé ou un aliment simple
            let food;
            let isMealComposed = false;
            if (item.isMeal && composedMeals[item.id]) {
                food = composedMeals[item.id];
                isMealComposed = true;
            } else {
                food = foods[item.id];
            }
            
            if (!food) return;

            const el = document.createElement('div');
            el.className = isMealComposed ? 'meal-item composed-meal-item' : 'meal-item';
            el.draggable = true; // Rendre l'élément draggable
            el.dataset.sourceMeal = type; // Type de repas source
            el.dataset.uniqueId = item.uniqueId; // ID unique de l'item
            el.dataset.foodId = item.id; // ID de l'aliment ou repas
            el.dataset.weight = item.weight; // Poids actuel (toujours en grammes)
            if (isMealComposed) el.dataset.isMeal = 'true';
            
            // Calcul des macros : 3 cas possibles
            let cal, prot, carb, fat, sug, fib;
            const totalRecipeWeight = isMealComposed && food.isPortionAdjustable ? (food.totalWeight || 100) : null;
            const consumedWeight = isMealComposed && food.isPortionAdjustable ? (item.weight || totalRecipeWeight) : item.weight;
            
            if (isMealComposed && item.customPortions) {
                // CAS 1 : Repas avec portions personnalisées (ajustées)
                // Calculer les macros depuis les customPortions puis appliquer le ratio poids consommé
                let totals = { calories: 0, proteins: 0, carbs: 0, fats: 0, sugars: 0, fibers: 0 };
                let customTotalWeight = 0;
                
                food.ingredients.forEach(ing => {
                    const ingredientFood = foods[ing.foodId];
                    const weight = item.customPortions[ing.foodId] || 0;
                    customTotalWeight += weight;
                    
                    if (ingredientFood && weight > 0) {
                        totals.calories += (ingredientFood.calories * weight / 100);
                        totals.proteins += (ingredientFood.proteins * weight / 100);
                        totals.carbs += (ingredientFood.carbs * weight / 100);
                        totals.fats += (ingredientFood.fats * weight / 100);
                        totals.sugars += ((ingredientFood.sugars || 0) * weight / 100);
                        totals.fibers += ((ingredientFood.fibers || 0) * weight / 100);
                    }
                });
                
                // Appliquer le ratio poids consommé / poids total recette
                const refWeight = totalRecipeWeight || customTotalWeight || 1;
                const factor = consumedWeight / refWeight;
                cal = (totals.calories * factor).toFixed(0);
                prot = (totals.proteins * factor).toFixed(1);
                carb = (totals.carbs * factor).toFixed(1);
                fat = (totals.fats * factor).toFixed(1);
                sug = (totals.sugars * factor).toFixed(1);
                fib = (totals.fibers * factor).toFixed(1);
            } else if (isMealComposed && food.isPortionAdjustable) {
                // CAS 2 : Repas ajustable sans customPortions -> appliquer le prorata selon le poids consommé
                const factor = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;
                cal = ((food.calories || 0) * factor).toFixed(0);
                prot = ((food.proteins || 0) * factor).toFixed(1);
                carb = ((food.carbs || 0) * factor).toFixed(1);
                fat = ((food.fats || 0) * factor).toFixed(1);
                sug = (((food.sugars || 0) * factor)).toFixed(1);
                fib = (((food.fibers || 0) * factor)).toFixed(1);
            } else {
                // CAS 3 : Calcul normal (aliment ou repas pour 100g)
                cal = (food.calories * item.weight / 100).toFixed(0);
                prot = (food.proteins * item.weight / 100).toFixed(1);
                carb = (food.carbs * item.weight / 100).toFixed(1);
                fat = (food.fats * item.weight / 100).toFixed(1);
                sug = (food.sugars * item.weight / 100).toFixed(1);
                fib = ((food.fibers || 0) * item.weight / 100).toFixed(1);
            }
            
            // Calculer le coût si disponible
            let costInfo = '';
            // Utiliser customPrice si défini (priorité absolue)
            if (item.customPrice !== undefined && item.customPrice !== null) {
                costInfo = ` | 💰 ${item.customPrice.toFixed(2)}€`;
            }
            else if (isMealComposed && item.customPortions) {
                // Repas avec portions personnalisées : calculer le prix puis appliquer le ratio
                let totalCost = 0;
                let customTotalW = 0;
                food.ingredients.forEach(ing => {
                    const ingredientFood = foods[ing.foodId];
                    const weight = item.customPortions[ing.foodId] || 0;
                    customTotalW += weight;
                    
                    if (ingredientFood && weight > 0 && hasPrice(ingredientFood)) {
                        const pricePer100g = getPricePer100g(ingredientFood);
                        totalCost += (pricePer100g / 100) * weight;
                    }
                });
                if (totalCost > 0) {
                    const refW = totalRecipeWeight || customTotalW || 1;
                    const costFactor = consumedWeight / refW;
                    costInfo = ` | 💰 ${(totalCost * costFactor).toFixed(2)}€`;
                }
            } else if (hasPrice(food)) {
                let cost;
                if (isMealComposed && food.isPortionAdjustable) {
                    // Repas ajustable sans customPortions : appliquer le prorata du prix de la recette
                    const factor = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;
                    cost = (food.price * factor).toFixed(2);
                } else {
                    // Calcul normal : prix pour 100g * poids / 100
                    const pricePer100g = getPricePer100g(food);
                    cost = ((pricePer100g / 100) * item.weight).toFixed(2);
                }
                costInfo = ` | 💰 ${cost}€`;
            }
            
            // Gérer l'affichage : portions ou grammes
            const isPortionBased = food.isPortionBased || false;
            const portionWeight = food.portionWeight || null;
            let displayValue, displayUnit, inputStep;
            
            if (isPortionBased && portionWeight) {
                // Afficher en portions
                displayValue = (item.weight / portionWeight).toFixed(1);
                displayUnit = 'p';
                inputStep = '0.1';
                el.dataset.isPortionBased = 'true';
                el.dataset.portionWeight = portionWeight;
            } else {
                // Afficher en grammes
                displayValue = item.weight;
                displayUnit = 'g';
                inputStep = '1';
            }

            const mealBadge = isMealComposed ? '<span class="meal-badge-small">REPAS</span>' : '';
            
            // Vérifier si le repas a des portions ajustables
            const isAdjustable = isMealComposed && food.isPortionAdjustable;

            // Zone de quantité
            const isFullRecipe = isAdjustable && (consumedWeight === totalRecipeWeight);
            let weightSection = '';
            if (isAdjustable) {
                const stateLabel = item.customPortions ? 'Composition personnalisée' : `sur ${totalRecipeWeight} g`;
                weightSection = `
                    <div class="ci-qty-row">
                        <label class="ci-full-recipe">
                            <input type="checkbox" class="ci-full-recipe-cb" ${isFullRecipe ? 'checked' : ''}>
                            <span>Recette entière (${totalRecipeWeight} g)</span>
                        </label>
                        <div class="ci-qty-block">
                            <input class="ci-qty-input" type="number" value="${consumedWeight}" min="1" step="1" ${isFullRecipe ? 'disabled' : ''}>
                            <span class="ci-qty-unit">g</span>
                        </div>
                        <span class="ci-qty-hint">${stateLabel}</span>
                        <button class="ci-adjust-btn" data-unique-id="${item.uniqueId}">⚙ Ajuster</button>
                    </div>
                `;
            } else {
                weightSection = `
                    <div class="ci-qty-row">
                        <div class="ci-qty-block">
                            <input class="ci-qty-input" type="number" value="${displayValue}" min="0.1" step="${inputStep}">
                            <span class="ci-qty-unit">${displayUnit}</span>
                        </div>
                    </div>
                `;
            }

            // Barre de macros
            const costChip = costInfo ? `<span class="ci-macro"><b>${costInfo.replace(' | 💰 ', '').replace('€','')}</b><em>€</em></span>` : '';
            const macrosBar = `
                <div class="ci-macros">
                    <span class="ci-macro ci-macro-kcal"><b>${cal}</b><em>kcal</em></span>
                    <span class="ci-macro"><b>${prot}</b><em>P</em></span>
                    <span class="ci-macro"><b>${carb}</b><em>G</em></span>
                    <span class="ci-macro"><b>${fat}</b><em>L</em></span>
                    <span class="ci-macro"><b>${fib}</b><em>F</em></span>
                    ${costChip}
                </div>
            `;
            
            el.innerHTML = `
                <div class="ci-part1">
                    <div class="ci-drag">⠿</div>
                    ${mealBadge}
                    <div class="ci-actions">
                        <button class="ci-btn-dup" title="Dupliquer">⧉</button>
                        <button class="ci-btn-del" title="Supprimer">✕</button>
                    </div>
                </div>
                <div class="ci-part2">
                    <span class="ci-name">${food.name}</span>
                </div>
                <div class="ci-part3">
                    ${weightSection}
                    ${macrosBar}
                </div>
            `;

            el.querySelector('.ci-btn-del').onclick = () => removeHandler(type, item.uniqueId);
            
            el.querySelector('.ci-btn-dup').onclick = (e) => {
                e.stopPropagation();
                if (window.handleDuplicateMealItem) {
                    window.handleDuplicateMealItem(type, item);
                }
            };
            
            const adjustBtn = el.querySelector('.ci-adjust-btn');
            if (adjustBtn && isAdjustable) {
                adjustBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.handleAdjustPortions) {
                        window.handleAdjustPortions(type, item.uniqueId, item.id, item.customPortions, item.customPrice);
                    }
                };
            }
            
            // ATTACHER LES LISTENERS DE DRAG
            console.log('🔧 Attachement des listeners pour', item.id, '- draggable:', el.draggable);
            
            // TEST: mousedown pour voir si l'élément reçoit les événements
            el.addEventListener('mousedown', function(e) {
                console.log('🖱️ MOUSEDOWN sur meal-item:', this.dataset.foodId, '- target:', e.target.tagName);
            });
            
            el.addEventListener('dragstart', function(e) {
                console.log('🚀 DRAGSTART déclenché !', this.dataset.foodId);
                
                // COMME DANS L'EXEMPLE : stocker this (la référence DOM)
                window.draggedMealElement = this;
                
                // Stocker aussi les données pour la BDD
                window.draggedMealData = {
                    sourceMeal: this.dataset.sourceMeal,
                    uniqueId: parseInt(this.dataset.uniqueId, 10),
                    foodId: this.dataset.foodId,
                    weight: parseFloat(this.dataset.weight),
                    isMeal: this.dataset.isMeal === 'true'
                };
                
                // Effet visuel
                setTimeout(() => this.classList.add('dragging'), 0);
            });
            
            el.addEventListener('dragend', function() {
                console.log('✋ DRAGEND déclenché');
                this.classList.remove('dragging');
                // NE PAS nettoyer window.draggedMealElement ici !
                // Le nettoyage se fera dans handleDrop après utilisation
            });
            
            // Configurer l'input de poids
            const weightInput = el.querySelector('.ci-qty-input');
            if (weightInput) {
                let updating = false;
                const triggerUpdate = () => {
                    if (updating) return;
                    const newVal = parseFloat(weightInput.value);
                    if (isNaN(newVal) || newVal <= 0) return;
                    let valueInGrams = newVal;
                    if (isPortionBased && portionWeight) {
                        valueInGrams = newVal * portionWeight;
                    }
                    updating = true;
                    weightChangeHandler(type, item.uniqueId, valueInGrams);
                };
                weightInput.addEventListener('change', triggerUpdate);
                weightInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        triggerUpdate();
                    }
                });
            }

            // Checkbox "recette entière"
            const fullRecipeCb = el.querySelector('.ci-full-recipe-cb');
            if (fullRecipeCb && isAdjustable) {
                fullRecipeCb.addEventListener('change', () => {
                    if (fullRecipeCb.checked) {
                        weightInput.value = totalRecipeWeight;
                        weightInput.disabled = true;
                        weightChangeHandler(type, item.uniqueId, totalRecipeWeight);
                    } else {
                        weightInput.disabled = false;
                        weightInput.focus();
                    }
                });
            }
            
            container.appendChild(el);
        });
    }
}

/**
 * Gère la logique visuelle de changement d'onglet.
 * @param {string} tabName - L'ID de l'onglet à activer.
 */
export function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.nav-tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}


// --- Fonctions pour la Modale de Modification ---

/**
 * Ouvre la modale de modification et la pré-remplit avec les données de l'aliment.
 * @param {string} foodId - L'ID de l'aliment à modifier.
 * @param {object} foodData - Les données de l'aliment.
 */
export function openEditModal(foodId, foodData) {
    elements.editFoodId.value = foodId;
    elements.editFoodName.value = foodData.name;
    
    // Pré-remplir la catégorie
    const categorySelect = document.getElementById('editFoodCategory');
    if (categorySelect) {
        categorySelect.value = foodData.category || 'other';
    }
    
    // Gérer le type de nutrition (per100g ou perPortion)
    const isPortionBased = foodData.isPortionBased || false;
    const portionWeight = foodData.portionWeight || null;
    
    // Cocher le bon bouton radio nutrition
    const nutritionType = isPortionBased ? 'perPortion' : 'per100g';
    const radioNutrition = document.querySelector(`input[name="editFoodNutritionType"][value="${nutritionType}"]`);
    if (radioNutrition) {
        radioNutrition.checked = true;
    }
    
    // Si c'est basé sur des portions, reconvertir les valeurs /100g en valeurs /portion
    let calories = foodData.calories;
    let proteins = foodData.proteins;
    let carbs = foodData.carbs;
    let sugars = foodData.sugars;
    let fibers = foodData.fibers || 0;
    let fats = foodData.fats;
    
    if (isPortionBased && portionWeight) {
        const ratio = portionWeight / 100;
        calories *= ratio;
        proteins *= ratio;
        carbs *= ratio;
        sugars *= ratio;
        fibers *= ratio;
        fats *= ratio;
        
        // Afficher le poids de portion
        const portionWeightInput = document.getElementById('editFoodPortionWeight');
        if (portionWeightInput) {
            portionWeightInput.value = portionWeight;
        }
    }
    
    elements.editFoodCalories.value = calories.toFixed(1);
    elements.editFoodProteins.value = proteins.toFixed(1);
    elements.editFoodCarbs.value = carbs.toFixed(1);
    elements.editFoodSugars.value = sugars.toFixed(1);
    elements.editFoodFibers.value = fibers.toFixed(1);
    elements.editFoodFats.value = fats.toFixed(1);
    
    // Mettre à jour les labels
    if (typeof window.updateNutritionLabels === 'function') {
        window.updateNutritionLabels('editFood');
    }
    
    elements.editFoodPrice.value = foodData.price || '';
    elements.editFoodPriceQuantity.value = foodData.priceQuantity || foodData.priceGrams || '';
    
    // Cocher le bon bouton radio selon le priceUnit
    const priceUnit = foodData.priceUnit || 'grams';
    const radioToCheck = document.querySelector(`input[name="editFoodPriceType"][value="${priceUnit}"]`);
    if (radioToCheck) {
        radioToCheck.checked = true;
        // Mettre à jour le label dynamiquement
        if (typeof window.updatePriceLabel === 'function') {
            window.updatePriceLabel('editFood');
        }
    }
    
    elements.editModal.classList.add('show');
}

/**
 * Ferme la modale de modification.
 */
export function closeEditModal() {
    elements.editModal.classList.remove('show');
}

/**
 * Affiche une modale par son ID.
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
}

/**
 * Masque une modale par son ID.
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
}

/**
 * Affiche les activités physiques du jour.
 */
export function displayActivities(activities, editHandler, deleteHandler) {
    const container = document.getElementById('activitiesList');
    const summaryDiv = document.getElementById('activitiesSummary');
    
    if (!activities || activities.length === 0) {
        container.innerHTML = '<p class="no-activities">Aucune activité enregistrée aujourd\'hui</p>';
        summaryDiv.style.display = 'none';
        return;
    }
    
    let totalDuration = 0;
    let totalCalories = 0;
    
    container.innerHTML = '';
    activities.forEach(activity => {
        totalDuration += activity.duration;
        totalCalories += activity.calories;
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-info">
                <div class="activity-name">${activity.type}</div>
                <div class="activity-details">⏱️ ${activity.duration} min | 🔥 ${activity.calories} kcal</div>
            </div>
            <div class="activity-actions">
                <button class="activity-edit-btn" data-id="${activity.id}">✏️ Modifier</button>
                <button class="activity-delete-btn" data-id="${activity.id}">🗑️ Supprimer</button>
            </div>
        `;
        
        item.querySelector('.activity-edit-btn').addEventListener('click', () => editHandler(activity.id));
        item.querySelector('.activity-delete-btn').addEventListener('click', () => deleteHandler(activity.id));
        
        container.appendChild(item);
    });
    
    // Afficher le résumé
    document.getElementById('totalDuration').textContent = `${totalDuration} min`;
    document.getElementById('totalActivityCalories').textContent = `${totalCalories} kcal`;
    summaryDiv.style.display = 'flex';
}

/**
 * Affiche les objectifs dans l'onglet Objectifs.
 * @param {object} goals - Les objectifs (calories, proteins, carbs, fats, mb, det, etc.).
 */
export function displayGoals(goals) {
    if (!goals) return;
    
    const resultsSection = document.getElementById('goalsResults');
    resultsSection.style.display = 'block';
    
    // Afficher les résultats calculés
    if (goals.mb) document.getElementById('goalMB').textContent = `${goals.mb} kcal`;
    if (goals.det) document.getElementById('goalDET').textContent = `${goals.det} kcal`;
    document.getElementById('goalCalories').textContent = `${goals.calories} kcal`;
    
    // Mettre à jour le label selon le profil
    const goalCaloriesLabel = document.getElementById('goalCaloriesLabel');
    if (goalCaloriesLabel) {
        const profileLabels = {
            'cut': '🔥 Calories pour la Sèche',
            'weightloss': '📉 Calories pour la Perte de Poids',
            'bulk': '💪 Calories pour la Prise de Masse',
            'maintenance': '⚖️ Calories de Maintenance',
            'recomp': '🎯 Calories pour la Recomposition'
        };
        goalCaloriesLabel.textContent = profileLabels[goals.goalProfile] || '🎯 Calories pour votre objectif';
    }
    document.getElementById('goalProteins').textContent = `${goals.proteins} g`;
    document.getElementById('goalCarbs').textContent = `${goals.carbs} g`;
    document.getElementById('goalFats').textContent = `${goals.fats} g`;
    
    // Pré-remplir les inputs pour édition manuelle
    document.getElementById('goalProteinsInput').value = goals.proteins;
    document.getElementById('goalCarbsInput').value = goals.carbs;
    document.getElementById('goalFatsInput').value = goals.fats;
    
    // Afficher le bouton modifier
    document.getElementById('editMacrosBtn').style.display = 'inline-block';
    
    // Afficher les objectifs hydratation et pas
    const waterGoal = goals.waterGoal || 2000;
    const stepsGoal = goals.stepsGoal || 10000;
    document.getElementById('goalWaterDisplay').textContent = `${waterGoal} ml`;
    document.getElementById('goalStepsDisplay').textContent = `${stepsGoal} pas`;
    
    // Pré-remplir les inputs wellness
    document.getElementById('goalWaterEditInput').value = waterGoal;
    document.getElementById('goalStepsEditInput').value = stepsGoal;
    
    // Afficher le bouton modifier wellness
    document.getElementById('editWellnessBtn').style.display = 'inline-block';
    
    // Pré-remplir tous les champs du formulaire
    if (goals.goalProfile) {
        document.getElementById('goalProfile').value = goals.goalProfile;
        // Déclencher l'événement change pour mettre à jour l'interface et les conseils
        setTimeout(() => {
            const event = new Event('change');
            document.getElementById('goalProfile').dispatchEvent(event);
        }, 100);
    }
    if (goals.sexe) {
        const radioToCheck = goals.sexe === 'homme' ? 'homme' : 'femme';
        document.getElementById(radioToCheck).checked = true;
    }
    if (goals.age) document.getElementById('age').value = goals.age;
    if (goals.weight) document.getElementById('goalWeight').value = goals.weight;
    if (goals.taille) document.getElementById('taille').value = goals.taille;
    if (goals.activite) document.getElementById('activite').value = goals.activite;
    // Gérer l'ancien format (deficitPercent) et le nouveau (adjustmentPercent)
    const adjustmentValue = goals.adjustmentPercent !== undefined ? goals.adjustmentPercent : goals.deficitPercent;
    if (adjustmentValue !== undefined) {
        const calorieAdjustmentEl = document.getElementById('calorieAdjustment');
        if (calorieAdjustmentEl) calorieAdjustmentEl.value = adjustmentValue;
    }
    if (goals.waterGoal) document.getElementById('waterGoalInput').value = goals.waterGoal;
    if (goals.stepsGoal) document.getElementById('stepsGoalInput').value = goals.stepsGoal;
    if (goals.sugarsMax !== undefined) document.getElementById('sugarsMaxInput').value = goals.sugarsMax;
    if (goals.fibersMin !== undefined) document.getElementById('fibersMinInput').value = goals.fibersMin;
}

/**
 * Met à jour l'affichage de l'hydratation.
 * @param {object} waterData - Données d'hydratation {totalMl, history}.
 * @param {object|null} goals - Les objectifs (optionnel).
 */
export function updateWaterDisplay(waterData, goals = null) {
    const waterGoal = (goals && goals.waterGoal) || 2000; // 2L par défaut
    const totalMl = waterData.totalMl || 0;
    const percentage = Math.min((totalMl / waterGoal) * 100, 100);
    
    document.getElementById('waterGoal').textContent = waterGoal;
    document.getElementById('waterValue').textContent = `${totalMl} ml / ${waterGoal} ml`;
    document.getElementById('waterProgress').style.width = `${percentage}%`;
}

/**
 * Met à jour l'affichage des pas.
 * @param {number} steps - Nombre de pas.
 * @param {object|null} goals - Les objectifs (optionnel).
 */
export function updateStepsDisplay(steps, goals = null) {
    const stepsGoal = (goals && goals.stepsGoal) || 10000; // 10000 pas par défaut
    const percentage = Math.min((steps / stepsGoal) * 100, 100);
    
    document.getElementById('stepsGoal').textContent = stepsGoal;
    document.getElementById('stepsValue').textContent = `${steps} / ${stepsGoal} pas`;
    document.getElementById('stepsProgress').style.width = `${percentage}%`;
    document.getElementById('stepsInput').value = steps;
}

/**
 * Met à jour le résumé quotidien affiché.
 * @param {object} meals - Les repas de la journée.
 * @param {object} foods - Dictionnaire des aliments.
 * @param {object} totals - Totaux nutritionnels.
 * @param {string} date - Date formatée.
 * @param {object} waterData - Données d'hydratation (optionnel).
 * @param {number} steps - Nombre de pas (optionnel).
 * @param {array} activities - Activités sportives (optionnel).
 * @param {object} goals - Les objectifs (optionnel).
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel).
 */
export function updateDailySummary(meals, foods, totals, date, waterData = 0, steps = 0, activities = [], goals = null, composedMeals = {}) {
    const summaryContent = document.getElementById('dailySummaryContent');
    
    // Vérifier s'il y a des aliments
    const hasFood = Object.values(meals).some(mealItems => mealItems.length > 0);
    if (!hasFood) {
        summaryContent.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">Aucun aliment ajouté pour cette journée.</p>';
        return;
    }
    
    let summary = `📅 ${date}\n\n`;
    let showIngredientDetails = true; // Flag pour afficher les détails des repas ajustés
    let totalCost = 0;
    
    // Hydratation
    const waterGoal = (goals && goals.waterGoal) || 2000;
    const waterMl = (waterData && waterData.totalMl) || 0;
    summary += '💧 HYDRATATION\n';
    summary += '─────────────────────────────\n';
    summary += `  • Total : ${waterMl} ml / ${waterGoal} ml\n\n`;
    
    // Nombre de pas
    const stepsGoal = (goals && goals.stepsGoal) || 10000;
    summary += '👟 ACTIVITÉ QUOTIDIENNE\n';
    summary += '─────────────────────────────\n';
    summary += `  • Nombre de pas : ${steps} pas / ${stepsGoal} pas\n\n`;
    
    // Activités sportives
    if (activities && activities.length > 0) {
        let totalActivityDuration = 0;
        let totalActivityCalories = 0;
        
        summary += '🏃 ACTIVITÉS SPORTIVES\n';
        summary += '─────────────────────────────\n';
        activities.forEach(activity => {
            summary += `  • ${activity.type} - ${activity.duration} min (${activity.calories} kcal)\n`;
            totalActivityDuration += activity.duration;
            totalActivityCalories += activity.calories;
        });
        summary += `  ➜ Total : ${totalActivityDuration} min | ${totalActivityCalories} kcal brûlées\n\n`;
    }
    
    const mealNames = {
        'petit-dej': '🌅 PETIT-DÉJEUNER',
        'dejeuner': '☀️ DÉJEUNER',
        'diner': '🌙 DÎNER',
        'snack': '🍎 SNACK'
    };
    
    // Pour chaque repas
    Object.keys(mealNames).forEach(mealType => {
        const mealItems = meals[mealType] || [];
        if (mealItems.length > 0) {
            summary += `${mealNames[mealType]}\n`;
            summary += '─────────────────────────────\n';
            
            // Calculer les totaux du repas
            let mealCal = 0, mealProt = 0, mealCarb = 0, mealFat = 0, mealCost = 0;
            
            mealItems.forEach(item => {
                let food;
                let itemLabel = '';
                
                // Vérifier si c'est un repas composé
                if (item.isMeal && composedMeals[item.id]) {
                    food = composedMeals[item.id];
                    itemLabel = '🍽️ '; // Badge pour les repas
                } else {
                    food = foods[item.id];
                }
                
                if (food) {
                    let itemCal = 0, itemProt = 0, itemCarb = 0, itemFat = 0, itemCost = 0;
                    
                    // CAS 1 : Repas avec customPortions - Afficher le détail des ingrédients
                    if (item.isMeal && item.customPortions && food.ingredients) {
                        summary += `  • ${itemLabel}${food.name} :\n`;
                        
                        food.ingredients.forEach(ing => {
                            const ingredientFood = foods[ing.foodId];
                            const weight = item.customPortions[ing.foodId] || 0;
                            
                            if (ingredientFood) {
                                if (weight > 0) {
                                    // Ingrédient normal avec poids > 0
                                    const factor = weight / 100;
                                    itemCal += ingredientFood.calories * factor;
                                    itemProt += ingredientFood.proteins * factor;
                                    itemCarb += ingredientFood.carbs * factor;
                                    itemFat += ingredientFood.fats * factor;
                                    
                                    let ingCost = 0;
                                    if (hasPrice(ingredientFood)) {
                                        const pricePer100g = getPricePer100g(ingredientFood);
                                        ingCost = (pricePer100g / 100) * weight;
                                        itemCost += ingCost;
                                    }
                                    
                                    let ingInfo = `    ◦ ${ingredientFood.name} - ${weight}g`;
                                    if (ingCost > 0) {
                                        ingInfo += ` (${ingCost.toFixed(2)}€)`;
                                    }
                                    summary += ingInfo + '\n';
                                } else {
                                    // Ingrédient à 0g : nom barré, 0g, 0€
                                    let ingInfo = `    ◦ <s>${ingredientFood.name}</s> - 0g (0.00€)`;
                                    summary += ingInfo + '\n';
                                }
                            }
                        });
                        
                        // Utiliser prix personnalisé si défini, sinon prix calculé
                        if (item.customPrice !== undefined && item.customPrice !== null) {
                            itemCost = item.customPrice;
                        }
                        
                        // Ajouter aux totaux
                        mealCal += itemCal;
                        mealProt += itemProt;
                        mealCarb += itemCarb;
                        mealFat += itemFat;
                        mealCost += itemCost;
                        totalCost += itemCost;
                    }
                    // CAS 2 : Repas ajustable sans customPortions -> appliquer le prorata selon le poids consommé
                    else if (item.isMeal && food.isPortionAdjustable) {
                        const totalRecipeWeight = food.totalWeight || 100;
                        const consumedWeight = item.weight || totalRecipeWeight;
                        const factor = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;
                        itemCal = food.calories * factor;
                        itemProt = food.proteins * factor;
                        itemCarb = food.carbs * factor;
                        itemFat = food.fats * factor;
                        
                        // Utiliser prix personnalisé si défini, sinon prix du repas
                        if (item.customPrice !== undefined && item.customPrice !== null) {
                            itemCost = item.customPrice;
                        } else if (hasPrice(food)) {
                            itemCost = food.price * factor;
                        }
                        
                        // Ajouter aux totaux
                        mealCal += itemCal;
                        mealProt += itemProt;
                        mealCarb += itemCarb;
                        mealFat += itemFat;
                        mealCost += itemCost;
                        totalCost += itemCost;
                        
                        let itemInfo = `  • ${itemLabel}${food.name} - ${item.weight}g`;
                        if (itemCost > 0) {
                            itemInfo += ` (${itemCost.toFixed(2)}€)`;
                        }
                        summary += itemInfo + '\n';
                    }
                    // CAS 3 : Calcul normal
                    else {
                        const factor = item.weight / 100;
                        itemCal = food.calories * factor;
                        itemProt = food.proteins * factor;
                        itemCarb = food.carbs * factor;
                        itemFat = food.fats * factor;
                        
                        if (hasPrice(food)) {
                            const pricePer100g = getPricePer100g(food);
                            itemCost = (pricePer100g / 100) * item.weight;
                        }
                        
                        // Ajouter aux totaux
                        mealCal += itemCal;
                        mealProt += itemProt;
                        mealCarb += itemCarb;
                        mealFat += itemFat;
                        mealCost += itemCost;
                        totalCost += itemCost;
                        
                        let itemInfo = `  • ${itemLabel}${food.name} - ${item.weight}g`;
                        if (itemCost > 0) {
                            itemInfo += ` (${itemCost.toFixed(2)}€)`;
                        }
                        summary += itemInfo + '\n';
                    }
                }
            });
            
            // Afficher le total du repas
            summary += `  ➜ Total : ${mealCal.toFixed(0)} kcal | P: ${mealProt.toFixed(1)}g | G: ${mealCarb.toFixed(1)}g | L: ${mealFat.toFixed(1)}g`;
            if (mealCost > 0) {
                summary += ` | 💰 ${mealCost.toFixed(2)}€`;
            }
            summary += '\n\n';
        }
    });
    
    // Totaux
    summary += '═══════════════════════════════\n';
    summary += '📊 TOTAUX DE LA JOURNÉE\n';
    summary += '═══════════════════════════════\n';
    summary += `🔥 Calories Consommées : ${totals.calories.toFixed(0)} kcal\n`;
    summary += `🥩 Protéines : ${totals.proteins.toFixed(1)} g\n`;
    summary += `🍚 Glucides : ${totals.carbs.toFixed(1)} g\n`;
    summary += `🍬 Sucres : ${totals.sugars.toFixed(1)} g\n`;
    summary += `🌾 Fibres : ${totals.fibers.toFixed(1)} g\n`;
    summary += `🥑 Lipides : ${totals.fats.toFixed(1)} g\n`;
    
    // Ajouter calories brûlées si activités
    if (activities && activities.length > 0) {
        const totalCaloriesBurned = activities.reduce((sum, a) => sum + a.calories, 0);
        summary += `🔥 Calories Brûlées : ${totalCaloriesBurned} kcal\n`;
        const netCalories = totals.calories - totalCaloriesBurned;
        summary += `📊 Bilan Net : ${netCalories.toFixed(0)} kcal\n`;
    }
    
    // Ajouter coût total si au moins un aliment a un prix
    if (totalCost > 0) {
        summary += `💰 Coût Total : ${totalCost.toFixed(2)} €\n`;
    }
    
    // Convertir le texte en HTML (remplacer \n par <br> et préserver les balises <s>)
    summaryContent.innerHTML = summary.replace(/\n/g, '<br>');
}

/**
 * Génère le texte du résumé pour l'export / copie.
 * @param {object} meals - Les repas de la journée.
 * @param {object} foods - Dictionnaire des aliments.
 * @param {object} totals - Totaux nutritionnels.
 * @param {string} date - Date formatée.
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel).
 * @returns {string} Le texte du résumé.
 */
export function generateSummaryText(meals, foods, totals, date, waterData = 0, steps = 0, activities = [], goals = null, composedMeals = {}) {
    let summary = `📅 ${date}\n\n`;
    let totalCost = 0;
    
    // Hydratation
    const waterGoal = (goals && goals.waterGoal) || 2000;
    const waterMl = (waterData && waterData.totalMl) || 0;
    summary += '💧 HYDRATATION\n';
    summary += '─────────────────────────────\n';
    summary += `  • Total : ${waterMl} ml / ${waterGoal} ml\n\n`;
    
    // Nombre de pas
    const stepsGoal = (goals && goals.stepsGoal) || 10000;
    summary += '👟 ACTIVITÉ QUOTIDIENNE\n';
    summary += '─────────────────────────────\n';
    summary += `  • Nombre de pas : ${steps} pas / ${stepsGoal} pas\n\n`;
    
    // Activités sportives
    if (activities && activities.length > 0) {
        let totalActivityDuration = 0;
        let totalActivityCalories = 0;
        
        summary += '🏃 ACTIVITÉS SPORTIVES\n';
        summary += '─────────────────────────────\n';
        activities.forEach(activity => {
            summary += `  • ${activity.type} - ${activity.duration} min (${activity.calories} kcal)\n`;
            totalActivityDuration += activity.duration;
            totalActivityCalories += activity.calories;
        });
        summary += `  ➜ Total : ${totalActivityDuration} min | ${totalActivityCalories} kcal brûlées\n\n`;
    }
    
    const mealNames = {
        'petit-dej': '🌅 PETIT-DÉJEUNER',
        'dejeuner': '☀️ DÉJEUNER',
        'diner': '🌙 DÎNER',
        'snack': '🍎 SNACK'
    };
    
    // Pour chaque repas
    Object.keys(mealNames).forEach(mealType => {
        const mealItems = meals[mealType] || [];
        if (mealItems.length > 0) {
            summary += `${mealNames[mealType]}\n`;
            summary += '─────────────────────────────\n';
            
            // Calculer les totaux du repas
            let mealCal = 0, mealProt = 0, mealCarb = 0, mealFat = 0, mealCost = 0;
            
            mealItems.forEach(item => {
                let food;
                let itemLabel = '';
                
                // Vérifier si c'est un repas composé
                if (item.isMeal && composedMeals[item.id]) {
                    food = composedMeals[item.id];
                    itemLabel = '🍽️ '; // Badge pour les repas
                } else {
                    food = foods[item.id];
                }
                
                if (food) {
                    let itemCal = 0, itemProt = 0, itemCarb = 0, itemFat = 0, itemCost = 0;
                    
                    // CAS 1 : Repas avec customPortions - Afficher le détail des ingrédients
                    if (item.isMeal && item.customPortions && food.ingredients) {
                        summary += `  • ${itemLabel}${food.name} :\n`;
                        
                        food.ingredients.forEach(ing => {
                            const ingredientFood = foods[ing.foodId];
                            const weight = item.customPortions[ing.foodId] || 0;
                            
                            if (ingredientFood) {
                                if (weight > 0) {
                                    // Ingrédient normal avec poids > 0
                                    const factor = weight / 100;
                                    itemCal += ingredientFood.calories * factor;
                                    itemProt += ingredientFood.proteins * factor;
                                    itemCarb += ingredientFood.carbs * factor;
                                    itemFat += ingredientFood.fats * factor;
                                    
                                    let ingCost = 0;
                                    if (hasPrice(ingredientFood)) {
                                        const pricePer100g = getPricePer100g(ingredientFood);
                                        ingCost = (pricePer100g / 100) * weight;
                                        itemCost += ingCost;
                                    }
                                    
                                    let ingInfo = `    ◦ ${ingredientFood.name} - ${weight}g`;
                                    if (ingCost > 0) {
                                        ingInfo += ` (${ingCost.toFixed(2)}€)`;
                                    }
                                    summary += ingInfo + '\n';
                                } else {
                                    // Ingrédient à 0g : nom barré, 0g, 0€
                                    let ingInfo = `    ◦ <s>${ingredientFood.name}</s> - 0g (0.00€)`;
                                    summary += ingInfo + '\n';
                                }
                            }
                        });
                        
                        // Utiliser prix personnalisé si défini, sinon prix calculé
                        if (item.customPrice !== undefined && item.customPrice !== null) {
                            itemCost = item.customPrice;
                        }
                        
                        // Ajouter aux totaux
                        mealCal += itemCal;
                        mealProt += itemProt;
                        mealCarb += itemCarb;
                        mealFat += itemFat;
                        mealCost += itemCost;
                        totalCost += itemCost;
                    }
                    // CAS 2 : Repas ajustable sans customPortions -> appliquer le prorata selon le poids consommé
                    else if (item.isMeal && food.isPortionAdjustable) {
                        const totalRecipeWeight = food.totalWeight || 100;
                        const consumedWeight = item.weight || totalRecipeWeight;
                        const factor = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;
                        itemCal = food.calories * factor;
                        itemProt = food.proteins * factor;
                        itemCarb = food.carbs * factor;
                        itemFat = food.fats * factor;
                        
                        // Utiliser prix personnalisé si défini, sinon prix du repas
                        if (item.customPrice !== undefined && item.customPrice !== null) {
                            itemCost = item.customPrice;
                        } else if (hasPrice(food)) {
                            itemCost = food.price * factor;
                        }
                        
                        // Ajouter aux totaux
                        mealCal += itemCal;
                        mealProt += itemProt;
                        mealCarb += itemCarb;
                        mealFat += itemFat;
                        mealCost += itemCost;
                        totalCost += itemCost;
                        
                        let itemInfo = `  • ${itemLabel}${food.name} - ${item.weight}g`;
                        if (itemCost > 0) {
                            itemInfo += ` (${itemCost.toFixed(2)}€)`;
                        }
                        summary += itemInfo + '\n';
                    }
                    // CAS 3 : Calcul normal
                    else {
                        const factor = item.weight / 100;
                        itemCal = food.calories * factor;
                        itemProt = food.proteins * factor;
                        itemCarb = food.carbs * factor;
                        itemFat = food.fats * factor;
                        
                        if (hasPrice(food)) {
                            const pricePer100g = getPricePer100g(food);
                            itemCost = (pricePer100g / 100) * item.weight;
                        }
                        
                        // Ajouter aux totaux
                        mealCal += itemCal;
                        mealProt += itemProt;
                        mealCarb += itemCarb;
                        mealFat += itemFat;
                        mealCost += itemCost;
                        totalCost += itemCost;
                        
                        let itemInfo = `  • ${itemLabel}${food.name} - ${item.weight}g`;
                        if (itemCost > 0) {
                            itemInfo += ` (${itemCost.toFixed(2)}€)`;
                        }
                        summary += itemInfo + '\n';
                    }
                }
            });
            
            // Afficher le total du repas
            summary += `  ➜ Total : ${mealCal.toFixed(0)} kcal | P: ${mealProt.toFixed(1)}g | G: ${mealCarb.toFixed(1)}g | L: ${mealFat.toFixed(1)}g`;
            if (mealCost > 0) {
                summary += ` | 💰 ${mealCost.toFixed(2)}€`;
            }
            summary += '\n\n';
        }
    });
    
    // Totaux
    summary += '═══════════════════════════════\n';
    summary += '📊 TOTAUX DE LA JOURNÉE\n';
    summary += '═══════════════════════════════\n';
    summary += `🔥 Calories Consommées : ${totals.calories.toFixed(0)} kcal\n`;
    summary += `🥩 Protéines : ${totals.proteins.toFixed(1)} g\n`;
    summary += `🍚 Glucides : ${totals.carbs.toFixed(1)} g\n`;
    summary += `🍬 Sucres : ${totals.sugars.toFixed(1)} g\n`;
    summary += `🌾 Fibres : ${totals.fibers.toFixed(1)} g\n`;
    summary += `🥑 Lipides : ${totals.fats.toFixed(1)} g\n`;
    
    // Ajouter calories brûlées si activités
    if (activities && activities.length > 0) {
        const totalCaloriesBurned = activities.reduce((sum, a) => sum + a.calories, 0);
        summary += `🔥 Calories Brûlées : ${totalCaloriesBurned} kcal\n`;
        const netCalories = totals.calories - totalCaloriesBurned;
        summary += `📊 Bilan Net : ${netCalories.toFixed(0)} kcal\n`;
    }
    
    // Ajouter coût total si au moins un aliment a un prix
    if (totalCost > 0) {
        summary += `💰 Coût Total : ${totalCost.toFixed(2)} €\n`;
    }
    
    return summary;
}