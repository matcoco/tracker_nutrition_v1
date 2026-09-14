// js/charts-averages.js
// Contient updateAverageCharts() — extrait de charts.js pour alléger celui-ci.

import { loadAverages } from '../core/db.js';
import { getResponsiveOptions, isDayAllowedByStatsFilter } from './charts.js';

// Instance locale des graphiques de moyennes (partagé avec charts.js via même objet Chart.js)
const avgCharts = {};

/**
 * Met à jour les graphiques de moyennes.
 * @param {string} periodType - Type de période ('week' ou 'month')
 * @param {object} foods - Le dictionnaire de tous les aliments.
 * @param {object|null} goals - Les objectifs nutritionnels (optionnel).
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel).
 */
export async function updateAverageCharts(periodType, foods, goals = null, composedMeals = {}) {
    const numPeriods = periodType === 'week' ? 12 : 6; // 12 semaines ou 6 mois
    const data = await loadAverages(periodType, numPeriods, foods, composedMeals, isDayAllowedByStatsFilter);
    const labels = data.map(d => d.label);

    // --- Graphique Moyenne Calories ---
    if (avgCharts.avgCalories) avgCharts.avgCalories.destroy();
    const avgCaloriesDatasets = [{
        label: 'Moyenne Calories (kcal)',
        data: data.map(d => d.avgCalories.toFixed(0)),
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'var(--color-primary-start)',
        borderWidth: 2,
        order: 2
    }];
    if (goals && goals.calories) {
        avgCaloriesDatasets.push({ label: 'Objectif', type: 'line', data: Array(labels.length).fill(goals.calories), borderColor: '#ef4444', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
    }
    avgCharts.avgCalories = new Chart(document.getElementById('avgCaloriesChart'), {
        type: 'bar', data: { labels, datasets: avgCaloriesDatasets }, options: getResponsiveOptions(goals && goals.calories)
    });

    // --- Graphique Moyenne Protéines ---
    if (avgCharts.avgProteins) avgCharts.avgProteins.destroy();
    const avgProteinsDatasets = [{ label: 'Moyenne Protéines (g)', data: data.map(d => d.avgProteins.toFixed(1)), backgroundColor: '#10b981', order: 2 }];
    if (goals && goals.proteins) {
        avgProteinsDatasets.push({ label: 'Objectif', type: 'line', data: Array(labels.length).fill(goals.proteins), borderColor: '#ef4444', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
    }
    avgCharts.avgProteins = new Chart(document.getElementById('avgProteinsChart'), {
        type: 'bar', data: { labels, datasets: avgProteinsDatasets }, options: getResponsiveOptions(goals && goals.proteins)
    });

    // --- Graphique Moyenne Glucides ---
    if (avgCharts.avgCarbs) avgCharts.avgCarbs.destroy();
    const avgCarbsDatasets = [{ label: 'Moyenne Glucides (g)', data: data.map(d => d.avgCarbs.toFixed(1)), backgroundColor: '#f59e0b', order: 2 }];
    if (goals && goals.carbs) {
        avgCarbsDatasets.push({ label: 'Objectif', type: 'line', data: Array(labels.length).fill(goals.carbs), borderColor: '#ef4444', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
    }
    avgCharts.avgCarbs = new Chart(document.getElementById('avgCarbsChart'), {
        type: 'bar', data: { labels, datasets: avgCarbsDatasets }, options: getResponsiveOptions(goals && goals.carbs)
    });

    // --- Graphique Moyenne Lipides ---
    if (avgCharts.avgFats) avgCharts.avgFats.destroy();
    const avgFatsDatasets = [{ label: 'Moyenne Lipides (g)', data: data.map(d => d.avgFats.toFixed(1)), backgroundColor: '#ef4444', order: 2 }];
    if (goals && goals.fats) {
        avgFatsDatasets.push({ label: 'Objectif', type: 'line', data: Array(labels.length).fill(goals.fats), borderColor: '#ef4444', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
    }
    avgCharts.avgFats = new Chart(document.getElementById('avgFatsChart'), {
        type: 'bar', data: { labels, datasets: avgFatsDatasets }, options: getResponsiveOptions(goals && goals.fats)
    });

    // --- Graphique Moyenne Fibres ---
    if (avgCharts.avgFibers) avgCharts.avgFibers.destroy();
    avgCharts.avgFibers = new Chart(document.getElementById('avgFibersChart'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Moyenne Fibres (g)', data: data.map(d => d.avgFibers.toFixed(1)), backgroundColor: '#84cc16', order: 2 }] },
        options: getResponsiveOptions(false)
    });

    // --- Graphique Moyenne Poids ---
    if (avgCharts.avgWeight) avgCharts.avgWeight.destroy();
    avgCharts.avgWeight = new Chart(document.getElementById('avgWeightChart'), {
        type: 'line',
        data: { labels, datasets: [{ label: 'Poids Moyen (kg)', data: data.map(d => d.avgWeight), borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.1)', tension: 0.4, fill: true, spanGaps: true }] },
        options: { ...getResponsiveOptions(false), scales: { ...getResponsiveOptions(false).scales, y: { ...getResponsiveOptions(false).scales.y, beginAtZero: false } } }
    });

    // --- Graphique Moyenne Tour de Ventre ---
    if (avgCharts.avgBelly) avgCharts.avgBelly.destroy();
    avgCharts.avgBelly = new Chart(document.getElementById('avgBellyChart'), {
        type: 'line',
        data: { labels, datasets: [{ label: 'Tour de ventre Moyen (cm)', data: data.map(d => d.avgBelly), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', tension: 0.4, fill: true, spanGaps: true }] },
        options: { ...getResponsiveOptions(false), scales: { ...getResponsiveOptions(false).scales, y: { ...getResponsiveOptions(false).scales.y, beginAtZero: false } } }
    });

    // --- Graphique Moyenne Hydratation ---
    if (avgCharts.avgWater) avgCharts.avgWater.destroy();
    const avgWaterDatasets = [{ label: 'Hydratation Moyenne (ml)', data: data.map(d => d.avgWater.toFixed(0)), backgroundColor: '#06b6d4', order: 2 }];
    if (goals && goals.waterGoal) {
        avgWaterDatasets.push({ label: 'Objectif', type: 'line', data: Array(labels.length).fill(goals.waterGoal), borderColor: '#ef4444', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
    }
    avgCharts.avgWater = new Chart(document.getElementById('avgWaterChart'), {
        type: 'bar', data: { labels, datasets: avgWaterDatasets }, options: getResponsiveOptions(goals && goals.waterGoal)
    });

    // --- Graphique Moyenne Pas ---
    if (avgCharts.avgSteps) avgCharts.avgSteps.destroy();
    const avgStepsDatasets = [{ label: 'Pas Moyens', data: data.map(d => d.avgSteps.toFixed(0)), backgroundColor: '#f97316', order: 2 }];
    if (goals && goals.stepsGoal) {
        avgStepsDatasets.push({ label: 'Objectif', type: 'line', data: Array(labels.length).fill(goals.stepsGoal), borderColor: '#ef4444', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
    }
    avgCharts.avgSteps = new Chart(document.getElementById('avgStepsChart'), {
        type: 'bar', data: { labels, datasets: avgStepsDatasets }, options: getResponsiveOptions(goals && goals.stepsGoal)
    });
}
