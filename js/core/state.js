// js/core/state.js
// État global partagé de l'application.
// Tous les handlers importent ce module pour accéder à l'état sans dépendance circulaire.

import { defaultActivities } from '../config.js';

const state = {
    foods: {},
    meals: {}, // Repas composés
    currentDate: new Date(),
    currentPeriod: 7,
    currentCustomStatsRange: null,
    currentAveragePeriod: 'week', // 'week' ou 'month'
    currentCostPeriod: 7,
    currentActivityPeriod: 7,
    currentFoodAnalysisPeriod: 7,
    draggedFoodId: null,
    draggedMealItem: null,
    draggedElement: null,
    goals: null,
    displayedFoodsCount: 10,
    maxFoodsPerLoad: 10,
    activities: [],
    customActivities: [],
    allActivities: [],
    selectedCategory: 'all',
    selectedCategoryManage: 'all',
};

export default state;
