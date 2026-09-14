// js/handlers/food-handlers.js
// Handlers pour la gestion des aliments : CRUD, recherche, filtres, portions ajustables.

import state from '../core/state.js';
import * as db from '../core/db.js';
import * as ui from '../ui/ui-core.js';
import * as utils from '../core/utils.js';
import * as aiFood from '../features/ai-food-assistant.js';

// Référence à la fonction loadCurrentDay (injectée depuis app.js)
let _loadCurrentDay = null;
let _handleDragStart = null;
let _handleQuickAdd = null;
let _handleEditFoodClick = null;
let _handleDeleteFoodClick = null;

/**
 * Injecte les dépendances circulaires depuis app.js.
 */
export function initFoodHandlers({ loadCurrentDay, handleDragStart, handleQuickAdd, editFoodClick, deleteFoodClick }) {
    _loadCurrentDay = loadCurrentDay;
    _handleDragStart = handleDragStart;
    _handleQuickAdd = handleQuickAdd;
    _handleEditFoodClick = editFoodClick;
    _handleDeleteFoodClick = deleteFoodClick;
}

export function refreshAvailableFoods() {
    ui.displayFoods(state.foods, _handleDragStart, _handleQuickAdd, state.displayedFoodsCount, state.meals, state.selectedCategory);
}

export function updateCategoryCounts() {
    const categories = ['all', 'meals', 'proteins', 'vegetables', 'starches', 'fruits', 'dairy', 'fats', 'beverages', 'snacks', 'condiments', 'sauces', 'other'];
    const counts = { all: Object.keys(state.foods).length, meals: Object.keys(state.meals).length, proteins: 0, vegetables: 0, starches: 0, fruits: 0, dairy: 0, fats: 0, beverages: 0, snacks: 0, condiments: 0, sauces: 0, other: 0 };

    Object.values(state.foods).forEach(food => {
        const category = food.category || 'other';
        if (counts.hasOwnProperty(category)) counts[category]++;
        else counts.other++;
    });

    categories.forEach(category => {
        const badge = document.querySelector(`[data-count="${category}"]`);
        if (badge) badge.textContent = counts[category];
    });

    const categoriesManage = ['all', 'proteins', 'vegetables', 'starches', 'fruits', 'dairy', 'fats', 'beverages', 'snacks', 'condiments', 'sauces', 'other'];
    categoriesManage.forEach(category => {
        const badge = document.querySelector(`[data-count-manage="${category}"]`);
        if (badge) badge.textContent = counts[category];
    });
}

function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (!input || value === undefined || value === null) return;
    input.value = value;
}

function roundNutritionValue(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Number(number.toFixed(1));
}

function adaptNutritionToSelectedInputMode(data) {
    const nutritionType = document.querySelector('input[name="foodNutritionType"]:checked')?.value || 'per100g';
    if (nutritionType !== 'perPortion') return { ...data, fillMode: 'per100g' };

    const portionWeight = parseFloat(document.getElementById('foodPortionWeight')?.value);
    if (!Number.isFinite(portionWeight) || portionWeight <= 0) {
        throw new Error('Indique le poids de la portion avant de remplir les valeurs en mode "1 portion".');
    }

    const ratio = portionWeight / 100;
    return {
        ...data,
        calories: roundNutritionValue(data.calories * ratio),
        proteins: roundNutritionValue(data.proteins * ratio),
        carbs: roundNutritionValue(data.carbs * ratio),
        sugars: roundNutritionValue(data.sugars * ratio),
        fibers: roundNutritionValue(data.fibers * ratio),
        fats: roundNutritionValue(data.fats * ratio),
        fillMode: 'perPortion',
        portionWeight
    };
}

function fillFoodForm(foodData) {
    const normalizedData = aiFood.normalizeFoodData(foodData);
    if (!normalizedData.name) throw new Error('Aucun nom détecté.');
    const data = adaptNutritionToSelectedInputMode(normalizedData);

    if (typeof window.updateNutritionLabels === 'function') window.updateNutritionLabels('food');

    setInputValue('foodName', data.name);
    setInputValue('foodCategory', data.category);
    setInputValue('foodCalories', data.calories);
    setInputValue('foodProteins', data.proteins);
    setInputValue('foodCarbs', data.carbs);
    setInputValue('foodSugars', data.sugars);
    setInputValue('foodFibers', data.fibers);
    setInputValue('foodFats', data.fats);
    setInputValue('foodGlycemicIndex', data.glycemicIndex);
    if (data.price !== null && data.priceQuantity !== null) {
        setInputValue('foodPrice', data.price);
        setInputValue('foodPriceQuantity', data.priceQuantity);
        const priceRadio = document.querySelector(`input[name="foodPriceType"][value="${data.priceUnit}"]`);
        if (priceRadio) priceRadio.checked = true;
        if (typeof window.updatePriceLabel === 'function') window.updatePriceLabel('food');
    }

    return data;
}

function setFoodAIStatus(message, type = 'info') {
    const status = document.getElementById('aiFoodStatus');
    if (!status) return;
    status.className = `ai-status ai-status--${type}`;
    status.textContent = message;
    status.style.display = 'block';
}

function renderFoodCandidates(candidates) {
    const container = document.getElementById('aiFoodCandidates');
    if (!container) return;
    container.innerHTML = '';
    candidates.forEach((candidate, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ai-food-candidate';
        button.textContent = candidate.label || candidate.title || `Résultat ${index + 1}`;
        button.addEventListener('click', () => {
            const filledData = candidate.data ? fillFoodForm(candidate.data) : null;
            if (candidate.url) window.open(candidate.url, '_blank', 'noopener');
            const modeText = filledData?.fillMode === 'perPortion'
                ? ` Valeurs adaptées pour ${filledData.portionWeight}g.`
                : '';
            setFoodAIStatus(`Résultat "${button.textContent}" sélectionné.${modeText}`, 'info');
        });
        if (index === 0) button.classList.add('primary');
        container.appendChild(button);
    });
}

async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export async function handleAIFoodWebSearch() {
    const query = document.getElementById('aiFoodQuery')?.value?.trim();
    if (!query) {
        ui.showNotification('Indique le nom du produit à chercher.', 'error');
        return;
    }

    const button = document.getElementById('aiFoodSearchBtn');
    if (button) { button.disabled = true; button.textContent = 'Recherche...'; }
    const preference = aiFood.getFoodSearchPreference();
    const priorityLabel = preference.enabled && preference.retailers.length
        ? ` Priorité: ${preference.retailers.join(' > ')}.`
        : '';
    setFoodAIStatus(`Recherche internet Brave + extraction DeepSeek en cours...${priorityLabel}`, 'loading');

    try {
        const { foodData, results } = await aiFood.extractFoodFromInternetSearch(query);
        renderFoodCandidates(results);
        const filledData = fillFoodForm(foodData);
        const modeText = filledData.fillMode === 'perPortion'
            ? ` Valeurs adaptées pour ${filledData.portionWeight}g.`
            : ' Valeurs pour 100g.';
        setFoodAIStatus(`${results.length} résultat(s) web trouvé(s). Les champs ont été remplis, IG compris.${modeText}`, 'info');
    } catch (error) {
        setFoodAIStatus(error.message, 'error');
    } finally {
        if (button) { button.disabled = false; button.textContent = 'Rechercher web'; }
    }
}

export async function handleAIFoodAnalyze() {
    const query = document.getElementById('aiFoodQuery')?.value?.trim() || '';
    const file = document.getElementById('aiFoodImage')?.files?.[0] || null;
    if (!query && !file) {
        ui.showNotification('Ajoute une image ou un texte à analyser.', 'error');
        return;
    }

    const button = document.getElementById('aiFoodAnalyzeBtn');
    if (button) { button.disabled = true; button.textContent = 'Analyse...'; }
    setFoodAIStatus(file ? 'Lecture OCR de la capture puis analyse IA...' : 'Analyse IA en cours...', 'loading');

    try {
        const imageDataUrl = file ? await fileToDataUrl(file) : null;
        const result = await aiFood.analyzeTextOrImage({ query, imageDataUrl });
        const filledData = fillFoodForm(result);
        const modeText = filledData.fillMode === 'perPortion'
            ? ` Valeurs adaptées pour ${filledData.portionWeight}g.`
            : ' Valeurs pour 100g.';
        setFoodAIStatus(`Champs du formulaire remplis par l’IA.${modeText}`, 'info');
    } catch (error) {
        setFoodAIStatus(error.message, 'error');
    } finally {
        if (button) { button.disabled = false; button.textContent = 'Analyser image/texte'; }
    }
}

export function handleFoodSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const loadMoreBtn = document.getElementById('loadMoreFoodsBtn');

    if (searchTerm) {
        ui.displayFoods(state.foods, _handleDragStart, _handleQuickAdd, 0, state.meals, state.selectedCategory);
        const foodItems = document.querySelectorAll('.food-item');
        const noResultsMsg = document.getElementById('noResultsMessage');
        let visibleCount = 0;
        foodItems.forEach(item => {
            const foodName = item.dataset.foodName?.toLowerCase() || '';
            if (foodName.includes(searchTerm)) { item.classList.remove('hidden'); visibleCount++; }
            else { item.classList.add('hidden'); }
        });
        if (noResultsMsg) noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    } else {
        ui.displayFoods(state.foods, _handleDragStart, _handleQuickAdd, state.displayedFoodsCount, state.meals, state.selectedCategory);
        const noResultsMsg = document.getElementById('noResultsMessage');
        if (noResultsMsg) noResultsMsg.style.display = 'none';
    }
}

export function handleCategoryFilter(event) {
    const button = event.target.closest('.category-filter-btn');
    if (!button) return;
    const category = button.dataset.category;
    state.selectedCategory = category;
    document.querySelectorAll('.category-filter-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    const searchInput = document.getElementById('foodSearch');
    if (searchInput.value) handleFoodSearch({ target: searchInput });
    else ui.displayFoods(state.foods, _handleDragStart, _handleQuickAdd, state.displayedFoodsCount, state.meals, category);
}

export function handleCategoryFilterManage(event) {
    const button = event.currentTarget;
    if (!button) return;
    const category = button.dataset.categoryManage;
    state.selectedCategoryManage = category;
    document.querySelectorAll('.category-filter-btn-manage').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    const searchTerm = document.getElementById('foodSearchManage').value.trim().toLowerCase();
    if (searchTerm) handleFoodSearchManage();
    else ui.displayFoodsManage(state.foods, _handleEditFoodClick, _handleDeleteFoodClick, state.selectedCategoryManage);
}

export function handleLoadMoreFoods() {
    state.displayedFoodsCount += state.maxFoodsPerLoad;
    ui.displayFoods(state.foods, _handleDragStart, _handleQuickAdd, state.displayedFoodsCount, state.meals, state.selectedCategory);
}

export function handleFoodSearchManage(event) {
    const searchTerm = (event?.target?.value || document.getElementById('foodSearchManage').value).toLowerCase();
    const foodItems = document.querySelectorAll('#foodsListManage .food-item');
    const noResultsMsg = document.getElementById('noResultsMessageManage');
    let visibleCount = 0;
    foodItems.forEach(item => {
        const foodName = item.dataset.foodName?.toLowerCase() || '';
        if (foodName.includes(searchTerm)) { item.classList.remove('hidden'); visibleCount++; }
        else { item.classList.add('hidden'); }
    });
    if (noResultsMsg) noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
}

export async function handleAddFood(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector('#foodName').value;
    if (!name) return;
    const id = utils.generateFoodId(name);
    if (state.foods[id]) { ui.showNotification(`L'aliment "${name}" existe déjà.`, 'error'); return; }
    const category = form.querySelector('#foodCategory').value || 'other';
    const price = parseFloat(form.querySelector('#foodPrice').value);
    const priceQuantity = parseFloat(form.querySelector('#foodPriceQuantity').value);
    const priceUnit = form.querySelector('input[name="foodPriceType"]:checked')?.value || 'grams';
    const nutritionType = form.querySelector('input[name="foodNutritionType"]:checked')?.value || 'per100g';
    const portionWeight = parseFloat(form.querySelector('#foodPortionWeight')?.value) || null;
    const glycemicIndexValue = parseFloat(form.querySelector('#foodGlycemicIndex')?.value);

    let calories = parseFloat(form.querySelector('#foodCalories').value) || 0;
    let proteins = parseFloat(form.querySelector('#foodProteins').value) || 0;
    let carbs = parseFloat(form.querySelector('#foodCarbs').value) || 0;
    let sugars = parseFloat(form.querySelector('#foodSugars').value) || 0;
    let fibers = parseFloat(form.querySelector('#foodFibers').value) || 0;
    let fats = parseFloat(form.querySelector('#foodFats').value) || 0;

    if (nutritionType === 'perPortion' && portionWeight && portionWeight > 0) {
        const ratio = 100 / portionWeight;
        calories *= ratio; proteins *= ratio; carbs *= ratio; sugars *= ratio; fibers *= ratio; fats *= ratio;
    }

    const newFood = { name, calories, proteins, carbs, sugars, fibers, fats, category, isPortionBased: nutritionType === 'perPortion', portionWeight: nutritionType === 'perPortion' ? portionWeight : null };
    if (!isNaN(glycemicIndexValue)) {
        newFood.glycemicIndex = Math.min(Math.max(glycemicIndexValue, 0), 100);
        newFood.glycemicLoad = (newFood.glycemicIndex * carbs) / 100;
    }
    if (price && priceQuantity && price > 0 && priceQuantity > 0) {
        newFood.price = price; newFood.priceQuantity = priceQuantity; newFood.priceUnit = priceUnit;
    }
    await db.saveFood(id, newFood);
    state.foods[id] = newFood;
    ui.displayFoods(state.foods, _handleDragStart, _handleQuickAdd, state.displayedFoodsCount, state.meals, state.selectedCategory);
    ui.displayFoodsManage(state.foods, _handleEditFoodClick, _handleDeleteFoodClick, state.selectedCategoryManage);
    updateCategoryCounts();
    form.reset();
    ui.showNotification(`${name} ajouté avec succès !`);
}

export function handleEditFoodClick(event) {
    const foodId = event.currentTarget.dataset.foodId;
    const foodData = state.foods[foodId];
    if (foodData) ui.openEditModal(foodId, foodData);
}

export async function handleDeleteFoodClick(event) {
    const foodId = event.currentTarget.dataset.foodId;
    const foodName = event.currentTarget.dataset.foodName;
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer "${foodName}" ?\n\nCette action est irréversible.`)) return;
    try {
        await db.deleteFood(foodId);
        delete state.foods[foodId];
        ui.displayFoods(state.foods, _handleDragStart, _handleQuickAdd, state.displayedFoodsCount, state.meals, state.selectedCategory);
        ui.displayFoodsManage(state.foods, _handleEditFoodClick, _handleDeleteFoodClick, state.selectedCategoryManage);
        updateCategoryCounts();
        await _loadCurrentDay();
        ui.showNotification(`✅ "${foodName}" a été supprimé avec succès !`);
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        ui.showNotification(`❌ Erreur lors de la suppression de "${foodName}"`, 'error');
    }
}

export async function handleUpdateFood(event) {
    event.preventDefault();
    const form = event.target;
    const oldId = form.querySelector('#editFoodId').value;
    const previousFoodData = state.foods[oldId] || {};
    const newName = form.querySelector('#editFoodName').value;
    const newId = utils.generateFoodId(newName);
    const category = form.querySelector('#editFoodCategory').value || 'other';
    const price = parseFloat(form.querySelector('#editFoodPrice').value);
    const priceQuantity = parseFloat(form.querySelector('#editFoodPriceQuantity').value);
    const priceUnit = form.querySelector('input[name="editFoodPriceType"]:checked')?.value || 'grams';
    const nutritionType = form.querySelector('input[name="editFoodNutritionType"]:checked')?.value || 'per100g';
    const portionWeight = parseFloat(form.querySelector('#editFoodPortionWeight')?.value) || null;
    const glycemicIndexValue = parseFloat(form.querySelector('#editFoodGlycemicIndex')?.value);

    let calories = parseFloat(form.querySelector('#editFoodCalories').value) || 0;
    let proteins = parseFloat(form.querySelector('#editFoodProteins').value) || 0;
    let carbs = parseFloat(form.querySelector('#editFoodCarbs').value) || 0;
    let sugars = parseFloat(form.querySelector('#editFoodSugars').value) || 0;
    let fibers = parseFloat(form.querySelector('#editFoodFibers').value) || 0;
    let fats = parseFloat(form.querySelector('#editFoodFats').value) || 0;

    if (nutritionType === 'perPortion' && portionWeight && portionWeight > 0) {
        const ratio = 100 / portionWeight;
        calories *= ratio; proteins *= ratio; carbs *= ratio; sugars *= ratio; fibers *= ratio; fats *= ratio;
    }

    const updatedFoodData = { name: newName, calories, proteins, carbs, sugars, fibers, fats, category, isPortionBased: nutritionType === 'perPortion', portionWeight: nutritionType === 'perPortion' ? portionWeight : null };
    if (!isNaN(glycemicIndexValue)) {
        updatedFoodData.glycemicIndex = Math.min(Math.max(glycemicIndexValue, 0), 100);
        updatedFoodData.glycemicLoad = (updatedFoodData.glycemicIndex * carbs) / 100;
    }
    if (price && priceQuantity && price > 0 && priceQuantity > 0) {
        updatedFoodData.price = price; updatedFoodData.priceQuantity = priceQuantity; updatedFoodData.priceUnit = priceUnit;
    } else if (
        previousFoodData.price &&
        (previousFoodData.priceQuantity || previousFoodData.priceGrams) &&
        form.querySelector('#editFoodPrice').value.trim() === '' &&
        form.querySelector('#editFoodPriceQuantity').value.trim() === ''
    ) {
        updatedFoodData.price = previousFoodData.price;
        if (previousFoodData.priceQuantity) updatedFoodData.priceQuantity = previousFoodData.priceQuantity;
        if (previousFoodData.priceGrams) updatedFoodData.priceGrams = previousFoodData.priceGrams;
        updatedFoodData.priceUnit = previousFoodData.priceUnit || 'grams';
    }

    if (oldId === newId) {
        await db.saveFood(oldId, updatedFoodData);
        state.foods[oldId] = updatedFoodData;
    } else {
        if (state.foods[newId]) { ui.showNotification(`Un aliment nommé "${newName}" existe déjà.`, 'error'); return; }
        await db.replaceFoodId(oldId, newId, updatedFoodData);
        delete state.foods[oldId];
        state.foods[newId] = updatedFoodData;
    }

    ui.displayFoods(state.foods, _handleDragStart, _handleQuickAdd, state.displayedFoodsCount, state.meals, state.selectedCategory);
    ui.displayFoodsManage(state.foods, _handleEditFoodClick, _handleDeleteFoodClick, state.selectedCategoryManage);
    updateCategoryCounts();
    await _loadCurrentDay();
    ui.closeEditModal();
    ui.showNotification(`"${updatedFoodData.name}" mis à jour avec succès !`);
}

// --- AJUSTEMENT DES PORTIONS ---
let currentAdjustment = null;

export function handleAdjustPortions(mealType, uniqueId, mealId, customPortions, customPrice) {
    const meal = state.meals[mealId];
    if (!meal || !meal.isPortionAdjustable) return;

    currentAdjustment = { mealType, uniqueId, mealId, meal };

    document.getElementById('adjustPortionsMealName').textContent = meal.name;
    const container = document.getElementById('adjustPortionsContainer');
    container.innerHTML = '';

    meal.ingredients.forEach(ing => {
        const food = state.foods[ing.foodId];
        if (!food) return;
        const currentWeight = (customPortions && customPortions.hasOwnProperty(ing.foodId)) ? customPortions[ing.foodId] : ing.weight;
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 12px; background: #f8f9fa; border-radius: 8px;';
        row.dataset.foodId = ing.foodId;
        row.innerHTML = `<span style="flex: 1; font-weight: 500;">${food.name}</span><input type="number" class="portion-input" value="${currentWeight}" min="0" step="1" style="width: 80px; padding: 8px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 1em;"><span style="font-weight: 600; color: #666;">g</span>`;
        row.querySelector('.portion-input').addEventListener('input', updateAdjustmentPreview);
        container.appendChild(row);
    });

    const customPriceCheckbox = document.getElementById('customPriceCheckbox');
    const customPriceInput = document.getElementById('customPriceInput');
    if (customPrice !== undefined && customPrice !== null) {
        customPriceCheckbox.checked = true; customPriceInput.disabled = false; customPriceInput.value = customPrice.toFixed(2);
    } else {
        customPriceCheckbox.checked = false; customPriceInput.disabled = true; customPriceInput.value = '';
    }
    updateAdjustmentPreview();
    ui.showModal('adjustPortionsModal');
}

export function updateAdjustmentPreview() {
    const rows = document.querySelectorAll('#adjustPortionsContainer > div');
    let totals = { calories: 0, proteins: 0, carbs: 0, fats: 0, fibers: 0, sugars: 0, cost: 0 };
    let hasCost = false;

    rows.forEach(row => {
        const foodId = row.dataset.foodId;
        const weight = parseFloat(row.querySelector('.portion-input').value) || 0;
        const food = state.foods[foodId];
        if (food && weight > 0) {
            totals.calories += ((Number(food.calories) || 0) * weight / 100);
            totals.proteins += ((Number(food.proteins) || 0) * weight / 100);
            totals.carbs += ((Number(food.carbs) || 0) * weight / 100);
            totals.fats += ((Number(food.fats) || 0) * weight / 100);
            totals.fibers += ((Number(food.fibers) || 0) * weight / 100);
            totals.sugars += ((Number(food.sugars) || 0) * weight / 100);
            if (food.price && (food.priceQuantity || food.priceGrams)) {
                let pricePer100g;
                if (food.priceQuantity && food.priceUnit) {
                    if (food.priceUnit === 'grams') pricePer100g = (food.price / food.priceQuantity) * 100;
                    else if (food.priceUnit === 'portions') { const pw = food.portionWeight || 100; pricePer100g = (food.price / (food.priceQuantity * pw)) * 100; }
                } else if (food.priceGrams) pricePer100g = (food.price / food.priceGrams) * 100;
                if (pricePer100g) { totals.cost += (pricePer100g / 100) * weight; hasCost = true; }
            }
        }
    });

    document.getElementById('adjustCal').textContent = totals.calories.toFixed(0);
    document.getElementById('adjustProt').textContent = totals.proteins.toFixed(1);
    document.getElementById('adjustCarbs').textContent = totals.carbs.toFixed(1);
    document.getElementById('adjustFat').textContent = totals.fats.toFixed(1);
    document.getElementById('adjustFib').textContent = totals.fibers.toFixed(1);
    document.getElementById('adjustSug').textContent = totals.sugars.toFixed(1);

    const costSection = document.getElementById('adjustCostSection');
    const customPriceCheckbox = document.getElementById('customPriceCheckbox');
    const customPriceInput = document.getElementById('customPriceInput');
    if (hasCost) {
        if (customPriceCheckbox.checked) {
            const cp = parseFloat(customPriceInput.value);
            document.getElementById('adjustCost').textContent = (!isNaN(cp) && cp >= 0) ? cp.toFixed(2) : totals.cost.toFixed(2);
        } else { document.getElementById('adjustCost').textContent = totals.cost.toFixed(2); }
        costSection.style.display = 'block';
    } else { costSection.style.display = 'none'; }
}

export function closeAdjustPortionsModal() {
    ui.hideModal('adjustPortionsModal');
    currentAdjustment = null;
}

export async function saveAdjustedPortions() {
    if (!currentAdjustment) return;
    const { mealType, uniqueId } = currentAdjustment;
    const rows = document.querySelectorAll('#adjustPortionsContainer > div');
    const customPortions = {};
    rows.forEach(row => { customPortions[row.dataset.foodId] = parseFloat(row.querySelector('.portion-input').value) || 0; });

    const customPriceCheckbox = document.getElementById('customPriceCheckbox');
    const customPriceInput = document.getElementById('customPriceInput');
    let customPrice = null;
    if (customPriceCheckbox.checked) {
        const priceValue = parseFloat(customPriceInput.value);
        if (!isNaN(priceValue) && priceValue >= 0) customPrice = priceValue;
    }

    const meals = await db.loadDayMeals(state.currentDate);
    const mealItems = meals[mealType];
    const itemIndex = mealItems.findIndex(item => String(item.uniqueId) === String(uniqueId));
    if (itemIndex !== -1) {
        mealItems[itemIndex].customPortions = customPortions;
        if (customPrice !== null) mealItems[itemIndex].customPrice = customPrice;
        else delete mealItems[itemIndex].customPrice;
        await db.saveDayMeals(state.currentDate, meals);
        _loadCurrentDay();
        ui.showNotification('✅ Portions ajustées avec succès !');
    }
    closeAdjustPortionsModal();
}
