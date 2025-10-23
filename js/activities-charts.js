// js/activities-charts.js - Graphiques pour les activités physiques

import * as db from './db.js';
import * as utils from './utils.js';

const activityCharts = {
    dailyCalories: null,
    totalTime: null,
    typeDistribution: null,
    topActivities: null,
    caloriesByType: null,
    weeklyComparison: null
};

/**
 * Met à jour tous les graphiques d'activités
 * @param {number} period - Nombre de jours
 */
export async function updateActivityCharts(period) {
    // Charger les données de la période
    const data = [];
    const today = new Date();
    
    for (let i = period - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = utils.formatDateKey(date);
        const activities = await db.loadDayActivities(date);
        
        let dailyCalories = 0;
        let dailyDuration = 0;
        const typeStats = {};
        
        activities.forEach(activity => {
            dailyCalories += activity.calories;
            dailyDuration += activity.duration;
            
            if (!typeStats[activity.type]) {
                typeStats[activity.type] = {
                    count: 0,
                    duration: 0,
                    calories: 0
                };
            }
            typeStats[activity.type].count++;
            typeStats[activity.type].duration += activity.duration;
            typeStats[activity.type].calories += activity.calories;
        });
        
        data.push({
            date: dateKey,
            calories: dailyCalories,
            duration: dailyDuration,
            typeStats: typeStats
        });
    }
    
    // Créer les graphiques
    createDailyCaloriesChart(data);
    createTotalTimeChart(data);
    createTypeDistributionChart(data);
    createTopActivitiesChart(data);
    createCaloriesByTypeChart(data);
    createWeeklyComparisonChart();
}

/**
 * Graphique 1 : Calories brûlées quotidiennes
 */
function createDailyCaloriesChart(data) {
    const labels = data.map(d => new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    const calories = data.map(d => d.calories);
    
    if (activityCharts.dailyCalories) activityCharts.dailyCalories.destroy();
    activityCharts.dailyCalories = new Chart(document.getElementById('activityCaloriesChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Calories brûlées (kcal)',
                data: calories,
                backgroundColor: '#ef4444',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.parsed.y} kcal`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `${value} kcal`
                    }
                }
            }
        }
    });
}

/**
 * Graphique 2 : Temps d'activité total par jour
 */
function createTotalTimeChart(data) {
    const labels = data.map(d => new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    const durations = data.map(d => d.duration);
    
    if (activityCharts.totalTime) activityCharts.totalTime.destroy();
    activityCharts.totalTime = new Chart(document.getElementById('activityTimeChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temps d\'activité (min)',
                data: durations,
                backgroundColor: '#8b5cf6',
                borderRadius: 5
            }, {
                label: 'Objectif recommandé',
                type: 'line',
                data: Array(labels.length).fill(30),
                borderColor: '#f59e0b',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.parsed.y} min`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `${value} min`
                    }
                }
            }
        }
    });
}

/**
 * Graphique 3 : Répartition par type d'activité (temps)
 */
function createTypeDistributionChart(data) {
    // Agréger toutes les données de type sur la période
    const allTypes = {};
    
    data.forEach(day => {
        Object.entries(day.typeStats).forEach(([type, stats]) => {
            if (!allTypes[type]) allTypes[type] = 0;
            allTypes[type] += stats.duration;
        });
    });
    
    const sortedTypes = Object.entries(allTypes).sort((a, b) => b[1] - a[1]);
    const labels = sortedTypes.map(([type]) => type);
    const durations = sortedTypes.map(([, duration]) => duration);
    
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    
    if (activityCharts.typeDistribution) activityCharts.typeDistribution.destroy();
    activityCharts.typeDistribution = new Chart(document.getElementById('activityTypeDistChart'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: durations,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = durations.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} min (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Graphique 4 : Top 5 activités les plus pratiquées
 */
function createTopActivitiesChart(data) {
    // Compter le nombre de sessions par type
    const activityCount = {};
    
    data.forEach(day => {
        Object.entries(day.typeStats).forEach(([type, stats]) => {
            if (!activityCount[type]) activityCount[type] = 0;
            activityCount[type] += stats.count;
        });
    });
    
    const sorted = Object.entries(activityCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sorted.map(([type]) => type);
    const counts = sorted.map(([, count]) => count);
    
    if (activityCharts.topActivities) activityCharts.topActivities.destroy();
    activityCharts.topActivities = new Chart(document.getElementById('topActivitiesChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nombre de sessions',
                data: counts,
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.parsed.x} sessions`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

/**
 * Graphique 5 : Calories brûlées par type d'activité
 */
function createCaloriesByTypeChart(data) {
    // Agréger les calories par type
    const typeCalories = {};
    
    data.forEach(day => {
        Object.entries(day.typeStats).forEach(([type, stats]) => {
            if (!typeCalories[type]) typeCalories[type] = 0;
            typeCalories[type] += stats.calories;
        });
    });
    
    const sortedTypes = Object.entries(typeCalories).sort((a, b) => b[1] - a[1]);
    const labels = sortedTypes.map(([type]) => type);
    const calories = sortedTypes.map(([, cal]) => cal);
    
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    
    if (activityCharts.caloriesByType) activityCharts.caloriesByType.destroy();
    activityCharts.caloriesByType = new Chart(document.getElementById('caloriesByTypeChart'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: calories,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = calories.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} kcal (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Graphique 6 : Comparaison hebdomadaire/mensuelle
 */
async function createWeeklyComparisonChart() {
    const periods = [7, 30];
    const avgCalories = [];
    const avgDuration = [];
    
    for (const period of periods) {
        let totalCalories = 0;
        let totalDuration = 0;
        const today = new Date();
        
        for (let i = period - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const activities = await db.loadDayActivities(date);
            
            activities.forEach(activity => {
                totalCalories += activity.calories;
                totalDuration += activity.duration;
            });
        }
        
        avgCalories.push((totalCalories / period).toFixed(0));
        avgDuration.push((totalDuration / period).toFixed(0));
    }
    
    if (activityCharts.weeklyComparison) activityCharts.weeklyComparison.destroy();
    activityCharts.weeklyComparison = new Chart(document.getElementById('activityComparisonChart'), {
        type: 'bar',
        data: {
            labels: ['Moyenne 7j', 'Moyenne 30j'],
            datasets: [{
                label: 'Calories/jour (kcal)',
                data: avgCalories,
                backgroundColor: '#ef4444',
                yAxisID: 'y'
            }, {
                label: 'Durée/jour (min)',
                data: avgDuration,
                backgroundColor: '#8b5cf6',
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const unit = context.dataset.label.includes('Calories') ? ' kcal' : ' min';
                            return `${context.dataset.label}: ${context.parsed.y}${unit}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Calories (kcal)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Durée (min)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}
