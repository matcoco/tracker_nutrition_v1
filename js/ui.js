// js/ui.js

import { formatDateDisplay } from './utils.js';
import { calculateMealTotals } from './utils.js';

// --- Éléments du DOM ---
// On met en cache les éléments fréquemment utilisés pour de meilleures performances.
const elements = {
    currentDate: document.getElementById('currentDate'),
    totalCalories: document.getElementById('totalCalories'),
    totalProteins: document.getElementById('totalProteins'),
    totalCarbs: document.getElementById('totalCarbs'),
    totalFats: document.getElementById('totalFats'),
    totalSugars: document.getElementById('totalSugars'),
    weightInput: document.getElementById('weightInput'),
    saveWeightBtn: document.getElementById('saveWeightBtn'),
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
    editFoodPriceGrams: document.getElementById('editFoodPriceGrams'),
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
 * Affiche la liste des aliments disponibles pour le glisser-déposer.
 * @param {object} foods - Le dictionnaire de tous les aliments.
 * @param {Function} dragStartHandler - La fonction à appeler au début du drag.
 * @param {Function} quickAddHandler - La fonction à appeler pour l'ajout rapide.
 * @param {number} maxItems - Nombre maximum d'aliments à afficher (0 = tous).
 */
export function displayFoods(foods, dragStartHandler, quickAddHandler, maxItems = 20) {
    elements.foodsList.innerHTML = '';
    const foodsArray = Object.entries(foods);
    const itemsToShow = maxItems > 0 ? Math.min(maxItems, foodsArray.length) : foodsArray.length;
    
    for (let i = 0; i < itemsToShow; i++) {
        const [id, food] = foodsArray[i];
        const el = createFoodElement(id, food, dragStartHandler, quickAddHandler);
        elements.foodsList.appendChild(el);
    }
    
    // Gérer le bouton "Voir plus"
    updateLoadMoreButton(foodsArray.length, itemsToShow);
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
    
    // Calculer prix au 100g si disponible
    let priceInfo = '';
    if (food.price && food.priceGrams) {
        const pricePer100g = (food.price / food.priceGrams * 100).toFixed(2);
        priceInfo = ` | 💰 ${pricePer100g}€/100g`;
    }
    
    el.innerHTML = `
        <div class="food-item-header">
            <div class="food-name">${food.name}</div>
            <button class="quick-action-btn" data-food-id="${id}" title="Ajouter rapidement">+</button>
        </div>
        <div class="food-calories">${food.calories} kcal | P: ${food.proteins}g | G: ${food.carbs}g | F: ${food.fibers || 0}g | L: ${food.fats}g${priceInfo}</div>
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
 * Affiche les aliments dans l'onglet de gestion, les rendant cliquables pour modification.
 * @param {object} foods - Le dictionnaire de tous les aliments.
 * @param {Function} editClickHandler - La fonction à appeler lors d'un clic sur un aliment.
 * @param {Function} deleteClickHandler - La fonction à appeler lors d'un clic sur le bouton supprimer.
 */
export function displayFoodsManage(foods, editClickHandler, deleteClickHandler) {
    elements.foodsListManage.innerHTML = '';
    for (const [id, food] of Object.entries(foods)) {
        const el = document.createElement('div');
        el.className = 'food-item';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.dataset.foodId = id;
        el.dataset.foodName = food.name;
        
        let priceInfo = '';
        if (food.price && food.priceGrams) {
            const pricePer100g = (food.price / food.priceGrams * 100).toFixed(2);
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
        
        el.innerHTML = `<div class="food-name">${food.name}</div><div class="food-calories">${food.calories} kcal | P: ${food.proteins}g | G: ${food.carbs}g | F: ${food.fibers || 0}g | L: ${food.fats}g${priceInfo}</div>`;
        el.addEventListener('click', editClickHandler);
        el.appendChild(deleteBtn);
        elements.foodsListManage.appendChild(el);
    }
}

/**
 * Affiche tous les repas de la journée.
 * @param {object} meals - L'objet contenant les 4 repas du jour.
 * @param {object} foods - Le dictionnaire de tous les aliments.
 * @param {Function} removeHandler - Fonction à appeler pour supprimer un aliment.
 * @param {Function} weightChangeHandler - Fonction à appeler pour changer le poids.
 * @param {Function} mealItemDragStartHandler - Fonction à appeler au début du drag d'un meal-item.
 */
export function displayMeals(meals, foods, removeHandler, weightChangeHandler, mealItemDragStartHandler) {
    for (const [type, items] of Object.entries(meals)) {
        const container = document.getElementById(type);
        const summaryEl = document.getElementById(`summary-${type}`);
        if (!container || !summaryEl) continue;

        container.innerHTML = '';
        const totals = calculateMealTotals(items, foods);
        
        // Calculer le coût total du repas
        let mealCost = 0;
        items.forEach(item => {
            const food = foods[item.id];
            if (food && food.price && food.priceGrams) {
                mealCost += (food.price / food.priceGrams * item.weight);
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
            const food = foods[item.id];
            if (!food) return;

            const el = document.createElement('div');
            el.className = 'meal-item';
            el.draggable = true; // Rendre l'élément draggable
            el.dataset.sourceMeal = type; // Type de repas source
            el.dataset.uniqueId = item.uniqueId; // ID unique de l'item
            el.dataset.foodId = item.id; // ID de l'aliment
            el.dataset.weight = item.weight; // Poids actuel
            
            const cal = (food.calories * item.weight / 100).toFixed(0);
            const prot = (food.proteins * item.weight / 100).toFixed(1);
            const carb = (food.carbs * item.weight / 100).toFixed(1);
            const fat = (food.fats * item.weight / 100).toFixed(1);
            const sug = (food.sugars * item.weight / 100).toFixed(1);
            const fib = ((food.fibers || 0) * item.weight / 100).toFixed(1);
            
            // Calculer le coût si disponible
            let costInfo = '';
            if (food.price && food.priceGrams) {
                const cost = (food.price / food.priceGrams * item.weight).toFixed(2);
                costInfo = ` | 💰 ${cost}€`;
            }

            el.innerHTML = `
                <div class="meal-item-header">
                    <span class="meal-item-name">${food.name}</span>
                    <button class="remove-btn">✕</button>
                </div>
                <div class="weight-input">
                    <input type="number" value="${item.weight}" min="1">
                    <span>g</span>
                </div>
                <div class="meal-item-macros">${cal} kcal | P: ${prot}g | G: ${carb}g | F: ${fib}g | L: ${fat}g | S: ${sug}g${costInfo}</div>
            `;

            el.querySelector('.remove-btn').onclick = () => removeHandler(type, item.uniqueId);
            
            const weightInput = el.querySelector('input[type="number"]');
            weightInput.onchange = (e) => weightChangeHandler(type, item.uniqueId, e.target.value);
            
            // Empêcher le drag quand on interagit avec l'input ou le bouton
            weightInput.addEventListener('mousedown', (e) => {
                el.setAttribute('draggable', 'false');
            });
            weightInput.addEventListener('blur', () => {
                el.setAttribute('draggable', 'true');
            });
            
            const removeBtn = el.querySelector('.remove-btn');
            removeBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                el.setAttribute('draggable', 'false');
            });
            removeBtn.addEventListener('mouseup', () => {
                setTimeout(() => el.setAttribute('draggable', 'true'), 100);
            });
            
            // Ajouter le handler de dragstart pour le déplacement entre repas
            if (mealItemDragStartHandler) {
                el.addEventListener('dragstart', mealItemDragStartHandler);
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
    elements.editFoodCalories.value = foodData.calories;
    elements.editFoodProteins.value = foodData.proteins;
    elements.editFoodCarbs.value = foodData.carbs;
    elements.editFoodSugars.value = foodData.sugars;
    elements.editFoodFibers.value = foodData.fibers || 0;
    elements.editFoodFats.value = foodData.fats;
    elements.editFoodPrice.value = foodData.price || '';
    elements.editFoodPriceGrams.value = foodData.priceGrams || '';
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
    if (goals.sexe) {
        const radioToCheck = goals.sexe === 'homme' ? 'homme' : 'femme';
        document.getElementById(radioToCheck).checked = true;
    }
    if (goals.age) document.getElementById('age').value = goals.age;
    if (goals.weight) document.getElementById('goalWeight').value = goals.weight;
    if (goals.taille) document.getElementById('taille').value = goals.taille;
    if (goals.activite) document.getElementById('activite').value = goals.activite;
    if (goals.deficitPercent) document.getElementById('deficit').value = goals.deficitPercent;
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
 * Met à jour l'affichage du résumé quotidien.
 * @param {object} meals - Les repas de la journée.
 * @param {object} foods - Dictionnaire des aliments.
 * @param {object} totals - Totaux nutritionnels.
 * @param {string} date - Date formatée.
 */
export function updateDailySummary(meals, foods, totals, date, waterData = 0, steps = 0, activities = [], goals = null) {
    const summaryContent = document.getElementById('dailySummaryContent');
    
    // Vérifier s'il y a des aliments
    const hasFood = Object.values(meals).some(mealItems => mealItems.length > 0);
    
    if (!hasFood) {
        summaryContent.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Aucun aliment ajouté pour aujourd\'hui</p>';
        return;
    }
    
    // Générer le résumé
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
                const food = foods[item.id];
                if (food) {
                    const factor = item.weight / 100;
                    mealCal += food.calories * factor;
                    mealProt += food.proteins * factor;
                    mealCarb += food.carbs * factor;
                    mealFat += food.fats * factor;
                    
                    let itemInfo = `  • ${food.name} - ${item.weight}g`;
                    
                    // Calculer le coût de cet item
                    if (food.price && food.priceGrams) {
                        const itemCost = (food.price / food.priceGrams * item.weight);
                        totalCost += itemCost;
                        mealCost += itemCost;
                        itemInfo += ` (${itemCost.toFixed(2)}€)`;
                    }
                    
                    summary += itemInfo + '\n';
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
    
    summaryContent.textContent = summary;
}

/**
 * Génère le texte du résumé pour la copie.
 * @param {object} meals - Les repas de la journée.
 * @param {object} foods - Dictionnaire des aliments.
 * @param {object} totals - Totaux nutritionnels.
 * @param {string} date - Date formatée.
 * @returns {string} Le texte du résumé.
 */
export function generateSummaryText(meals, foods, totals, date, waterData = 0, steps = 0, activities = [], goals = null) {
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
                const food = foods[item.id];
                if (food) {
                    const factor = item.weight / 100;
                    mealCal += food.calories * factor;
                    mealProt += food.proteins * factor;
                    mealCarb += food.carbs * factor;
                    mealFat += food.fats * factor;
                    
                    let itemInfo = `  • ${food.name} - ${item.weight}g`;
                    
                    // Calculer le coût de cet item
                    if (food.price && food.priceGrams) {
                        const itemCost = (food.price / food.priceGrams * item.weight);
                        totalCost += itemCost;
                        mealCost += itemCost;
                        itemInfo += ` (${itemCost.toFixed(2)}€)`;
                    }
                    
                    summary += itemInfo + '\n';
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