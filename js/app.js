// js/app.js
// Point d'entrée de l'application. Orchestre l'initialisation et les événements.

import { defaultFoods, defaultActivities } from './config.js';
import state from './core/state.js';
import * as db from './core/db.js';
import * as ui from './ui/ui-core.js';
import * as uiMeals from './ui/ui-meals.js';
import * as charts from './stats/charts.js';
import * as chartsAverages from './stats/charts-averages.js';
import * as costs from './stats/costs.js';
import * as activityCharts from './stats/activities-charts.js';
import * as periodComparison from './stats/period-comparison.js';
import * as utils from './core/utils.js';
import * as dbUtils from './core/db-utils.js';
import * as foodAnalysis from './stats/food-analysis.js';
import * as foodComparison from './features/food-comparison.js';
import * as meals from './features/meals.js';
import * as importExport from './data/import-export.js';
import { planBackupImport, OPTIONAL_BACKUP_STORES } from './data/backup-format.js';
import * as mealHistory from './features/meal-history.js';
import * as healthEvents from './features/health-events.js';

// Handlers
import * as statsHandlers from './handlers/stats-handlers.js';
import * as dailyHandlers from './handlers/daily-handlers.js';
import * as foodHandlers from './handlers/food-handlers.js';
import * as activityHandlers from './handlers/activity-handlers.js';
import * as goalsHandlers from './handlers/goals-handlers.js';
import * as aiHandlers from './handlers/ai-handlers.js';

// --- LOGIQUE PRINCIPALE ---

async function loadCurrentDay() {
    const dateFormatted = utils.formatDateDisplay(state.currentDate);
    ui.updateDateDisplay(state.currentDate);
    const dayMeals = await db.loadDayMeals(state.currentDate);
    const weight = await db.loadDayWeight(state.currentDate);
    const belly = await db.loadDayBelly(state.currentDate);
    const bedtime = await db.loadDayBedtime(state.currentDate);
    const sleepDuration = await db.loadDaySleepDuration(state.currentDate);
    const dailyEvents = await db.loadHealthEventsForDate(state.currentDate);
    const waterData = await db.loadDayWater(state.currentDate);
    const steps = await db.loadDaySteps(state.currentDate);

    try { state.activities = await db.loadDayActivities(state.currentDate); }
    catch (error) { console.log('Erreur chargement activités:', error); state.activities = []; }

    uiMeals.displayMeals(dayMeals, state.foods, 
        (mt, uid) => dailyHandlers.handleRemoveMealItem(mt, uid, loadCurrentDay),
        (mt, uid, nw) => dailyHandlers.handleUpdateWeight(mt, uid, nw, loadCurrentDay),
        (mt, uid, time) => dailyHandlers.handleUpdateMealItemTime(mt, uid, time, loadCurrentDay),
        (mt, time) => dailyHandlers.handleUpdateMealTime(mt, time, loadCurrentDay),
        state.meals);
    const totals = utils.calculateDayTotals(dayMeals, state.foods, state.meals);
    const burnedCalories = (state.activities || []).reduce((sum, a) => sum + (a.calories || 0), 0);
    ui.updateSummary(totals, state.goals, burnedCalories, weight);
    ui.updateWeightDisplay(weight);
    ui.updateBellyDisplay(belly);
    ui.updateBedtimeDisplay(bedtime);
    ui.updateSleepDurationDisplay(sleepDuration);
    healthEvents.renderActiveEvents(dailyEvents);
    uiMeals.updateWaterDisplay(waterData, state.goals);
    uiMeals.updateStepsDisplay(steps, state.goals);

    try { uiMeals.displayActivities(state.activities,
        (id) => activityHandlers.handleEditActivity(id),
        (id) => activityHandlers.handleDeleteActivity(id, loadCurrentDay)); }
    catch (error) { console.log('Erreur affichage activités:', error); }

    uiMeals.updateDailySummary(dayMeals, state.foods, totals, dateFormatted, waterData, steps, state.activities, state.goals, state.meals);
}

function changeDate(days) {
    state.currentDate.setDate(state.currentDate.getDate() + days);
    loadCurrentDay().catch(error => {
        console.error('Erreur chargement du jour:', error);
        ui.showNotification('Erreur lors du chargement de la journée.', 'error');
    });
}
function goToToday() {
    state.currentDate = new Date();
    loadCurrentDay().catch(error => {
        console.error('Erreur chargement du jour:', error);
        ui.showNotification('Erreur lors du chargement de la journée.', 'error');
    });
}
function handleDatePickerChange(event) {
    const selectedDate = event.target.value;
    if (selectedDate) {
        state.currentDate = new Date(selectedDate + 'T12:00:00');
        loadCurrentDay().catch(error => {
            console.error('Erreur chargement du jour:', error);
            ui.showNotification('Erreur lors du chargement de la journée.', 'error');
        });
    }
}

// --- IMPORT / EXPORT / RESET ---
function enrichFoodForExport(food) {
    const glycemicIndex = Number.isFinite(Number(food.glycemicIndex))
        ? Math.min(Math.max(Number(food.glycemicIndex), 0), 100)
        : null;
    const carbs = Number(food.carbs) || 0;
    const glycemicLoad = glycemicIndex !== null ? (glycemicIndex * carbs) / 100 : null;

    return {
        ...food,
        glycemicIndex,
        glycemicLoad
    };
}

function enrichDailyMealForExport(day) {
    const sharedMealTypes = ['petit-dej', 'dejeuner', 'diner'];
    const defaultTimes = { 'petit-dej': '08:00', dejeuner: '12:30', diner: '19:30' };
    const meals = { ...(day.meals || {}) };
    const mealTimes = { ...(day.mealTimes || {}) };

    sharedMealTypes.forEach(mealType => {
        const items = meals[mealType] || [];
        const time = mealTimes[mealType] || items.find(item => item.time)?.time || defaultTimes[mealType];
        mealTimes[mealType] = time;
        meals[mealType] = items.map(item => ({ ...item, time }));
    });

    meals.snack = (meals.snack || []).map(item => ({ ...item }));

    return {
        ...day,
        calorieGoal: Number.isFinite(Number(day.calorieGoal)) ? Math.round(Number(day.calorieGoal)) : null,
        proteinGoal: Number.isFinite(Number(day.proteinGoal)) ? Math.round(Number(day.proteinGoal)) : null,
        carbGoal: Number.isFinite(Number(day.carbGoal)) ? Math.round(Number(day.carbGoal)) : null,
        fatGoal: Number.isFinite(Number(day.fatGoal)) ? Math.round(Number(day.fatGoal)) : null,
        bedtime: day.bedtime || null,
        sleepDuration: Number.isFinite(Number(day.sleepDuration)) ? Number(day.sleepDuration) : null,
        events: Array.isArray(day.events) ? day.events : [],
        mealTimes,
        meals
    };
}

function normalizeDailyMealForImport(day) {
    if (!day || !day.date) return day;
    return {
        ...day,
        meals: day.meals || { 'petit-dej': [], dejeuner: [], diner: [], snack: [] },
        calorieGoal: Number.isFinite(Number(day.calorieGoal)) ? Math.round(Number(day.calorieGoal)) : null,
        proteinGoal: Number.isFinite(Number(day.proteinGoal)) ? Math.round(Number(day.proteinGoal)) : null,
        carbGoal: Number.isFinite(Number(day.carbGoal)) ? Math.round(Number(day.carbGoal)) : null,
        fatGoal: Number.isFinite(Number(day.fatGoal)) ? Math.round(Number(day.fatGoal)) : null,
        bedtime: day.bedtime || null,
        sleepDuration: Number.isFinite(Number(day.sleepDuration)) ? Number(day.sleepDuration) : null,
        events: Array.isArray(day.events) ? day.events : []
    };
}

function initStatsFilterSettingsUI() {
    const enabledInput = document.getElementById('excludeLowCalorieDaysInput');
    const thresholdInput = document.getElementById('lowCalorieThresholdInput');
    if (!enabledInput || !thresholdInput) return;

    const settings = charts.getStatsFilterSettings();
    enabledInput.checked = settings.excludeLowCalorieDays;
    thresholdInput.value = settings.lowCalorieThreshold;
}

function refreshStatsSections() {
    const periodFilter = statsHandlers.getCurrentStatsPeriodFilter();
    charts.updateCharts(periodFilter, state.foods, state.goals, state.meals);
    chartsAverages.updateAverageCharts(state.currentAveragePeriod, state.foods, state.goals, state.meals);
    costs.updateCostCharts(state.currentCostPeriod, state.foods, state.meals);
    try { activityCharts.updateActivityCharts(state.currentActivityPeriod, state.foods, state.meals); } catch (error) { console.log('Erreur graphiques activités:', error); }
    foodAnalysis.updateFoodAnalysis(state.currentFoodAnalysisPeriod, state.foods, state.meals);
    mealHistory.updateMealHistory(periodFilter, state.foods, state.meals);
}

function saveStatsFilterSettingsFromUI() {
    const enabledInput = document.getElementById('excludeLowCalorieDaysInput');
    const thresholdInput = document.getElementById('lowCalorieThresholdInput');
    if (!enabledInput || !thresholdInput) return;

    charts.saveStatsFilterSettings({
        excludeLowCalorieDays: enabledInput.checked,
        lowCalorieThreshold: thresholdInput.value
    });

    refreshStatsSections();
    ui.showNotification('Réglage des statistiques sauvegardé !');
}

function formatTimeFromTimestamp(timestamp, expectedDate) {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (expectedDate && `${year}-${month}-${day}` !== expectedDate) return null;
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function enrichDayActivitiesForExport(day) {
    return {
        ...day,
        activities: (day.activities || []).map(activity => ({
            ...activity,
            time: activity.time || formatTimeFromTimestamp(activity.id, day.date)
        }))
    };
}

async function handleExport() {
    try {
        const foodsData = (await db.getAllFromStore('foods')).map(enrichFoodForExport);
        const composedMealsData = await db.getAllFromStore('meals');
        const mealsData = (await db.getAllFromStore('dailyMeals')).map(enrichDailyMealForExport);
        const goalsData = await db.getAllFromStore('goals');
        const waterData = await db.getAllFromStore('dailyWater');
        const stepsData = await db.getAllFromStore('dailySteps');
        const activitiesData = (await db.getAllFromStore('dailyActivities')).map(enrichDayActivitiesForExport);
        const customActivitiesData = await db.getAllFromStore('customActivities');
        const healthEventsData = await db.getAllFromStore('healthEvents');
        const appSettings = {
            statsFilter: charts.getStatsFilterSettings()
        };
        const dataToExport = {
            version: '1.6.0', exportDate: new Date().toISOString(),
            foods: foodsData, meals: composedMealsData, dailyMeals: mealsData, goals: goalsData,
            dailyWater: waterData, dailySteps: stepsData, dailyActivities: activitiesData, customActivities: customActivitiesData,
            healthEvents: healthEventsData,
            appSettings
        };
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `nutrition-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click(); URL.revokeObjectURL(url);
        ui.showNotification('Exportation réussie !');
    } catch (error) { ui.showNotification('Échec de l\'exportation.', 'error'); }
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            // --- Validation AVANT toute écriture ---
            const plan = planBackupImport(data);
            if (!plan.ok) {
                ui.showNotification(`❌ ${plan.error}`, 'error');
                return;
            }
            const { foods: foodsToImport, dailyMeals: dailyMealsToImport } = plan;
            if (!confirm('Importer ces données ?\n⚠️ Les données actuelles seront remplacées.')) return;

            // Seuls les stores réellement présents dans le fichier sont remplacés :
            // les autres sont conservés (une sauvegarde ancienne, sans
            // `healthEvents`, effaçait sinon tout l'historique de santé).
            const STORES_TO_REPLACE = plan.storesToReplace;

            // Instantané de secours : si l'écriture échoue en cours de route, on
            // restaure l'état précédent au lieu de laisser une base à moitié vidée.
            const snapshot = {};
            for (const store of STORES_TO_REPLACE) snapshot[store] = await db.getAllFromStore(store);

            try {
                for (const store of STORES_TO_REPLACE) await db.clearStore(store);
                await db.bulkPut('foods', foodsToImport);
                await db.bulkPut('dailyMeals', dailyMealsToImport.map(normalizeDailyMealForImport));
                for (const [key, storeName] of Object.entries(OPTIONAL_BACKUP_STORES)) {
                    if (plan.optional[key] !== null) await db.bulkPut(storeName, plan.optional[key]);
                }
            } catch (writeError) {
                for (const store of STORES_TO_REPLACE) {
                    await db.clearStore(store);
                    if (snapshot[store]?.length) await db.bulkPut(store, snapshot[store]);
                }
                throw new Error(`Importation annulée, données précédentes restaurées (${writeError.message}).`);
            }

            if (data.appSettings?.statsFilter) charts.saveStatsFilterSettings(data.appSettings.statsFilter);
            await init(true);
            meals.resetInitialization();
            const currentTab = document.querySelector('.nav-tab.active')?.dataset.tab;
            if (currentTab === 'meals') meals.refreshMealsDisplay(state.meals, state.foods);
            ui.showNotification(plan.preservedStores.length
                ? `Importation réussie ! Données absentes du fichier conservées : ${plan.preservedStores.join(', ')}.`
                : 'Importation réussie !');
        } catch (error) { ui.showNotification(error.message, 'error'); }
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function handleReset() {
    if (!confirm('⚠️ Voulez-vous vraiment réinitialiser TOUTES vos données ?\n\nCela supprimera :\n- Tous vos aliments personnalisés\n- Tous vos repas composés\n- Tous vos repas quotidiens enregistrés\n- Tous vos objectifs\n- Toutes vos données d\'hydratation\n- Toutes vos données de pas\n- Toutes vos activités\n- Tous vos événements\n- Tous vos poids enregistrés\n\nCette action est IRRÉVERSIBLE !')) return;
    try {
        await db.clearStore('foods'); await db.clearStore('meals'); await db.clearStore('dailyMeals');
        await db.clearStore('goals'); await db.clearStore('dailyWater'); await db.clearStore('dailySteps');
        await db.clearStore('dailyActivities'); await db.clearStore('customActivities');
        await db.clearStore('healthEvents');
        ui.showNotification('✅ Toutes les données ont été supprimées ! Rechargement...', 'success');
        setTimeout(() => window.location.reload(), 1500);
    } catch (error) { console.error('Erreur réinitialisation:', error); ui.showNotification('❌ Erreur lors de la réinitialisation', 'error'); }
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
    // Navigation onglets
    document.querySelector('.nav-tabs').addEventListener('click', e => {
        if (e.target.matches('.nav-tab')) {
            const tabName = e.target.dataset.tab;
            ui.switchTab(tabName);
            if (tabName === 'stats') {
                refreshStatsSections();
            }
            if (tabName === 'meals') meals.initMeals(state.foods);
            if (tabName === 'comparison') foodComparison.initComparison(state.foods, state.meals);
            if (tabName === 'events') healthEvents.refreshHealthEventsTab();
            if (tabName === 'settings') {
                importExport.initImportExport(state.foods, state.meals);
                aiHandlers.initApiKeySettings();
            }
        }
    });

    // Période statistiques
    document.querySelector('.stats-period').addEventListener('click', e => {
        if (e.target.matches('.period-btn')) {
            const periodValue = e.target.dataset.period;
            state.currentPeriod = periodValue === 'all' ? 'all' : parseInt(periodValue, 10);
            state.currentCustomStatsRange = null;
            document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const periodFilter = statsHandlers.getCurrentStatsPeriodFilter();
            charts.updateCharts(periodFilter, state.foods, state.goals, state.meals);
            mealHistory.updateMealHistory(periodFilter, state.foods, state.meals);
            statsHandlers.saveStatsState();
        }
    });
    document.getElementById('applyStatsDateRangeBtn').addEventListener('click', statsHandlers.applyCustomStatsDateRange);
    periodComparison.initPeriodComparison(() => ({
        foods: state.foods,
        goals: state.goals,
        composedMeals: state.meals
    }));

    // Périodes moyennes / coûts / activités
    document.querySelectorAll('.stats-period').forEach(periodContainer => {
        periodContainer.addEventListener('click', e => {
            if (e.target.matches('.average-period-btn')) {
                state.currentAveragePeriod = e.target.dataset.avgPeriod;
                document.querySelectorAll('.average-period-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                chartsAverages.updateAverageCharts(state.currentAveragePeriod, state.foods, state.goals, state.meals);
                statsHandlers.saveStatsState();
            }
            if (e.target.matches('.cost-period-btn')) {
                state.currentCostPeriod = parseInt(e.target.dataset.costPeriod, 10);
                document.querySelectorAll('.cost-period-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                costs.updateCostCharts(state.currentCostPeriod, state.foods, state.meals);
                statsHandlers.saveStatsState();
            }
            if (e.target.matches('.activity-period-btn')) {
                state.currentActivityPeriod = parseInt(e.target.dataset.activityPeriod, 10);
                document.querySelectorAll('.activity-period-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                activityCharts.updateActivityCharts(state.currentActivityPeriod, state.foods, state.meals);
                statsHandlers.saveStatsState();
            }
        });
    });

    // Navigation dates
    document.getElementById('prev-day-btn').addEventListener('click', () => changeDate(-1));
    document.getElementById('next-day-btn').addEventListener('click', () => changeDate(1));
    document.getElementById('today-btn').addEventListener('click', goToToday);
    document.getElementById('datePicker').addEventListener('change', handleDatePickerChange);

    // Poids / ventre
    document.getElementById('saveWeightBtn').addEventListener('click', () => dailyHandlers.handleSaveWeight(loadCurrentDay));
    document.getElementById('saveBellyBtn').addEventListener('click', dailyHandlers.handleSaveBelly);
    document.getElementById('saveBedtimeBtn').addEventListener('click', () => dailyHandlers.handleSaveBedtime(loadCurrentDay));
    document.getElementById('saveSleepDurationBtn').addEventListener('click', () => dailyHandlers.handleSaveSleepDuration(loadCurrentDay));
    healthEvents.initHealthEvents({ loadCurrentDay });

    // Objectifs
    document.getElementById('goalsForm').addEventListener('submit', goalsHandlers.handleGoalsSubmit);

    // Recherche & filtres aliments
    document.getElementById('foodSearch').addEventListener('input', foodHandlers.handleFoodSearch);
    document.getElementById('loadMoreFoodsBtn').addEventListener('click', foodHandlers.handleLoadMoreFoods);
    document.getElementById('foodSearchManage').addEventListener('input', foodHandlers.handleFoodSearchManage);
    document.getElementById('aiFoodSearchBtn').addEventListener('click', foodHandlers.handleAIFoodWebSearch);
    document.getElementById('aiFoodAnalyzeBtn').addEventListener('click', foodHandlers.handleAIFoodAnalyze);
    document.querySelectorAll('.category-filter-btn').forEach(btn => btn.addEventListener('click', foodHandlers.handleCategoryFilter));
    document.querySelectorAll('.category-filter-btn-manage').forEach(btn => btn.addEventListener('click', foodHandlers.handleCategoryFilterManage));

    // Navigation stats
    document.querySelectorAll('.stats-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { statsHandlers.handleStatsNavigation(e); statsHandlers.saveStatsState(); });
    });

    // Hydratation
    document.querySelectorAll('.water-btn.add-btn').forEach(btn => btn.addEventListener('click', () => dailyHandlers.handleAddWater(parseInt(btn.dataset.amount))));
    document.getElementById('editWaterBtn').addEventListener('click', dailyHandlers.handleEditWater);
    document.getElementById('resetWaterBtn').addEventListener('click', dailyHandlers.handleResetWater);

    // Pas
    document.getElementById('updateStepsBtn').addEventListener('click', dailyHandlers.handleUpdateSteps);
    document.getElementById('resetStepsBtn').addEventListener('click', dailyHandlers.handleResetSteps);
    document.getElementById('stepsInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') dailyHandlers.handleUpdateSteps(); });

    // Résumé
    document.getElementById('copySummaryBtn').addEventListener('click', dailyHandlers.handleCopySummary);
    document.getElementById('toggleSummaryBtn').addEventListener('click', dailyHandlers.handleToggleSummary);

    // Édition macros
    document.getElementById('editMacrosBtn').addEventListener('click', goalsHandlers.handleEditMacros);
    document.getElementById('saveMacrosBtn').addEventListener('click', goalsHandlers.handleSaveMacros);
    document.getElementById('cancelMacrosBtn').addEventListener('click', goalsHandlers.handleCancelMacrosEdit);

    // Édition objectifs bien-être
    document.getElementById('editWellnessBtn').addEventListener('click', goalsHandlers.handleEditWellness);
    document.getElementById('saveWellnessBtn').addEventListener('click', goalsHandlers.handleSaveWellness);
    document.getElementById('cancelWellnessBtn').addEventListener('click', goalsHandlers.handleCancelWellnessEdit);

    // Drag & drop repas
    document.querySelectorAll('.meal-column').forEach(col => {
        col.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', (e) => { if (e.target === col || !col.contains(e.relatedTarget)) col.classList.remove('drag-over'); });
        col.addEventListener('drop', (e) => dailyHandlers.handleDrop(e, loadCurrentDay));
    });
    document.body.addEventListener('dragend', dailyHandlers.handleDragEnd);

    // Formulaires aliments
    document.getElementById('addFoodForm').addEventListener('submit', foodHandlers.handleAddFood);
    document.getElementById('editFoodForm').addEventListener('submit', foodHandlers.handleUpdateFood);

    // Activités physiques
    document.getElementById('addActivityBtn').addEventListener('click', () => activityHandlers.handleAddActivity(loadCurrentDay));
    document.getElementById('addCustomActivityBtn').addEventListener('click', () => ui.showModal('customActivityModal'));
    document.getElementById('customActivityForm').addEventListener('submit', activityHandlers.handleAddCustomActivity);
    document.getElementById('editActivityForm').addEventListener('submit', (e) => activityHandlers.handleSaveEditActivity(e, loadCurrentDay));
    activityHandlers.initStrengthActivityControls();
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
            foodAnalysis.updateFoodAnalysis(state.currentFoodAnalysisPeriod, state.foods, state.meals);
            statsHandlers.saveStatsState();
        });
    });
    document.querySelectorAll('.food-analysis-table th.sortable').forEach(th => th.addEventListener('click', () => foodAnalysis.handleTableSort(th.dataset.sort)));
    document.getElementById('copyFoodAnalysisBtn').addEventListener('click', foodAnalysis.copyFoodAnalysisToClipboard);
    document.getElementById('exportFoodAnalysisCSVBtn').addEventListener('click', foodAnalysis.exportFoodAnalysisToCSV);
    document.querySelectorAll('.column-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => foodAnalysis.toggleColumn(e.target.dataset.column, e.target.checked));
    });

    // Import / export / reset
    document.getElementById('export-btn').addEventListener('click', handleExport);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', handleImport);
    document.getElementById('reset-btn').addEventListener('click', handleReset);
    document.getElementById('saveStatsFilterSettingsBtn').addEventListener('click', saveStatsFilterSettingsFromUI);
    document.getElementById('cancelEditBtn').addEventListener('click', ui.closeEditModal);
    document.getElementById('closeEditFoodModal').addEventListener('click', ui.closeEditModal);
    document.getElementById('editFoodModal').addEventListener('click', e => { if (e.target === e.currentTarget) ui.closeEditModal(); });

    // Ajustement des portions
    document.getElementById('closeAdjustPortionsModal').addEventListener('click', foodHandlers.closeAdjustPortionsModal);
    document.getElementById('cancelAdjustPortionsBtn').addEventListener('click', foodHandlers.closeAdjustPortionsModal);
    document.getElementById('confirmAdjustPortionsBtn').addEventListener('click', foodHandlers.saveAdjustedPortions);
    document.getElementById('adjustPortionsModal').addEventListener('click', e => { if (e.target === e.currentTarget) foodHandlers.closeAdjustPortionsModal(); });
    document.getElementById('customPriceCheckbox').addEventListener('change', e => {
        const customPriceInput = document.getElementById('customPriceInput');
        customPriceInput.disabled = !e.target.checked;
        if (e.target.checked) customPriceInput.focus();
        else customPriceInput.value = '';
        foodHandlers.updateAdjustmentPreview();
    });
    document.getElementById('customPriceInput').addEventListener('input', foodHandlers.updateAdjustmentPreview);

    // Export JSON stats pour analyse IA
    document.getElementById('exportStatsJsonBtn').addEventListener('click', () => charts.exportStatsData(state.foods, state.meals));

    // IA – GLM : génération repas
    document.getElementById('aiGenerateMealsBtn').addEventListener('click', aiHandlers.openAIModal);
    document.getElementById('closeAiMealModal').addEventListener('click', () => ui.hideModal('aiMealModal'));
    document.getElementById('cancelAiMealBtn').addEventListener('click', () => ui.hideModal('aiMealModal'));
    document.getElementById('aiMealModal').addEventListener('click', e => { if (e.target === e.currentTarget) ui.hideModal('aiMealModal'); });
    document.getElementById('aiGenerateBtn').addEventListener('click', aiHandlers.handleGenerateMeals);
    document.getElementById('aiRefreshPromptBtn').addEventListener('click', aiHandlers.refreshPromptPreview);
    document.getElementById('aiCopyPromptBtn').addEventListener('click', aiHandlers.handleCopyPrompt);
    document.getElementById('aiManualToggle').addEventListener('click', aiHandlers.handleToggleManualSection);
    document.getElementById('aiProcessManualBtn').addEventListener('click', aiHandlers.handleProcessManualResponse);
    // Rafraîchir le prompt quand on change les options
    document.getElementById('ai-source-type').addEventListener('change', aiHandlers.refreshPromptPreview);
    ['petit-dej', 'dejeuner', 'diner', 'snack'].forEach(mt => {
        const cb = document.getElementById(`ai-meal-${mt}`);
        if (cb) cb.addEventListener('change', aiHandlers.refreshPromptPreview);
    });
    // IA – Paramètres
    document.getElementById('saveGlmApiKeyBtn').addEventListener('click', aiHandlers.handleSaveApiKey);
    document.getElementById('clearGlmApiKeyBtn').addEventListener('click', aiHandlers.handleClearApiKey);
    document.getElementById('saveBraveSearchApiKeyBtn').addEventListener('click', aiHandlers.handleSaveSearchApiKey);
    document.getElementById('clearBraveSearchApiKeyBtn').addEventListener('click', aiHandlers.handleClearSearchApiKey);
    document.getElementById('saveFoodSearchPreferenceBtn').addEventListener('click', aiHandlers.handleSaveFoodSearchPreference);
}

// --- INITIALISATION ---
async function initializeDefaultFoods() {
    const existingFoods = await db.loadFoods();
    if (Object.keys(existingFoods).length === 0) {
        for (const [id, food] of Object.entries(defaultFoods)) { await db.saveFood(id, food); }
        ui.showNotification('Base de données initialisée !');
    }
}

async function init(isReload = false) {
    try {
        if (!isReload) { await db.initDB(); setupEventListeners(); }
        await db.migrateLegacyDayEvents();
        await db.migrateLegacyMealItemIds();
        await db.migrateLegacyGoals();
        await initializeDefaultFoods();
        state.foods = await db.loadFoods();
        state.meals = await db.loadMeals();
        state.goals = await db.loadGoals();
        if (!isReload) statsHandlers.restoreStatsState();

        // Injecter les dépendances dans les handlers
        foodHandlers.initFoodHandlers({
            loadCurrentDay,
            handleDragStart: dailyHandlers.handleDragStart,
            handleQuickAdd: (foodId, mealType) => dailyHandlers.handleQuickAdd(foodId, mealType, loadCurrentDay),
            editFoodClick: foodHandlers.handleEditFoodClick,
            deleteFoodClick: foodHandlers.handleDeleteFoodClick
        });
        goalsHandlers.initGoalsHandlers({ loadCurrentDay });
        aiHandlers.initAIHandlers({ loadCurrentDay });

        // Exposer le state et fonctions globalement
        window.appState = state;
        window.refreshAvailableFoods = foodHandlers.refreshAvailableFoods;
        window.handleAdjustPortions = foodHandlers.handleAdjustPortions;
        window.handleDuplicateMealItem = (mt, item) => dailyHandlers.handleDuplicateMealItem(mt, item, loadCurrentDay);
        window.handleMealItemDragStart = dailyHandlers.handleMealItemDragStart;
        window.handleMealItemDragEnd = dailyHandlers.handleMealItemDragEnd;

        try {
            state.customActivities = await db.loadCustomActivities();
            activityHandlers.updateActivitySelects();
        } catch (error) { console.log('Erreur chargement activités personnalisées:', error); state.customActivities = []; state.allActivities = [...defaultActivities]; }

        if (state.goals) ui.displayGoals(state.goals);
        initStatsFilterSettingsUI();
        await loadCurrentDay();
        ui.displayFoods(state.foods, dailyHandlers.handleDragStart,
            (foodId, mealType) => dailyHandlers.handleQuickAdd(foodId, mealType, loadCurrentDay),
            state.displayedFoodsCount, state.meals, state.selectedCategory);
        ui.displayFoodsManage(state.foods, foodHandlers.handleEditFoodClick, foodHandlers.handleDeleteFoodClick, state.selectedCategoryManage);
        foodHandlers.updateCategoryCounts();

        if (!isReload) statsHandlers.initStatsNavObserver();

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
