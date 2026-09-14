// js/handlers/stats-handlers.js
// Gestion de la navigation et de l'état des statistiques.

import state from '../core/state.js';
import * as charts from '../stats/charts.js';
import * as chartsAverages from '../stats/charts-averages.js';
import * as mealHistory from '../features/meal-history.js';

const STATS_STATE_KEY = 'nt_stats_state';

export function getCurrentStatsPeriodFilter() {
    return state.currentCustomStatsRange || state.currentPeriod;
}

export function saveStatsState() {
    const toSave = {
        currentPeriod:           state.currentPeriod,
        currentCustomStatsRange: state.currentCustomStatsRange,
        currentAveragePeriod:    state.currentAveragePeriod,
        currentCostPeriod:       state.currentCostPeriod,
        currentActivityPeriod:   state.currentActivityPeriod,
        currentFoodAnalysisPeriod: state.currentFoodAnalysisPeriod,
        activeStatsSection:      document.querySelector('.stats-nav-btn.active')?.dataset.section || 'evolution',
    };
    try { localStorage.setItem(STATS_STATE_KEY, JSON.stringify(toSave)); } catch(e) {}
}

export function restoreStatsState() {
    try {
        const raw = localStorage.getItem(STATS_STATE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);

        if (saved.currentPeriod !== undefined)         state.currentPeriod           = saved.currentPeriod;
        if (saved.currentCustomStatsRange)             state.currentCustomStatsRange = saved.currentCustomStatsRange;
        if (saved.currentAveragePeriod)                state.currentAveragePeriod    = saved.currentAveragePeriod;
        if (saved.currentCostPeriod !== undefined)     state.currentCostPeriod       = saved.currentCostPeriod;
        if (saved.currentActivityPeriod !== undefined) state.currentActivityPeriod   = saved.currentActivityPeriod;
        if (saved.currentFoodAnalysisPeriod !== undefined) state.currentFoodAnalysisPeriod = saved.currentFoodAnalysisPeriod;

        // Restaurer le bouton période principal actif
        document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
        if (state.currentCustomStatsRange) {
            const s = document.getElementById('statsStartDate');
            const e = document.getElementById('statsEndDate');
            if (s) s.value = state.currentCustomStatsRange.startDate;
            if (e) e.value = state.currentCustomStatsRange.endDate;
        } else {
            const periodVal = String(state.currentPeriod);
            const btn = document.querySelector(`.period-btn[data-period="${periodVal}"]`);
            if (btn) btn.classList.add('active');
        }

        // Restaurer le bouton de période des moyennes
        document.querySelectorAll('.average-period-btn').forEach(btn => btn.classList.remove('active'));
        const avgBtn = document.querySelector(`.average-period-btn[data-avg-period="${state.currentAveragePeriod}"]`);
        if (avgBtn) avgBtn.classList.add('active');

        // Restaurer le bouton de période des coûts
        document.querySelectorAll('.cost-period-btn').forEach(btn => btn.classList.remove('active'));
        const costBtn = document.querySelector(`.cost-period-btn[data-cost-period="${state.currentCostPeriod}"]`);
        if (costBtn) costBtn.classList.add('active');

        // Restaurer le bouton de période des activités
        document.querySelectorAll('.activity-period-btn').forEach(btn => btn.classList.remove('active'));
        const actBtn = document.querySelector(`.activity-period-btn[data-activity-period="${state.currentActivityPeriod}"]`);
        if (actBtn) actBtn.classList.add('active');

        // Restaurer le bouton de période analyse aliments
        document.querySelectorAll('.food-analysis-period-btn').forEach(btn => btn.classList.remove('active'));
        const foodBtn = document.querySelector(`.food-analysis-period-btn[data-food-period="${state.currentFoodAnalysisPeriod}"]`);
        if (foodBtn) foodBtn.classList.add('active');

        // Restaurer la section active de la nav stats
        if (saved.activeStatsSection) {
            document.querySelectorAll('.stats-nav-btn').forEach(btn => btn.classList.remove('active'));
            const navBtn = document.querySelector(`.stats-nav-btn[data-section="${saved.activeStatsSection}"]`);
            if (navBtn) navBtn.classList.add('active');
            const targetSection = document.getElementById(`stats-${saved.activeStatsSection}`);
            if (targetSection) {
                setTimeout(() => targetSection.scrollIntoView({ behavior: 'instant', block: 'start' }), 100);
            }
        }
    } catch(e) {}
}

function clearCustomStatsRangeSelection() {
    state.currentCustomStatsRange = null;
}

export function applyCustomStatsDateRange() {
    const startInput = document.getElementById('statsStartDate');
    const endInput = document.getElementById('statsEndDate');
    const startDate = startInput.value;
    const endDate = endInput.value;

    if (!startDate || !endDate) return;
    if (new Date(startDate) > new Date(endDate)) return;

    clearCustomStatsRangeSelection();
    state.currentCustomStatsRange = { startDate, endDate };
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    charts.updateCharts(getCurrentStatsPeriodFilter(), state.foods, state.goals, state.meals);
    mealHistory.updateMealHistory(getCurrentStatsPeriodFilter(), state.foods, state.meals);
    saveStatsState();
}

export function handleStatsNavigation(event) {
    const button = event.currentTarget;
    const section = button.dataset.section;

    document.querySelectorAll('.stats-nav-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const sectionId = `stats-${section}`;
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function initStatsNavObserver() {
    const sections = document.querySelectorAll('.stats-section');
    const observerOptions = { root: null, rootMargin: '-100px 0px -60% 0px', threshold: 0 };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.id;
                const section = sectionId.replace('stats-', '');
                document.querySelectorAll('.stats-nav-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.section === section) btn.classList.add('active');
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
}
