// js/food-analysis.js - Analyse de la consommation par aliment

import * as db from './db.js';
import * as utils from './utils.js';

const foodAnalysisCharts = {
    weightChart: null,
    costChart: null
};

let currentFoodPeriod = 7;
let currentSortColumn = 'name';
let currentSortDirection = 'asc';
let currentFoodData = [];

/**
 * Met à jour toute la section d'analyse par aliment
 */
export async function updateFoodAnalysis(period, foods) {
    currentFoodPeriod = period;
    
    // Collecter les données sur la période
    const foodConsumption = await collectFoodConsumption(period, foods);
    currentFoodData = foodConsumption;
    
    // Mettre à jour les cartes de synthèse
    updateFoodAnalysisSummary(foodConsumption, period);
    
    // Mettre à jour le tableau
    updateFoodAnalysisTable(foodConsumption);
    
    // Créer les graphiques
    createFoodAnalysisCharts(foodConsumption);
}

/**
 * Collecte les données de consommation pour chaque aliment
 */
async function collectFoodConsumption(period, foods) {
    const consumption = {};
    const today = new Date();
    
    // Parcourir chaque jour de la période
    for (let i = period - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const meals = await db.loadDayMeals(date);
        
        // Parcourir tous les repas
        for (const mealType in meals) {
            if (Array.isArray(meals[mealType])) {
                meals[mealType].forEach(item => {
                    const food = foods[item.id];
                    if (food) {
                        if (!consumption[item.id]) {
                            consumption[item.id] = {
                                id: item.id,
                                name: food.name,
                                totalWeight: 0,
                                totalCost: 0,
                                totalProteins: 0,
                                totalCarbs: 0,
                                totalFats: 0,
                                totalFibers: 0,
                                totalSugars: 0,
                                proteinsPer100g: food.proteins || 0, // Protéines pour 100g
                                proteinPrice: 0 // Sera calculé après
                            };
                        }
                        
                        // Ajouter le poids
                        consumption[item.id].totalWeight += item.weight;
                        
                        // Calculer et ajouter le coût si disponible
                        if (food.price && food.priceGrams) {
                            const itemCost = (food.price / food.priceGrams) * item.weight;
                            consumption[item.id].totalCost += itemCost;
                        }
                        
                        // Calculer les macronutriments
                        // Les valeurs nutritionnelles sont pour 100g
                        const factor = item.weight / 100;
                        consumption[item.id].totalProteins += (food.proteins || 0) * factor;
                        consumption[item.id].totalCarbs += (food.carbs || 0) * factor;
                        consumption[item.id].totalFats += (food.fats || 0) * factor;
                        consumption[item.id].totalFibers += (food.fibers || 0) * factor;
                        consumption[item.id].totalSugars += (food.sugars || 0) * factor;
                    }
                });
            }
        }
    }
    
    // Calculer le prix pour 100g de protéines
    Object.values(consumption).forEach(item => {
        const food = foods[item.id];
        if (food && food.price && food.priceGrams && item.proteinsPer100g > 0) {
            // Prix au kilo
            const pricePerKg = (food.price / food.priceGrams) * 1000;
            // Prix pour 100g de protéines = (prix au kilo / protéines pour 100g) * 100
            item.proteinPrice = (pricePerKg / item.proteinsPer100g) * 100;
        } else {
            item.proteinPrice = 0;
        }
    });
    
    // Convertir en tableau et trier
    return Object.values(consumption);
}

/**
 * Met à jour les cartes de synthèse
 */
function updateFoodAnalysisSummary(foodData, period) {
    const totalFoods = foodData.length;
    const totalWeight = foodData.reduce((sum, f) => sum + f.totalWeight, 0);
    const totalCost = foodData.reduce((sum, f) => sum + f.totalCost, 0);
    
    const periodText = period === 7 ? '7 derniers jours' : 
                       period === 30 ? '30 derniers jours' : 
                       '365 derniers jours';
    
    document.getElementById('foodAnalysisTotalFoods').textContent = totalFoods;
    document.getElementById('foodAnalysisFoodsPeriod').textContent = periodText;
    
    document.getElementById('foodAnalysisTotalWeight').textContent = `${(totalWeight / 1000).toFixed(2)} kg`;
    document.getElementById('foodAnalysisWeightPeriod').textContent = periodText;
    
    document.getElementById('foodAnalysisTotalCost').textContent = `${totalCost.toFixed(2)} €`;
    document.getElementById('foodAnalysisCostPeriod').textContent = periodText;
}

/**
 * Met à jour le tableau détaillé
 */
function updateFoodAnalysisTable(foodData) {
    const tbody = document.getElementById('foodAnalysisTableBody');
    
    if (foodData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #999;">Aucune donnée disponible</td></tr>';
        return;
    }
    
    // Trier les données
    const sortedData = sortFoodData(foodData, currentSortColumn, currentSortDirection);
    
    tbody.innerHTML = '';
    sortedData.forEach(food => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${food.name}</td>
            <td>${(food.totalWeight / 1000).toFixed(2)} kg</td>
            <td>${food.totalCost.toFixed(2)} €</td>
            <td class="macro-column" data-column="proteins">${food.totalProteins.toFixed(1)} g</td>
            <td class="macro-column" data-column="carbs">${food.totalCarbs.toFixed(1)} g</td>
            <td class="macro-column" data-column="fats">${food.totalFats.toFixed(1)} g</td>
            <td class="macro-column" data-column="fibers">${food.totalFibers.toFixed(1)} g</td>
            <td class="macro-column" data-column="sugars">${food.totalSugars.toFixed(1)} g</td>
            <td class="macro-column" data-column="proteinsPer100g">${food.proteinsPer100g.toFixed(1)} g</td>
            <td class="macro-column" data-column="proteinPrice">${food.proteinPrice > 0 ? food.proteinPrice.toFixed(2) + ' €' : 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Restaurer l'état des colonnes après la mise à jour
    restoreColumnStates();
}

/**
 * Restaure l'état visible/masqué des colonnes basé sur les checkboxes
 */
function restoreColumnStates() {
    document.querySelectorAll('.column-toggle').forEach(checkbox => {
        const columnName = checkbox.dataset.column;
        const isVisible = checkbox.checked;
        
        // Mettre à jour les en-têtes
        const headers = document.querySelectorAll(`th[data-column="${columnName}"]`);
        headers.forEach(header => {
            header.style.display = isVisible ? 'table-cell' : 'none';
        });
        
        // Mettre à jour les cellules
        const cells = document.querySelectorAll(`td[data-column="${columnName}"]`);
        cells.forEach(cell => {
            cell.style.display = isVisible ? 'table-cell' : 'none';
        });
    });
}

/**
 * Trie les données selon la colonne et direction
 */
function sortFoodData(data, column, direction) {
    const sorted = [...data];
    
    sorted.sort((a, b) => {
        let valA, valB;
        
        if (column === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            return direction === 'asc' ? 
                   valA.localeCompare(valB) : 
                   valB.localeCompare(valA);
        } else if (column === 'weight') {
            valA = a.totalWeight;
            valB = b.totalWeight;
        } else if (column === 'cost') {
            valA = a.totalCost;
            valB = b.totalCost;
        } else if (column === 'proteins') {
            valA = a.totalProteins;
            valB = b.totalProteins;
        } else if (column === 'carbs') {
            valA = a.totalCarbs;
            valB = b.totalCarbs;
        } else if (column === 'fats') {
            valA = a.totalFats;
            valB = b.totalFats;
        } else if (column === 'fibers') {
            valA = a.totalFibers;
            valB = b.totalFibers;
        } else if (column === 'sugars') {
            valA = a.totalSugars;
            valB = b.totalSugars;
        } else if (column === 'proteinsPer100g') {
            valA = a.proteinsPer100g;
            valB = b.proteinsPer100g;
        } else if (column === 'proteinPrice') {
            valA = a.proteinPrice;
            valB = b.proteinPrice;
        }
        
        return direction === 'asc' ? valA - valB : valB - valA;
    });
    
    return sorted;
}

/**
 * Gère le tri du tableau
 */
export function handleTableSort(column) {
    // Si même colonne, inverser la direction
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'desc'; // Par défaut décroissant pour poids et prix
        if (column === 'name') {
            currentSortDirection = 'asc'; // Alphabétique croissant par défaut
        }
    }
    
    // Mettre à jour les icônes de tri
    document.querySelectorAll('.food-analysis-table th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    const sortedTh = document.querySelector(`[data-sort="${column}"]`);
    if (sortedTh) {
        sortedTh.classList.add(currentSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
    
    // Mettre à jour le tableau
    updateFoodAnalysisTable(currentFoodData);
}

/**
 * Crée les graphiques Top 10
 */
function createFoodAnalysisCharts(foodData) {
    // Trier par poids (top 10)
    const topByWeight = [...foodData]
        .sort((a, b) => b.totalWeight - a.totalWeight)
        .slice(0, 10);
    
    // Trier par coût (top 10)
    const topByCost = [...foodData]
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 10);
    
    // Graphique Poids
    if (foodAnalysisCharts.weightChart) foodAnalysisCharts.weightChart.destroy();
    foodAnalysisCharts.weightChart = new Chart(document.getElementById('foodAnalysisWeightChart'), {
        type: 'bar',
        data: {
            labels: topByWeight.map(f => f.name),
            datasets: [{
                label: 'Poids (kg)',
                data: topByWeight.map(f => (f.totalWeight / 1000).toFixed(2)),
                backgroundColor: [
                    '#667eea', '#764ba2', '#48c6ef', '#6f86d6', '#f093fb',
                    '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'
                ]
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
                        label: (context) => `${context.parsed.x} kg`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `${value} kg`
                    }
                }
            }
        }
    });
    
    // Graphique Coût
    if (foodAnalysisCharts.costChart) foodAnalysisCharts.costChart.destroy();
    foodAnalysisCharts.costChart = new Chart(document.getElementById('foodAnalysisCostChart'), {
        type: 'bar',
        data: {
            labels: topByCost.map(f => f.name),
            datasets: [{
                label: 'Coût (€)',
                data: topByCost.map(f => f.totalCost.toFixed(2)),
                backgroundColor: [
                    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
                ]
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
 * Gère l'affichage/masquage des colonnes de macros
 */
export function toggleColumn(columnName, isVisible) {
    // Mettre à jour les en-têtes
    const headers = document.querySelectorAll(`th[data-column="${columnName}"]`);
    headers.forEach(header => {
        header.style.display = isVisible ? 'table-cell' : 'none';
    });
    
    // Mettre à jour les cellules du tableau
    const cells = document.querySelectorAll(`td[data-column="${columnName}"]`);
    cells.forEach(cell => {
        cell.style.display = isVisible ? 'table-cell' : 'none';
    });
}

/**
 * Obtient les colonnes visibles
 */
function getVisibleColumns() {
    const visible = ['name', 'weight', 'cost'];
    document.querySelectorAll('.column-toggle').forEach(checkbox => {
        if (checkbox.checked) {
            visible.push(checkbox.dataset.column);
        }
    });
    return visible;
}

/**
 * Copie les données dans le presse-papier
 */
export function copyFoodAnalysisToClipboard() {
    if (currentFoodData.length === 0) {
        alert('Aucune donnée à copier');
        return;
    }
    
    const visibleColumns = getVisibleColumns();
    
    // En-têtes
    let text = 'Aliment\tPoids Total (kg)\tPrix Total (€)';
    if (visibleColumns.includes('proteins')) text += '\tProtéines (g)';
    if (visibleColumns.includes('carbs')) text += '\tGlucides (g)';
    if (visibleColumns.includes('fats')) text += '\tLipides (g)';
    if (visibleColumns.includes('fibers')) text += '\tFibres (g)';
    if (visibleColumns.includes('sugars')) text += '\tSucres (g)';
    if (visibleColumns.includes('proteinsPer100g')) text += '\tProt/100g (g)';
    if (visibleColumns.includes('proteinPrice')) text += '\tPrix/100g prot (€)';
    text += '\n' + '─'.repeat(80) + '\n';
    
    const sortedData = sortFoodData(currentFoodData, currentSortColumn, currentSortDirection);
    sortedData.forEach(food => {
        text += `${food.name}\t${(food.totalWeight / 1000).toFixed(2)}\t${food.totalCost.toFixed(2)}`;
        if (visibleColumns.includes('proteins')) text += `\t${food.totalProteins.toFixed(1)}`;
        if (visibleColumns.includes('carbs')) text += `\t${food.totalCarbs.toFixed(1)}`;
        if (visibleColumns.includes('fats')) text += `\t${food.totalFats.toFixed(1)}`;
        if (visibleColumns.includes('fibers')) text += `\t${food.totalFibers.toFixed(1)}`;
        if (visibleColumns.includes('sugars')) text += `\t${food.totalSugars.toFixed(1)}`;
        if (visibleColumns.includes('proteinsPer100g')) text += `\t${food.proteinsPer100g.toFixed(1)}`;
        if (visibleColumns.includes('proteinPrice')) text += `\t${food.proteinPrice > 0 ? food.proteinPrice.toFixed(2) : 'N/A'}`;
        text += '\n';
    });
    
    navigator.clipboard.writeText(text).then(() => {
        showCopyNotification('Données copiées dans le presse-papier !');
    }).catch(err => {
        console.error('Erreur copie:', err);
        alert('Erreur lors de la copie');
    });
}

/**
 * Exporte les données en CSV
 */
export function exportFoodAnalysisToCSV() {
    if (currentFoodData.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }
    
    const visibleColumns = getVisibleColumns();
    
    // En-têtes
    let csv = 'Aliment,Poids Total (kg),Prix Total (€)';
    if (visibleColumns.includes('proteins')) csv += ',Protéines (g)';
    if (visibleColumns.includes('carbs')) csv += ',Glucides (g)';
    if (visibleColumns.includes('fats')) csv += ',Lipides (g)';
    if (visibleColumns.includes('fibers')) csv += ',Fibres (g)';
    if (visibleColumns.includes('sugars')) csv += ',Sucres (g)';
    if (visibleColumns.includes('proteinsPer100g')) csv += ',Prot/100g (g)';
    if (visibleColumns.includes('proteinPrice')) csv += ',Prix/100g prot (€)';
    csv += '\n';
    
    const sortedData = sortFoodData(currentFoodData, currentSortColumn, currentSortDirection);
    sortedData.forEach(food => {
        csv += `"${food.name}",${(food.totalWeight / 1000).toFixed(2)},${food.totalCost.toFixed(2)}`;
        if (visibleColumns.includes('proteins')) csv += `,${food.totalProteins.toFixed(1)}`;
        if (visibleColumns.includes('carbs')) csv += `,${food.totalCarbs.toFixed(1)}`;
        if (visibleColumns.includes('fats')) csv += `,${food.totalFats.toFixed(1)}`;
        if (visibleColumns.includes('fibers')) csv += `,${food.totalFibers.toFixed(1)}`;
        if (visibleColumns.includes('sugars')) csv += `,${food.totalSugars.toFixed(1)}`;
        if (visibleColumns.includes('proteinsPer100g')) csv += `,${food.proteinsPer100g.toFixed(1)}`;
        if (visibleColumns.includes('proteinPrice')) csv += `,${food.proteinPrice > 0 ? food.proteinPrice.toFixed(2) : 'N/A'}`;
        csv += '\n';
    });
    
    // Créer le fichier et télécharger
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analyse-aliments-${currentFoodPeriod}j-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    showCopyNotification('Fichier CSV téléchargé !');
}

/**
 * Affiche une notification temporaire
 */
function showCopyNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}
