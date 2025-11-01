// js/app.js

import { defaultFoods, defaultActivities } from './config.js';
import * as db from './db.js';
import * as ui from './ui.js';
import * as charts from './charts.js';
import * as costs from './costs.js';
import * as activityCharts from './activities-charts.js';
import * as utils from './utils.js';
import * as dbUtils from './db-utils.js';
import * as foodAnalysis from './food-analysis.js';
import * as foodComparison from './food-comparison.js';
import * as meals from './meals.js';
import * as importExport from './import-export.js';

// --- ÉTAT GLOBAL DE L'APPLICATION ---
let state = {
    foods: {},
    meals: {}, // Repas composés
    currentDate: new Date(),
    currentPeriod: 7,
    currentAveragePeriod: 'week', // 'week' ou 'month'
    currentCostPeriod: 7, // Période pour l'analyse des coûts
    currentActivityPeriod: 7, // Période pour les graphiques d'activités
    currentFoodAnalysisPeriod: 7, // Période pour l'analyse par aliment
    currentCategory: 'all', // Catégorie filtrée dans le suivi quotidien
    draggedFoodId: null,
    draggedMealItem: null, // Pour stocker les infos du meal-item déplacé
    draggedElement: null,  // Stocke la référence DOM
    goals: null,
    displayedFoodsCount: 20,
    maxFoodsPerLoad: 20,
    activities: [], // Activités du jour
    customActivities: [], // Activités personnalisées
    allActivities: [], // Toutes les activités (défaut + custom)
};

// --- LOGIQUE PRINCIPALE ---
// (Les fonctions loadCurrentDay, changeDate, goToToday restent inchangées)
async function loadCurrentDay() {
    const dateFormatted = utils.formatDateDisplay(state.currentDate);
    ui.updateDateDisplay(state.currentDate);
    const meals = await db.loadDayMeals(state.currentDate);
    const weight = await db.loadDayWeight(state.currentDate);
    const waterData = await db.loadDayWater(state.currentDate);
    const steps = await db.loadDaySteps(state.currentDate);
    
    // Charger les activités avec protection
    try {
        state.activities = await db.loadDayActivities(state.currentDate);
    } catch (error) {
        console.log('Erreur chargement activités (normal si première utilisation):', error);
        state.activities = [];
    }
    
    ui.displayMeals(meals, state.foods, handleRemoveMealItem, handleUpdateWeight, state.meals);
    const totals = utils.calculateDayTotals(meals, state.foods, state.meals);
    ui.updateSummary(totals, state.goals);
    ui.updateWeightDisplay(weight);
    ui.updateWaterDisplay(waterData, state.goals);
    ui.updateStepsDisplay(steps, state.goals);
    
    // Afficher activités avec protection
    try {
        ui.displayActivities(state.activities, handleEditActivity, handleDeleteActivity);
    } catch (error) {
        console.log('Erreur affichage activités:', error);
    }
    
    ui.updateDailySummary(meals, state.foods, totals, dateFormatted, waterData, steps, state.activities, state.goals, state.meals);
}
function changeDate(days) {
    state.currentDate.setDate(state.currentDate.getDate() + days);
    loadCurrentDay();
}
function goToToday() {
    state.currentDate = new Date();
    loadCurrentDay();
}
function handleDatePickerChange(event) {
    const selectedDate = event.target.value;
    if (selectedDate) {
        state.currentDate = new Date(selectedDate + 'T12:00:00');
        loadCurrentDay();
    }
}


// --- GESTIONNAIRES D'ÉVÉNEMENTS (HANDLERS) ---
// (Les handlers pour le Drag & Drop et la gestion des repas restent inchangés)
function handleDragStart(event) {
    state.draggedFoodId = event.target.dataset.foodId;
    state.draggedMealItem = null; // Reset meal item
    event.target.classList.add('dragging');
}

function handleDragEnd(event) {
    // Retirer la classe dragging de l'élément (food-item ou meal-item)
    const draggingElement = event.target.closest('.food-item') || event.target.closest('.meal-item') || event.target;
    if (draggingElement) {
        draggingElement.classList.remove('dragging');
    }
    
    // Retirer toutes les classes drag-over des meal-columns
    document.querySelectorAll('.meal-column.drag-over').forEach(col => {
        col.classList.remove('drag-over');
    });
    
    // Ne pas nettoyer ici: le drop a besoin des variables globales
    // Le nettoyage complet est effectué à la fin de handleDrop()
}

async function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    console.log('📦 DROP déclenché !', event.currentTarget.dataset.meal);
    console.log('   draggedMealElement:', window.draggedMealElement);
    console.log('   draggedMealData:', window.draggedMealData);
    
    const targetMealType = event.currentTarget.dataset.meal;
    event.currentTarget.classList.remove('drag-over');
    
    // Nettoyer toutes les autres classes drag-over
    document.querySelectorAll('.meal-column.drag-over').forEach(col => {
        if (col !== event.currentTarget) {
            col.classList.remove('drag-over');
        }
    });
    
    const meals = await db.loadDayMeals(state.currentDate);
    
    console.log('🔍 Test conditions:');
    console.log('   window.draggedMealElement:', window.draggedMealElement);
    console.log('   window.draggedMealData:', window.draggedMealData);
    console.log('   state.draggedFoodId:', state.draggedFoodId);
    
    // CAS 1 (PRIORITAIRE) : Drop d'un meal-item depuis un autre repas (APPROCHE DE L'EXEMPLE)
    if (window.draggedMealElement && window.draggedMealData) {
        console.log('🎯 ENTRÉE dans le if meal-item !');
        const sourceMeal = window.draggedMealData.sourceMeal;
        
        // Si on déplace vers le même repas, ne rien faire
        if (sourceMeal === targetMealType) {
            console.log('⚠️ Même repas, pas de déplacement');
            // Nettoyer l'état avant de sortir
            state.draggedFoodId = null;
            window.draggedMealElement = null;
            window.draggedMealData = null;
            return;
        }
        
        console.log('✅ Déplacement de', sourceMeal, 'vers', targetMealType);
        
        // Déplacement logique: mettre à jour la BDD
        meals[sourceMeal] = meals[sourceMeal].filter(item => item.uniqueId !== window.draggedMealData.uniqueId);
        meals[targetMealType].push({
            id: window.draggedMealData.foodId,
            weight: window.draggedMealData.weight,
            isMeal: window.draggedMealData.isMeal || false,
            uniqueId: window.draggedMealData.uniqueId // Garder le même uniqueId
        });
        
        await db.saveDayMeals(state.currentDate, meals);
        console.log('💾 BDD mise à jour');
        
        // Re-render des repas pour mettre à jour les en-têtes et refléter l'état (fiable)
        ui.displayMeals(meals, state.foods, handleRemoveMealItem, handleUpdateWeight, state.meals);
        // Mettre à jour le résumé de la journée
        const totals = utils.calculateDayTotals(meals, state.foods, state.meals);
        ui.updateSummary(totals, state.goals);
        
        ui.showNotification(`Aliment déplacé vers ${getMealName(targetMealType)} !`);
    }
    
    // CAS 2 : Drop d'un aliment ou repas depuis la liste disponible
    else if (state.draggedFoodId) {
        console.log('➕ Ajout depuis la liste:', state.draggedFoodId);
        
        // Vérifier si c'est un repas composé
        if (state.meals[state.draggedFoodId]) {
            // C'est un repas → l'ajouter comme bloc (pas de décomposition)
            const meal = state.meals[state.draggedFoodId];
            meals[targetMealType].push({ 
                id: state.draggedFoodId,
                isMeal: true, // Flag pour identifier que c'est un repas composé
                weight: 100, // Poids par défaut (pourra être ajusté)
                uniqueId: Date.now()
            });
            await db.saveDayMeals(state.currentDate, meals);
            // Re-render repas + résumé
            ui.displayMeals(meals, state.foods, handleRemoveMealItem, handleUpdateWeight, state.meals);
            const totals = utils.calculateDayTotals(meals, state.foods, state.meals);
            ui.updateSummary(totals, state.goals);
            ui.showNotification(`${meal.name} ajouté !`);
        }
        // Sinon, c'est un aliment simple
        else if (state.foods[state.draggedFoodId]) {
            const food = state.foods[state.draggedFoodId];
            // Si l'aliment est basé sur des portions, utiliser le poids de la portion, sinon 100g
            const defaultWeight = (food.isPortionBased && food.portionWeight) ? food.portionWeight : 100;
            meals[targetMealType].push({ id: state.draggedFoodId, weight: defaultWeight, uniqueId: Date.now() });
            await db.saveDayMeals(state.currentDate, meals);
            // Re-render repas + résumé
            ui.displayMeals(meals, state.foods, handleRemoveMealItem, handleUpdateWeight, state.meals);
            const totals = utils.calculateDayTotals(meals, state.foods, state.meals);
            ui.updateSummary(totals, state.goals);
        }
    }
    
    // Nettoyer l'état à la fin du drop
    state.draggedFoodId = null;
    state.draggedMealItem = null;
    window.draggedMealElement = null;
    window.draggedMealData = null;
}

// Fonction helper pour obtenir le nom du repas
function getMealName(mealType) {
    const names = {
        'petit-dej': 'Petit Déjeuner',
        'dejeuner': 'Déjeuner',
        'diner': 'Dîner',
        'snack': 'Snack'
    };
    return names[mealType] || mealType;
}

async function handleRemoveMealItem(mealType, uniqueId) {
    const meals = await db.loadDayMeals(state.currentDate);
    meals[mealType] = meals[mealType].filter(item => item.uniqueId !== uniqueId);
    await db.saveDayMeals(state.currentDate, meals);
    loadCurrentDay();
}
async function handleUpdateWeight(mealType, uniqueId, newWeight) {
    const meals = await db.loadDayMeals(state.currentDate);
    const item = meals[mealType].find(i => i.uniqueId === uniqueId);
    if (item) {
        item.weight = parseFloat(newWeight) || 100;
        await db.saveDayMeals(state.currentDate, meals);
        loadCurrentDay();
    }
}

async function handleSaveWeight() {
    const weightInput = document.getElementById('weightInput');
    const weight = parseFloat(weightInput.value);
    if (weight && weight > 0) {
        await db.saveDayWeight(state.currentDate, weight);
        ui.showNotification('Poids enregistré !');
    } else if (weightInput.value === '') {
        // Si le champ est vide, on peut supprimer le poids (optionnel)
        await db.saveDayWeight(state.currentDate, null);
        ui.showNotification('Poids effacé.');
    } else {
        ui.showNotification('Veuillez entrer un poids valide.', 'error');
    }
}

// --- HANDLER POUR L'AJOUT RAPIDE ---
async function handleQuickAdd(foodId, mealType) {
    const meals = await db.loadDayMeals(state.currentDate);
    
    // Vérifier si c'est un repas composé
    if (state.meals[foodId]) {
        const meal = state.meals[foodId];
        meals[mealType].push({ 
            id: foodId,
            isMeal: true, // Flag pour identifier que c'est un repas composé
            weight: 100, // Poids par défaut
            uniqueId: Date.now()
        });
        await db.saveDayMeals(state.currentDate, meals);
        loadCurrentDay();
        ui.showNotification(`${meal.name} ajouté !`);
    }
    // Sinon, c'est un aliment simple
    else if (state.foods[foodId]) {
        const food = state.foods[foodId];
        // Si l'aliment est basé sur des portions, utiliser le poids de la portion, sinon 100g
        const defaultWeight = (food.isPortionBased && food.portionWeight) ? food.portionWeight : 100;
        meals[mealType].push({ id: foodId, weight: defaultWeight, uniqueId: Date.now() });
        await db.saveDayMeals(state.currentDate, meals);
        loadCurrentDay();
        ui.showNotification(`${food.name} ajouté !`);
    }
}

// --- HANDLER POUR LA RECHERCHE D'ALIMENTS ---
function handleFoodSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const loadMoreBtn = document.getElementById('loadMoreFoodsBtn');
    
    if (searchTerm || state.currentCategory !== 'all') {
        // En mode recherche ou filtrage, afficher tous les résultats correspondants
        ui.displayFoods(state.foods, handleDragStart, handleQuickAdd, 0, state.meals);
        
        const foodItems = document.querySelectorAll('.food-item');
        const noResultsMsg = document.getElementById('noResultsMessage');
        let visibleCount = 0;

        foodItems.forEach(item => {
            const foodName = item.dataset.foodName?.toLowerCase() || '';
            const foodCategory = item.dataset.foodCategory || 'other';
            
            // Vérifier à la fois le nom ET la catégorie
            const matchesSearch = !searchTerm || foodName.includes(searchTerm);
            const matchesCategory = state.currentCategory === 'all' || foodCategory === state.currentCategory;
            
            if (matchesSearch && matchesCategory) {
                item.classList.remove('hidden');
                visibleCount++;
            } else {
                item.classList.add('hidden');
            }
        });

        // Afficher/masquer le message "Aucun résultat"
        if (noResultsMsg) {
            noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
        }
        
        // Masquer le bouton "Voir plus" en mode recherche/filtrage
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    } else {
        // Sans recherche ni filtrage, revenir à l'affichage limité
        ui.displayFoods(state.foods, handleDragStart, handleQuickAdd, state.displayedFoodsCount, state.meals);
        const noResultsMsg = document.getElementById('noResultsMessage');
        if (noResultsMsg) noResultsMsg.style.display = 'none';
    }
}

// --- HANDLER POUR CHARGER PLUS D'ALIMENTS ---
function handleLoadMoreFoods() {
    state.displayedFoodsCount += state.maxFoodsPerLoad;
    ui.displayFoods(state.foods, handleDragStart, handleQuickAdd, state.displayedFoodsCount, state.meals);
}

// --- HANDLER POUR LE FILTRE DE CATÉGORIE ---
function handleCategoryFilter(event) {
    state.currentCategory = event.target.value;
    // Déclencher handleFoodSearch pour appliquer le filtre
    handleFoodSearch({ target: document.getElementById('foodSearch') });
}

// --- FONCTION POUR RAFRAÎCHIR LA LISTE DES ALIMENTS DISPONIBLES ---
function refreshAvailableFoods() {
    ui.displayFoods(state.foods, handleDragStart, handleQuickAdd, state.displayedFoodsCount, state.meals);
}

// --- HELPER POUR METTRE À JOUR LE RÉSUMÉ ---
async function updateDailySummaryHelper() {
    const meals = await db.loadDayMeals(state.currentDate);
    const totals = utils.calculateDayTotals(meals, state.foods, state.meals);
    const dateFormatted = utils.formatDateDisplay(state.currentDate);
    const waterData = await db.loadDayWater(state.currentDate);
    const steps = await db.loadDaySteps(state.currentDate);
    const activities = state.activities || [];
    ui.updateDailySummary(meals, state.foods, totals, dateFormatted, waterData, steps, activities, state.goals, state.meals);
}

// --- HANDLERS POUR L'HYDRATATION ---
async function handleAddWater(amount) {
    const waterData = await db.loadDayWater(state.currentDate);
    waterData.totalMl = (waterData.totalMl || 0) + amount;
    waterData.history = waterData.history || [];
    waterData.history.push({
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        ml: amount
    });
    
    await db.saveDayWater(state.currentDate, waterData);
    ui.updateWaterDisplay(waterData, state.goals);
    ui.showNotification(`+${amount}ml d'eau ajoutés ! 💧`);
    
    // Mettre à jour le résumé de la journée
    await updateDailySummaryHelper();
}

async function handleEditWater() {
    const waterData = await db.loadDayWater(state.currentDate);
    const currentMl = waterData.totalMl || 0;
    const newAmount = prompt(`✏️ Modifier l'hydratation du jour\n\nQuantité actuelle : ${currentMl} ml\nNouvelle quantité (ml) :`, currentMl);
    
    if (newAmount !== null && !isNaN(newAmount) && parseInt(newAmount) >= 0) {
        const newMl = parseInt(newAmount);
        waterData.totalMl = newMl;
        waterData.history = waterData.history || [];
        waterData.history.push({
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            ml: newMl,
            type: 'edit'
        });
        
        await db.saveDayWater(state.currentDate, waterData);
        ui.updateWaterDisplay(waterData, state.goals);
        ui.showNotification(`💧 Hydratation mise à jour : ${newMl} ml`);
        
        // Mettre à jour le résumé de la journée
        await updateDailySummaryHelper();
    }
}

async function handleResetWater() {
    if (confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser l\'hydratation du jour ?')) {
        await db.saveDayWater(state.currentDate, { totalMl: 0, history: [] });
        ui.updateWaterDisplay({ totalMl: 0, history: [] }, state.goals);
        ui.showNotification('💧 Hydratation réinitialisée');
        
        // Mettre à jour le résumé de la journée
        await updateDailySummaryHelper();
    }
}

// --- HANDLER POUR LES PAS ---
async function handleUpdateSteps() {
    const stepsInput = document.getElementById('stepsInput');
    const steps = parseInt(stepsInput.value);
    
    if (isNaN(steps) || steps < 0) {
        ui.showNotification('⚠️ Nombre de pas invalide', 'error');
        return;
    }
    
    await db.saveDaySteps(state.currentDate, steps);
    ui.updateStepsDisplay(steps, state.goals);
    ui.showNotification(`👟 ${steps} pas enregistrés !`);
    
    // Mettre à jour le résumé de la journée
    await updateDailySummaryHelper();
}

async function handleResetSteps() {
    if (confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser les pas du jour ?')) {
        await db.saveDaySteps(state.currentDate, 0);
        ui.updateStepsDisplay(0, state.goals);
        ui.showNotification('👟 Pas réinitialisés');
        
        // Mettre à jour le résumé de la journée
        await updateDailySummaryHelper();
    }
}

// --- HANDLERS POUR ÉDITER LES MACROS ---
function handleEditMacros() {
    // Masquer les affichages et afficher les inputs
    document.querySelectorAll('.macro-display').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.macro-input').forEach(el => el.style.display = 'block');
    
    // Masquer bouton modifier, afficher boutons sauvegarder/annuler
    document.getElementById('editMacrosBtn').style.display = 'none';
    document.getElementById('macroEditActions').style.display = 'block';
}

function handleCancelMacrosEdit() {
    // Afficher les affichages et masquer les inputs
    document.querySelectorAll('.macro-display').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.macro-input').forEach(el => el.style.display = 'none');
    
    // Afficher bouton modifier, masquer boutons sauvegarder/annuler
    document.getElementById('editMacrosBtn').style.display = 'inline-block';
    document.getElementById('macroEditActions').style.display = 'none';
}

async function handleSaveMacros() {
    const proteins = parseInt(document.getElementById('goalProteinsInput').value, 10);
    const carbs = parseInt(document.getElementById('goalCarbsInput').value, 10);
    const fats = parseInt(document.getElementById('goalFatsInput').value, 10);
    
    if (!proteins || !carbs || !fats || proteins < 0 || carbs < 0 || fats < 0) {
        ui.showNotification('⚠️ Veuillez entrer des valeurs valides pour tous les macros', 'error');
        return;
    }
    
    // Recalculer les calories totales
    const newCalories = Math.round((proteins * 4) + (carbs * 4) + (fats * 9));
    
    // Mettre à jour les objectifs
    const updatedGoals = {
        ...state.goals,
        proteins: proteins,
        carbs: carbs,
        fats: fats,
        calories: newCalories
    };
    
    await db.saveGoals(updatedGoals);
    state.goals = updatedGoals;
    
    // Mettre à jour l'affichage
    document.getElementById('goalProteins').textContent = `${proteins} g`;
    document.getElementById('goalCarbs').textContent = `${carbs} g`;
    document.getElementById('goalFats').textContent = `${fats} g`;
    document.getElementById('goalCalories').textContent = `${newCalories} kcal`;
    
    // Retour au mode affichage
    handleCancelMacrosEdit();
    
    ui.showNotification('✅ Macronutriments mis à jour !');
    
    // Rafraîchir l'affichage du jour en cours
    await loadCurrentDay();
}

// --- HANDLERS POUR ÉDITER LES OBJECTIFS BIEN-ÊTRE ---
function handleEditWellness() {
    // Masquer les affichages et afficher les inputs
    document.querySelectorAll('.wellness-display').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.wellness-input').forEach(el => el.style.display = 'block');
    
    // Masquer bouton modifier, afficher boutons sauvegarder/annuler
    document.getElementById('editWellnessBtn').style.display = 'none';
    document.getElementById('wellnessEditActions').style.display = 'block';
}

function handleCancelWellnessEdit() {
    // Afficher les affichages et masquer les inputs
    document.querySelectorAll('.wellness-display').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.wellness-input').forEach(el => el.style.display = 'none');
    
    // Afficher bouton modifier, masquer boutons sauvegarder/annuler
    document.getElementById('editWellnessBtn').style.display = 'inline-block';
    document.getElementById('wellnessEditActions').style.display = 'none';
}

async function handleSaveWellness() {
    const waterGoal = parseInt(document.getElementById('goalWaterEditInput').value, 10);
    const stepsGoal = parseInt(document.getElementById('goalStepsEditInput').value, 10);
    
    if (!waterGoal || !stepsGoal || waterGoal < 500 || stepsGoal < 1000) {
        ui.showNotification('⚠️ Veuillez entrer des valeurs valides', 'error');
        return;
    }
    
    // Mettre à jour les objectifs
    const updatedGoals = {
        ...state.goals,
        waterGoal: waterGoal,
        stepsGoal: stepsGoal
    };
    
    await db.saveGoals(updatedGoals);
    state.goals = updatedGoals;
    
    // Mettre à jour l'affichage
    document.getElementById('goalWaterDisplay').textContent = `${waterGoal} ml`;
    document.getElementById('goalStepsDisplay').textContent = `${stepsGoal} pas`;
    
    // Retour au mode affichage
    handleCancelWellnessEdit();
    
    ui.showNotification('✅ Objectifs bien-être mis à jour !');
    
    // Rafraîchir l'affichage du jour en cours
    await loadCurrentDay();
}

// --- HANDLER POUR COPIER LE RÉSUMÉ ---
async function handleCopySummary() {
    const meals = await db.loadDayMeals(state.currentDate);
    const totals = utils.calculateDayTotals(meals, state.foods, state.meals);
    const dateFormatted = utils.formatDateDisplay(state.currentDate);
    const waterData = await db.loadDayWater(state.currentDate);
    const steps = await db.loadDaySteps(state.currentDate);
    const activities = await db.loadDayActivities(state.currentDate);
    const summaryText = ui.generateSummaryText(meals, state.foods, totals, dateFormatted, waterData, steps, activities, state.goals, state.meals);
    
    const copyBtn = document.getElementById('copySummaryBtn');
    const copyText = copyBtn.querySelector('.copy-text');
    
    try {
        await navigator.clipboard.writeText(summaryText);
        
        // Feedback visuel
        copyBtn.classList.add('copied');
        copyText.textContent = 'Copié !';
        
        ui.showNotification('📋 Résumé copié dans le presse-papiers !');
        
        // Retour à l'état normal après 2 secondes
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyText.textContent = 'Copier';
        }, 2000);
    } catch (err) {
        ui.showNotification('❌ Erreur lors de la copie', 'error');
        console.error('Erreur de copie:', err);
    }
}

// --- HANDLER POUR DÉVELOPPER/CACHER LE RÉSUMÉ ---
function handleToggleSummary() {
    const summaryContent = document.getElementById('dailySummaryContent');
    const toggleBtn = document.getElementById('toggleSummaryBtn');
    
    // Toggle des classes
    summaryContent.classList.toggle('collapsed');
    toggleBtn.classList.toggle('expanded');
}

// --- HANDLERS POUR ACTIVITÉS PHYSIQUES ---
async function handleAddActivity() {
    const activityType = document.getElementById('activitySelect').value;
    const duration = parseInt(document.getElementById('activityDuration').value);
    const calories = parseInt(document.getElementById('activityCalories').value);
    
    if (!activityType || !duration || !calories || duration <= 0 || calories < 0) {
        ui.showNotification('⚠️ Veuillez remplir tous les champs correctement', 'error');
        return;
    }
    
    const newActivity = {
        id: Date.now(),
        type: activityType,
        duration,
        calories
    };
    
    state.activities.push(newActivity);
    await db.saveDayActivities(state.currentDate, state.activities);
    
    // Réinitialiser le formulaire
    document.getElementById('activitySelect').value = '';
    document.getElementById('activityDuration').value = '';
    document.getElementById('activityCalories').value = '';
    
    // Rafraîchir l'affichage
    await loadCurrentDay();
    ui.showNotification('✅ Activité ajoutée !');
}

function handleEditActivity(id) {
    const activity = state.activities.find(a => a.id === id);
    if (!activity) return;
    
    // Pré-remplir le formulaire de modification
    document.getElementById('editActivityIndex').value = id;
    document.getElementById('editActivityType').value = activity.type;
    document.getElementById('editActivityDuration').value = activity.duration;
    document.getElementById('editActivityCalories').value = activity.calories;
    
    // Afficher la modal
    ui.showModal('editActivityModal');
}

async function handleSaveEditActivity(event) {
    event.preventDefault();
    
    const id = parseInt(document.getElementById('editActivityIndex').value);
    const type = document.getElementById('editActivityType').value;
    const duration = parseInt(document.getElementById('editActivityDuration').value);
    const calories = parseInt(document.getElementById('editActivityCalories').value);
    
    const activityIndex = state.activities.findIndex(a => a.id === id);
    if (activityIndex === -1) return;
    
    state.activities[activityIndex] = { id, type, duration, calories };
    await db.saveDayActivities(state.currentDate, state.activities);
    
    ui.hideModal('editActivityModal');
    await loadCurrentDay();
    ui.showNotification('✅ Activité modifiée !');
}

async function handleDeleteActivity(id) {
    if (!confirm('Supprimer cette activité ?')) return;
    
    state.activities = state.activities.filter(a => a.id !== id);
    await db.saveDayActivities(state.currentDate, state.activities);
    
    await loadCurrentDay();
    ui.showNotification('🗑️ Activité supprimée');
}

async function handleAddCustomActivity(event) {
    event.preventDefault();
    
    const name = document.getElementById('customActivityName').value.trim();
    if (!name) {
        ui.showNotification('⚠️ Veuillez entrer un nom d\'activité', 'error');
        return;
    }
    
    // Vérifier si l'activité existe déjà
    if (state.allActivities.includes(name)) {
        ui.showNotification('⚠️ Cette activité existe déjà', 'error');
        return;
    }
    
    await db.saveCustomActivity(name);
    state.customActivities = await db.loadCustomActivities();
    updateActivitySelects();
    
    document.getElementById('customActivityName').value = '';
    ui.hideModal('customActivityModal');
    ui.showNotification('✅ Nouvelle activité ajoutée !');
}

function updateActivitySelects() {
    state.allActivities = [...defaultActivities, ...state.customActivities.map(a => a.name)];
    
    const selects = [
        document.getElementById('activitySelect'),
        document.getElementById('editActivityType')
    ];
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Sélectionner une activité...</option>';
        
        state.allActivities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity;
            option.textContent = activity;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    });
}

// --- HANDLER POUR LA RECHERCHE DANS L'ONGLET ALIMENTS ---
function handleFoodSearchManage(event) {
    const searchTerm = event.target.value.toLowerCase();
    const foodItems = document.querySelectorAll('#foodsListManage .food-item');
    const noResultsMsg = document.getElementById('noResultsMessageManage');
    let visibleCount = 0;

    foodItems.forEach(item => {
        const foodName = item.dataset.foodName?.toLowerCase() || '';
        if (foodName.includes(searchTerm)) {
            item.classList.remove('hidden');
            visibleCount++;
        } else {
            item.classList.add('hidden');
        }
    });

    // Afficher/masquer le message "Aucun résultat"
    if (noResultsMsg) {
        noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }
}

async function handleGoalsSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    // Récupération de tous les paramètres du formulaire
    const goalProfile = form.querySelector('#goalProfile').value;
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

    // Calcul du Métabolisme de Base (formule de Mifflin-St Jeor)
    let mb;
    if (sexe === 'homme') {
        mb = 10 * weight + 6.25 * taille - 5 * age + 5;
    } else {
        mb = 10 * weight + 6.25 * taille - 5 * age - 161;
    }
    
    // Calcul de la Dépense Énergétique Totale (DET)
    const det = mb * activite;
    
    // Calcul des calories selon le profil
    // Note: valeurs négatives = surplus (pour prise de masse)
    const targetKcal = Math.round(det * (1 - adjustmentPercent));
    
    // Calcul des macros selon le profil choisi
    let proteins, fats;
    
    switch (goalProfile) {
        case 'cut': // Sèche: haute protéine pour préserver muscle
            proteins = Math.round(weight * 2.2);
            fats = Math.round(weight * 1.0);
            break;
        case 'weightloss': // Perte de poids: équilibré
            proteins = Math.round(weight * 1.8);
            fats = Math.round(weight * 0.9);
            break;
        case 'bulk': // Prise de masse: haute protéine et plus de glucides
            proteins = Math.round(weight * 2.0);
            fats = Math.round(weight * 1.1);
            break;
        case 'maintenance': // Maintien: équilibré
            proteins = Math.round(weight * 1.6);
            fats = Math.round(weight * 1.0);
            break;
        case 'recomp': // Recomposition: très haute protéine
            proteins = Math.round(weight * 2.4);
            fats = Math.round(weight * 0.9);
            break;
        default:
            proteins = Math.round(weight * 2.0);
            fats = Math.round(weight * 1.0);
    }
    
    // Calcul des calories pour protéines/lipides
    const kcalProteins = proteins * 4;
    const kcalFats = fats * 9;
    
    // Calcul des glucides à partir des calories restantes
    const kcalCarbs = targetKcal - kcalProteins - kcalFats;
    const carbs = Math.max(Math.round(kcalCarbs / 4), 0);

    // Sauvegarde des objectifs avec tous les paramètres du formulaire
    const goals = {
        calories: targetKcal,
        proteins: proteins,
        carbs: carbs,
        fats: fats,
        mb: Math.round(mb),
        det: Math.round(det),
        // Paramètres du formulaire
        goalProfile: goalProfile,
        sexe: sexe,
        age: age,
        weight: weight,
        taille: taille,
        activite: activite,
        adjustmentPercent: adjustmentPercent,
        // Objectifs hydratation et pas
        waterGoal: waterGoal,
        stepsGoal: stepsGoal,
        // Seuils sucres et fibres
        sugarsMax: sugarsMax,
        fibersMin: fibersMin
    };

    await db.saveGoals(goals);
    state.goals = goals;
    ui.displayGoals(goals);
    ui.showNotification('Objectifs enregistrés !');
    
    // Rafraîchir l'affichage du jour en cours pour montrer les écarts
    await loadCurrentDay();
}


async function handleAddFood(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector('#foodName').value;
    if (!name) return;
    const id = utils.generateFoodId(name);
    if (state.foods[id]) {
        ui.showNotification(`L'aliment "${name}" existe déjà.`, 'error');
        return;
    }
    
    // Récupérer la catégorie
    const category = form.querySelector('#foodCategory').value || 'other';
    
    const price = parseFloat(form.querySelector('#foodPrice').value);
    const priceQuantity = parseFloat(form.querySelector('#foodPriceQuantity').value);
    const priceUnit = form.querySelector('input[name="foodPriceType"]:checked')?.value || 'grams';
    
    // Récupérer le type de valeurs nutritionnelles
    const nutritionType = form.querySelector('input[name="foodNutritionType"]:checked')?.value || 'per100g';
    const portionWeight = parseFloat(form.querySelector('#foodPortionWeight')?.value) || null;
    
    // Récupérer les valeurs saisies
    let calories = parseFloat(form.querySelector('#foodCalories').value) || 0;
    let proteins = parseFloat(form.querySelector('#foodProteins').value) || 0;
    let carbs = parseFloat(form.querySelector('#foodCarbs').value) || 0;
    let sugars = parseFloat(form.querySelector('#foodSugars').value) || 0;
    let fibers = parseFloat(form.querySelector('#foodFibers').value) || 0;
    let fats = parseFloat(form.querySelector('#foodFats').value) || 0;
    
    // Si les valeurs sont pour 1 portion, convertir en valeurs pour 100g
    if (nutritionType === 'perPortion' && portionWeight && portionWeight > 0) {
        const ratio = 100 / portionWeight;
        calories *= ratio;
        proteins *= ratio;
        carbs *= ratio;
        sugars *= ratio;
        fibers *= ratio;
        fats *= ratio;
    }
    
    const newFood = {
        name,
        category,
        calories,
        proteins,
        carbs,
        sugars,
        fibers,
        fats,
        // Stocker le type et le poids de portion
        isPortionBased: nutritionType === 'perPortion',
        portionWeight: nutritionType === 'perPortion' ? portionWeight : null
    };
    
    // Ajouter prix si renseigné
    if (price && priceQuantity && price > 0 && priceQuantity > 0) {
        newFood.price = price;
        newFood.priceQuantity = priceQuantity;
        newFood.priceUnit = priceUnit; // 'grams' ou 'portions'
    }
    await db.saveFood(id, newFood);
    state.foods[id] = newFood;
    ui.displayFoods(state.foods, handleDragStart, handleQuickAdd, state.displayedFoodsCount, state.meals);
    ui.displayFoodsManage(state.foods, handleEditFoodClick, handleDeleteFoodClick);
    form.reset();
    ui.showNotification(`${name} ajouté avec succès !`);
}

function handleEditFoodClick(event) {
    const foodId = event.currentTarget.dataset.foodId;
    const foodData = state.foods[foodId];
    if (foodData) {
        ui.openEditModal(foodId, foodData);
    }
}

/**
 * Gère la suppression d'un aliment avec confirmation.
 */
async function handleDeleteFoodClick(event) {
    const foodId = event.currentTarget.dataset.foodId;
    const foodName = event.currentTarget.dataset.foodName;
    
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer "${foodName}" ?\n\nCette action est irréversible.`)) {
        return;
    }
    
    try {
        // Supprimer de la base de données
        await db.deleteFood(foodId);
        
        // Supprimer de l'état local
        delete state.foods[foodId];
        
        // Rafraîchir les listes d'aliments
        ui.displayFoods(state.foods, handleDragStart, handleQuickAdd, state.displayedFoodsCount, state.meals);
        ui.displayFoodsManage(state.foods, handleEditFoodClick, handleDeleteFoodClick);
        
        // Recharger la journée pour mettre à jour l'affichage
        await loadCurrentDay();
        
        ui.showNotification(`✅ "${foodName}" a été supprimé avec succès !`);
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        ui.showNotification(`❌ Erreur lors de la suppression de "${foodName}"`, 'error');
    }
}

/**
 * Gère la mise à jour d'un aliment, y compris le renommage.
 */
async function handleUpdateFood(event) {
    event.preventDefault();
    const form = event.target;
    const oldId = form.querySelector('#editFoodId').value;
    const newName = form.querySelector('#editFoodName').value;
    const newId = utils.generateFoodId(newName);

    // Récupérer la catégorie
    const category = form.querySelector('#editFoodCategory').value || 'other';

    const price = parseFloat(form.querySelector('#editFoodPrice').value);
    const priceQuantity = parseFloat(form.querySelector('#editFoodPriceQuantity').value);
    const priceUnit = form.querySelector('input[name="editFoodPriceType"]:checked')?.value || 'grams';
    
    // Récupérer le type de valeurs nutritionnelles
    const nutritionType = form.querySelector('input[name="editFoodNutritionType"]:checked')?.value || 'per100g';
    const portionWeight = parseFloat(form.querySelector('#editFoodPortionWeight')?.value) || null;
    
    // Récupérer les valeurs saisies
    let calories = parseFloat(form.querySelector('#editFoodCalories').value) || 0;
    let proteins = parseFloat(form.querySelector('#editFoodProteins').value) || 0;
    let carbs = parseFloat(form.querySelector('#editFoodCarbs').value) || 0;
    let sugars = parseFloat(form.querySelector('#editFoodSugars').value) || 0;
    let fibers = parseFloat(form.querySelector('#editFoodFibers').value) || 0;
    let fats = parseFloat(form.querySelector('#editFoodFats').value) || 0;
    
    // Si les valeurs sont pour 1 portion, convertir en valeurs pour 100g
    if (nutritionType === 'perPortion' && portionWeight && portionWeight > 0) {
        const ratio = 100 / portionWeight;
        calories *= ratio;
        proteins *= ratio;
        carbs *= ratio;
        sugars *= ratio;
        fibers *= ratio;
        fats *= ratio;
    }
    
    const updatedFoodData = {
        name: newName,
        category,
        calories,
        proteins,
        carbs,
        sugars,
        fibers,
        fats,
        // Stocker le type et le poids de portion
        isPortionBased: nutritionType === 'perPortion',
        portionWeight: nutritionType === 'perPortion' ? portionWeight : null
    };
    
    // Ajouter prix si renseigné
    if (price && priceQuantity && price > 0 && priceQuantity > 0) {
        updatedFoodData.price = price;
        updatedFoodData.priceQuantity = priceQuantity;
        updatedFoodData.priceUnit = priceUnit; // 'grams' ou 'portions'
    }

    // CAS 1 : Le nom n'a pas changé, c'est une simple mise à jour.
    if (oldId === newId) {
        await db.saveFood(oldId, updatedFoodData);
        state.foods[oldId] = updatedFoodData;
    } 
    // CAS 2 : Le nom a changé, c'est une migration complexe.
    else {
        // Sécurité : on vérifie que le nouveau nom n'est pas déjà pris.
        if (state.foods[newId]) {
            ui.showNotification(`Un aliment nommé "${newName}" existe déjà.`, 'error');
            return;
        }
        await db.replaceFoodId(oldId, newId, updatedFoodData);
        // Mettre à jour l'état local
        delete state.foods[oldId];
        state.foods[newId] = updatedFoodData;
    }

    // Rafraîchir toute l'interface
    ui.displayFoods(state.foods, handleDragStart, handleQuickAdd, state.displayedFoodsCount, state.meals);
    ui.displayFoodsManage(state.foods, handleEditFoodClick, handleDeleteFoodClick);
    await loadCurrentDay(); 

    ui.closeEditModal();
    ui.showNotification(`"${updatedFoodData.name}" mis à jour avec succès !`);
}

// (Les handlers pour l'import, export et reset restent inchangés)
async function handleExport() {
    try {
        const foodsData = await db.getAllFromStore('foods');
        const composedMealsData = await db.getAllFromStore('meals'); // Repas composés
        const mealsData = await db.getAllFromStore('dailyMeals');
        const goalsData = await db.getAllFromStore('goals');
        const waterData = await db.getAllFromStore('dailyWater');
        const stepsData = await db.getAllFromStore('dailySteps');
        const activitiesData = await db.getAllFromStore('dailyActivities');
        const customActivitiesData = await db.getAllFromStore('customActivities');
        const dataToExport = { 
            version: '1.5.0', // v1.5.0: Prix personnalisé, recherche repas, améliorations comparaison
            exportDate: new Date().toISOString(), 
            foods: foodsData,
            meals: composedMealsData, // Repas composés
            dailyMeals: mealsData, 
            goals: goalsData,
            dailyWater: waterData,
            dailySteps: stepsData,
            dailyActivities: activitiesData,
            customActivities: customActivitiesData
        };
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nutrition-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        ui.showNotification('Exportation réussie !');
    } catch (error) {
        ui.showNotification('Échec de l\'exportation.', 'error');
    }
}
function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Détecter si c'est un fichier de partage sélectif
            if (data.data && data.data.foods && data.appName === 'Nutrition Tracker') {
                ui.showNotification('⚠️ Ce fichier est un partage d\'aliments/repas.\n\nVeuillez utiliser le bouton "📂 Importer depuis un fichier" dans la section "Partage d\'Aliments et Repas" pour importer ce type de fichier.', 'error');
                return;
            }
            
            // Vérifier le format de sauvegarde complète
            if (!data.foods || !data.dailyMeals) {
                ui.showNotification('❌ Format de fichier invalide.\n\nAssurez-vous d\'importer une sauvegarde complète exportée depuis cette application.', 'error');
                return;
            }
            
            if (!confirm('Importer ces données ?\n⚠️ Les données actuelles seront remplacées.')) return;
            
            // Vider tous les stores
            await db.clearStore('foods');
            await db.clearStore('meals'); // Repas composés
            await db.clearStore('dailyMeals');
            await db.clearStore('goals');
            await db.clearStore('dailyWater');
            await db.clearStore('dailySteps');
            await db.clearStore('dailyActivities');
            await db.clearStore('customActivities');
            
            // Importer les données
            await db.bulkPut('foods', data.foods);
            if (data.meals) await db.bulkPut('meals', data.meals); // Repas composés
            await db.bulkPut('dailyMeals', data.dailyMeals);
            if (data.goals) await db.bulkPut('goals', data.goals);
            if (data.dailyWater) await db.bulkPut('dailyWater', data.dailyWater);
            if (data.dailySteps) await db.bulkPut('dailySteps', data.dailySteps);
            if (data.dailyActivities) await db.bulkPut('dailyActivities', data.dailyActivities);
            if (data.customActivities) await db.bulkPut('customActivities', data.customActivities);
            
            await init(true);
            
            // Réinitialiser le module meals pour forcer le rafraîchissement
            meals.resetInitialization();
            
            // Si on est sur l'onglet repas, rafraîchir immédiatement
            const currentTab = document.querySelector('.tab-btn.active')?.dataset.tab;
            if (currentTab === 'meals') {
                meals.refreshMealsDisplay(state.meals, state.foods);
            }
            
            ui.showNotification('Importation réussie !');
        } catch (error) {
            ui.showNotification(error.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
async function handleReset() {
    if (!confirm('⚠️ Voulez-vous vraiment réinitialiser TOUTES vos données ?\n\nCela supprimera :\n- Tous vos aliments personnalisés\n- Tous vos repas composés\n- Tous vos repas quotidiens enregistrés\n- Tous vos objectifs\n- Toutes vos données d\'hydratation\n- Toutes vos données de pas\n- Toutes vos activités\n- Tous vos poids enregistrés\n\nCette action est IRRÉVERSIBLE !')) return;
    
    try {
        // Réinitialiser tous les stores
        await db.clearStore('foods');
        await db.clearStore('meals'); // Repas composés
        await db.clearStore('dailyMeals');
        await db.clearStore('goals');
        await db.clearStore('dailyWater');
        await db.clearStore('dailySteps');
        await db.clearStore('dailyActivities');
        await db.clearStore('customActivities');
        
        // Afficher notification avant rechargement
        ui.showNotification('✅ Toutes les données ont été supprimées ! Rechargement...', 'success');
        
        // Recharger complètement la page après un court délai
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        ui.showNotification('❌ Erreur lors de la réinitialisation', 'error');
    }
}

// --- INITIALISATION ---

// =================== AJUSTEMENT DES PORTIONS ===================

// Variable pour stocker le contexte de l'ajustement en cours
let currentAdjustment = null;

/**
 * Ouvre la modale d'ajustement des portions
 */
function handleAdjustPortions(mealType, uniqueId, mealId, customPortions, customPrice) {
    const meal = state.meals[mealId];
    if (!meal || !meal.isPortionAdjustable) return;
    
    // Stocker le contexte
    currentAdjustment = {
        mealType,
        uniqueId,
        mealId,
        meal
    };
    
    // Remplir la modale
    document.getElementById('adjustPortionsMealName').textContent = meal.name;
    const container = document.getElementById('adjustPortionsContainer');
    container.innerHTML = '';
    
    // Créer une ligne pour chaque ingrédient
    meal.ingredients.forEach(ing => {
        const food = state.foods[ing.foodId];
        if (!food) return;
        
        // Utiliser customPortions si existe (même si 0), sinon valeur par défaut
        const currentWeight = (customPortions && customPortions.hasOwnProperty(ing.foodId)) 
            ? customPortions[ing.foodId] 
            : ing.weight;
        
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 12px; background: #f8f9fa; border-radius: 8px;';
        row.dataset.foodId = ing.foodId;
        
        row.innerHTML = `
            <span style="flex: 1; font-weight: 500;">${food.name}</span>
            <input type="number" class="portion-input" value="${currentWeight}" min="0" step="1" 
                   style="width: 80px; padding: 8px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 1em;">
            <span style="font-weight: 600; color: #666;">g</span>
        `;
        
        // Listener pour mise à jour en temps réel
        row.querySelector('.portion-input').addEventListener('input', updateAdjustmentPreview);
        
        container.appendChild(row);
    });
    
    // Charger le prix personnalisé s'il existe
    const customPriceCheckbox = document.getElementById('customPriceCheckbox');
    const customPriceInput = document.getElementById('customPriceInput');
    
    if (customPrice !== undefined && customPrice !== null) {
        customPriceCheckbox.checked = true;
        customPriceInput.disabled = false;
        customPriceInput.value = customPrice.toFixed(2);
    } else {
        customPriceCheckbox.checked = false;
        customPriceInput.disabled = true;
        customPriceInput.value = '';
    }
    
    // Calculer et afficher l'aperçu initial
    updateAdjustmentPreview();
    
    // Afficher la modale
    ui.showModal('adjustPortionsModal');
}

/**
 * Met à jour l'aperçu nutritionnel en temps réel
 */
function updateAdjustmentPreview() {
    const rows = document.querySelectorAll('#adjustPortionsContainer > div');
    let totals = {
        calories: 0,
        proteins: 0,
        carbs: 0,
        fats: 0,
        fibers: 0,
        sugars: 0,
        cost: 0
    };
    let hasCost = false;
    
    rows.forEach(row => {
        const foodId = row.dataset.foodId;
        const weight = parseFloat(row.querySelector('.portion-input').value) || 0;
        const food = state.foods[foodId];
        
        if (food && weight > 0) {
            totals.calories += (food.calories * weight / 100);
            totals.proteins += (food.proteins * weight / 100);
            totals.carbs += (food.carbs * weight / 100);
            totals.fats += (food.fats * weight / 100);
            totals.fibers += ((food.fibers || 0) * weight / 100);
            totals.sugars += ((food.sugars || 0) * weight / 100);
            
            // Calculer le coût si disponible
            if (food.price && (food.priceQuantity || food.priceGrams)) {
                // Utiliser la fonction getPricePer100g pour gérer tous les formats
                let pricePer100g;
                if (food.priceQuantity && food.priceUnit) {
                    // Nouveau format
                    if (food.priceUnit === 'grams') {
                        pricePer100g = (food.price / food.priceQuantity) * 100;
                    } else if (food.priceUnit === 'portions') {
                        const portionWeight = food.portionWeight || 100;
                        const totalGrams = food.priceQuantity * portionWeight;
                        pricePer100g = (food.price / totalGrams) * 100;
                    }
                } else if (food.priceGrams) {
                    // Ancien format (rétrocompatibilité)
                    pricePer100g = (food.price / food.priceGrams) * 100;
                }
                
                if (pricePer100g) {
                    totals.cost += (pricePer100g / 100) * weight;
                    hasCost = true;
                }
            }
        }
    });
    
    // Mettre à jour l'affichage nutritionnel
    document.getElementById('adjustCal').textContent = totals.calories.toFixed(0);
    document.getElementById('adjustProt').textContent = totals.proteins.toFixed(1);
    document.getElementById('adjustCarbs').textContent = totals.carbs.toFixed(1);
    document.getElementById('adjustFat').textContent = totals.fats.toFixed(1);
    document.getElementById('adjustFib').textContent = totals.fibers.toFixed(1);
    document.getElementById('adjustSug').textContent = totals.sugars.toFixed(1);
    
    // Afficher le coût si au moins un ingrédient a un prix
    const costSection = document.getElementById('adjustCostSection');
    const customPriceCheckbox = document.getElementById('customPriceCheckbox');
    const customPriceInput = document.getElementById('customPriceInput');
    
    if (hasCost) {
        // Si prix personnalisé activé et valide, l'afficher dans le champ
        if (customPriceCheckbox.checked) {
            const customPrice = parseFloat(customPriceInput.value);
            if (!isNaN(customPrice) && customPrice >= 0) {
                document.getElementById('adjustCost').textContent = customPrice.toFixed(2);
            } else {
                document.getElementById('adjustCost').textContent = totals.cost.toFixed(2);
            }
        } else {
            document.getElementById('adjustCost').textContent = totals.cost.toFixed(2);
        }
        costSection.style.display = 'block';
    } else {
        costSection.style.display = 'none';
    }
}

/**
 * Ferme la modale d'ajustement
 */
function closeAdjustPortionsModal() {
    ui.hideModal('adjustPortionsModal');
    currentAdjustment = null;
}

/**
 * Sauvegarde les portions ajustées
 */
async function saveAdjustedPortions() {
    if (!currentAdjustment) return;
    
    const { mealType, uniqueId } = currentAdjustment;
    
    // Récupérer les nouvelles portions
    const rows = document.querySelectorAll('#adjustPortionsContainer > div');
    const customPortions = {};
    
    rows.forEach(row => {
        const foodId = row.dataset.foodId;
        const weight = parseFloat(row.querySelector('.portion-input').value) || 0;
        // Sauvegarder toutes les valeurs, y compris 0 (pour indiquer "pas de cet ingrédient")
        customPortions[foodId] = weight;
    });
    
    // Récupérer le prix personnalisé si activé
    const customPriceCheckbox = document.getElementById('customPriceCheckbox');
    const customPriceInput = document.getElementById('customPriceInput');
    let customPrice = null;
    
    if (customPriceCheckbox.checked) {
        const priceValue = parseFloat(customPriceInput.value);
        if (!isNaN(priceValue) && priceValue >= 0) {
            customPrice = priceValue;
        }
    }
    
    // Mettre à jour dans la BDD
    const meals = await db.loadDayMeals(state.currentDate);
    const mealItems = meals[mealType];
    const itemIndex = mealItems.findIndex(item => item.uniqueId === uniqueId);
    
    if (itemIndex !== -1) {
        mealItems[itemIndex].customPortions = customPortions;
        
        // Sauvegarder ou supprimer le prix personnalisé
        if (customPrice !== null) {
            mealItems[itemIndex].customPrice = customPrice;
        } else {
            delete mealItems[itemIndex].customPrice;
        }
        
        await db.saveDayMeals(state.currentDate, meals);
        
        // Recharger l'affichage
        loadCurrentDay();
        
        ui.showNotification('✅ Portions ajustées avec succès !');
    }
    
    closeAdjustPortionsModal();
}

// Exposer la fonction globalement pour ui.js
window.handleAdjustPortions = handleAdjustPortions;

// =================== FIN AJUSTEMENT DES PORTIONS ===================

function setupEventListeners() {
    document.querySelector('.nav-tabs').addEventListener('click', e => {
        if (e.target.matches('.nav-tab')) {
            const tabName = e.target.dataset.tab;
            ui.switchTab(tabName);
            if (tabName === 'stats') {
                charts.updateCharts(state.currentPeriod, state.foods, state.goals, state.meals);
                charts.updateAverageCharts(state.currentAveragePeriod, state.foods, state.goals, state.meals);
                costs.updateCostCharts(state.currentCostPeriod, state.foods, state.meals);
                try {
                    activityCharts.updateActivityCharts(state.currentActivityPeriod);
                } catch (error) {
                    console.log('Erreur chargement graphiques activités:', error);
                }
                foodAnalysis.updateFoodAnalysis(state.currentFoodAnalysisPeriod, state.foods);
            }
            if (tabName === 'meals') {
                meals.initMeals(state.foods);
            }
            if (tabName === 'comparison') {
                foodComparison.initComparison(state.foods, state.meals);
            }
            if (tabName === 'settings') {
                importExport.initImportExport(state.foods, state.meals);
            }
        }
    });
    document.querySelector('.stats-period').addEventListener('click', e => {
        if (e.target.matches('.period-btn')) {
            const periodValue = e.target.dataset.period;
            state.currentPeriod = periodValue === 'all' ? 'all' : parseInt(periodValue, 10);
            document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            charts.updateCharts(state.currentPeriod, state.foods, state.goals, state.meals);
        }
    });
    
    // Event listener pour les boutons de période des moyennes
    document.querySelectorAll('.stats-period').forEach(periodContainer => {
        periodContainer.addEventListener('click', e => {
            if (e.target.matches('.average-period-btn')) {
                state.currentAveragePeriod = e.target.dataset.avgPeriod;
                document.querySelectorAll('.average-period-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                charts.updateAverageCharts(state.currentAveragePeriod, state.foods, state.goals, state.meals);
            }
            // Event listener pour les boutons de période des coûts
            if (e.target.matches('.cost-period-btn')) {
                state.currentCostPeriod = parseInt(e.target.dataset.costPeriod, 10);
                document.querySelectorAll('.cost-period-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                costs.updateCostCharts(state.currentCostPeriod, state.foods, state.meals);
            }
            // Event listener pour les boutons de période des activités
            if (e.target.matches('.activity-period-btn')) {
                state.currentActivityPeriod = parseInt(e.target.dataset.activityPeriod, 10);
                document.querySelectorAll('.activity-period-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                activityCharts.updateActivityCharts(state.currentActivityPeriod);
            }
        });
    });
    
    // Event listener pour la navigation entre les sections de statistiques
    document.querySelector('.stats-navigation')?.addEventListener('click', e => {
        if (e.target.matches('.stats-nav-btn')) {
            // Retirer la classe active de tous les boutons
            document.querySelectorAll('.stats-nav-btn').forEach(btn => btn.classList.remove('active'));
            // Ajouter la classe active au bouton cliqué
            e.target.classList.add('active');
            
            // Récupérer l'ID de la section cible
            const targetSectionId = e.target.dataset.section;
            const targetSection = document.getElementById(targetSectionId);
            
            if (targetSection) {
                // Scroll smooth vers la section
                targetSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        }
    });
    
    // Intersection Observer pour mettre à jour le bouton actif selon la section visible
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px', // Zone de détection au milieu de l'écran
        threshold: 0
    };
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Trouver le bouton correspondant à cette section
                const sectionId = entry.target.id;
                const correspondingBtn = document.querySelector(`.stats-nav-btn[data-section="${sectionId}"]`);
                
                if (correspondingBtn) {
                    // Retirer active de tous les boutons
                    document.querySelectorAll('.stats-nav-btn').forEach(btn => btn.classList.remove('active'));
                    // Ajouter active au bouton correspondant
                    correspondingBtn.classList.add('active');
                }
            }
        });
    }, observerOptions);
    
    // Observer toutes les sections de statistiques
    document.querySelectorAll('.stats-section').forEach(section => {
        sectionObserver.observe(section);
    });
    
    document.getElementById('prev-day-btn').addEventListener('click', () => changeDate(-1));
    document.getElementById('next-day-btn').addEventListener('click', () => changeDate(1));
    document.getElementById('today-btn').addEventListener('click', goToToday);
    document.getElementById('datePicker').addEventListener('change', handleDatePickerChange);
    document.getElementById('saveWeightBtn').addEventListener('click', handleSaveWeight);
    document.getElementById('goalsForm').addEventListener('submit', handleGoalsSubmit);
    document.getElementById('foodSearch').addEventListener('input', handleFoodSearch);
    document.getElementById('categoryFilter').addEventListener('change', handleCategoryFilter);
    document.getElementById('loadMoreFoodsBtn').addEventListener('click', handleLoadMoreFoods);
    document.getElementById('foodSearchManage').addEventListener('input', handleFoodSearchManage);
    
    // Hydratation
    document.querySelectorAll('.water-btn.add-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAddWater(parseInt(btn.dataset.amount)));
    });
    document.getElementById('editWaterBtn').addEventListener('click', handleEditWater);
    document.getElementById('resetWaterBtn').addEventListener('click', handleResetWater);
    
    // Pas
    document.getElementById('updateStepsBtn').addEventListener('click', handleUpdateSteps);
    document.getElementById('resetStepsBtn').addEventListener('click', handleResetSteps);
    document.getElementById('stepsInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUpdateSteps();
    });
    
    // Copier résumé
    document.getElementById('copySummaryBtn').addEventListener('click', handleCopySummary);
    
    // Toggle résumé (développer/cacher)
    document.getElementById('toggleSummaryBtn').addEventListener('click', handleToggleSummary);
    
    // Édition macros
    document.getElementById('editMacrosBtn').addEventListener('click', handleEditMacros);
    document.getElementById('saveMacrosBtn').addEventListener('click', handleSaveMacros);
    document.getElementById('cancelMacrosBtn').addEventListener('click', handleCancelMacrosEdit);
    
    // Édition objectifs bien-être
    document.getElementById('editWellnessBtn').addEventListener('click', handleEditWellness);
    document.getElementById('saveWellnessBtn').addEventListener('click', handleSaveWellness);
    document.getElementById('cancelWellnessBtn').addEventListener('click', handleCancelWellnessEdit);
    
    document.querySelectorAll('.meal-column').forEach(col => {
        col.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            col.classList.add('drag-over'); 
        });
        col.addEventListener('dragleave', (e) => {
            // Ne retirer drag-over que si on quitte vraiment la meal-column (pas juste un enfant)
            if (e.target === col || !col.contains(e.relatedTarget)) {
                col.classList.remove('drag-over');
            }
        });
        col.addEventListener('drop', handleDrop);
    });
    
    // Nettoyer l'état à la fin du drag (comme dans l'exemple)
    document.body.addEventListener('dragend', handleDragEnd);
    document.getElementById('addFoodForm').addEventListener('submit', handleAddFood);
    document.getElementById('editFoodForm').addEventListener('submit', handleUpdateFood);
    // Activités physiques
    document.getElementById('addActivityBtn').addEventListener('click', handleAddActivity);
    document.getElementById('addCustomActivityBtn').addEventListener('click', () => ui.showModal('customActivityModal'));
    document.getElementById('customActivityForm').addEventListener('submit', handleAddCustomActivity);
    document.getElementById('editActivityForm').addEventListener('submit', handleSaveEditActivity);
    document.getElementById('closeCustomActivityModal').addEventListener('click', () => ui.hideModal('customActivityModal'));
    document.getElementById('closeEditActivityModal').addEventListener('click', () => ui.hideModal('editActivityModal'));
    document.getElementById('cancelCustomActivityBtn').addEventListener('click', () => ui.hideModal('customActivityModal'));
    document.getElementById('cancelEditActivityBtn').addEventListener('click', () => ui.hideModal('editActivityModal'));
    
    // Analyse par aliment
    document.querySelectorAll('.food-analysis-period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.currentFoodAnalysisPeriod = parseInt(e.target.dataset.foodPeriod, 10);
            document.querySelectorAll('.food-analysis-period-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            foodAnalysis.updateFoodAnalysis(state.currentFoodAnalysisPeriod, state.foods);
        });
    });
    
    // Tri du tableau
    document.querySelectorAll('.food-analysis-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortColumn = th.dataset.sort;
            foodAnalysis.handleTableSort(sortColumn);
        });
    });
    
    // Boutons d'export
    document.getElementById('copyFoodAnalysisBtn').addEventListener('click', foodAnalysis.copyFoodAnalysisToClipboard);
    document.getElementById('exportFoodAnalysisCSVBtn').addEventListener('click', foodAnalysis.exportFoodAnalysisToCSV);
    
    // Checkboxes pour afficher/masquer les colonnes de macros
    document.querySelectorAll('.column-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const columnName = e.target.dataset.column;
            const isVisible = e.target.checked;
            foodAnalysis.toggleColumn(columnName, isVisible);
        });
    });
    
    document.getElementById('export-btn').addEventListener('click', handleExport);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', handleImport);
    document.getElementById('reset-btn').addEventListener('click', handleReset);
    document.getElementById('cancelEditBtn').addEventListener('click', ui.closeEditModal);
    document.querySelector('.modal-close-btn').addEventListener('click', ui.closeEditModal);
    document.getElementById('editFoodModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) ui.closeEditModal();
    });
    
    // Modale d'ajustement des portions
    document.getElementById('closeAdjustPortionsModal').addEventListener('click', closeAdjustPortionsModal);
    document.getElementById('cancelAdjustPortionsBtn').addEventListener('click', closeAdjustPortionsModal);
    document.getElementById('confirmAdjustPortionsBtn').addEventListener('click', saveAdjustedPortions);
    document.getElementById('adjustPortionsModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeAdjustPortionsModal();
    });
    
    // Checkbox pour activer/désactiver le prix personnalisé
    document.getElementById('customPriceCheckbox').addEventListener('change', e => {
        const customPriceInput = document.getElementById('customPriceInput');
        customPriceInput.disabled = !e.target.checked;
        if (e.target.checked) {
            customPriceInput.focus();
        } else {
            customPriceInput.value = '';
        }
        updateAdjustmentPreview(); // Mettre à jour l'affichage
    });
    
    // Input du prix personnalisé - mise à jour en temps réel
    document.getElementById('customPriceInput').addEventListener('input', updateAdjustmentPreview);
}

async function initializeDefaultFoods() {
    const existingFoods = await db.loadFoods();
    if (Object.keys(existingFoods).length === 0) {
        for (const [id, food] of Object.entries(defaultFoods)) {
            await db.saveFood(id, food);
        }
        ui.showNotification('Base de données initialisée !');
    }
}

async function init(isReload = false) {
    try {
        if (!isReload) {
            await db.initDB();
            setupEventListeners();
        }
        await initializeDefaultFoods();
        state.foods = await db.loadFoods();
        state.meals = await db.loadMeals();
        state.goals = await db.loadGoals();
        
        // Exposer le state globalement pour les modules qui en ont besoin
        window.appState = state;
        window.refreshAvailableFoods = refreshAvailableFoods;
        
        // Charger activités personnalisées avec protection
        try {
            state.customActivities = await db.loadCustomActivities();
            updateActivitySelects();
        } catch (error) {
            console.log('Erreur chargement activités personnalisées:', error);
            state.customActivities = [];
            state.allActivities = [...defaultActivities];
        }
        if (state.goals) {
            ui.displayGoals(state.goals);
        }
        await loadCurrentDay();
        ui.displayFoods(state.foods, handleDragStart, handleQuickAdd, state.displayedFoodsCount, state.meals);
        ui.displayFoodsManage(state.foods, handleEditFoodClick, handleDeleteFoodClick);
        if (!isReload) {
            console.log('✅ Application prête !');
            console.log('\n🔧 OUTILS DE DIAGNOSTIC DISPONIBLES:');
            console.log('  • dbDiagnose()     - Diagnostiquer la base de données');
            console.log('  • dbCheck()        - Vérifier l\'intégrité de tous les stores');
            console.log('  • dbExport()       - Exporter tous les aliments en JSON');
            console.log('  • dbFixStructure() - 🔥 Ajouter price/priceGrams à TOUS les aliments');
            console.log('  • dbAddPrice(id, price, grams) - Ajouter un prix à un aliment');
            console.log('  • dbBulkPrices(data) - Mettre à jour plusieurs prix en lot');
            console.log('\n📝 Exemples:');
            console.log('  dbFixStructure()  // Ajouter les champs price/priceGrams partout');
            console.log('  dbAddPrice("banane", 2.50, 1000)  // Prix individuel');
            console.log('  dbBulkPrices({ "banane": {price: 2.5, priceGrams: 1000}, ... })\n');
        }
    } catch (error) {
        console.error('Erreur initialisation:', error);
        ui.showNotification("Erreur lors de l'initialisation", 'error');
    }
}

// Lance l'application
init();