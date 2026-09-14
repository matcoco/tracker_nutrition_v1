// js/handlers/daily-handlers.js
// Handlers pour le suivi quotidien : drag & drop, repas, poids, ventre, eau, pas, résumé.

import state from '../core/state.js';
import * as db from '../core/db.js';
import * as ui from '../ui/ui-core.js';
import * as uiMeals from '../ui/ui-meals.js';
import * as utils from '../core/utils.js';
import { updateGoalsWeight } from './goals-handlers.js';

// --- DRAG & DROP ---
export function handleDragStart(event) {
    state.draggedFoodId = event.target.dataset.foodId;
    state.draggedMealItem = null;
    event.target.classList.add('dragging');
}

export function handleMealItemDragStart(event) {
    const mealItem = event.currentTarget;
    state.draggedFoodId = null;
    state.draggedMealItem = {
        sourceMeal: mealItem.dataset.sourceMeal,
        uniqueId: mealItem.dataset.uniqueId
    };
    mealItem.classList.add('dragging');
}

export function handleDragEnd(event) {
    const draggingElement = event.target.closest('.food-item') || event.target.closest('.meal-item') || event.target;
    if (draggingElement) draggingElement.classList.remove('dragging');
    document.querySelectorAll('.meal-column.drag-over').forEach(col => col.classList.remove('drag-over'));
}

export function handleMealItemDragEnd(event) {
    handleDragEnd(event);
}

function getMealName(mealType) {
    const names = { 'petit-dej': 'Petit Déjeuner', 'dejeuner': 'Déjeuner', 'diner': 'Dîner', 'snack': 'Snack' };
    return names[mealType] || mealType;
}

/**
 * Génère un identifiant unique pour une ligne de repas.
 * `Date.now()` seul pouvait produire des collisions lorsque deux aliments
 * étaient ajoutés dans la même milliseconde, rendant les lignes
 * impossibles à supprimer ou à modifier individuellement.
 * @returns {number}
 */
let lastGeneratedId = 0;
export function generateMealItemId() {
    const now = Date.now();
    lastGeneratedId = now > lastGeneratedId ? now : lastGeneratedId + 1;
    return lastGeneratedId;
}

function getDefaultMealTime(mealType) {
    const defaults = { 'petit-dej': '08:00', 'dejeuner': '12:30', 'diner': '19:30' };
    const headerInput = document.getElementById(`mealTime-${mealType}`);
    if (headerInput?.value) return headerInput.value;
    if (defaults[mealType]) return defaults[mealType];
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function isSharedTimeMeal(mealType) {
    return ['petit-dej', 'dejeuner', 'diner'].includes(mealType);
}

async function findPreviousKnownWeight(date) {
    const currentKey = utils.formatDateKey(date);
    const allDays = await db.getAllFromStore('dailyMeals');
    return allDays
        .filter(day => day.date < currentKey && Number(day.weight) > 0)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.weight || null;
}

export async function handleDrop(event, loadCurrentDay) {
    event.preventDefault();
    event.stopPropagation();
    const targetMealType = event.currentTarget.dataset.meal;
    event.currentTarget.classList.remove('drag-over');
    document.querySelectorAll('.meal-column.drag-over').forEach(col => {
        if (col !== event.currentTarget) col.classList.remove('drag-over');
    });

    const meals = await db.loadDayMeals(state.currentDate);
    if (!meals || !Array.isArray(meals[targetMealType])) {
        state.draggedFoodId = null;
        state.draggedMealItem = null;
        return;
    }

    if (state.draggedMealItem) {
        const { sourceMeal, uniqueId } = state.draggedMealItem;
        if (sourceMeal === targetMealType) { state.draggedFoodId = null; state.draggedMealItem = null; return; }
        if (!Array.isArray(meals[sourceMeal])) { state.draggedFoodId = null; state.draggedMealItem = null; return; }
        const sourceIndex = meals[sourceMeal].findIndex(item => String(item.uniqueId) === String(uniqueId));
        if (sourceIndex === -1) { state.draggedFoodId = null; state.draggedMealItem = null; return; }
        const [movedItem] = meals[sourceMeal].splice(sourceIndex, 1);
        if (isSharedTimeMeal(targetMealType)) movedItem.time = getDefaultMealTime(targetMealType);
        meals[targetMealType].push(movedItem);
        await db.saveDayMeals(state.currentDate, meals);
        await loadCurrentDay();
        ui.showNotification(`Aliment déplacé vers ${getMealName(targetMealType)} !`);
    } else if (state.draggedFoodId) {
        if (state.meals[state.draggedFoodId]) {
            const meal = state.meals[state.draggedFoodId];
            const defaultMealWeight = meal.totalWeight || 100;
            meals[targetMealType].push({ id: state.draggedFoodId, isMeal: true, weight: defaultMealWeight, time: getDefaultMealTime(targetMealType), uniqueId: generateMealItemId() });
            await db.saveDayMeals(state.currentDate, meals);
            await loadCurrentDay();
            ui.showNotification(`${meal.name} ajouté !`);
        } else if (state.foods[state.draggedFoodId]) {
            const food = state.foods[state.draggedFoodId];
            const defaultWeight = (food.isPortionBased && food.portionWeight) ? food.portionWeight : 100;
            meals[targetMealType].push({ id: state.draggedFoodId, weight: defaultWeight, time: getDefaultMealTime(targetMealType), uniqueId: generateMealItemId() });
            await db.saveDayMeals(state.currentDate, meals);
            await loadCurrentDay();
            ui.showNotification(`${food.name} ajouté !`);
        }
    }
    state.draggedFoodId = null;
    state.draggedMealItem = null;
}

export async function handleRemoveMealItem(mealType, uniqueId, loadCurrentDay) {
    const meals = await db.loadDayMeals(state.currentDate);
    if (!Array.isArray(meals[mealType])) return;
    meals[mealType] = meals[mealType].filter(item => String(item.uniqueId) !== String(uniqueId));
    await db.saveDayMeals(state.currentDate, meals);
    loadCurrentDay();
}

export async function handleUpdateWeight(mealType, uniqueId, newWeight, loadCurrentDay) {
    const meals = await db.loadDayMeals(state.currentDate);
    if (!Array.isArray(meals[mealType])) return;
    const item = meals[mealType].find(i => String(i.uniqueId) === String(uniqueId));
    if (item) {
        item.weight = parseFloat(newWeight) || item.weight || 100;
        await db.saveDayMeals(state.currentDate, meals);
        loadCurrentDay();
    }
}

export async function handleUpdateMealItemTime(mealType, uniqueId, newTime, loadCurrentDay) {
    const meals = await db.loadDayMeals(state.currentDate);
    const item = meals[mealType].find(i => String(i.uniqueId) === String(uniqueId));
    if (item) {
        item.time = newTime || '';
        await db.saveDayMeals(state.currentDate, meals);
        loadCurrentDay();
    }
}

export async function handleUpdateMealTime(mealType, newTime, loadCurrentDay) {
    const meals = await db.loadDayMeals(state.currentDate);
    if (!meals[mealType]) return;
    meals[mealType].forEach(item => {
        item.time = newTime || '';
    });
    await db.saveDayMeals(state.currentDate, meals);
    loadCurrentDay();
}

export async function handleDuplicateMealItem(mealType, item, loadCurrentDay) {
    const meals = await db.loadDayMeals(state.currentDate);
    const duplicatedItem = structuredClone(item);
    duplicatedItem.uniqueId = generateMealItemId();
    meals[mealType].push(duplicatedItem);
    await db.saveDayMeals(state.currentDate, meals);
    loadCurrentDay();
    const foodName = item.isMeal && state.meals[item.id] ? state.meals[item.id].name :
                     state.foods[item.id] ? state.foods[item.id].name : 'Item';
    ui.showNotification(`${foodName} dupliqué !`);
}

export async function handleQuickAdd(foodId, mealType, loadCurrentDay) {
    const meals = await db.loadDayMeals(state.currentDate);
    if (state.meals[foodId]) {
        const meal = state.meals[foodId];
        const defaultMealWeight = meal.totalWeight || 100;
        meals[mealType].push({ id: foodId, isMeal: true, weight: defaultMealWeight, time: getDefaultMealTime(mealType), uniqueId: generateMealItemId() });
        await db.saveDayMeals(state.currentDate, meals);
        loadCurrentDay();
        ui.showNotification(`${meal.name} ajouté !`);
    } else if (state.foods[foodId]) {
        const food = state.foods[foodId];
        const defaultWeight = (food.isPortionBased && food.portionWeight) ? food.portionWeight : 100;
        meals[mealType].push({ id: foodId, weight: defaultWeight, time: getDefaultMealTime(mealType), uniqueId: generateMealItemId() });
        await db.saveDayMeals(state.currentDate, meals);
        loadCurrentDay();
        ui.showNotification(`${food.name} ajouté !`);
    }
}

// --- POIDS / VENTRE ---
export async function handleSaveWeight(loadCurrentDay = null) {
    const weightInput = document.getElementById('weightInput');
    const weight = parseFloat(weightInput.value);
    if (weight && weight > 0) {
        await db.saveDayWeight(state.currentDate, weight);
        const updatedGoals = await updateGoalsWeight(weight);
        if (loadCurrentDay) await loadCurrentDay();
        ui.showNotification(updatedGoals ? 'Poids enregistré et objectifs recalculés !' : 'Poids enregistré !');
    } else if (weightInput.value === '') {
        await db.saveDayWeight(state.currentDate, null);
        const previousWeight = await findPreviousKnownWeight(state.currentDate);
        const updatedGoals = previousWeight ? await updateGoalsWeight(previousWeight) : null;
        if (loadCurrentDay) await loadCurrentDay();
        ui.showNotification(updatedGoals
            ? `Poids effacé, objectifs recalculés avec le dernier poids connu (${previousWeight} kg).`
            : 'Poids effacé.');
    } else {
        ui.showNotification('Veuillez entrer un poids valide.', 'error');
    }
}

export async function handleSaveBelly() {
    const bellyInput = document.getElementById('bellyInput');
    const belly = parseFloat(bellyInput.value);
    if (belly && belly > 0) {
        await db.saveDayBelly(state.currentDate, belly);
        ui.showNotification('Tour de ventre enregistré !');
    } else if (bellyInput.value === '') {
        await db.saveDayBelly(state.currentDate, null);
        ui.showNotification('Tour de ventre effacé.');
    } else {
        ui.showNotification('Veuillez entrer une valeur valide.', 'error');
    }
}

export async function handleSaveBedtime(loadCurrentDay = null) {
    const bedtimeInput = document.getElementById('bedtimeInput');
    const bedtime = bedtimeInput.value;
    await db.saveDayBedtime(state.currentDate, bedtime || null);
    if (loadCurrentDay) await loadCurrentDay();
    ui.showNotification(bedtime ? 'Heure de coucher enregistrée !' : 'Heure de coucher effacée.');
}

export async function handleSaveSleepDuration(loadCurrentDay = null) {
    const hoursInput = document.getElementById('sleepDurationHoursInput');
    const minutesInput = document.getElementById('sleepDurationMinutesInput');
    const hoursValue = hoursInput.value;
    const minutesValue = minutesInput.value;

    if (hoursValue === '' && minutesValue === '') {
        await db.saveDaySleepDuration(state.currentDate, null);
        if (loadCurrentDay) await loadCurrentDay();
        ui.showNotification('Durée du sommeil effacée.');
        return;
    }

    const hours = hoursValue === '' ? 0 : parseInt(hoursValue, 10);
    const minutes = minutesValue === '' ? 0 : parseInt(minutesValue, 10);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
        ui.showNotification('Veuillez entrer une durée de sommeil valide.', 'error');
        return;
    }

    const sleepDuration = parseFloat((hours + minutes / 60).toFixed(2));
    await db.saveDaySleepDuration(state.currentDate, sleepDuration);
    if (loadCurrentDay) await loadCurrentDay();
    ui.showNotification('Durée du sommeil enregistrée !');
}

// --- HYDRATATION ---
async function updateDailySummaryHelper() {
    const meals = await db.loadDayMeals(state.currentDate);
    const totals = utils.calculateDayTotals(meals, state.foods, state.meals);
    const dateFormatted = utils.formatDateDisplay(state.currentDate);
    const waterData = await db.loadDayWater(state.currentDate);
    const steps = await db.loadDaySteps(state.currentDate);
    const activities = state.activities || [];
    uiMeals.updateDailySummary(meals, state.foods, totals, dateFormatted, waterData, steps, activities, state.goals, state.meals);
}

export async function handleAddWater(amount) {
    const increment = Number(amount);
    if (!Number.isFinite(increment) || increment <= 0) {
        ui.showNotification('⚠️ Quantité d\'eau invalide', 'error');
        return;
    }
    const waterData = await db.loadDayWater(state.currentDate);
    waterData.totalMl = (Number(waterData.totalMl) || 0) + increment;
    waterData.history = waterData.history || [];
    waterData.history.push({ time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), ml: increment });
    await db.saveDayWater(state.currentDate, waterData);
    uiMeals.updateWaterDisplay(waterData, state.goals);
    ui.showNotification(`+${increment}ml d'eau ajoutés ! 💧`);
    await updateDailySummaryHelper();
}

export async function handleEditWater() {
    const waterData = await db.loadDayWater(state.currentDate);
    const currentMl = waterData.totalMl || 0;
    const newAmount = prompt(`✏️ Modifier l'hydratation du jour\n\nQuantité actuelle : ${currentMl} ml\nNouvelle quantité (ml) :`, currentMl);
    if (newAmount !== null && !isNaN(newAmount) && parseInt(newAmount) >= 0) {
        const newMl = parseInt(newAmount);
        waterData.totalMl = newMl;
        waterData.history = waterData.history || [];
        waterData.history.push({ time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), ml: newMl, type: 'edit' });
        await db.saveDayWater(state.currentDate, waterData);
        uiMeals.updateWaterDisplay(waterData, state.goals);
        ui.showNotification(`💧 Hydratation mise à jour : ${newMl} ml`);
        await updateDailySummaryHelper();
    }
}

export async function handleResetWater() {
    if (confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser l\'hydratation du jour ?')) {
        await db.saveDayWater(state.currentDate, { totalMl: 0, history: [] });
        uiMeals.updateWaterDisplay({ totalMl: 0, history: [] }, state.goals);
        ui.showNotification('💧 Hydratation réinitialisée');
        await updateDailySummaryHelper();
    }
}

// --- PAS ---
export async function handleUpdateSteps() {
    const stepsInput = document.getElementById('stepsInput');
    const steps = parseInt(stepsInput.value);
    if (isNaN(steps) || steps < 0) { ui.showNotification('⚠️ Nombre de pas invalide', 'error'); return; }
    await db.saveDaySteps(state.currentDate, steps);
    uiMeals.updateStepsDisplay(steps, state.goals);
    ui.showNotification(`👟 ${steps} pas enregistrés !`);
    await updateDailySummaryHelper();
}

export async function handleResetSteps() {
    if (confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser les pas du jour ?')) {
        await db.saveDaySteps(state.currentDate, 0);
        uiMeals.updateStepsDisplay(0, state.goals);
        ui.showNotification('👟 Pas réinitialisés');
        await updateDailySummaryHelper();
    }
}

// --- RÉSUMÉ ---
export async function handleCopySummary() {
    const meals = await db.loadDayMeals(state.currentDate);
    const totals = utils.calculateDayTotals(meals, state.foods, state.meals);
    const dateFormatted = utils.formatDateDisplay(state.currentDate);
    const waterData = await db.loadDayWater(state.currentDate);
    const steps = await db.loadDaySteps(state.currentDate);
    const activities = await db.loadDayActivities(state.currentDate);
    const summaryText = uiMeals.generateSummaryText(meals, state.foods, totals, dateFormatted, waterData, steps, activities, state.goals, state.meals);
    const copyBtn = document.getElementById('copySummaryBtn');
    const copyText = copyBtn?.querySelector('.copy-text');
    try {
        await navigator.clipboard.writeText(summaryText);
        copyBtn?.classList.add('copied');
        if (copyText) copyText.textContent = 'Copié !';
        ui.showNotification('📋 Résumé copié dans le presse-papiers !');
        setTimeout(() => { copyBtn?.classList.remove('copied'); if (copyText) copyText.textContent = 'Copier'; }, 2000);
    } catch (err) {
        ui.showNotification('❌ Erreur lors de la copie', 'error');
        console.error('Erreur de copie:', err);
    }
}

export function handleToggleSummary() {
    const summaryContent = document.getElementById('dailySummaryContent');
    const toggleBtn = document.getElementById('toggleSummaryBtn');
    summaryContent.classList.toggle('collapsed');
    toggleBtn.classList.toggle('expanded');
}
