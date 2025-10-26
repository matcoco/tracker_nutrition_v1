// js/import-export.js - Gestion de l'import/export des aliments et repas

import * as db from './db.js';
import { showNotification } from './ui.js';

/**
 * Exporte les aliments et repas sélectionnés au format JSON
 * @param {Array} selectedFoodIds - IDs des aliments sélectionnés
 * @param {Array} selectedMealIds - IDs des repas sélectionnés
 * @param {Object} foods - Dictionnaire de tous les aliments
 * @param {Object} meals - Dictionnaire de tous les repas
 */
export function exportSelectedItems(selectedFoodIds, selectedMealIds, foods, meals) {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        appName: 'Nutrition Tracker',
        data: {
            foods: {},
            meals: {}
        }
    };

    // Ajouter les aliments sélectionnés
    selectedFoodIds.forEach(id => {
        if (foods[id]) {
            exportData.data.foods[id] = foods[id];
        }
    });

    // Ajouter les repas sélectionnés
    selectedMealIds.forEach(id => {
        if (meals[id]) {
            exportData.data.meals[id] = meals[id];
        }
    });

    // Créer et télécharger le fichier JSON
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `nutrition-data-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const totalItems = selectedFoodIds.length + selectedMealIds.length;
    showNotification(`✅ Export réussi : ${totalItems} élément(s) exporté(s) !`);
}

/**
 * Importe des aliments et repas depuis un fichier JSON
 * @param {File} file - Fichier JSON à importer
 * @param {Object} existingFoods - Aliments existants
 * @param {Object} existingMeals - Repas existants
 * @returns {Promise<Object>} - Résultats de l'import
 */
export async function importFromFile(file, existingFoods, existingMeals) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                // Valider le format
                if (!validateImportData(importData)) {
                    throw new Error('Format de fichier invalide');
                }
                
                // Détecter les conflits
                const conflicts = detectConflicts(importData, existingFoods, existingMeals);
                
                // Importer uniquement les nouveaux éléments (ignorer les doublons)
                const result = await mergeData(importData, existingFoods, existingMeals, conflicts);
                
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
        reader.readAsText(file);
    });
}

/**
 * Valide le format des données importées
 * @param {Object} data - Données à valider
 * @returns {boolean}
 */
function validateImportData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.version || !data.data) return false;
    if (!data.data.foods || !data.data.meals) return false;
    if (typeof data.data.foods !== 'object' || typeof data.data.meals !== 'object') return false;
    
    return true;
}

/**
 * Détecte les conflits entre données importées et existantes
 * @param {Object} importData - Données à importer
 * @param {Object} existingFoods - Aliments existants
 * @param {Object} existingMeals - Repas existants
 * @returns {Object} - Liste des conflits
 */
function detectConflicts(importData, existingFoods, existingMeals) {
    const conflicts = {
        foods: [],
        meals: []
    };
    
    // Vérifier les conflits d'aliments
    Object.keys(importData.data.foods).forEach(id => {
        if (existingFoods[id]) {
            conflicts.foods.push({
                id,
                name: importData.data.foods[id].name
            });
        }
    });
    
    // Vérifier les conflits de repas
    Object.keys(importData.data.meals).forEach(id => {
        if (existingMeals[id]) {
            conflicts.meals.push({
                id,
                name: importData.data.meals[id].name
            });
        }
    });
    
    return conflicts;
}

/**
 * Fusionne les données importées avec les existantes (ajoute uniquement les nouveaux)
 * @param {Object} importData - Données à importer
 * @param {Object} existingFoods - Aliments existants
 * @param {Object} existingMeals - Repas existants
 * @param {Object} conflicts - Conflits détectés
 * @returns {Promise<Object>} - Résultats de l'import
 */
async function mergeData(importData, existingFoods, existingMeals, conflicts) {
    const result = {
        foodsAdded: 0,
        mealsAdded: 0,
        foodsIgnored: conflicts.foods.length,
        mealsIgnored: conflicts.meals.length,
        ignoredItems: []
    };
    
    // Importer les aliments (ignorer les doublons)
    for (const [id, food] of Object.entries(importData.data.foods)) {
        if (!existingFoods[id]) {
            await db.saveFood(id, food);
            result.foodsAdded++;
        } else {
            result.ignoredItems.push({ type: 'aliment', name: food.name });
        }
    }
    
    // Importer les repas (ignorer les doublons)
    for (const [id, meal] of Object.entries(importData.data.meals)) {
        if (!existingMeals[id]) {
            await db.saveMeal(id, meal);
            result.mealsAdded++;
        } else {
            result.ignoredItems.push({ type: 'repas', name: meal.name });
        }
    }
    
    return result;
}

/**
 * Initialise l'interface d'import/export
 * @param {Object} foods - Aliments disponibles
 * @param {Object} meals - Repas disponibles
 */
export function initImportExport(foods, meals) {
    setupExportInterface(foods, meals);
    setupImportInterface(foods, meals);
}

/**
 * Configure l'interface d'export
 */
function setupExportInterface(foods, meals) {
    const exportBtn = document.getElementById('exportDataBtn');
    const modal = document.getElementById('exportModal');
    const closeBtn = document.getElementById('closeExportModal');
    const confirmBtn = document.getElementById('confirmExportBtn');
    const toggleBtns = document.querySelectorAll('.export-toggle-btn');
    
    let currentMode = 'foods'; // 'foods' ou 'meals'
    
    if (!exportBtn || !modal) return;
    
    // Ouvrir la modale
    exportBtn.addEventListener('click', () => {
        modal.classList.add('show');
        populateExportList('foods', foods);
    });
    
    // Fermer la modale
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Toggle entre aliments et repas
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            if (mode === currentMode) return;
            
            currentMode = mode;
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (mode === 'foods') {
                populateExportList('foods', foods);
            } else {
                populateExportList('meals', meals);
            }
        });
    });
    
    // Tout sélectionner / Tout désélectionner
    const selectAllBtn = document.getElementById('selectAllExportBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.export-checkbox');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            
            checkboxes.forEach(cb => cb.checked = !allChecked);
            selectAllBtn.textContent = allChecked ? '✓ Tout sélectionner' : '✗ Tout désélectionner';
        });
    }
    
    // Confirmer l'export
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const selectedFoods = [];
            const selectedMeals = [];
            
            document.querySelectorAll('.export-checkbox:checked').forEach(cb => {
                if (cb.dataset.type === 'food') {
                    selectedFoods.push(cb.dataset.id);
                } else {
                    selectedMeals.push(cb.dataset.id);
                }
            });
            
            if (selectedFoods.length === 0 && selectedMeals.length === 0) {
                showNotification('⚠️ Veuillez sélectionner au moins un élément à exporter', 'error');
                return;
            }
            
            exportSelectedItems(selectedFoods, selectedMeals, foods, meals);
            modal.classList.remove('show');
        });
    }
}

/**
 * Remplit la liste d'export
 */
function populateExportList(mode, items) {
    const container = document.getElementById('exportListContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const itemsArray = Object.entries(items);
    if (itemsArray.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Aucun élément disponible</p>';
        return;
    }
    
    itemsArray.forEach(([id, item]) => {
        const div = document.createElement('div');
        div.className = 'export-item';
        
        const emoji = mode === 'foods' ? '🥗' : '🍽️';
        const type = mode === 'foods' ? 'food' : 'meal';
        
        div.innerHTML = `
            <label>
                <input type="checkbox" class="export-checkbox" data-id="${id}" data-type="${type}">
                <span>${emoji} ${item.name}</span>
            </label>
        `;
        
        container.appendChild(div);
    });
}

/**
 * Configure l'interface d'import
 */
function setupImportInterface(foods, meals) {
    const importBtn = document.getElementById('importDataBtn');
    const fileInput = document.getElementById('importFileInput');
    
    if (!importBtn || !fileInput) return;
    
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const result = await importFromFile(file, foods, meals);
            
            // Afficher les résultats
            let message = `✅ Import terminé !\n\n`;
            message += `📥 ${result.foodsAdded} aliment(s) ajouté(s)\n`;
            message += `📥 ${result.mealsAdded} repas ajouté(s)\n`;
            
            if (result.foodsIgnored > 0 || result.mealsIgnored > 0) {
                message += `\n⚠️ ${result.foodsIgnored + result.mealsIgnored} doublon(s) ignoré(s)`;
            }
            
            showNotification(message);
            
            // Recharger la page pour afficher les nouvelles données
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            showNotification(`❌ Erreur lors de l'import : ${error.message}`, 'error');
        }
        
        // Réinitialiser l'input
        fileInput.value = '';
    });
}
