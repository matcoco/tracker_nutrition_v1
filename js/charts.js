// js/charts.js

import { loadPeriodMeals, loadAverages, getAllFromStore } from './db.js';
import { calculateDayTotals, formatDateKey } from './utils.js';

// Un objet pour conserver les instances des graphiques afin de pouvoir les détruire avant de les redessiner.
let charts = {};

/**
 * Détermine si les données doivent être regroupées et comment
 * @param {number|string} period - La période sélectionnée
 * @returns {string} 'daily', 'weekly' ou 'monthly'
 */
function getGroupingMode(period) {
    if (period === 'all') return 'monthly';
    const numPeriod = parseInt(period);
    if (numPeriod <= 30) return 'daily';
    if (numPeriod <= 180) return 'weekly';
    return 'monthly';
}

/**
 * Regroupe les données par semaine (moyennes)
 * @param {Array} data - Données quotidiennes
 * @returns {Array} Données regroupées par semaine
 */
function groupByWeek(data) {
    const weeks = {};
    
    data.forEach(day => {
        const date = new Date(day.date);
        // Obtenir le lundi de la semaine
        const monday = new Date(date);
        const dayOfWeek = date.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        monday.setDate(date.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        
        const weekKey = formatDateKey(monday);
        
        if (!weeks[weekKey]) {
            weeks[weekKey] = {
                date: weekKey,
                days: [],
                calories: 0,
                proteins: 0,
                carbs: 0,
                fats: 0,
                sugars: 0,
                fibers: 0,
                weights: [],
                water: 0,
                steps: 0
            };
        }
        
        weeks[weekKey].days.push(day);
        weeks[weekKey].calories += day.calories;
        weeks[weekKey].proteins += day.proteins;
        weeks[weekKey].carbs += day.carbs;
        weeks[weekKey].fats += day.fats;
        weeks[weekKey].sugars += day.sugars;
        weeks[weekKey].fibers += day.fibers;
        if (day.weight) weeks[weekKey].weights.push(day.weight);
        weeks[weekKey].water += day.water || 0;
        weeks[weekKey].steps += day.steps || 0;
    });
    
    // Calculer les moyennes
    return Object.values(weeks).map(week => {
        const count = week.days.length;
        return {
            date: week.date,
            calories: week.calories / count,
            proteins: week.proteins / count,
            carbs: week.carbs / count,
            fats: week.fats / count,
            sugars: week.sugars / count,
            fibers: week.fibers / count,
            weight: week.weights.length > 0 ? week.weights.reduce((a, b) => a + b, 0) / week.weights.length : null,
            water: week.water / count,
            steps: week.steps / count
        };
    });
}

/**
 * Regroupe les données par mois (moyennes)
 * @param {Array} data - Données quotidiennes
 * @returns {Array} Données regroupées par mois
 */
function groupByMonth(data) {
    const months = {};
    
    data.forEach(day => {
        const date = new Date(day.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        
        if (!months[monthKey]) {
            months[monthKey] = {
                date: monthKey,
                days: [],
                calories: 0,
                proteins: 0,
                carbs: 0,
                fats: 0,
                sugars: 0,
                fibers: 0,
                weights: [],
                water: 0,
                steps: 0
            };
        }
        
        months[monthKey].days.push(day);
        months[monthKey].calories += day.calories;
        months[monthKey].proteins += day.proteins;
        months[monthKey].carbs += day.carbs;
        months[monthKey].fats += day.fats;
        months[monthKey].sugars += day.sugars;
        months[monthKey].fibers += day.fibers;
        if (day.weight) months[monthKey].weights.push(day.weight);
        months[monthKey].water += day.water || 0;
        months[monthKey].steps += day.steps || 0;
    });
    
    // Calculer les moyennes
    return Object.values(months).map(month => {
        const count = month.days.length;
        return {
            date: month.date,
            calories: month.calories / count,
            proteins: month.proteins / count,
            carbs: month.carbs / count,
            fats: month.fats / count,
            sugars: month.sugars / count,
            fibers: month.fibers / count,
            weight: month.weights.length > 0 ? month.weights.reduce((a, b) => a + b, 0) / month.weights.length : null,
            water: month.water / count,
            steps: month.steps / count
        };
    });
}

/**
 * Formatte les labels en fonction du mode de regroupement
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @param {string} mode - 'daily', 'weekly' ou 'monthly'
 * @returns {string} Label formaté
 */
function formatLabel(dateStr, mode) {
    const date = new Date(dateStr);
    
    if (mode === 'daily') {
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    } else if (mode === 'weekly') {
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 6);
        return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
    } else { // monthly
        return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    }
}

// Configuration responsive commune pour les graphiques
const getResponsiveOptions = (hasGoals = false, isDonut = false) => {
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    
    if (isDonut) {
        return {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: isMobile ? 'bottom' : 'right',
                    labels: {
                        font: {
                            size: isMobile ? 10 : 12
                        },
                        padding: isMobile ? 8 : 10,
                        boxWidth: isMobile ? 12 : 15
                    }
                },
                tooltip: {
                    bodyFont: {
                        size: isMobile ? 11 : 13
                    },
                    padding: isMobile ? 8 : 12
                }
            }
        };
    }
    
    return {
        responsive: true,
        maintainAspectRatio: isMobile ? false : true,
        aspectRatio: isMobile ? 1.2 : 2,
        plugins: {
            legend: {
                display: hasGoals,
                position: 'top',
                labels: {
                    font: {
                        size: isMobile ? 10 : 12
                    },
                    padding: isMobile ? 5 : 10,
                    boxWidth: isMobile ? 12 : 15,
                    usePointStyle: true
                }
            },
            tooltip: {
                enabled: true,
                bodyFont: {
                    size: isMobile ? 11 : 13
                },
                padding: isMobile ? 8 : 12,
                displayColors: true,
                boxWidth: isMobile ? 8 : 10
            }
        },
        scales: {
            x: {
                ticks: {
                    font: {
                        size: isMobile ? 9 : 11
                    },
                    maxRotation: isMobile ? 45 : 0,
                    minRotation: isMobile ? 45 : 0,
                    autoSkip: true,
                    maxTicksLimit: isMobile ? 7 : 15
                },
                grid: {
                    display: !isMobile
                }
            },
            y: {
                ticks: {
                    font: {
                        size: isMobile ? 9 : 11
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            }
        },
        interaction: {
            mode: 'index',
            intersect: false
        }
    };
};

/**
 * Met à jour tous les graphiques de la page des statistiques.
 * @param {number|string} period - Le nombre de jours pour la période ou 'all'.
 * @param {object} foods - Le dictionnaire de tous les aliments.
 * @param {object|null} goals - Les objectifs nutritionnels (optionnel).
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel).
 */
export async function updateCharts(period, foods, goals = null, composedMeals = {}) {
    // Charger les données
    let rawData;
    if (period === 'all') {
        // Charger toutes les données disponibles
        const allMeals = await getAllFromStore('dailyMeals');
        const allWeights = await getAllFromStore('dailyWeights');
        const allWater = await getAllFromStore('dailyWater');
        const allSteps = await getAllFromStore('dailySteps');
        
        // Créer un objet pour regrouper par date
        const dataByDate = {};
        
        allMeals.forEach(meal => {
            if (!dataByDate[meal.date]) {
                dataByDate[meal.date] = { date: meal.date, meals: meal.meals };
            }
        });
        
        allWeights.forEach(w => {
            if (dataByDate[w.date]) dataByDate[w.date].weight = w.weight;
        });
        
        allWater.forEach(w => {
            if (dataByDate[w.date]) dataByDate[w.date].water = w.totalMl;
        });
        
        allSteps.forEach(s => {
            if (dataByDate[s.date]) dataByDate[s.date].steps = s.steps;
        });
        
        // Convertir en tableau et calculer les totaux
        rawData = Object.values(dataByDate)
            .map(day => {
                const dayTotals = calculateDayTotals(day.meals || { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] }, foods, composedMeals);
                return {
                    date: day.date,
                    weight: day.weight || null,
                    water: day.water || 0,
                    steps: day.steps || 0,
                    ...dayTotals
                };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    } else {
        rawData = await loadPeriodMeals(period, foods, composedMeals);
    }
    
    // Déterminer le mode de regroupement
    const groupingMode = getGroupingMode(period);
    
    // Appliquer le regroupement si nécessaire
    let data;
    if (groupingMode === 'weekly') {
        data = groupByWeek(rawData);
    } else if (groupingMode === 'monthly') {
        data = groupByMonth(rawData);
    } else {
        data = rawData;
    }
    
    // Créer les labels en fonction du mode
    const labels = data.map(d => formatLabel(d.date, groupingMode));

    // --- Graphique des Calories (Ligne) ---
    if (charts.calories) charts.calories.destroy();
    const caloriesDatasets = [{
        label: 'Calories (kcal)',
        data: data.map(d => d.calories.toFixed(0)),
        borderColor: 'var(--color-primary-start)',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true
    }];
    if (goals && goals.calories) {
        caloriesDatasets.push({
            label: 'Objectif',
            data: Array(labels.length).fill(goals.calories),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        });
    }
    charts.calories = new Chart(document.getElementById('caloriesChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: caloriesDatasets
        },
        options: getResponsiveOptions(goals && goals.calories)
    });

    // --- Graphique des Macronutriments (Donut) ---
    const totalProteins = data.reduce((sum, d) => sum + d.proteins, 0);
    const totalCarbs = data.reduce((sum, d) => sum + d.carbs, 0);
    const totalFats = data.reduce((sum, d) => sum + d.fats, 0);
    const totalSugars = data.reduce((sum, d) => sum + d.sugars, 0); // Ajout du calcul pour les sucres
    const totalFibers = data.reduce((sum, d) => sum + d.fibers, 0); // Ajout du calcul pour les fibres

    if (charts.macros) charts.macros.destroy();
    charts.macros = new Chart(document.getElementById('macrosChart'), {
        type: 'doughnut',
        data: {
            // Ajout du libellé 'Fibres'
            labels: ['Protéines', 'Glucides', 'Lipides', 'Sucres', 'Fibres'],
            datasets: [{
                // Ajout des données et de la couleur correspondante
                data: [totalProteins, totalCarbs, totalFats, totalSugars, totalFibers],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#84cc16']
            }]
        },
        options: getResponsiveOptions(false, true)
    });
    // --- Graphique des Protéines (Barres) ---
    if (charts.proteins) charts.proteins.destroy();
    const proteinsDatasets = [{ label: 'Protéines (g)', data: data.map(d => d.proteins.toFixed(1)), backgroundColor: '#10b981', order: 2 }];
    if (goals && goals.proteins) {
        proteinsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.proteins),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    charts.proteins = new Chart(document.getElementById('proteinsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: proteinsDatasets
        },
        options: getResponsiveOptions(goals && goals.proteins)
    });

    // --- Graphique des Glucides (Barres) ---
    if (charts.carbs) charts.carbs.destroy();
    const carbsDatasets = [{ label: 'Glucides (g)', data: data.map(d => d.carbs.toFixed(1)), backgroundColor: '#f59e0b', order: 2 }];
    if (goals && goals.carbs) {
        carbsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.carbs),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    charts.carbs = new Chart(document.getElementById('carbsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: carbsDatasets
        },
        options: getResponsiveOptions(goals && goals.carbs)
    });

    // --- Graphique des Lipides (Barres) ---
    if (charts.lipids) charts.lipids.destroy();
    const lipidsDatasets = [{ label: 'Lipides (g)', data: data.map(d => d.fats.toFixed(1)), backgroundColor: '#ef4444', order: 2 }];
    if (goals && goals.fats) {
        lipidsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.fats),
            borderColor: '#8b5cf6',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    charts.lipids = new Chart(document.getElementById('lipidsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: lipidsDatasets
        },
        options: getResponsiveOptions(goals && goals.fats)
    });

    // --- NOUVEAU : Graphique des Sucres (Barres) ---
    if (charts.sugars) charts.sugars.destroy();
    const sugarsDatasets = [{
        label: 'Sucres (g)',
        data: data.map(d => d.sugars.toFixed(1)),
        backgroundColor: '#8b5cf6',
        order: 4
    }];
    
    // Seuil 1 : Min à privilégier (25g) - VERT FONCÉ
    sugarsDatasets.push({
        label: 'Seuil Idéal (25g)',
        type: 'line',
        data: Array(labels.length).fill(25),
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        order: 3
    });
    
    // Seuil 2 : Recommandé (50g) - ORANGE
    sugarsDatasets.push({
        label: 'Seuil Recommandé (50g)',
        type: 'line',
        data: Array(labels.length).fill(50),
        borderColor: '#f59e0b',
        borderDash: [8, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        order: 2
    });
    
    // Seuil 3 : Maximum absolu (100g) - ROUGE
    sugarsDatasets.push({
        label: 'Seuil Max (100g)',
        type: 'line',
        data: Array(labels.length).fill(100),
        borderColor: '#ef4444',
        borderDash: [10, 5],
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        order: 1
    });
    
    charts.sugars = new Chart(document.getElementById('sugarsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: sugarsDatasets
        },
        options: getResponsiveOptions(true)
    });

    // --- NOUVEAU : Graphique des Fibres (Barres) ---
    if (charts.fibers) charts.fibers.destroy();
    const fibersDatasets = [{
        label: 'Fibres (g)',
        data: data.map(d => d.fibers.toFixed(1)),
        backgroundColor: '#84cc16',
        order: 2
    }];
    if (goals && goals.fibersMin) {
        fibersDatasets.push({
            label: 'Seuil Min',
            type: 'line',
            data: Array(labels.length).fill(goals.fibersMin),
            borderColor: '#10b981',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    charts.fibers = new Chart(document.getElementById('fibersChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: fibersDatasets
        },
        options: getResponsiveOptions(goals && goals.fibersMin)
    });

    // --- NOUVEAU : Graphique du Poids (Ligne) ---
    // Filtrer les données qui ont un poids renseigné
    const weightData = data.map(d => d.weight || null);
    const weightLabels = labels;
    
    if (charts.weight) charts.weight.destroy();
    const weightOptions = getResponsiveOptions(false);
    weightOptions.plugins.tooltip.callbacks = {
        label: function(context) {
            if (context.parsed.y !== null) {
                return 'Poids: ' + context.parsed.y.toFixed(1) + ' kg';
            }
            return 'Non renseigné';
        }
    };
    weightOptions.scales.y.beginAtZero = false;
    
    charts.weight = new Chart(document.getElementById('weightChart'), {
        type: 'line',
        data: {
            labels: weightLabels,
            datasets: [{
                label: 'Poids (kg)',
                data: weightData,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.4,
                fill: true,
                spanGaps: true // Pour connecter les points même s'il y a des valeurs nulles
            }]
        },
        options: weightOptions
    });

    // --- NOUVEAU : Graphique de l'Hydratation (Barres) ---
    const waterData = await import('./db.js').then(module => module.loadPeriodWater(period));
    const waterLabels = waterData.map(d => new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    
    const waterDatasets = [{
        label: 'Hydratation (ml)',
        data: waterData.map(d => d.totalMl),
        backgroundColor: '#06b6d4',
        order: 2
    }];
    
    if (goals && goals.waterGoal) {
        waterDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(waterLabels.length).fill(goals.waterGoal),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    if (charts.water) charts.water.destroy();
    charts.water = new Chart(document.getElementById('waterChart'), {
        type: 'bar',
        data: {
            labels: waterLabels,
            datasets: waterDatasets
        },
        options: getResponsiveOptions(goals && goals.waterGoal)
    });

    // --- NOUVEAU : Graphique des Pas (Barres) ---
    const stepsData = await import('./db.js').then(module => module.loadPeriodSteps(period));
    const stepsLabels = stepsData.map(d => new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    
    const stepsDatasets = [{
        label: 'Nombre de pas',
        data: stepsData.map(d => d.steps),
        backgroundColor: '#f97316',
        order: 2
    }];
    
    if (goals && goals.stepsGoal) {
        stepsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(stepsLabels.length).fill(goals.stepsGoal),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    if (charts.steps) charts.steps.destroy();
    charts.steps = new Chart(document.getElementById('stepsChart'), {
        type: 'bar',
        data: {
            labels: stepsLabels,
            datasets: stepsDatasets
        },
        options: getResponsiveOptions(goals && goals.stepsGoal)
    });
}

// Écouter les changements de taille de fenêtre pour redessiner les graphiques
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Redessiner tous les graphiques existants
        Object.keys(charts).forEach(key => {
            if (charts[key]) {
                charts[key].resize();
            }
        });
    }, 250);
});

/**
 * Met à jour les graphiques de moyennes.
 * @param {string} periodType - Type de période ('week' ou 'month')
 * @param {object} foods - Le dictionnaire de tous les aliments.
 * @param {object|null} goals - Les objectifs nutritionnels (optionnel).
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel).
 */
export async function updateAverageCharts(periodType, foods, goals = null, composedMeals = {}) {
    const numPeriods = periodType === 'week' ? 12 : 6; // 12 semaines ou 6 mois
    const data = await loadAverages(periodType, numPeriods, foods, composedMeals);
    const labels = data.map(d => d.label);
    
    // --- Graphique Moyenne Calories ---
    if (charts.avgCalories) charts.avgCalories.destroy();
    const avgCaloriesDatasets = [{
        label: 'Moyenne Calories (kcal)',
        data: data.map(d => d.avgCalories.toFixed(0)),
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'var(--color-primary-start)',
        borderWidth: 2,
        order: 2
    }];
    
    if (goals && goals.calories) {
        avgCaloriesDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.calories),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    charts.avgCalories = new Chart(document.getElementById('avgCaloriesChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: avgCaloriesDatasets
        },
        options: getResponsiveOptions(goals && goals.calories)
    });
    
    // --- Graphique Moyenne Protéines ---
    if (charts.avgProteins) charts.avgProteins.destroy();
    const avgProteinsDatasets = [{
        label: 'Moyenne Protéines (g)',
        data: data.map(d => d.avgProteins.toFixed(1)),
        backgroundColor: '#10b981',
        order: 2
    }];
    
    if (goals && goals.proteins) {
        avgProteinsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.proteins),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    charts.avgProteins = new Chart(document.getElementById('avgProteinsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: avgProteinsDatasets
        },
        options: getResponsiveOptions(goals && goals.proteins)
    });
    
    // --- Graphique Moyenne Glucides ---
    if (charts.avgCarbs) charts.avgCarbs.destroy();
    const avgCarbsDatasets = [{
        label: 'Moyenne Glucides (g)',
        data: data.map(d => d.avgCarbs.toFixed(1)),
        backgroundColor: '#f59e0b',
        order: 2
    }];
    
    if (goals && goals.carbs) {
        avgCarbsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.carbs),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    charts.avgCarbs = new Chart(document.getElementById('avgCarbsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: avgCarbsDatasets
        },
        options: getResponsiveOptions(goals && goals.carbs)
    });
    
    // --- Graphique Moyenne Lipides ---
    if (charts.avgFats) charts.avgFats.destroy();
    const avgFatsDatasets = [{
        label: 'Moyenne Lipides (g)',
        data: data.map(d => d.avgFats.toFixed(1)),
        backgroundColor: '#ef4444',
        order: 2
    }];
    
    if (goals && goals.fats) {
        avgFatsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.fats),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    charts.avgFats = new Chart(document.getElementById('avgFatsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: avgFatsDatasets
        },
        options: getResponsiveOptions(goals && goals.fats)
    });
    
    // --- Graphique Moyenne Fibres ---
    if (charts.avgFibers) charts.avgFibers.destroy();
    const avgFibersDatasets = [{
        label: 'Moyenne Fibres (g)',
        data: data.map(d => d.avgFibers.toFixed(1)),
        backgroundColor: '#84cc16',
        order: 2
    }];
    
    charts.avgFibers = new Chart(document.getElementById('avgFibersChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: avgFibersDatasets
        },
        options: getResponsiveOptions(false)
    });
    
    // --- Graphique Moyenne Poids ---
    if (charts.avgWeight) charts.avgWeight.destroy();
    const weightData = data.map(d => d.avgWeight);
    
    charts.avgWeight = new Chart(document.getElementById('avgWeightChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Poids Moyen (kg)',
                data: weightData,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.4,
                fill: true,
                spanGaps: true
            }]
        },
        options: {
            ...getResponsiveOptions(false),
            scales: {
                ...getResponsiveOptions(false).scales,
                y: {
                    ...getResponsiveOptions(false).scales.y,
                    beginAtZero: false
                }
            }
        }
    });
    
    // --- Graphique Moyenne Hydratation ---
    if (charts.avgWater) charts.avgWater.destroy();
    const avgWaterDatasets = [{
        label: 'Hydratation Moyenne (ml)',
        data: data.map(d => d.avgWater.toFixed(0)),
        backgroundColor: '#06b6d4',
        order: 2
    }];
    
    if (goals && goals.waterGoal) {
        avgWaterDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.waterGoal),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    charts.avgWater = new Chart(document.getElementById('avgWaterChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: avgWaterDatasets
        },
        options: getResponsiveOptions(goals && goals.waterGoal)
    });
    
    // --- Graphique Moyenne Pas ---
    if (charts.avgSteps) charts.avgSteps.destroy();
    const avgStepsDatasets = [{
        label: 'Pas Moyens',
        data: data.map(d => d.avgSteps.toFixed(0)),
        backgroundColor: '#f97316',
        order: 2
    }];
    
    if (goals && goals.stepsGoal) {
        avgStepsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.stepsGoal),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    charts.avgSteps = new Chart(document.getElementById('avgStepsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: avgStepsDatasets
        },
        options: getResponsiveOptions(goals && goals.stepsGoal)
    });
}