// js/meals.js - Gestion des repas composés

import * as db from './db.js';

let mealsData = {};
let isInitialized = false;

/**
 * Initialise le module des repas
 * @param {object} foods - Dictionnaire des aliments disponibles
 */
export async function initMeals(foods) {
    if (isInitialized) return;
    isInitialized = true;
    
    // Charger les repas depuis la DB
    mealsData = await db.loadMeals();
    
    // Initialiser l'interface
    displayMealsList(mealsData, foods);
    setupEventListeners(foods);
}

/**
 * Calcule les valeurs nutritionnelles totales d'un repas
 * @param {array} ingredients - Liste des ingrédients [{foodId, weight}, ...]
 * @param {object} foods - Dictionnaire des aliments
 * @returns {object} - Valeurs nutritionnelles totales
 */
export function calculateMealNutrition(ingredients, foods) {
    const totals = {
        calories: 0,
        proteins: 0,
        carbs: 0,
        fats: 0,
        sugars: 0,
        fibers: 0
    };
    
    let totalPrice = 0;
    let hasPriceInfo = false;
    
    ingredients.forEach(ingredient => {
        const food = foods[ingredient.foodId];
        if (!food) return;
        
        const factor = ingredient.weight / 100;
        totals.calories += food.calories * factor;
        totals.proteins += food.proteins * factor;
        totals.carbs += food.carbs * factor;
        totals.fats += food.fats * factor;
        totals.sugars += (food.sugars || 0) * factor;
        totals.fibers += (food.fibers || 0) * factor;
        
        // Calculer le prix si disponible
        if (food.price && (food.priceQuantity || food.priceGrams)) {
            hasPriceInfo = true;
            let pricePer100g = 0;
            
            if (food.priceQuantity && food.priceUnit) {
                if (food.priceUnit === 'grams') {
                    pricePer100g = (food.price / food.priceQuantity) * 100;
                } else if (food.priceUnit === 'portions') {
                    const portionWeight = food.portionWeight || 100;
                    const totalGrams = food.priceQuantity * portionWeight;
                    pricePer100g = (food.price / totalGrams) * 100;
                }
            } else if (food.priceGrams) {
                // Ancien format
                pricePer100g = (food.price / food.priceGrams) * 100;
            }
            
            totalPrice += (pricePer100g / 100) * ingredient.weight;
        }
    });
    
    // Ajouter les infos de prix si disponibles
    if (hasPriceInfo) {
        totals.price = totalPrice;
        totals.priceQuantity = 100; // Prix pour 100g du repas
        totals.priceUnit = 'grams';
    }
    
    return totals;
}

/**
 * Affiche la liste des repas
 */
function displayMealsList(meals, foods) {
    const container = document.getElementById('mealsListContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const mealsArray = Object.entries(meals);
    if (mealsArray.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Aucun repas créé pour le moment</p>';
        return;
    }
    
    mealsArray.forEach(([id, meal]) => {
        const el = document.createElement('div');
        el.className = 'meal-item';
        el.dataset.mealId = id;
        
        // Utiliser les valeurs stockées (déjà calculées pour 100g si totalWeight défini)
        const ingredientsList = meal.ingredients.map(ing => {
            const food = foods[ing.foodId];
            return food ? `${food.name} (${ing.weight}g)` : '';
        }).filter(Boolean).join(', ');
        
        let priceInfo = '';
        if (meal.price) {
            priceInfo = ` | 💰 ${meal.price.toFixed(2)}€/100g`;
        }
        
        // Afficher le poids total si défini
        const weightInfo = meal.totalWeight ? ` (recette de ${meal.totalWeight}g)` : '';
        const nutritionLabel = meal.totalWeight ? 'pour 100g' : '';
        
        el.innerHTML = `
            <div class="meal-item-header">
                <div class="meal-name">
                    <span class="meal-badge">REPAS</span>
                    ${meal.name}${weightInfo}
                </div>
                <div class="meal-actions">
                    <button class="meal-duplicate-btn" data-meal-id="${id}" title="Dupliquer">📋</button>
                    <button class="meal-edit-btn" data-meal-id="${id}" title="Modifier">✏️</button>
                    <button class="meal-delete-btn" data-meal-id="${id}" title="Supprimer">🗑️</button>
                </div>
            </div>
            <div class="meal-details">
                <div class="meal-nutrition">
                    ${meal.calories.toFixed(0)} kcal | P: ${meal.proteins.toFixed(1)}g | G: ${meal.carbs.toFixed(1)}g | L: ${meal.fats.toFixed(1)}g${priceInfo} ${nutritionLabel}
                </div>
                <div class="meal-ingredients">
                    📝 ${ingredientsList}
                </div>
            </div>
        `;
        
        container.appendChild(el);
    });
    
    // Ajouter les event listeners
    document.querySelectorAll('.meal-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mealId = e.currentTarget.dataset.mealId;
            editMeal(mealId, meals, foods);
        });
    });
    
    document.querySelectorAll('.meal-duplicate-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mealId = e.currentTarget.dataset.mealId;
            duplicateMeal(mealId, meals, foods);
        });
    });
    
    document.querySelectorAll('.meal-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mealId = e.currentTarget.dataset.mealId;
            deleteMeal(mealId, meals, foods);
        });
    });
}

/**
 * Configure les event listeners
 */
function setupEventListeners(foods) {
    const createBtn = document.getElementById('createMealBtn');
    const form = document.getElementById('mealForm');
    const addIngredientBtn = document.getElementById('addIngredientBtn');
    const cancelBtn = document.getElementById('cancelMealBtn');
    
    if (createBtn) {
        createBtn.addEventListener('click', () => showMealForm(foods));
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideMealForm);
    }
    
    if (addIngredientBtn) {
        addIngredientBtn.addEventListener('click', () => addIngredientRow(foods));
    }
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveMealFromForm(foods);
        });
    }
    
    // Mettre à jour l'aperçu quand le poids total change
    const totalWeightInput = document.getElementById('mealTotalWeight');
    if (totalWeightInput) {
        totalWeightInput.addEventListener('input', () => updateMealPreview(foods));
    }
}

/**
 * Affiche le formulaire de création/édition
 */
function showMealForm(foods, meal = null) {
    const formSection = document.getElementById('mealFormSection');
    const ingredientsContainer = document.getElementById('mealIngredientsContainer');
    
    formSection.style.display = 'block';
    ingredientsContainer.innerHTML = '';
    
    // Pré-remplir si édition ou duplication
    if (meal) {
        document.getElementById('mealName').value = meal.name;
        document.getElementById('mealTotalWeight').value = meal.totalWeight || '';
        
        // Si meal.id existe, c'est une édition, sinon c'est une duplication
        if (meal.id) {
            document.getElementById('mealFormTitle').textContent = 'Modifier le repas';
            document.getElementById('mealForm').dataset.editId = meal.id;
        } else {
            document.getElementById('mealFormTitle').textContent = 'Créer un nouveau repas (copie)';
            document.getElementById('mealForm').dataset.editId = '';
        }
        
        meal.ingredients.forEach(ing => {
            addIngredientRow(foods, ing);
        });
    } else {
        document.getElementById('mealName').value = '';
        document.getElementById('mealTotalWeight').value = '';
        document.getElementById('mealFormTitle').textContent = 'Créer un nouveau repas';
        document.getElementById('mealForm').dataset.editId = '';
        addIngredientRow(foods); // Ajouter une ligne vide par défaut
    }
    
    updateMealPreview(foods);
    formSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Masque le formulaire
 */
function hideMealForm() {
    document.getElementById('mealFormSection').style.display = 'none';
    document.getElementById('mealForm').reset();
}

/**
 * Ajoute une ligne d'ingrédient
 */
function addIngredientRow(foods, ingredient = null) {
    const container = document.getElementById('mealIngredientsContainer');
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    
    const foodsOptions = Object.entries(foods).map(([id, food]) => {
        const selected = ingredient && ingredient.foodId === id ? 'selected' : '';
        return `<option value="${id}" ${selected}>${food.name}</option>`;
    }).join('');
    
    const weightValue = ingredient ? ingredient.weight : 100;
    
    row.innerHTML = `
        <select class="ingredient-select" required>
            <option value="">-- Sélectionner --</option>
            ${foodsOptions}
        </select>
        <input type="number" class="ingredient-weight" value="${weightValue}" min="1" step="1" placeholder="Poids (g)" required>
        <button type="button" class="remove-ingredient-btn" title="Retirer">❌</button>
    `;
    
    container.appendChild(row);
    
    // Event listeners
    row.querySelector('.remove-ingredient-btn').addEventListener('click', () => {
        row.remove();
        updateMealPreview(foods);
    });
    
    row.querySelector('.ingredient-select').addEventListener('change', () => updateMealPreview(foods));
    row.querySelector('.ingredient-weight').addEventListener('input', () => updateMealPreview(foods));
}

/**
 * Met à jour l'aperçu des valeurs nutritionnelles
 */
function updateMealPreview(foods) {
    const rows = document.querySelectorAll('.ingredient-row');
    const ingredients = [];
    
    rows.forEach(row => {
        const foodId = row.querySelector('.ingredient-select').value;
        const weight = parseFloat(row.querySelector('.ingredient-weight').value) || 0;
        
        if (foodId && weight > 0) {
            ingredients.push({ foodId, weight });
        }
    });
    
    let nutrition = calculateMealNutrition(ingredients, foods);
    const totalWeight = parseFloat(document.getElementById('mealTotalWeight').value) || null;
    
    // Si un poids total est renseigné, recalculer pour 100g
    let displayLabel = 'Totaux nutritionnels';
    if (totalWeight && totalWeight > 0) {
        const factor = 100 / totalWeight;
        nutrition = {
            calories: nutrition.calories * factor,
            proteins: nutrition.proteins * factor,
            carbs: nutrition.carbs * factor,
            fats: nutrition.fats * factor,
            sugars: nutrition.sugars * factor,
            fibers: nutrition.fibers * factor,
            price: nutrition.price ? nutrition.price * factor : undefined,
            priceQuantity: nutrition.price ? 100 : undefined,
            priceUnit: nutrition.price ? 'grams' : undefined
        };
        displayLabel = `Valeurs pour 100g (recette de ${totalWeight}g)`;
    }
    
    const preview = document.getElementById('mealNutritionPreview');
    if (preview) {
        let priceInfo = '';
        if (nutrition.price) {
            const priceLabel = totalWeight ? '/100g' : '';
            priceInfo = ` | 💰 ${nutrition.price.toFixed(2)}€${priceLabel}`;
        }
        
        preview.innerHTML = `
            <strong>${displayLabel} :</strong><br>
            ${nutrition.calories.toFixed(0)} kcal | 
            Protéines: ${nutrition.proteins.toFixed(1)}g | 
            Glucides: ${nutrition.carbs.toFixed(1)}g | 
            Lipides: ${nutrition.fats.toFixed(1)}g${priceInfo}
        `;
    }
}

/**
 * Sauvegarde le repas depuis le formulaire
 */
async function saveMealFromForm(foods) {
    const name = document.getElementById('mealName').value.trim();
    const editId = document.getElementById('mealForm').dataset.editId;
    
    if (!name) {
        alert('Veuillez entrer un nom pour le repas');
        return;
    }
    
    // Récupérer les ingrédients
    const rows = document.querySelectorAll('.ingredient-row');
    const ingredients = [];
    
    rows.forEach(row => {
        const foodId = row.querySelector('.ingredient-select').value;
        const weight = parseFloat(row.querySelector('.ingredient-weight').value) || 0;
        
        if (foodId && weight > 0) {
            ingredients.push({ foodId, weight });
        }
    });
    
    if (ingredients.length === 0) {
        alert('Veuillez ajouter au moins un ingrédient');
        return;
    }
    
    // Créer l'ID
    const id = editId || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Récupérer le poids total si renseigné
    const totalWeight = parseFloat(document.getElementById('mealTotalWeight').value) || null;
    
    // Calculer les valeurs nutritionnelles totales
    let nutrition = calculateMealNutrition(ingredients, foods);
    
    // Si un poids total est renseigné, recalculer pour 100g
    if (totalWeight && totalWeight > 0) {
        const factor = 100 / totalWeight;
        nutrition = {
            calories: nutrition.calories * factor,
            proteins: nutrition.proteins * factor,
            carbs: nutrition.carbs * factor,
            fats: nutrition.fats * factor,
            sugars: nutrition.sugars * factor,
            fibers: nutrition.fibers * factor,
            price: nutrition.price ? nutrition.price * factor : undefined,
            priceQuantity: nutrition.price ? 100 : undefined,
            priceUnit: nutrition.price ? 'grams' : undefined
        };
    }
    
    // Créer l'objet repas
    const meal = {
        name,
        ingredients,
        totalWeight, // Stocker le poids total pour référence
        ...nutrition
    };
    
    // Sauvegarder dans la DB
    await db.saveMeal(id, meal);
    mealsData[id] = meal;
    
    // Mettre à jour l'état global de l'app
    if (window.appState) {
        window.appState.meals[id] = meal;
    }
    
    // Rafraîchir l'affichage
    displayMealsList(mealsData, foods);
    hideMealForm();
    
    // Rafraîchir la liste d'aliments disponibles dans le Suivi Quotidien
    if (window.refreshAvailableFoods) {
        window.refreshAvailableFoods();
    }
    
    // Notification
    const message = editId ? 'Repas modifié !' : 'Repas créé !';
    showNotification(message);
}

/**
 * Édite un repas existant
 */
function editMeal(mealId, meals, foods) {
    const meal = meals[mealId];
    if (!meal) return;
    
    showMealForm(foods, { ...meal, id: mealId });
}

/**
 * Duplique un repas existant
 */
function duplicateMeal(mealId, meals, foods) {
    const meal = meals[mealId];
    if (!meal) return;
    
    // Créer une copie du repas avec un nouveau nom
    const duplicatedMeal = {
        ...meal,
        name: `${meal.name} - Copie`
    };
    
    // Ouvrir le formulaire en mode création (sans id)
    // L'utilisateur pourra modifier le nom et les ingrédients avant de sauvegarder
    showMealForm(foods, duplicatedMeal);
}

/**
 * Supprime un repas
 */
async function deleteMeal(mealId, meals, foods) {
    const meal = meals[mealId];
    if (!meal) return;
    
    if (!confirm(`Voulez-vous vraiment supprimer le repas "${meal.name}" ?`)) {
        return;
    }
    
    await db.deleteMeal(mealId);
    delete mealsData[mealId];
    
    // Mettre à jour l'état global
    if (window.appState) {
        delete window.appState.meals[mealId];
    }
    
    displayMealsList(mealsData, foods);
    
    // Rafraîchir la liste d'aliments disponibles
    if (window.refreshAvailableFoods) {
        window.refreshAvailableFoods();
    }
    
    showNotification('Repas supprimé !');
}

/**
 * Affiche une notification
 */
function showNotification(message) {
    // Utilise la fonction de notification existante si disponible
    if (window.showNotification) {
        window.showNotification(message);
    } else {
        alert(message);
    }
}

/**
 * Retourne les données des repas
 */
export function getMealsData() {
    return mealsData;
}

/**
 * Recharge les repas depuis la DB
 */
export async function reloadMeals() {
    mealsData = await db.loadMeals();
    return mealsData;
}
