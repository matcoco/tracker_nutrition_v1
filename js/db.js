// js/db.js

import { DB_NAME, DB_VERSION } from './config.js';
import { formatDateKey, calculateDayTotals } from './utils.js';

let db;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject(request.error);
        request.onsuccess = (event) => { db = event.target.result; resolve(db); };
        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains('foods')) dbInstance.createObjectStore('foods', { keyPath: 'id' });
            if (!dbInstance.objectStoreNames.contains('meals')) dbInstance.createObjectStore('meals', { keyPath: 'id' });
            if (!dbInstance.objectStoreNames.contains('dailyMeals')) dbInstance.createObjectStore('dailyMeals', { keyPath: 'date' });
            if (!dbInstance.objectStoreNames.contains('goals')) dbInstance.createObjectStore('goals', { keyPath: 'id' });
            if (!dbInstance.objectStoreNames.contains('dailyWater')) dbInstance.createObjectStore('dailyWater', { keyPath: 'date' });
            if (!dbInstance.objectStoreNames.contains('dailySteps')) dbInstance.createObjectStore('dailySteps', { keyPath: 'date' });
            if (!dbInstance.objectStoreNames.contains('dailyActivities')) dbInstance.createObjectStore('dailyActivities', { keyPath: 'date' });
            if (!dbInstance.objectStoreNames.contains('customActivities')) dbInstance.createObjectStore('customActivities', { keyPath: 'id', autoIncrement: true });
        };
    });
}

export function saveFood(id, food) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['foods'], 'readwrite');
        const store = transaction.objectStore('foods');
        const request = store.put({ id, ...food });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function loadFoods() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['foods'], 'readonly');
        const request = transaction.objectStore('foods').getAll();
        request.onsuccess = () => {
            const foodsObject = {};
            request.result.forEach(foodItem => {
                const { id, ...data } = foodItem;
                foodsObject[id] = data;
            });
            resolve(foodsObject);
        };
        request.onerror = () => reject(request.error);
    });
}

export function saveDayMeals(date, meals, weight = null) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readwrite');
        const store = transaction.objectStore('dailyMeals');
        const dateKey = formatDateKey(date);
        const getRequest = store.get(dateKey);
        
        getRequest.onsuccess = () => {
            const existingData = getRequest.result || { date: dateKey };
            const data = {
                date: dateKey,
                meals: meals,
                // Préserver le poids existant si on n'en fournit pas un nouveau
                weight: weight !== null ? weight : (existingData.weight || null)
            };
            const putRequest = store.put(data);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export function loadDayMeals(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readonly');
        const request = transaction.objectStore('dailyMeals').get(formatDateKey(date));
        request.onsuccess = () => {
            const defaultMeals = { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] };
            resolve(request.result ? request.result.meals : defaultMeals);
        };
        request.onerror = () => reject(request.error);
    });
}

export function saveDayWeight(date, weight) {
    return new Promise(async (resolve, reject) => {
        try {
            const transaction = db.transaction(['dailyMeals'], 'readwrite');
            const store = transaction.objectStore('dailyMeals');
            const dateKey = formatDateKey(date);
            const getRequest = store.get(dateKey);
            
            getRequest.onsuccess = () => {
                const data = getRequest.result || { date: dateKey, meals: { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] } };
                data.weight = weight;
                const putRequest = store.put(data);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        } catch (error) {
            reject(error);
        }
    });
}

export function loadDayWeight(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readonly');
        const request = transaction.objectStore('dailyMeals').get(formatDateKey(date));
        request.onsuccess = () => {
            resolve(request.result && request.result.weight ? request.result.weight : null);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function loadPeriodMeals(days, foods) {
    const data = [];
    const endDate = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const targetDate = new Date(endDate);
        targetDate.setDate(targetDate.getDate() - i);
        const meals = await loadDayMeals(targetDate);
        const weight = await loadDayWeight(targetDate);
        const dayTotals = calculateDayTotals(meals, foods);
        data.push({ date: formatDateKey(targetDate), weight, ...dayTotals });
    }
    return data;
}

export function getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const request = transaction.objectStore(storeName).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function bulkPut(storeName, data) {
    return new Promise((resolve, reject) => {
        if (data.length === 0) return resolve();
        const transaction = db.transaction([storeName], 'readwrite');
        let completed = 0;
        data.forEach(item => {
            const request = transaction.objectStore(storeName).put(item);
            request.onsuccess = () => {
                if (++completed === data.length) resolve();
            };
        });
        transaction.onerror = () => reject(transaction.error);
    });
}

/**
 * Remplace un ID d'aliment par un nouveau partout dans la base de données.
 * Cette opération est atomique : soit tout réussit, soit tout est annulé.
 * @param {string} oldId - L'ID actuel de l'aliment.
 * @param {string} newId - Le nouvel ID à utiliser.
 * @param {object} newFoodData - L'objet complet du nouvel aliment (sans son ID).
 * @returns {Promise<void>}
 */
export function replaceFoodId(oldId, newId, newFoodData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['foods', 'dailyMeals'], 'readwrite');
        const foodsStore = transaction.objectStore('foods');
        const mealsStore = transaction.objectStore('dailyMeals');

        transaction.onerror = (event) => reject(event.target.error);
        transaction.oncomplete = () => resolve();

        foodsStore.delete(oldId);
        foodsStore.put({ id: newId, ...newFoodData });

        const cursorRequest = mealsStore.openCursor();
        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const dayData = cursor.value;
                let dayWasModified = false;
                for (const mealType in dayData.meals) {
                    dayData.meals[mealType].forEach(item => {
                        if (item.id === oldId) {
                            item.id = newId;
                            dayWasModified = true;
                        }
                    });
                }
                if (dayWasModified) {
                    cursor.update(dayData);
                }
                cursor.continue();
            }
        };
    });
}

/**
 * Supprime un aliment de la base de données.
 * @param {string} foodId - L'ID de l'aliment à supprimer.
 * @returns {Promise<void>}
 */
export function deleteFood(foodId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['foods'], 'readwrite');
        const store = transaction.objectStore('foods');
        const request = store.delete(foodId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==================== REPAS COMPOSÉS ====================

/**
 * Sauvegarde un repas composé.
 * @param {string} id - L'ID du repas.
 * @param {object} meal - Les données du repas.
 * @returns {Promise<void>}
 */
export function saveMeal(id, meal) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['meals'], 'readwrite');
        const store = transaction.objectStore('meals');
        const request = store.put({ id, ...meal });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Charge tous les repas composés.
 * @returns {Promise<object>} - Dictionnaire des repas.
 */
export function loadMeals() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['meals'], 'readonly');
        const request = transaction.objectStore('meals').getAll();
        request.onsuccess = () => {
            const mealsObject = {};
            request.result.forEach(mealItem => {
                const { id, ...data } = mealItem;
                mealsObject[id] = data;
            });
            resolve(mealsObject);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Supprime un repas composé.
 * @param {string} mealId - L'ID du repas à supprimer.
 * @returns {Promise<void>}
 */
export function deleteMeal(mealId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['meals'], 'readwrite');
        const store = transaction.objectStore('meals');
        const request = store.delete(mealId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==================== OBJECTIFS ====================

/**
 * Sauvegarde les objectifs nutritionnels.
 * @param {object} goals - Les objectifs (calories, proteins, carbs, fats).
 * @returns {Promise<void>}
 */
export function saveGoals(goals) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['goals'], 'readwrite');
        const store = transaction.objectStore('goals');
        const request = store.put({ id: 'current', ...goals });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Charge les objectifs nutritionnels.
 * @returns {Promise<object|null>} Les objectifs ou null s'ils n'existent pas.
 */
export function loadGoals() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['goals'], 'readonly');
        const request = transaction.objectStore('goals').get('current');
        request.onsuccess = () => {
            if (request.result) {
                const { id, ...goalsData } = request.result;
                resolve(goalsData);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// =================== HYDRATATION ===================

export function saveDayWater(date, waterData) {
    return new Promise((resolve, reject) => {
        const dateKey = formatDateKey(date);
        const transaction = db.transaction(['dailyWater'], 'readwrite');
        const store = transaction.objectStore('dailyWater');
        const request = store.put({ date: dateKey, ...waterData });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function loadDayWater(date) {
    return new Promise((resolve, reject) => {
        const dateKey = formatDateKey(date);
        const transaction = db.transaction(['dailyWater'], 'readonly');
        const store = transaction.objectStore('dailyWater');
        const request = store.get(dateKey);
        request.onsuccess = () => {
            if (request.result) {
                const { date, ...waterData } = request.result;
                resolve(waterData);
            } else {
                resolve({ totalMl: 0, history: [] });
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function loadPeriodWater(numDays) {
    const today = new Date();
    const data = [];
    
    for (let i = numDays - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = formatDateKey(date);
        const waterData = await loadDayWater(date);
        
        data.push({
            date: dateKey,
            totalMl: waterData.totalMl || 0
        });
    }
    
    return data;
}

// =================== PAS ===================

export function saveDaySteps(date, steps) {
    return new Promise((resolve, reject) => {
        const dateKey = formatDateKey(date);
        const transaction = db.transaction(['dailySteps'], 'readwrite');
        const store = transaction.objectStore('dailySteps');
        const request = store.put({ date: dateKey, steps });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function loadDaySteps(date) {
    return new Promise((resolve, reject) => {
        const dateKey = formatDateKey(date);
        const transaction = db.transaction(['dailySteps'], 'readonly');
        const store = transaction.objectStore('dailySteps');
        const request = store.get(dateKey);
        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result.steps || 0);
            } else {
                resolve(0);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function loadPeriodSteps(numDays) {
    const today = new Date();
    const data = [];
    
    for (let i = numDays - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = formatDateKey(date);
        const steps = await loadDaySteps(date);
        
        data.push({
            date: dateKey,
            steps: steps || 0
        });
    }
    
    return data;
}

// =================== MOYENNES ===================

/**
 * Calcule les moyennes hebdomadaires ou mensuelles
 * @param {string} periodType - 'week' ou 'month'
 * @param {number} numPeriods - Nombre de périodes à récupérer
 * @param {object} foods - Dictionnaire des aliments
 * @returns {Promise<Array>} Tableau des moyennes par période
 */
export async function loadAverages(periodType, numPeriods, foods) {
    const today = new Date();
    const averages = [];
    
    for (let p = numPeriods - 1; p >= 0; p--) {
        let startDate, endDate, label;
        
        if (periodType === 'week') {
            // Calculer le début et la fin de la semaine
            endDate = new Date(today);
            endDate.setDate(endDate.getDate() - (p * 7));
            startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);
            
            label = `S${formatDateKey(startDate).substring(5, 10)} - ${formatDateKey(endDate).substring(5, 10)}`;
        } else {
            // Calculer le mois
            endDate = new Date(today.getFullYear(), today.getMonth() - p, 0); // Dernier jour du mois
            if (p === 0) endDate = today; // Pour le mois en cours
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); // Premier jour du mois
            
            const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
            label = `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
        }
        
        // Collecter les données pour la période
        const periodData = {
            label,
            calories: [],
            proteins: [],
            carbs: [],
            fats: [],
            fibers: [],
            weights: [],
            water: [],
            steps: []
        };
        
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const meals = await loadDayMeals(currentDate);
            const totals = calculateDayTotals(meals, foods);
            const weight = await loadDayWeight(currentDate);
            const waterData = await loadDayWater(currentDate);
            const stepsData = await loadDaySteps(currentDate);
            
            periodData.calories.push(totals.calories);
            periodData.proteins.push(totals.proteins);
            periodData.carbs.push(totals.carbs);
            periodData.fats.push(totals.fats);
            periodData.fibers.push(totals.fibers);
            if (weight) periodData.weights.push(weight);
            periodData.water.push(waterData.totalMl || 0);
            periodData.steps.push(stepsData || 0);
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Calculer les moyennes
        const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        
        averages.push({
            label,
            avgCalories: avg(periodData.calories),
            avgProteins: avg(periodData.proteins),
            avgCarbs: avg(periodData.carbs),
            avgFats: avg(periodData.fats),
            avgFibers: avg(periodData.fibers),
            avgWeight: periodData.weights.length > 0 ? avg(periodData.weights) : null,
            avgWater: avg(periodData.water),
            avgSteps: avg(periodData.steps)
        });
    }
    
    return averages;
}

// ============================================
// ACTIVITÉS PHYSIQUES
// ============================================

export function saveDayActivities(date, activities) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyActivities'], 'readwrite');
        const store = transaction.objectStore('dailyActivities');
        const request = store.put({ date: formatDateKey(date), activities });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function loadDayActivities(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyActivities'], 'readonly');
        const request = transaction.objectStore('dailyActivities').get(formatDateKey(date));
        request.onsuccess = () => resolve(request.result?.activities || []);
        request.onerror = () => reject(request.error);
    });
}

export function saveCustomActivity(name) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['customActivities'], 'readwrite');
        const store = transaction.objectStore('customActivities');
        const request = store.add({ name });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function loadCustomActivities() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['customActivities'], 'readonly');
        const request = transaction.objectStore('customActivities').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function deleteCustomActivity(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['customActivities'], 'readwrite');
        const store = transaction.objectStore('customActivities');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}