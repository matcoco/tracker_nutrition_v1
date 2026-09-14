// js/ui-meals.js
// Extrait de ui.js : rendu des repas, activites, eau, pas et resumes quotidiens.

import { calculateMealItemNutrition, calculateMealTotals, calculateMealItemCost } from '../core/utils.js';
import { openEditModal as coreOpenEditModal, closeEditModal as coreCloseEditModal } from './ui-core.js';

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
    const priceQuantity = Number(food.priceQuantity);
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
    const priceGrams = Number(food.priceGrams);
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
    return food.price && (food.priceQuantity || food.priceGrams);
}

function isSharedTimeMeal(mealType) {
    return ['petit-dej', 'dejeuner', 'diner'].includes(mealType);
}

function getDefaultMealTime(mealType) {
    const defaults = { 'petit-dej': '08:00', 'dejeuner': '12:30', 'diner': '19:30' };
    return defaults[mealType] || '';
}

function getMealHeaderTime(mealType, mealItems) {
    return mealItems.find(item => item.time)?.time || getDefaultMealTime(mealType);
}

function formatMealItemLineStart(item, itemLabel, foodName, mealType) {
    const timeInfo = !isSharedTimeMeal(mealType) && item.time ? `${item.time} - ` : '';
    return `  • ${timeInfo}${itemLabel}${foodName}`;
}

/**
 * Échappe une valeur interpolée dans du HTML : noms d'aliments/repas, qui
 * peuvent provenir d'un import JSON ou d'une réponse IA.
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
}

function formatStrengthExercises(exercises = []) {
    if (!Array.isArray(exercises) || exercises.length === 0) return '';
    return exercises.map(exercise => {
        const details = [];
        if (exercise.muscle) details.push(escapeHtml(exercise.muscle));
        if (exercise.sets || exercise.reps) details.push(`${exercise.sets || 0}x${exercise.reps || 0}`);
        if (exercise.dumbbellWeight) details.push(`haltères ${exercise.dumbbellWeight} kg`);
        if (exercise.vestWeight) details.push(`gilet ${exercise.vestWeight} kg`);
        return `${escapeHtml(exercise.name || 'Exercice')}${details.length ? ` (${details.join(', ')})` : ''}`;
    }).join(' • ');
}

export function displayMeals(meals, foods, removeHandler, weightChangeHandler, timeChangeHandler = null, mealTimeChangeHandler = null, composedMeals = {}) {
    for (const [type, items] of Object.entries(meals || {})) {
        if (!Array.isArray(items)) continue;
        const container = document.getElementById(type);
        const summaryEl = document.getElementById(`summary-${type}`);
        if (!container || !summaryEl) continue;

        const sharedTime = isSharedTimeMeal(type);
        const mealTimeInput = document.getElementById(`mealTime-${type}`);
        if (sharedTime && mealTimeInput) {
            mealTimeInput.value = getMealHeaderTime(type, items);
            if (!mealTimeInput.dataset.bound) {
                mealTimeInput.addEventListener('change', () => {
                    if (mealTimeChangeHandler) mealTimeChangeHandler(type, mealTimeInput.value);
                });
                mealTimeInput.dataset.bound = 'true';
            }
        }

        container.innerHTML = '';
        const totals = calculateMealTotals(items, foods, composedMeals);
        
        const mealCost = items.reduce((sum, item) => sum + calculateMealItemCost(item, foods, composedMeals), 0);
        
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
            
            const customTotalWeight = isMealComposed && item.customPortions && Array.isArray(food.ingredients)
                ? food.ingredients.reduce((sum, ing) => sum + (Number(item.customPortions[ing.foodId]) || 0), 0)
                : 0;
            const totalRecipeWeight = isMealComposed && food.isPortionAdjustable
                ? (Number(food.totalWeight) || customTotalWeight || 100)
                : null;
            const consumedWeight = isMealComposed && food.isPortionAdjustable
                ? (Number(item.weight) || totalRecipeWeight)
                : (Number(item.weight) || 0);
            const nutrition = calculateMealItemNutrition(item, foods, composedMeals);
            const cal = nutrition.calories.toFixed(0);
            const prot = nutrition.proteins.toFixed(1);
            const carb = nutrition.carbs.toFixed(1);
            const sug = nutrition.sugars.toFixed(1);
            const fat = nutrition.fats.toFixed(1);
            const fib = nutrition.fibers.toFixed(1);
            
            const itemCostForDisplay = calculateMealItemCost(item, foods, composedMeals);
            const costInfo = itemCostForDisplay > 0 ? ` | 💰 ${itemCostForDisplay.toFixed(2)}€` : '';
            
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
            const itemTime = item.time || '';
            const timeField = sharedTime ? '' : `
                <label class="ci-time-field" title="Heure de prise">
                    <span>🕒</span>
                    <input class="ci-time-input" type="time" value="${itemTime}">
                </label>
            `;
            
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
                    <span class="ci-macro ci-macro-sugar"><b>${sug}</b><em>S</em></span>
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
                    <span class="ci-name">${escapeHtml(food.name)}</span>
                    ${timeField}
                </div>
                <div class="ci-part3">
                    ${weightSection}
                    ${macrosBar}
                </div>
            `;

            el.querySelector('.ci-btn-del').onclick = () => removeHandler(type, item.uniqueId);

            const timeInput = el.querySelector('.ci-time-input');
            if (timeInput && timeChangeHandler) {
                timeInput.addEventListener('change', () => {
                    timeChangeHandler(type, item.uniqueId, timeInput.value);
                });
            }
            
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
            
            if (window.handleMealItemDragStart) {
                el.addEventListener('dragstart', window.handleMealItemDragStart);
            }

            if (window.handleMealItemDragEnd) {
                el.addEventListener('dragend', window.handleMealItemDragEnd);
            }
            
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

    document.querySelector(`.nav-tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
}


// --- Fonctions pour la Modale de Modification ---

/**
 * Ouvre la modale de modification et la pré-remplit avec les données de l'aliment.
 * @param {string} foodId - L'ID de l'aliment à modifier.
 * @param {object} foodData - Les données de l'aliment.
 */
export function openEditModal(foodId, foodData) {
    // Ce module ne définit pas `elements` : l'ancienne implémentation levait une
    // ReferenceError. On délègue à ui-core, seule implémentation réellement utilisée.
    return coreOpenEditModal(foodId, foodData);
}

/**
 * Ferme la modale de modification.
 */
export function closeEditModal() {
    return coreCloseEditModal();
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
        const strengthDetails = formatStrengthExercises(activity.strengthExercises);
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-info">
                <div class="activity-name">${activity.type}</div>
                <div class="activity-details">${timeInfo}⏱️ ${activity.duration} min | 🔥 ${activity.calories} kcal</div>
                ${strengthDetails ? `<div class="activity-strength-details">🏋️ ${strengthDetails}</div>` : ''}
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
            const timeInfo = activity.time ? `${activity.time} - ` : '';
            summary += `  • ${timeInfo}${activity.type} - ${activity.duration} min (${activity.calories} kcal)\n`;
            const strengthDetails = formatStrengthExercises(activity.strengthExercises);
            if (strengthDetails) summary += `    🏋️ ${strengthDetails}\n`;
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
            const headerTime = isSharedTimeMeal(mealType) ? getMealHeaderTime(mealType, mealItems) : '';
            summary += `${mealNames[mealType]}${headerTime ? ` (${headerTime})` : ''}\n`;
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
                    const itemNutrition = calculateMealItemNutrition(item, foods, composedMeals);
                    
                    // CAS 1 : Repas avec customPortions - Afficher le détail des ingrédients
                    if (item.isMeal && item.customPortions && food.ingredients) {
                        summary += `${formatMealItemLineStart(item, itemLabel, food.name, mealType)} :\n`;
                        let customTotalWeight = 0;
                        
                        food.ingredients.forEach(ing => {
                            const ingredientFood = foods[ing.foodId];
                            const weight = Number(item.customPortions[ing.foodId]) || 0;
                            customTotalWeight += weight;
                            
                            if (ingredientFood) {
                                if (weight > 0) {
                                    // Ingrédient normal avec poids > 0
                                    const factor = weight / 100;
                                    itemCal += (Number(ingredientFood.calories) || 0) * factor;
                                    itemProt += (Number(ingredientFood.proteins) || 0) * factor;
                                    itemCarb += (Number(ingredientFood.carbs) || 0) * factor;
                                    itemFat += (Number(ingredientFood.fats) || 0) * factor;
                                    
                                    let ingCost = 0;
                                    if (hasPrice(ingredientFood)) {
                                        const pricePer100g = getPricePer100g(ingredientFood);
                                        ingCost = (pricePer100g / 100) * weight;
                                        itemCost += ingCost;
                                    }
                                    
                                    let ingInfo = `    ◦ ${escapeHtml(ingredientFood.name)} - ${weight}g`;
                                    if (ingCost > 0) {
                                        ingInfo += ` (${ingCost.toFixed(2)}€)`;
                                    }
                                    summary += ingInfo + '\n';
                                } else {
                                    // Ingrédient à 0g : nom barré, 0g, 0€
                                    let ingInfo = `    ◦ <s>${escapeHtml(ingredientFood.name)}</s> - 0g (0.00€)`;
                                    summary += ingInfo + '\n';
                                }
                            }
                        });
                        
                        itemCal = itemNutrition.calories;
                        itemProt = itemNutrition.proteins;
                        itemCarb = itemNutrition.carbs;
                        itemFat = itemNutrition.fats;

                        // Utiliser prix personnalisé si défini, sinon prix calculé
                        if (item.customPrice !== undefined && item.customPrice !== null) {
                            itemCost = item.customPrice;
                        } else {
                            const totalRecipeWeight = Number(food.totalWeight) || customTotalWeight || 1;
                            const consumedWeight = Number(item.weight) || totalRecipeWeight;
                            const factor = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;
                            itemCost *= factor;
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
                        itemCal = itemNutrition.calories;
                        itemProt = itemNutrition.proteins;
                        itemCarb = itemNutrition.carbs;
                        itemFat = itemNutrition.fats;
                        
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
                        
                        let itemInfo = `${formatMealItemLineStart(item, itemLabel, food.name, mealType)} - ${item.weight}g`;
                        if (itemCost > 0) {
                            itemInfo += ` (${itemCost.toFixed(2)}€)`;
                        }
                        summary += itemInfo + '\n';
                    }
                    // CAS 3 : Calcul normal
                    else {
                        itemCal = itemNutrition.calories;
                        itemProt = itemNutrition.proteins;
                        itemCarb = itemNutrition.carbs;
                        itemFat = itemNutrition.fats;
                        
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
                        
                        let itemInfo = `${formatMealItemLineStart(item, itemLabel, food.name, mealType)} - ${item.weight}g`;
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
            const timeInfo = activity.time ? `${activity.time} - ` : '';
            summary += `  • ${timeInfo}${activity.type} - ${activity.duration} min (${activity.calories} kcal)\n`;
            const strengthDetails = formatStrengthExercises(activity.strengthExercises);
            if (strengthDetails) summary += `    🏋️ ${strengthDetails}\n`;
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
            const headerTime = isSharedTimeMeal(mealType) ? getMealHeaderTime(mealType, mealItems) : '';
            summary += `${mealNames[mealType]}${headerTime ? ` (${headerTime})` : ''}\n`;
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
                    const itemNutrition = calculateMealItemNutrition(item, foods, composedMeals);
                    
                    // CAS 1 : Repas avec customPortions - Afficher le détail des ingrédients
                    if (item.isMeal && item.customPortions && food.ingredients) {
                        summary += `${formatMealItemLineStart(item, itemLabel, food.name, mealType)} :\n`;
                        let customTotalWeight = 0;
                        
                        food.ingredients.forEach(ing => {
                            const ingredientFood = foods[ing.foodId];
                            const weight = Number(item.customPortions[ing.foodId]) || 0;
                            customTotalWeight += weight;
                            
                            if (ingredientFood) {
                                if (weight > 0) {
                                    // Ingrédient normal avec poids > 0
                                    const factor = weight / 100;
                                    itemCal += (Number(ingredientFood.calories) || 0) * factor;
                                    itemProt += (Number(ingredientFood.proteins) || 0) * factor;
                                    itemCarb += (Number(ingredientFood.carbs) || 0) * factor;
                                    itemFat += (Number(ingredientFood.fats) || 0) * factor;
                                    
                                    let ingCost = 0;
                                    if (hasPrice(ingredientFood)) {
                                        const pricePer100g = getPricePer100g(ingredientFood);
                                        ingCost = (pricePer100g / 100) * weight;
                                        itemCost += ingCost;
                                    }
                                    
                                    let ingInfo = `    ◦ ${escapeHtml(ingredientFood.name)} - ${weight}g`;
                                    if (ingCost > 0) {
                                        ingInfo += ` (${ingCost.toFixed(2)}€)`;
                                    }
                                    summary += ingInfo + '\n';
                                } else {
                                    // Ingrédient à 0g : nom barré, 0g, 0€
                                    let ingInfo = `    ◦ <s>${escapeHtml(ingredientFood.name)}</s> - 0g (0.00€)`;
                                    summary += ingInfo + '\n';
                                }
                            }
                        });
                        
                        itemCal = itemNutrition.calories;
                        itemProt = itemNutrition.proteins;
                        itemCarb = itemNutrition.carbs;
                        itemFat = itemNutrition.fats;

                        // Utiliser prix personnalisé si défini, sinon prix calculé
                        if (item.customPrice !== undefined && item.customPrice !== null) {
                            itemCost = item.customPrice;
                        } else {
                            const totalRecipeWeight = Number(food.totalWeight) || customTotalWeight || 1;
                            const consumedWeight = Number(item.weight) || totalRecipeWeight;
                            const factor = totalRecipeWeight > 0 ? consumedWeight / totalRecipeWeight : 1;
                            itemCost *= factor;
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
                        itemCal = itemNutrition.calories;
                        itemProt = itemNutrition.proteins;
                        itemCarb = itemNutrition.carbs;
                        itemFat = itemNutrition.fats;
                        
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
                        
                        let itemInfo = `${formatMealItemLineStart(item, itemLabel, food.name, mealType)} - ${item.weight}g`;
                        if (itemCost > 0) {
                            itemInfo += ` (${itemCost.toFixed(2)}€)`;
                        }
                        summary += itemInfo + '\n';
                    }
                    // CAS 3 : Calcul normal
                    else {
                        itemCal = itemNutrition.calories;
                        itemProt = itemNutrition.proteins;
                        itemCarb = itemNutrition.carbs;
                        itemFat = itemNutrition.fats;
                        
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
                        
                        let itemInfo = `${formatMealItemLineStart(item, itemLabel, food.name, mealType)} - ${item.weight}g`;
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
