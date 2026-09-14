// js/handlers/goals-handlers.js
// Handlers pour les objectifs nutritionnels et bien-être.

import state from '../core/state.js';
import * as db from '../core/db.js';
import * as ui from '../ui/ui-core.js';

// Référence à loadCurrentDay (injectée)
let _loadCurrentDay = null;
export function initGoalsHandlers({ loadCurrentDay }) {
    _loadCurrentDay = loadCurrentDay;
}

async function saveCurrentDayCalorieGoal(goals) {
    if (goals?.calories) {
        await db.saveDayNutritionGoals(state.currentDate, goals);
    }
}

export function handleEditMacros() {
    document.querySelectorAll('.macro-display').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.macro-input').forEach(el => el.style.display = 'block');
    document.getElementById('editMacrosBtn').style.display = 'none';
    document.getElementById('macroEditActions').style.display = 'block';
}

export function handleCancelMacrosEdit() {
    document.querySelectorAll('.macro-display').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.macro-input').forEach(el => el.style.display = 'none');
    document.getElementById('editMacrosBtn').style.display = 'inline-block';
    document.getElementById('macroEditActions').style.display = 'none';
}

export async function handleSaveMacros() {
    const proteins = parseInt(document.getElementById('goalProteinsInput').value, 10);
    const carbs = parseInt(document.getElementById('goalCarbsInput').value, 10);
    const fats = parseInt(document.getElementById('goalFatsInput').value, 10);

    if (!proteins || !carbs || !fats || proteins < 0 || carbs < 0 || fats < 0) {
        ui.showNotification('⚠️ Veuillez entrer des valeurs valides pour tous les macros', 'error');
        return;
    }

    const newCalories = Math.round((proteins * 4) + (carbs * 4) + (fats * 9));
    const updatedGoals = { ...state.goals, proteins, carbs, fats, calories: newCalories };

    await db.saveGoals(updatedGoals);
    await saveCurrentDayCalorieGoal(updatedGoals);
    state.goals = updatedGoals;

    document.getElementById('goalProteins').textContent = `${proteins} g`;
    document.getElementById('goalCarbs').textContent = `${carbs} g`;
    document.getElementById('goalFats').textContent = `${fats} g`;
    document.getElementById('goalCalories').textContent = `${newCalories} kcal`;

    handleCancelMacrosEdit();
    ui.showNotification('✅ Macronutriments mis à jour !');
    await _loadCurrentDay();
}

export function handleEditWellness() {
    document.querySelectorAll('.wellness-display').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.wellness-input').forEach(el => el.style.display = 'block');
    document.getElementById('editWellnessBtn').style.display = 'none';
    document.getElementById('wellnessEditActions').style.display = 'block';
}

export function handleCancelWellnessEdit() {
    document.querySelectorAll('.wellness-display').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.wellness-input').forEach(el => el.style.display = 'none');
    document.getElementById('editWellnessBtn').style.display = 'inline-block';
    document.getElementById('wellnessEditActions').style.display = 'none';
}

export async function handleSaveWellness() {
    const waterGoal = parseInt(document.getElementById('goalWaterEditInput').value, 10);
    const stepsGoal = parseInt(document.getElementById('goalStepsEditInput').value, 10);

    if (!waterGoal || !stepsGoal || waterGoal < 500 || stepsGoal < 1000) {
        ui.showNotification('⚠️ Veuillez entrer des valeurs valides', 'error');
        return;
    }

    const updatedGoals = { ...state.goals, waterGoal, stepsGoal };
    await db.saveGoals(updatedGoals);
    state.goals = updatedGoals;

    document.getElementById('goalWaterDisplay').textContent = `${waterGoal} ml`;
    document.getElementById('goalStepsDisplay').textContent = `${stepsGoal} pas`;

    handleCancelWellnessEdit();
    ui.showNotification('✅ Objectifs bien-être mis à jour !');
    await _loadCurrentDay();
}

/**
 * Calcule les objectifs nutritionnels à partir des saisies du formulaire.
 * @returns {object|null} Les objectifs calculés, ou null si une saisie est invalide.
 */
export function calculateGoalsFromInputs({
    goalProfile,
    bmrFormula = 'mifflin',
    sexe,
    age,
    weight,
    taille,
    activite,
    adjustmentPercent,
    waterGoal = 2000,
    stepsGoal = 10000,
    sugarsMax = 25,
    fibersMin = 25
}) {
    // Sans cette garde, un champ vide produisait des objectifs NaN enregistrés
    // en base et affichés tels quels ("NaN kcal").
    // Attention : Number(null) et Number('') valent 0 — un champ laissé vide
    // serait donc accepté comme une valeur nulle au lieu d'être refusé.
    const nombres = { age, weight, taille, activite, adjustmentPercent };
    for (const [key, value] of Object.entries(nombres)) {
        const utilisable = value !== null && value !== undefined && value !== ''
            && typeof value !== 'boolean' && Number.isFinite(Number(value));
        if (!utilisable) return null;
    }
    if (sexe !== 'homme' && sexe !== 'femme') return null;

    const ageN = Number(age);
    const weightN = Number(weight);
    const tailleN = Number(taille);
    const activiteN = Number(activite);
    const adjustmentPercentN = Number(adjustmentPercent);

    let mb;
    if (bmrFormula === 'harris') {
        if (sexe === 'homme') mb = 66.5 + 13.75 * weightN + 5.003 * tailleN - 6.75 * ageN;
        else mb = 655.1 + 9.563 * weightN + 1.85 * tailleN - 4.676 * ageN;
    } else {
        if (sexe === 'homme') mb = 10 * weightN + 6.25 * tailleN - 5 * ageN + 5;
        else mb = 10 * weightN + 6.25 * tailleN - 5 * ageN - 161;
        bmrFormula = 'mifflin';
    }

    const det = mb * activiteN;
    const targetKcal = Math.round(det * (1 - adjustmentPercentN));

    let proteins, fats;
    switch (goalProfile) {
        case 'cut': proteins = Math.round(weightN * 2.2); fats = Math.round(weightN * 1.0); break;
        case 'weightloss': proteins = Math.round(weightN * 1.8); fats = Math.round(weightN * 0.9); break;
        case 'bulk': proteins = Math.round(weightN * 2.0); fats = Math.round(weightN * 1.1); break;
        case 'maintenance': proteins = Math.round(weightN * 1.6); fats = Math.round(weightN * 1.0); break;
        case 'recomp': proteins = Math.round(weightN * 2.4); fats = Math.round(weightN * 0.9); break;
        default: proteins = Math.round(weightN * 2.0); fats = Math.round(weightN * 1.0);
    }

    const carbs = Math.max(Math.round((targetKcal - proteins * 4 - fats * 9) / 4), 0);

    return {
        calories: targetKcal, proteins, carbs, fats,
        mb: Math.round(mb), det: Math.round(det),
        goalProfile, bmrFormula, sexe,
        age: ageN, weight: weightN, taille: tailleN,
        activite: activiteN, adjustmentPercent: adjustmentPercentN,
        waterGoal, stepsGoal, sugarsMax, fibersMin
    };
}

export async function updateGoalsWeight(weight) {
    if (!state.goals || !weight || weight <= 0) return null;
    const updatedGoals = calculateGoalsFromInputs({ ...state.goals, weight });
    if (!updatedGoals) return null;
    await db.saveGoals(updatedGoals);
    await saveCurrentDayCalorieGoal(updatedGoals);
    state.goals = updatedGoals;
    ui.displayGoals(updatedGoals);
    const goalWeightInput = document.getElementById('goalWeight');
    if (goalWeightInput) goalWeightInput.value = weight;
    return updatedGoals;
}

export async function handleGoalsSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const goalProfile = form.querySelector('#goalProfile').value;
    const bmrFormula = form.querySelector('#bmrFormula')?.value || 'mifflin';
    const sexe = form.querySelector('input[name="sexe"]:checked').value;
    const age = parseInt(form.querySelector('#age').value, 10);
    const weight = parseFloat(form.querySelector('#goalWeight').value);
    const taille = parseInt(form.querySelector('#taille').value, 10);
    const activite = parseFloat(form.querySelector('#activite').value);
    const adjustmentPercent = parseFloat(form.querySelector('#calorieAdjustment').value);
    const waterGoal = parseInt(form.querySelector('#waterGoalInput').value, 10) || 2000;
    const stepsGoal = parseInt(form.querySelector('#stepsGoalInput').value, 10) || 10000;
    const sugarsMax = parseInt(form.querySelector('#sugarsMaxInput').value, 10) || 25;
    const fibersMin = parseInt(form.querySelector('#fibersMinInput').value, 10) || 25;

    const goals = calculateGoalsFromInputs({
        goalProfile, bmrFormula, sexe, age, weight, taille, activite, adjustmentPercent,
        waterGoal, stepsGoal, sugarsMax, fibersMin
    });

    if (!goals) {
        ui.showNotification('⚠️ Veuillez renseigner tous les champs du profil (âge, poids, taille, activité).', 'error');
        return;
    }

    await db.saveGoals(goals);
    await saveCurrentDayCalorieGoal(goals);
    state.goals = goals;
    ui.displayGoals(goals);
    ui.showNotification('Objectifs enregistrés !');
    await _loadCurrentDay();
}
