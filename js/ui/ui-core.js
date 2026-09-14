// js/ui.js

import { formatDateDisplay } from '../core/utils.js';
import { calculateMealTotals } from '../core/utils.js';

// --- Fonctions helper pour les prix ---

/**
 * Calcule le prix pour 100g d'un aliment
 * Gère les anciennes données (priceGrams) et les nouvelles (priceQuantity + priceUnit)
 * @param {object} food - L'aliment
 * @returns {number|null} - Prix pour 100g ou null si non disponible
 */
function getPricePer100g(food) {
    const price = Number(food?.price);
    if (!Number.isFinite(price) || price <= 0) return null;

    // Nouveau format : priceQuantity + priceUnit
    const priceQuantity = Number(food?.priceQuantity);
    if (Number.isFinite(priceQuantity) && priceQuantity > 0) {
        const priceUnit = food.priceUnit || 'grams';
        if (priceUnit === 'grams') {
            return (price / priceQuantity) * 100;
        } else if (priceUnit === 'portions') {
            // Utiliser le poids réel de la portion si disponible, sinon 100g par défaut
            const portionWeight = Number(food.portionWeight) || 100;
            const totalGrams = priceQuantity * portionWeight;
            return totalGrams > 0 ? (price / totalGrams) * 100 : null;
        }
    }

    // Ancien format (rétrocompatibilité) : priceGrams
    const priceGrams = Number(food?.priceGrams);
    if (Number.isFinite(priceGrams) && priceGrams > 0) {
        return (price / priceGrams) * 100;
    }

    return null;
}

/**
 * Vérifie si un aliment a des informations de prix
 * @param {object} food - L'aliment
 * @returns {boolean}
 */
function hasPrice(food) {
    return getPricePer100g(food) !== null;
}

/**
 * Échappe une valeur destinée à être interpolée dans du HTML.
 * Les noms d'aliments et de repas peuvent provenir d'un import JSON :
 * sans échappement, un nom comme `<img src=x onerror=...>` s'exécutait.
 * @param {*} value - La valeur à échapper.
 * @returns {string}
 */
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
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
    bedtimeInput: document.getElementById('bedtimeInput'),
    saveBedtimeBtn: document.getElementById('saveBedtimeBtn'),
    sleepDurationHoursInput: document.getElementById('sleepDurationHoursInput'),
    sleepDurationMinutesInput: document.getElementById('sleepDurationMinutesInput'),
    saveSleepDurationBtn: document.getElementById('saveSleepDurationBtn'),
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
    editFoodGlycemicIndex: document.getElementById('editFoodGlycemicIndex'),
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
 * @param {number} burnedCalories - Calories brûlées lors des activités physiques.
 * @param {number|null} currentWeight - Poids du jour en kg, si disponible.
 */
export function updateSummary(totals, goals = null, burnedCalories = 0, currentWeight = null) {
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
        // Sans objectif, on ne peut pas calculer de progression : afficher 100 %
        // laissait croire à un objectif atteint sur un profil vierge.
        if (!goal) return 0;
        const percentage = (current / goal) * 100;
        if (!Number.isFinite(percentage)) return 0;
        return Math.max(0, Math.min(percentage, 100));
    };

    // Calories — on déduit les calories brûlées pour obtenir le net consommé
    const caloriesConsumed = Math.round(totals.calories);
    const caloriesBurned = Math.round(burnedCalories);
    const caloriesNet = caloriesConsumed - caloriesBurned;
    const caloriesGoal = goals?.calories || 0;
    const totalCaloriesEl = document.getElementById('totalCalories');
    if (goals) {
        const remaining = caloriesGoal - caloriesNet;
        const remainingLabel = remaining >= 0
            ? `Il reste <strong>${remaining} kcal</strong>`
            : `Dépassement de <strong>${Math.abs(remaining)} kcal</strong>`;
        if (caloriesBurned > 0) {
            totalCaloriesEl.innerHTML =
                `${caloriesNet} / ${caloriesGoal} kcal<br>
                <small style="opacity:0.8">${remainingLabel}</small>`;
        } else {
            totalCaloriesEl.innerHTML =
                `${caloriesConsumed} / ${caloriesGoal} kcal<br>
                <small style="opacity:0.8">${remainingLabel}</small>`;
        }
    } else {
        totalCaloriesEl.textContent = `${caloriesConsumed} kcal`;
    }
    const caloriesProgress = document.getElementById('caloriesProgress');
    if (caloriesProgress) {
        caloriesProgress.style.width = `${getPercentage(caloriesNet, caloriesGoal)}%`;
        caloriesProgress.className = `progress-fill ${getProgressClass(caloriesNet, caloriesGoal)}`;
    }

    // Protéines
    const proteinsCurrent = totals.proteins.toFixed(1);
    const proteinsGoal = goals?.proteins || 0;
    const proteinWeight = Number(currentWeight) > 0 ? Number(currentWeight) : Number(goals?.weight) || 0;
    const proteinRatio = proteinWeight > 0 ? totals.proteins / proteinWeight : null;
    const proteinRatioText = proteinRatio !== null
        ? `<br><small style="opacity:0.8">${proteinRatio.toFixed(2)} g/kg</small>`
        : '';
    document.getElementById('totalProteins').innerHTML = goals
        ? `${proteinsCurrent} / ${proteinsGoal} g${proteinRatioText}`
        : `${proteinsCurrent} g${proteinRatioText}`;
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

export function updateBedtimeDisplay(bedtime) {
    if (elements.bedtimeInput) {
        elements.bedtimeInput.value = bedtime || '';
    }
}

export function updateSleepDurationDisplay(sleepDuration) {
    if (elements.sleepDurationHoursInput && elements.sleepDurationMinutesInput) {
        if (sleepDuration === null || sleepDuration === undefined || sleepDuration === '') {
            elements.sleepDurationHoursInput.value = '';
            elements.sleepDurationMinutesInput.value = '';
            return;
        }
        const totalMinutes = Math.round(Number(sleepDuration) * 60);
        elements.sleepDurationHoursInput.value = Math.floor(totalMinutes / 60);
        elements.sleepDurationMinutesInput.value = totalMinutes % 60;
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
    const glycemicInfo = food.glycemicIndex !== undefined && food.glycemicIndex !== null
        ? ` | IG: ${parseFloat(food.glycemicIndex).toFixed(0)}`
        : '';
    const glycemicLoadInfo = food.glycemicLoad !== undefined && food.glycemicLoad !== null
        ? ` | CG: ${parseFloat(food.glycemicLoad).toFixed(1)}`
        : '';

    el.innerHTML = `
        <span class="food-category-icon">${categoryIcon}</span>
        <div class="food-item-header">
            <div class="food-name">${escapeHtml(food.name)}</div>
            <button class="quick-action-btn" data-food-id="${escapeHtml(id)}" title="Ajouter rapidement">+</button>
        </div>
        <div class="food-calories">${parseFloat(food.calories).toFixed(1)} kcal | P: ${parseFloat(food.proteins).toFixed(1)}g | G: ${parseFloat(food.carbs).toFixed(1)}g | F: ${parseFloat(food.fibers || 0).toFixed(1)}g | L: ${parseFloat(food.fats).toFixed(1)}g${glycemicInfo}${glycemicLoadInfo}${priceInfo}</div>
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
                ${escapeHtml(meal.name)}
            </div>
            <button class="quick-action-btn" data-food-id="${escapeHtml(id)}" title="Ajouter rapidement">+</button>
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
        const glycemicInfo = food.glycemicIndex !== undefined && food.glycemicIndex !== null
            ? ` | IG: ${parseFloat(food.glycemicIndex).toFixed(0)}`
            : '';
        const glycemicLoadInfo = food.glycemicLoad !== undefined && food.glycemicLoad !== null
            ? ` | CG: ${parseFloat(food.glycemicLoad).toFixed(1)}`
            : '';

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
            <div class="food-name">${escapeHtml(food.name)}</div>
            <div class="food-calories">${parseFloat(food.calories).toFixed(1)} kcal | P: ${parseFloat(food.proteins).toFixed(1)}g | G: ${parseFloat(food.carbs).toFixed(1)}g | F: ${parseFloat(food.fibers || 0).toFixed(1)}g | L: ${parseFloat(food.fats).toFixed(1)}g${glycemicInfo}${glycemicLoadInfo}${priceInfo}</div>
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
    if (elements.editFoodGlycemicIndex) {
        elements.editFoodGlycemicIndex.value = foodData.glycemicIndex ?? '';
    }

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
        const timeInfo = activity.time ? `🕒 ${activity.time} | ` : '';
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-info">
                <div class="activity-name">${activity.type}</div>
                <div class="activity-details">${timeInfo}⏱️ ${activity.duration} min | 🔥 ${activity.calories} kcal</div>
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
    const bmrFormulaEl = document.getElementById('bmrFormula');
    if (bmrFormulaEl) bmrFormulaEl.value = goals.bmrFormula || 'mifflin';
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
