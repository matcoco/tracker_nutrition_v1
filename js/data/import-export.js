// js/import-export.js - Gestion de l'import/export des aliments et repas

import * as db from '../core/db.js';
import { showNotification } from '../ui/ui-core.js';

/**
 * Exporte les aliments et repas sélectionnés au format JSON
 * @param {Array} selectedFoodIds - IDs des aliments sélectionnés
 * @param {Array} selectedMealIds - IDs des repas sélectionnés
 * @param {Object} foods - Dictionnaire de tous les aliments
 * @param {Object} meals - Dictionnaire de tous les repas
 */
export function exportSelectedItems(selectedFoodIds, selectedMealIds, foods, meals) {
    const exportData = {
        version: '1.5.0',
        exportDate: new Date().toISOString(),
        appName: 'Nutrition Tracker',
        data: {
            foods: {},
            meals: {}
        },
        metadata: {
            totalFoods: 0,
            totalMeals: 0,
            autoDependencies: 0
        }
    };

    // Ajouter les repas sélectionnés ET leurs dépendances automatiquement
    selectedMealIds.forEach(id => {
        if (meals[id]) {
            exportData.data.meals[id] = meals[id];
            
            // ✨ AUTO-INCLURE les aliments nécessaires au repas
            if (meals[id].ingredients) {
                meals[id].ingredients.forEach(ingredient => {
                    const foodId = ingredient.foodId;
                    if (foods[foodId] && !exportData.data.foods[foodId]) {
                        exportData.data.foods[foodId] = foods[foodId];
                        exportData.metadata.autoDependencies++;
                    }
                });
            }
        }
    });

    // Ajouter les aliments sélectionnés manuellement
    selectedFoodIds.forEach(id => {
        if (foods[id] && !exportData.data.foods[id]) {
            exportData.data.foods[id] = foods[id];
        }
    });
    
    exportData.metadata.totalFoods = Object.keys(exportData.data.foods).length;
    exportData.metadata.totalMeals = Object.keys(exportData.data.meals).length;

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

    let message = `✅ Export réussi !\n\n`;
    message += `📤 ${exportData.metadata.totalMeals} repas exporté(s)\n`;
    message += `📤 ${exportData.metadata.totalFoods} aliment(s) exporté(s)`;
    
    if (exportData.metadata.autoDependencies > 0) {
        message += `\n\n✨ ${exportData.metadata.autoDependencies} aliment(s) inclus automatiquement (dépendances des repas)`;
    }
    
    showNotification(message);
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
                
                // Valider le format et détecter le type
                const validation = validateImportData(importData);
                if (!validation.valid) {
                    throw new Error(validation.error);
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
 * Valide le format des données importées et détecte le type
 * @param {Object} data - Données à valider
 * @returns {Object} - { valid: boolean, type: string, error: string }
 */
function validateImportData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Le fichier ne contient pas de données valides' };
    }
    
    // Détecter le format GLOBAL (backup complet)
    if (data.foods && data.dailyMeals && !data.data) {
        return { 
            valid: false, 
            type: 'global',
            error: '⚠️ Ce fichier est une sauvegarde complète.\n\nVeuillez utiliser le bouton "📥 Importer les données" dans la section "Gestion des Données" pour restaurer une sauvegarde complète.' 
        };
    }
    
    // Détecter le format SÉLECTIF (partage d'aliments/repas)
    if (data.data && data.data.foods && data.data.meals) {
        if (typeof data.data.foods !== 'object' || typeof data.data.meals !== 'object') {
            return { valid: false, error: 'Format des aliments ou repas invalide' };
        }
        return { valid: true, type: 'selective' };
    }
    
    // Format non reconnu
    return { 
        valid: false, 
        error: 'Format de fichier non reconnu.\n\nAssurez-vous d\'importer un fichier exporté depuis cette application.' 
    };
}

/**
 * Compare si deux aliments sont identiques (mêmes valeurs nutritionnelles)
 * @param {Object} food1 - Premier aliment
 * @param {Object} food2 - Deuxième aliment
 * @returns {boolean}
 */
function isSameFood(food1, food2) {
    const tolerance = 0.1; // Tolérance de 0.1 pour les arrondis
    
    return Math.abs(food1.calories - food2.calories) <= tolerance &&
           Math.abs(food1.proteins - food2.proteins) <= tolerance &&
           Math.abs(food1.carbs - food2.carbs) <= tolerance &&
           Math.abs(food1.fats - food2.fats) <= tolerance;
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
        foodsMatched: 0,
        foodsRenamed: 0,
        mealsAdded: 0,
        mealsIgnored: 0,
        details: []
    };
    
    // Map pour suivre les changements d'ID d'aliments (oldId -> newId)
    const foodIdMapping = {};
    
    // ÉTAPE 1 : Importer les aliments (dépendances) avec gestion intelligente des conflits
    for (const [id, food] of Object.entries(importData.data.foods)) {
        if (!existingFoods[id]) {
            // Aliment n'existe pas → l'ajouter directement
            await db.saveFood(id, food);
            result.foodsAdded++;
            result.details.push({ type: 'food-added', name: food.name });
        } else {
            // Aliment existe déjà → vérifier s'il est identique
            if (isSameFood(existingFoods[id], food)) {
                // Valeurs identiques → utiliser l'existant
                result.foodsMatched++;
                result.details.push({ type: 'food-matched', name: food.name });
            } else {
                // Valeurs différentes → créer avec un nouveau ID pour éviter les conflits
                const newId = `${id}-imported-${Date.now()}`;
                const renamedFood = { ...food, name: `${food.name} (importé)` };
                await db.saveFood(newId, renamedFood);
                foodIdMapping[id] = newId; // Sauvegarder le mapping
                result.foodsRenamed++;
                result.details.push({ 
                    type: 'food-renamed', 
                    oldName: food.name, 
                    newName: renamedFood.name,
                    reason: 'Conflit détecté : valeurs nutritionnelles différentes'
                });
            }
        }
    }
    
    // ÉTAPE 2 : Mettre à jour les références dans les repas si nécessaire
    if (Object.keys(foodIdMapping).length > 0) {
        updateMealIngredients(importData.data.meals, foodIdMapping);
    }
    
    // ÉTAPE 3 : Importer les repas (maintenant toutes les dépendances existent)
    for (const [id, meal] of Object.entries(importData.data.meals)) {
        if (!existingMeals[id]) {
            await db.saveMeal(id, meal);
            result.mealsAdded++;
            result.details.push({ type: 'meal-added', name: meal.name });
        } else {
            // Repas existe déjà → ignorer
            result.mealsIgnored++;
            result.details.push({ type: 'meal-ignored', name: meal.name });
        }
    }
    
    return result;
}

/**
 * Met à jour les références des ingrédients dans les repas
 * @param {Object} meals - Repas à mettre à jour
 * @param {Object} idMapping - Map des changements d'ID (oldId -> newId)
 */
function updateMealIngredients(meals, idMapping) {
    Object.values(meals).forEach(meal => {
        if (meal.ingredients) {
            meal.ingredients.forEach(ingredient => {
                if (idMapping[ingredient.foodId]) {
                    ingredient.foodId = idMapping[ingredient.foodId];
                }
            });
        }
    });
}

// Flag pour éviter la réinitialisation multiple
let isExportImportInitialized = false;
let cachedFoodsData = {};
let cachedMealsData = {};

/**
 * Initialise l'interface d'import/export
 * @param {Object} foods - Aliments disponibles
 * @param {Object} meals - Repas disponibles
 */
export function initImportExport(foods, meals) {
    // Toujours mettre à jour les caches
    cachedFoodsData = foods;
    cachedMealsData = meals;
    
    // Initialiser seulement la première fois
    if (!isExportImportInitialized) {
        isExportImportInitialized = true;
        setupExportInterface();
        setupImportInterface();
    }
}

/**
 * Configure l'interface d'export
 */
function setupExportInterface() {
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
        populateExportList('foods', cachedFoodsData, cachedMealsData, cachedFoodsData);
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
                populateExportList('foods', cachedFoodsData, cachedMealsData, cachedFoodsData);
            } else {
                populateExportList('meals', cachedMealsData, cachedMealsData, cachedFoodsData);
            }
        });
    });
    
    // Tout sélectionner / Tout désélectionner
    const selectAllBtn = document.getElementById('selectAllExportBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.export-checkbox');
            
            // Vérifier qu'il y a bien des checkboxes
            if (checkboxes.length === 0) {
                console.warn('Aucune checkbox trouvée');
                return;
            }
            
            // Vérifier si toutes sont cochées
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            
            // Cocher/décocher toutes les checkboxes
            checkboxes.forEach(cb => {
                cb.checked = !allChecked;
            });
            
            // Mettre à jour le texte du bouton
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
            
            exportSelectedItems(selectedFoods, selectedMeals, cachedFoodsData, cachedMealsData);
            modal.classList.remove('show');
        });
    }
}

/**
 * Remplit la liste d'export
 */
function populateExportList(mode, items, meals, foods) {
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
        
        let dependenciesHtml = '';
        
        // Si c'est un repas, afficher les ingrédients qui seront auto-exportés
        if (mode === 'meals' && item.ingredients && item.ingredients.length > 0) {
            const ingredientNames = item.ingredients
                .map(ing => foods[ing.foodId]?.name)
                .filter(Boolean)
                .join(', ');
            
            const ingredientCount = item.ingredients.length;
            dependenciesHtml = `
                <div style="margin-left: 32px; margin-top: 4px; font-size: 0.85em; color: #666;">
                    📦 Inclura automatiquement ${ingredientCount} aliment(s) : ${ingredientNames}
                </div>
            `;
        }
        
        div.innerHTML = `
            <label style="display: block;">
                <input type="checkbox" class="export-checkbox" data-id="${id}" data-type="${type}">
                <span>${emoji} ${item.name}</span>
            </label>
            ${dependenciesHtml}
        `;
        
        container.appendChild(div);
    });
}

/**
 * Configure l'interface d'import
 */
function setupImportInterface() {
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
            const result = await importFromFile(file, cachedFoodsData, cachedMealsData);
            
            // Afficher les résultats détaillés
            let message = `✅ Import terminé !\n\n`;
            
            // Aliments
            if (result.foodsAdded > 0) {
                message += `📥 ${result.foodsAdded} aliment(s) ajouté(s)\n`;
            }
            if (result.foodsMatched > 0) {
                message += `✓ ${result.foodsMatched} aliment(s) correspondant(s) trouvé(s)\n`;
            }
            if (result.foodsRenamed > 0) {
                message += `🔄 ${result.foodsRenamed} aliment(s) renommé(s) (conflit détecté)\n`;
            }
            
            // Repas
            if (result.mealsAdded > 0) {
                message += `📥 ${result.mealsAdded} repas ajouté(s)\n`;
            }
            if (result.mealsIgnored > 0) {
                message += `⚠️ ${result.mealsIgnored} repas ignoré(s) (doublon)\n`;
            }
            
            // Message complémentaire
            if (result.foodsMatched > 0) {
                message += `\nℹ️ Les aliments correspondants ont été réutilisés`;
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
