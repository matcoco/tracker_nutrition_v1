// js/costs.js - Fonctions pour la gestion et l'affichage des coûts

import * as db from './db.js';
import * as utils from './utils.js';

const costCharts = {
    dailyCosts: null,
    costsByMeal: null,
    topCosts: null,
    costComparison: null
};

/**
 * Calcule le prix pour 100g d'un aliment
 * Gère les anciennes données (priceGrams) et les nouvelles (priceQuantity + priceUnit)
 * @param {object} food - L'aliment
 * @returns {number|null} - Prix pour 100g ou null si non disponible
 */
function getPricePer100g(food) {
    if (!food.price) return null;
    
    // Nouveau format : priceQuantity + priceUnit
    if (food.priceQuantity && food.priceUnit) {
        if (food.priceUnit === 'grams') {
            return (food.price / food.priceQuantity) * 100;
        } else if (food.priceUnit === 'portions') {
            // Utiliser le poids réel de la portion si disponible, sinon 100g par défaut
            const portionWeight = food.portionWeight || 100;
            const totalGrams = food.priceQuantity * portionWeight;
            return (food.price / totalGrams) * 100;
        }
    }
    
    // Ancien format (rétrocompatibilité) : priceGrams
    if (food.priceGrams) {
        return (food.price / food.priceGrams) * 100;
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

/**
 * Met à jour tous les graphiques et cartes de coûts
 * @param {number} period - Nombre de jours
 * @param {object} foods - Dictionnaire des aliments
 * @param {object} composedMeals - Dictionnaire des repas composés
 */
export async function updateCostCharts(period, foods, composedMeals = {}) {
    // Charger les données de la période
    const data = [];
    const today = new Date();
    
    for (let i = period - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = utils.formatDateKey(date);
        const meals = await db.loadDayMeals(date);
        const dayCost = utils.calculateDayCost(meals, foods, composedMeals);
        const costsByMeal = utils.calculateCostsByMeal(meals, foods, composedMeals);
        
        data.push({
            date: dateKey,
            cost: dayCost,
            costsByMeal: costsByMeal
        });
    }
    
    // Mettre à jour les cartes de synthèse
    updateCostSummaryCards(data, period);
    
    // Créer les graphiques
    createDailyCostsChart(data);
    createCostsByMealChart(data);
    createTopCostsChart(period, foods, composedMeals);
    createCostComparisonChart(foods, composedMeals);
}

/**
 * Met à jour les cartes de synthèse des coûts
 */
function updateCostSummaryCards(data, period) {
    const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
    const avgDailyCost = totalCost / period;
    const monthlyCost = avgDailyCost * 30;
    
    document.getElementById('totalCost').textContent = `${totalCost.toFixed(2)} €`;
    document.getElementById('totalCostPeriod').textContent = `${period} derniers jours`;
    document.getElementById('avgDailyCost').textContent = `${avgDailyCost.toFixed(2)} €`;
    document.getElementById('avgCostPeriod').textContent = `${period} derniers jours`;
    document.getElementById('monthlyCost').textContent = `${monthlyCost.toFixed(2)} €`;
}

/**
 * Créer le graphique d'évolution des coûts quotidiens
 */
function createDailyCostsChart(data) {
    const labels = data.map(d => new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    const costs = data.map(d => d.cost.toFixed(2));
    
    if (costCharts.dailyCosts) costCharts.dailyCosts.destroy();
    costCharts.dailyCosts = new Chart(document.getElementById('dailyCostsChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Coût (€)',
                data: costs,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.parsed.y.toFixed(2)} €`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `${value} €`
                    }
                }
            }
        }
    });
}

/**
 * Créer le graphique de répartition des coûts par repas
 */
function createCostsByMealChart(data) {
    const totalsByMeal = {
        'petit-dej': 0,
        'dejeuner': 0,
        'diner': 0,
        'snack': 0
    };
    
    data.forEach(d => {
        totalsByMeal['petit-dej'] += d.costsByMeal['petit-dej'];
        totalsByMeal['dejeuner'] += d.costsByMeal['dejeuner'];
        totalsByMeal['diner'] += d.costsByMeal['diner'];
        totalsByMeal['snack'] += d.costsByMeal['snack'];
    });
    
    if (costCharts.costsByMeal) costCharts.costsByMeal.destroy();
    costCharts.costsByMeal = new Chart(document.getElementById('costsByMealChart'), {
        type: 'doughnut',
        data: {
            labels: ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Snack'],
            datasets: [{
                data: [
                    totalsByMeal['petit-dej'].toFixed(2),
                    totalsByMeal['dejeuner'].toFixed(2),
                    totalsByMeal['diner'].toFixed(2),
                    totalsByMeal['snack'].toFixed(2)
                ],
                backgroundColor: ['#fbbf24', '#10b981', '#3b82f6', '#8b5cf6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${context.parsed.toFixed(2)} €`
                    }
                }
            }
        }
    });
}

/**
 * Créer le graphique du top 5 des aliments les plus chers
 */
async function createTopCostsChart(period, foods, composedMeals = {}) {
    const foodCosts = {};
    const today = new Date();
    
    // Calculer le coût total de chaque aliment sur la période
    for (let i = period - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const meals = await db.loadDayMeals(date);
        
        for (const mealType in meals) {
            if (Array.isArray(meals[mealType])) {
                meals[mealType].forEach(item => {
                    let food;
                    
                    // Vérifier si c'est un repas composé
                    if (item.isMeal && composedMeals[item.id]) {
                        food = composedMeals[item.id];
                    } else {
                        food = foods[item.id];
                    }
                    
                    if (food && hasPrice(food)) {
                        const pricePer100g = getPricePer100g(food);
                        const itemCost = (pricePer100g / 100) * item.weight;
                        if (!foodCosts[item.id]) {
                            foodCosts[item.id] = {
                                name: food.name,
                                cost: 0
                            };
                        }
                        foodCosts[item.id].cost += itemCost;
                    }
                });
            }
        }
    }
    
    // Trier et prendre le top 5
    const sorted = Object.values(foodCosts).sort((a, b) => b.cost - a.cost).slice(0, 5);
    const labels = sorted.map(f => f.name);
    const costs = sorted.map(f => f.cost.toFixed(2));
    
    if (costCharts.topCosts) costCharts.topCosts.destroy();
    costCharts.topCosts = new Chart(document.getElementById('topCostsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Coût Total (€)',
                data: costs,
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
                        label: (context) => `${context.parsed.x.toFixed(2)} €`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `${value} €`
                    }
                }
            }
        }
    });
}

/**
 * Créer le graphique de comparaison hebdo/mensuelle
 */
async function createCostComparisonChart(foods, composedMeals = {}) {
    // Calculer coûts des 7 et 30 derniers jours
    const periods = [7, 30];
    const costs = [];
    
    for (const period of periods) {
        let totalCost = 0;
        const today = new Date();
        
        for (let i = period - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const meals = await db.loadDayMeals(date);
            totalCost += utils.calculateDayCost(meals, foods, composedMeals);
        }
        
        costs.push((totalCost / period).toFixed(2));
    }
    
    if (costCharts.costComparison) costCharts.costComparison.destroy();
    costCharts.costComparison = new Chart(document.getElementById('costComparisonChart'), {
        type: 'bar',
        data: {
            labels: ['Moyenne 7j', 'Moyenne 30j'],
            datasets: [{
                label: 'Coût Moyen/Jour (€)',
                data: costs,
                backgroundColor: ['#667eea', '#48c6ef']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.parsed.y.toFixed(2)} €/jour`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `${value} €`
                    }
                }
            }
        }
    });
}
