// js/food-comparison.js

// État global de la comparaison
let comparisonChart = null;
let selectedFoods = {
    food1: null,
    food2: null,
    food3: null
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
            // Ex: 3.50€ pour 500g => (3.50 / 500) * 100 = 0.70€/100g
            return (food.price / food.priceQuantity) * 100;
        } else if (food.priceUnit === 'portions') {
            // Ex: 3.50€ pour 4 portions (assumant 100g par portion par défaut)
            // => (3.50 / 400) * 100 = 0.875€/100g
            const totalGrams = food.priceQuantity * 100; // 100g par portion par défaut
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
 * Initialise l'onglet de comparaison
 * @param {object} foods - Dictionnaire des aliments
 */
export function initComparison(foods) {
    populateFoodSelects(foods);
    setupSearchFilters(foods);
    setupEventListeners();
}

/**
 * Remplit les dropdowns avec tous les aliments disponibles
 * @param {object} foods - Dictionnaire des aliments
 */
function populateFoodSelects(foods) {
    const selects = [
        document.getElementById('comparisonFood1'),
        document.getElementById('comparisonFood2'),
        document.getElementById('comparisonFood3')
    ];

    selects.forEach(select => {
        // Garder l'option par défaut
        select.innerHTML = '<option value="">-- Sélectionner --</option>';
        
        // Ajouter tous les aliments
        Object.entries(foods).forEach(([id, food]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = food.name;
            select.appendChild(option);
        });
    });
}

/**
 * Configure les filtres de recherche pour chaque dropdown
 * @param {object} foods - Dictionnaire des aliments
 */
function setupSearchFilters(foods) {
    for (let i = 1; i <= 3; i++) {
        const searchInput = document.getElementById(`comparisonSearch${i}`);
        const select = document.getElementById(`comparisonFood${i}`);
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const options = select.querySelectorAll('option');
            
            options.forEach(option => {
                if (option.value === '') {
                    option.style.display = '';
                    return;
                }
                
                const foodName = foods[option.value]?.name.toLowerCase() || '';
                option.style.display = foodName.includes(query) ? '' : 'none';
            });
        });
    }
}

/**
 * Configure les gestionnaires d'événements
 */
function setupEventListeners() {
    // Activer le bouton Comparer quand au moins 2 aliments sont sélectionnés
    const selects = [
        document.getElementById('comparisonFood1'),
        document.getElementById('comparisonFood2'),
        document.getElementById('comparisonFood3')
    ];

    selects.forEach(select => {
        select.addEventListener('change', updateCompareButtonState);
    });

    // Bouton Comparer
    document.getElementById('compareBtn').addEventListener('click', performComparison);
    
    // Changement de mode de comparaison
    document.getElementById('comparisonMode').addEventListener('change', performComparison);
    
    // Bouton Copier
    document.getElementById('copyComparisonBtn').addEventListener('click', copyComparison);
}

/**
 * Met à jour l'état du bouton Comparer
 */
function updateCompareButtonState() {
    const food1 = document.getElementById('comparisonFood1').value;
    const food2 = document.getElementById('comparisonFood2').value;
    const compareBtn = document.getElementById('compareBtn');
    
    compareBtn.disabled = !food1 || !food2;
}

/**
 * Effectue la comparaison des aliments sélectionnés
 */
export function performComparison() {
    const food1Id = document.getElementById('comparisonFood1').value;
    const food2Id = document.getElementById('comparisonFood2').value;
    const food3Id = document.getElementById('comparisonFood3').value;
    
    if (!food1Id || !food2Id) {
        return;
    }
    
    // Récupérer les aliments depuis le state global
    const foods = window.appState?.foods || {};
    
    selectedFoods.food1 = { id: food1Id, ...foods[food1Id] };
    selectedFoods.food2 = { id: food2Id, ...foods[food2Id] };
    selectedFoods.food3 = food3Id ? { id: food3Id, ...foods[food3Id] } : null;
    
    // Afficher les résultats
    document.getElementById('comparisonResults').style.display = 'block';
    
    // Scroll vers les résultats
    document.getElementById('comparisonResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Mettre à jour tous les éléments
    updateComparisonChart();
    updateSummaryCards();
    updateComparisonTable();
}

/**
 * Met à jour le graphique à barres horizontales empilées de comparaison
 */
function updateComparisonChart() {
    const mode = document.getElementById('comparisonMode').value;
    const data = getAdjustedData(mode);
    
    // Détruire le graphique existant
    if (comparisonChart) {
        comparisonChart.destroy();
    }
    
    const ctx = document.getElementById('comparisonRadarChart').getContext('2d');
    
    // Récupérer les aliments non-null
    const foods = [data.food1, data.food2, data.food3].filter(f => f !== null);
    const foodNames = foods.map(f => f.name);
    
    // Couleurs pour chaque nutriment
    const nutrientColors = {
        proteins: { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgb(239, 68, 68)' },
        carbs: { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },
        fats: { bg: 'rgba(234, 179, 8, 0.8)', border: 'rgb(234, 179, 8)' },
        fibers: { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' }
    };
    
    // Créer un dataset par nutriment
    const datasets = [
        {
            label: 'Protéines (g)',
            data: foods.map(f => f.proteins),
            backgroundColor: nutrientColors.proteins.bg,
            borderColor: nutrientColors.proteins.border,
            borderWidth: 1
        },
        {
            label: 'Glucides (g)',
            data: foods.map(f => f.carbs),
            backgroundColor: nutrientColors.carbs.bg,
            borderColor: nutrientColors.carbs.border,
            borderWidth: 1
        },
        {
            label: 'Lipides (g)',
            data: foods.map(f => f.fats),
            backgroundColor: nutrientColors.fats.bg,
            borderColor: nutrientColors.fats.border,
            borderWidth: 1
        },
        {
            label: 'Fibres (g)',
            data: foods.map(f => f.fibers || 0),
            backgroundColor: nutrientColors.fibers.bg,
            borderColor: nutrientColors.fibers.border,
            borderWidth: 1
        }
    ];
    
    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: foodNames,
            datasets: datasets
        },
        options: {
            indexAxis: 'y', // Barres horizontales
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        font: {
                            size: 11
                        }
                    },
                    title: {
                        display: true,
                        text: 'Quantité (g)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    stacked: true,
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.parsed.x.toFixed(1) + ' g';
                            return label;
                        },
                        afterLabel: function(context) {
                            // Afficher le total de la barre
                            const datasetIndex = context.datasetIndex;
                            const foodIndex = context.dataIndex;
                            
                            if (datasetIndex === datasets.length - 1) {
                                let total = 0;
                                datasets.forEach(ds => {
                                    total += ds.data[foodIndex];
                                });
                                return `Total: ${total.toFixed(1)} g`;
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Met à jour les cartes de résumé
 */
function updateSummaryCards() {
    const mode = document.getElementById('comparisonMode').value;
    const data = getAdjustedData(mode);
    
    const foods = [data.food1, data.food2, data.food3].filter(f => f);
    
    // Meilleur choix global (basé sur ratio protéines/calories)
    const bestOverall = foods.reduce((best, food) => {
        const ratio = food.proteins / food.calories;
        const bestRatio = best.proteins / best.calories;
        return ratio > bestRatio ? food : best;
    });
    document.getElementById('bestOverall').textContent = bestOverall.name;
    
    // Plus riche en protéines
    const bestProtein = foods.reduce((best, food) => 
        food.proteins > best.proteins ? food : best
    );
    document.getElementById('bestProtein').textContent = 
        `${bestProtein.name} (${bestProtein.proteins.toFixed(1)}g)`;
    
    // Moins calorique
    const lowestCalorie = foods.reduce((best, food) => 
        food.calories < best.calories ? food : best
    );
    document.getElementById('lowestCalorie').textContent = 
        `${lowestCalorie.name} (${lowestCalorie.calories.toFixed(0)} kcal)`;
    
    // Plus économique
    const withPrice = foods.filter(f => hasPrice(f));
    if (withPrice.length > 0) {
        const bestPrice = withPrice.reduce((best, food) => {
            const pricePerFood = getPricePer100g(food);
            const pricePerBest = getPricePer100g(best);
            return pricePerFood < pricePerBest ? food : best;
        });
        const price = getPricePer100g(bestPrice).toFixed(2);
        document.getElementById('bestPrice').textContent = 
            `${bestPrice.name} (${price}€/100g)`;
    } else {
        document.getElementById('bestPrice').textContent = 'Prix non renseigné';
    }
}

/**
 * Met à jour le tableau comparatif
 */
function updateComparisonTable() {
    const mode = document.getElementById('comparisonMode').value;
    const data = getAdjustedData(mode);
    
    // Mettre à jour les en-têtes
    document.getElementById('header1').textContent = data.food1.name;
    document.getElementById('header2').textContent = data.food2.name;
    const header3 = document.getElementById('header3');
    if (data.food3) {
        header3.textContent = data.food3.name;
        header3.style.display = '';
    } else {
        header3.style.display = 'none';
    }
    
    // Construire les lignes du tableau
    const tbody = document.getElementById('comparisonTableBody');
    tbody.innerHTML = '';
    
    const metrics = [
        { label: '🔥 Calories', key: 'calories', unit: 'kcal', lowerIsBetter: true },
        { label: '🥩 Protéines', key: 'proteins', unit: 'g', lowerIsBetter: false },
        { label: '🍞 Glucides', key: 'carbs', unit: 'g', lowerIsBetter: false },
        { label: '🥑 Lipides', key: 'fats', unit: 'g', lowerIsBetter: false },
        { label: '🍬 Sucres', key: 'sugars', unit: 'g', lowerIsBetter: true },
        { label: '🌾 Fibres', key: 'fibers', unit: 'g', lowerIsBetter: false }
    ];
    
    // Ajouter le prix si disponible
    if ([data.food1, data.food2, data.food3].some(f => f && hasPrice(f))) {
        metrics.push({ label: '💰 Prix', key: 'price', unit: '€/100g', lowerIsBetter: true, isPrice: true });
    }
    
    metrics.forEach(metric => {
        const row = document.createElement('tr');
        
        const foods = [data.food1, data.food2, data.food3].filter(f => f);
        const values = foods.map(f => {
            if (metric.isPrice) {
                return getPricePer100g(f);
            }
            return f[metric.key] || 0;
        });
        
        // Trouver le meilleur
        const validValues = values.filter(v => v !== null);
        const bestValue = validValues.length > 0 
            ? (metric.lowerIsBetter 
                ? Math.min(...validValues) 
                : Math.max(...validValues))
            : null;
        
        const bestFood = foods.find((f, i) => values[i] === bestValue);
        
        row.innerHTML = `
            <td class="metric-label">${metric.label}</td>
            <td class="${values[0] === bestValue ? 'best-value' : ''}">${formatValue(values[0], metric)}</td>
            <td class="${values[1] === bestValue ? 'best-value' : ''}">${formatValue(values[1], metric)}</td>
            <td class="${data.food3 ? (values[2] === bestValue ? 'best-value' : '') : ''}" style="${data.food3 ? '' : 'display: none;'}">${data.food3 ? formatValue(values[2], metric) : ''}</td>
            <td class="winner-cell">${bestFood?.name || '-'}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Ajouter la quantité de référence
    const refRow = document.createElement('tr');
    refRow.classList.add('reference-row');
    refRow.innerHTML = `
        <td class="metric-label">📊 Quantité</td>
        <td>${data.quantity1}</td>
        <td>${data.quantity2}</td>
        <td style="${data.food3 ? '' : 'display: none;'}">${data.food3 ? data.quantity3 : ''}</td>
        <td>-</td>
    `;
    tbody.insertBefore(refRow, tbody.firstChild);
}

/**
 * Formate une valeur pour l'affichage dans le tableau
 */
function formatValue(value, metric) {
    if (value === null || value === undefined) {
        return '-';
    }
    
    if (metric.isPrice) {
        return `${value.toFixed(2)} ${metric.unit}`;
    }
    
    const formatted = metric.key === 'calories' ? value.toFixed(0) : value.toFixed(1);
    return `${formatted} ${metric.unit}`;
}

/**
 * Récupère les données ajustées selon le mode de comparaison
 */
function getAdjustedData(mode) {
    const result = {
        food1: { ...selectedFoods.food1 },
        food2: { ...selectedFoods.food2 },
        food3: selectedFoods.food3 ? { ...selectedFoods.food3 } : null,
        quantity1: '100g',
        quantity2: '100g',
        quantity3: '100g'
    };
    
    if (mode === '100g') {
        // Aucun ajustement nécessaire
        return result;
    }
    
    if (mode === 'calories') {
        // Ajuster pour 200 kcal
        const targetCalories = 200;
        
        [result.food1, result.food2, result.food3].forEach((food, index) => {
            if (!food) return;
            
            const ratio = targetCalories / food.calories;
            const quantity = 100 * ratio;
            
            food.proteins *= ratio;
            food.carbs *= ratio;
            food.fats *= ratio;
            food.sugars *= ratio;
            food.fibers = (food.fibers || 0) * ratio;
            food.calories = targetCalories;
            
            if (index === 0) result.quantity1 = `${quantity.toFixed(0)}g`;
            else if (index === 1) result.quantity2 = `${quantity.toFixed(0)}g`;
            else result.quantity3 = `${quantity.toFixed(0)}g`;
        });
    }
    
    if (mode === 'price') {
        // Ajuster pour 2€
        const targetPrice = 2;
        
        [result.food1, result.food2, result.food3].forEach((food, index) => {
            if (!food || !hasPrice(food)) return;
            
            const priceFor100g = getPricePer100g(food);
            const ratio = targetPrice / priceFor100g;
            const quantity = 100 * ratio;
            
            food.proteins *= ratio;
            food.carbs *= ratio;
            food.fats *= ratio;
            food.sugars *= ratio;
            food.fibers = (food.fibers || 0) * ratio;
            food.calories *= ratio;
            
            if (index === 0) result.quantity1 = `${quantity.toFixed(0)}g`;
            else if (index === 1) result.quantity2 = `${quantity.toFixed(0)}g`;
            else result.quantity3 = `${quantity.toFixed(0)}g`;
        });
    }
    
    return result;
}

/**
 * Copie la comparaison dans le presse-papier
 */
async function copyComparison() {
    const mode = document.getElementById('comparisonMode').value;
    const data = getAdjustedData(mode);
    
    const modeLabels = {
        '100g': 'Pour 100g',
        'calories': 'Pour 200 kcal',
        'price': 'Pour 2€'
    };
    
    let text = `⚖️ COMPARAISON D'ALIMENTS - ${modeLabels[mode]}\n`;
    text += `${'='.repeat(50)}\n\n`;
    
    const foods = [data.food1, data.food2, data.food3].filter(f => f);
    const quantities = [data.quantity1, data.quantity2, data.quantity3];
    
    foods.forEach((food, i) => {
        text += `📌 ${food.name} (${quantities[i]})\n`;
        text += `   🔥 ${food.calories.toFixed(0)} kcal\n`;
        text += `   🥩 ${food.proteins.toFixed(1)}g protéines\n`;
        text += `   🍞 ${food.carbs.toFixed(1)}g glucides\n`;
        text += `   🥑 ${food.fats.toFixed(1)}g lipides\n`;
        text += `   🍬 ${food.sugars.toFixed(1)}g sucres\n`;
        text += `   🌾 ${(food.fibers || 0).toFixed(1)}g fibres\n`;
        const pricePer100g = getPricePer100g(food);
        if (pricePer100g !== null) {
            text += `   💰 ${pricePer100g.toFixed(2)}€/100g\n`;
        }
        text += `\n`;
    });
    
    try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback();
    } catch (err) {
        console.error('Erreur de copie:', err);
        alert('Impossible de copier dans le presse-papier');
    }
}

/**
 * Affiche un feedback de copie réussie
 */
function showCopyFeedback() {
    const btn = document.getElementById('copyComparisonBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ Copié !';
    btn.style.background = '#10b981';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
    }, 2000);
}

/**
 * Réinitialise la comparaison
 */
export function resetComparison() {
    document.getElementById('comparisonFood1').value = '';
    document.getElementById('comparisonFood2').value = '';
    document.getElementById('comparisonFood3').value = '';
    document.getElementById('comparisonSearch1').value = '';
    document.getElementById('comparisonSearch2').value = '';
    document.getElementById('comparisonSearch3').value = '';
    document.getElementById('comparisonResults').style.display = 'none';
    updateCompareButtonState();
}
