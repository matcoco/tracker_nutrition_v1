// js/db.js

import { DB_NAME, DB_VERSION } from '../config.js';
import { formatDateKey, calculateDayTotals } from './utils.js';

let db;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject(request.error);
        // Sans onblocked, la promesse ne se résout jamais quand un autre onglet
        // détient une connexion plus ancienne : l'application restait blanche.
        request.onblocked = () => reject(new Error(
            'Mise à jour de la base de données bloquée : fermez les autres onglets de Nutrition Tracker puis rechargez la page.'
        ));
        request.onsuccess = (event) => {
            db = event.target.result;
            db.onversionchange = () => {
                db.close();
                db = undefined;
                console.warn('Base de données mise à jour dans un autre onglet : rechargez la page.');
            };
            resolve(db);
        };
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
            if (!dbInstance.objectStoreNames.contains('healthEvents')) dbInstance.createObjectStore('healthEvents', { keyPath: 'id' });
        };
    });
}

export function saveFood(id, food) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['foods'], 'readwrite');
        const store = transaction.objectStore('foods');
        // `id` en dernier : un champ id présent dans l'objet ne doit pas écraser la clé.
        const request = store.put({ ...food, id });
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
            // On repart de l'enregistrement existant : une liste blanche de champs
            // supprimait silencieusement tout champ non énuméré (ex. `mealTimes`).
            const data = {
                ...existingData,
                date: dateKey,
                meals: meals,
                // Préserver le poids existant si on n'en fournit pas un nouveau
                weight: weight !== null && weight !== undefined ? weight : (existingData.weight ?? null),
                events: Array.isArray(existingData.events) ? existingData.events : []
            };
            const putRequest = store.put(data);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * Normalise une ligne de repas journalier.
 * Certaines données historiques utilisent `foodId`/`uid` au lieu de
 * `id`/`uniqueId`, ce qui rendait la ligne invisible (0 kcal, non supprimable).
 * @param {object} item - La ligne à normaliser.
 * @returns {object} La ligne normalisée (même référence).
 */
export function normalizeMealItem(item) {
    if (!item || typeof item !== 'object') return item;
    if (item.id === undefined && item.foodId !== undefined) item.id = item.foodId;
    if (item.uniqueId === undefined && item.uid !== undefined) item.uniqueId = item.uid;
    return item;
}

function normalizeDayMeals(meals) {
    if (!meals || typeof meals !== 'object') return meals;
    for (const mealType of Object.keys(meals)) {
        if (Array.isArray(meals[mealType])) meals[mealType].forEach(normalizeMealItem);
    }
    return meals;
}

export function loadDayMeals(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readonly');
        const request = transaction.objectStore('dailyMeals').get(formatDateKey(date));
        request.onsuccess = () => {
            const defaultMeals = { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] };
            resolve(normalizeDayMeals(request.result?.meals) || defaultMeals);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Convertit durablement les anciennes lignes `foodId`/`uid` vers `id`/`uniqueId`.
 * Idempotent : les journées déjà au bon format ne sont pas réécrites.
 * @returns {Promise<number>} Nombre de journées migrées.
 */
export async function migrateLegacyMealItemIds() {
    const days = await getAllFromStore('dailyMeals');
    let migrated = 0;

    for (const day of days) {
        let changed = false;
        for (const mealType of Object.keys(day.meals || {})) {
            const items = day.meals[mealType];
            if (!Array.isArray(items)) continue;
            for (const item of items) {
                if (!item || typeof item !== 'object') continue;
                if (item.id === undefined && item.foodId !== undefined) { item.id = item.foodId; changed = true; }
                if (item.uniqueId === undefined && item.uid !== undefined) { item.uniqueId = item.uid; changed = true; }
            }
        }
        if (changed) {
            await new Promise((resolve, reject) => {
                const transaction = db.transaction(['dailyMeals'], 'readwrite');
                const request = transaction.objectStore('dailyMeals').put(day);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            migrated += 1;
        }
    }

    return migrated;
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

export function saveDayBelly(date, belly) {
    return new Promise(async (resolve, reject) => {
        try {
            const transaction = db.transaction(['dailyMeals'], 'readwrite');
            const store = transaction.objectStore('dailyMeals');
            const dateKey = formatDateKey(date);
            const getRequest = store.get(dateKey);
            
            getRequest.onsuccess = () => {
                const data = getRequest.result || { date: dateKey, meals: { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] } };
                data.belly = belly;
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

export function loadDayBelly(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readonly');
        const request = transaction.objectStore('dailyMeals').get(formatDateKey(date));
        request.onsuccess = () => {
            resolve(request.result && request.result.belly ? request.result.belly : null);
        };
        request.onerror = () => reject(request.error);
    });
}

export function saveDayBedtime(date, bedtime) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readwrite');
        const store = transaction.objectStore('dailyMeals');
        const dateKey = formatDateKey(date);
        const getRequest = store.get(dateKey);

        getRequest.onsuccess = () => {
            const data = getRequest.result || {
                date: dateKey,
                meals: { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] }
            };
            data.bedtime = bedtime || null;
            const putRequest = store.put(data);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export function loadDayBedtime(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readonly');
        const request = transaction.objectStore('dailyMeals').get(formatDateKey(date));
        request.onsuccess = () => resolve(request.result?.bedtime || null);
        request.onerror = () => reject(request.error);
    });
}

export function saveDaySleepDuration(date, sleepDuration) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readwrite');
        const store = transaction.objectStore('dailyMeals');
        const dateKey = formatDateKey(date);
        const getRequest = store.get(dateKey);

        getRequest.onsuccess = () => {
            const data = getRequest.result || {
                date: dateKey,
                meals: { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] }
            };
            // Attention : Number(null) === 0 et Number('') === 0. Il faut donc
            // distinguer explicitement l'effacement (null/undefined/chaîne vide)
            // d'une valeur invalide, qui ne doit pas écraser la valeur existante.
            if (sleepDuration === null || sleepDuration === undefined || sleepDuration === '') {
                data.sleepDuration = null;
            } else {
                const numericDuration = Number(sleepDuration);
                if (Number.isFinite(numericDuration)) data.sleepDuration = numericDuration;
            }
            const putRequest = store.put(data);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export function loadDaySleepDuration(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readonly');
        const request = transaction.objectStore('dailyMeals').get(formatDateKey(date));
        request.onsuccess = () => resolve(request.result?.sleepDuration ?? null);
        request.onerror = () => reject(request.error);
    });
}

export function saveHealthEvent(event) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['healthEvents'], 'readwrite');
        const request = transaction.objectStore('healthEvents').put(event);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function deleteHealthEvent(eventId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['healthEvents'], 'readwrite');
        const request = transaction.objectStore('healthEvents').delete(eventId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function loadHealthEvents() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['healthEvents'], 'readonly');
        const request = transaction.objectStore('healthEvents').getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function loadHealthEventsForDate(date) {
    const dateKey = formatDateKey(date);
    const events = await loadHealthEvents();
    return events.filter(event => event.startDate <= dateKey && (!event.endDate || event.endDate >= dateKey));
}

export async function migrateLegacyDayEvents() {
    const days = await getAllFromStore('dailyMeals');
    const daysWithLegacyEvents = days.filter(day => Array.isArray(day.events) && day.events.length > 0);
    if (!daysWithLegacyEvents.length) return;

    const existingIds = new Set((await loadHealthEvents()).map(event => event.id));
    for (const day of daysWithLegacyEvents) {
        for (const [index, event] of day.events.entries()) {
            const id = `legacy-${day.date}-${event.id || index}`;
            if (!existingIds.has(id)) {
                await saveHealthEvent({
                    id,
                    type: event.type,
                    comment: event.comment || '',
                    startDate: day.date,
                    endDate: day.date,
                    createdAt: event.createdAt || new Date().toISOString()
                });
            }
        }
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(['dailyMeals'], 'readwrite');
            const request = transaction.objectStore('dailyMeals').put({ ...day, events: [] });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export function saveDayCalorieGoal(date, calorieGoal) {
    return saveDayNutritionGoals(date, { calories: calorieGoal });
}

/**
 * Normalise un objectif journalier historisé.
 * Un champ absent, null ou vide conserve la valeur déjà enregistrée ;
 * une valeur non numérique ne l'écrase pas non plus.
 * @param {*} value - La valeur fournie.
 * @param {number|null|undefined} fallback - La valeur déjà enregistrée.
 * @returns {number|null}
 */
function normalizeDayGoal(value, fallback) {
    const previous = Number.isFinite(Number(fallback)) ? Math.round(Number(fallback)) : null;
    if (value === undefined || value === null || value === '') return previous;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric) : previous;
}

export function saveDayNutritionGoals(date, goals) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readwrite');
        const store = transaction.objectStore('dailyMeals');
        const dateKey = formatDateKey(date);
        const getRequest = store.get(dateKey);

        getRequest.onsuccess = () => {
            const data = getRequest.result || {
                date: dateKey,
                meals: { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] }
            };
            // Number(null) === 0 : un champ absent OU null doit conserver la valeur
            // déjà historisée, et non la remplacer par 0.
            data.calorieGoal = normalizeDayGoal(goals?.calories, data.calorieGoal);
            data.proteinGoal = normalizeDayGoal(goals?.proteins, data.proteinGoal);
            data.carbGoal = normalizeDayGoal(goals?.carbs, data.carbGoal);
            data.fatGoal = normalizeDayGoal(goals?.fats, data.fatGoal);
            const putRequest = store.put(data);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export function loadDayCalorieGoal(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readonly');
        const request = transaction.objectStore('dailyMeals').get(formatDateKey(date));
        request.onsuccess = () => resolve(request.result?.calorieGoal ?? null);
        request.onerror = () => reject(request.error);
    });
}

export function loadDayNutritionGoals(date) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dailyMeals'], 'readonly');
        const request = transaction.objectStore('dailyMeals').get(formatDateKey(date));
        request.onsuccess = () => resolve({
            calories: request.result?.calorieGoal ?? null,
            proteins: request.result?.proteinGoal ?? null,
            carbs: request.result?.carbGoal ?? null,
            fats: request.result?.fatGoal ?? null
        });
        request.onerror = () => reject(request.error);
    });
}

export async function getStatsReferenceEndDate() {
    const endDate = new Date();
    endDate.setHours(12, 0, 0, 0);
    const stores = ['dailyMeals', 'dailyWater', 'dailySteps', 'dailyActivities'];

    for (const storeName of stores) {
        try {
            const records = await getAllFromStore(storeName);
            records.forEach(record => {
                if (!record?.date) return;
                const recordDate = new Date(`${record.date}T12:00:00`);
                if (!Number.isNaN(recordDate.getTime()) && recordDate > endDate) {
                    endDate.setTime(recordDate.getTime());
                }
            });
        } catch (error) {
            // Certains stores peuvent être absents sur d'anciennes bases.
        }
    }

    return endDate;
}

export async function loadPeriodMeals(days, foods, composedMeals = {}) {
    const data = [];
    const endDate = await getStatsReferenceEndDate();
    for (let i = days - 1; i >= 0; i--) {
        const targetDate = new Date(endDate);
        targetDate.setDate(targetDate.getDate() - i);
        const meals = await loadDayMeals(targetDate);
        const weight = await loadDayWeight(targetDate);
        const belly = await loadDayBelly(targetDate);
        const bedtime = await loadDayBedtime(targetDate);
        const sleepDuration = await loadDaySleepDuration(targetDate);
        const waterData = await loadDayWater(targetDate);
        const stepsData = await loadDaySteps(targetDate);
        const activities = await loadDayActivities(targetDate);
        const caloriesBurned = activities.reduce((sum, a) => sum + (Number(a.calories) || 0), 0);
        const activityDuration = activities.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);
        const nutritionGoals = await loadDayNutritionGoals(targetDate);
        const dayTotals = calculateDayTotals(meals, foods, composedMeals);
        data.push({
            date: formatDateKey(targetDate),
            weight,
            belly,
            bedtime,
            sleepDuration,
            water: waterData.totalMl || 0,
            steps: stepsData || 0,
            caloriesBurned,
            activityCount: activities.length,
            activityDuration,
            activityTypes: activities.map(activity => activity.type).filter(Boolean),
            netCalories: dayTotals.calories - caloriesBurned,
            calorieGoal: nutritionGoals.calories,
            proteinGoal: nutritionGoals.proteins,
            carbGoal: nutritionGoals.carbs,
            fatGoal: nutritionGoals.fats,
            ...dayTotals
        });
    }
    return data;
}

export async function loadMealsByDateRange(startDate, endDate, foods, composedMeals = {}) {
    const data = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const finalDate = new Date(endDate);
    finalDate.setHours(0, 0, 0, 0);

    while (currentDate <= finalDate) {
        const meals = await loadDayMeals(currentDate);
        const weight = await loadDayWeight(currentDate);
        const belly = await loadDayBelly(currentDate);
        const bedtime = await loadDayBedtime(currentDate);
        const sleepDuration = await loadDaySleepDuration(currentDate);
        const waterData = await loadDayWater(currentDate);
        const stepsData = await loadDaySteps(currentDate);
        const activities = await loadDayActivities(currentDate);
        const caloriesBurned = activities.reduce((sum, a) => sum + (Number(a.calories) || 0), 0);
        const activityDuration = activities.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);
        const nutritionGoals = await loadDayNutritionGoals(currentDate);
        const dayTotals = calculateDayTotals(meals, foods, composedMeals);
        data.push({
            date: formatDateKey(currentDate),
            weight,
            belly,
            bedtime,
            sleepDuration,
            water: waterData.totalMl || 0,
            steps: stepsData || 0,
            caloriesBurned,
            activityCount: activities.length,
            activityDuration,
            activityTypes: activities.map(activity => activity.type).filter(Boolean),
            netCalories: dayTotals.calories - caloriesBurned,
            calorieGoal: nutritionGoals.calories,
            proteinGoal: nutritionGoals.proteins,
            carbGoal: nutritionGoals.carbs,
            fatGoal: nutritionGoals.fats,
            ...dayTotals
        });
        currentDate.setDate(currentDate.getDate() + 1);
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
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transaction annulée'));
        request.onerror = () => reject(request.error);
    });
}

export function bulkPut(storeName, data) {
    return new Promise((resolve, reject) => {
        const items = Array.isArray(data) ? data : Object.values(data || {});
        if (items.length === 0) return resolve();
        const transaction = db.transaction([storeName], 'readwrite');
        // On résout sur le COMMIT de la transaction, et non sur le succès de la
        // dernière requête : un abort du commit passait sinon inaperçu.
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transaction annulée'));
        const store = transaction.objectStore(storeName);
        for (const item of items) store.put(item);
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
        // L'id de newFoodData ne doit jamais écraser le nouvel identifiant :
        // on place donc `id` en dernier dans l'objet écrit.
        foodsStore.put({ ...newFoodData, id: newId });

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
        const request = store.put({ ...meal, id });
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
        const request = store.put({ ...goals, id: 'current' });
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

const GOAL_PROFILES = ['cut', 'weightloss', 'bulk', 'maintenance', 'recomp'];
const WELLNESS_GOAL_DEFAULTS = { waterGoal: 2000, stepsGoal: 10000, sugarsMax: 25, fibersMin: 25 };

/**
 * Déduit le profil d'objectif à partir du pourcentage d'ajustement calorique.
 * Positif = déficit, négatif = surplus (convention de l'application).
 * @param {number} adjustmentPercent
 * @returns {string}
 */
function inferGoalProfile(adjustmentPercent) {
    const value = Number(adjustmentPercent);
    if (!Number.isFinite(value)) return 'maintenance';
    if (value >= 0.15) return 'cut';
    if (value >= 0.05) return 'weightloss';
    if (value <= -0.05) return 'bulk';
    return 'maintenance';
}

/**
 * Met à niveau un objet d'objectifs enregistré par une ancienne version.
 *
 * Les sauvegardes antérieures à novembre 2025 utilisaient `deficitPercent` et
 * ne stockaient pas `goalProfile`. Sans migration, `calculateGoalsFromInputs`
 * produisait des objectifs `NaN` (avant correction) ou refusait silencieusement
 * de recalculer après une pesée.
 *
 * @param {object} goals - Les objectifs chargés.
 * @returns {object|null} Les objectifs migrés, ou null si rien ne changeait.
 */
export function normalizeLegacyGoals(goals) {
    if (!goals || typeof goals !== 'object') return null;

    const migrated = { ...goals };
    let changed = false;

    // 1. Ancien nom du champ d'ajustement calorique.
    if (migrated.adjustmentPercent === undefined && migrated.deficitPercent !== undefined) {
        const legacyValue = Number(migrated.deficitPercent);
        if (Number.isFinite(legacyValue)) {
            migrated.adjustmentPercent = legacyValue;
            changed = true;
        }
    }
    if ('deficitPercent' in migrated) {
        delete migrated.deficitPercent;
        changed = true;
    }

    // 2. Profil d'objectif absent ou inconnu.
    if (!GOAL_PROFILES.includes(migrated.goalProfile)) {
        migrated.goalProfile = inferGoalProfile(migrated.adjustmentPercent);
        changed = true;
    }

    // 3. Objectifs bien-être absents.
    for (const [key, defaultValue] of Object.entries(WELLNESS_GOAL_DEFAULTS)) {
        if (!Number.isFinite(Number(migrated[key]))) {
            migrated[key] = defaultValue;
            changed = true;
        }
    }

    // 4. Champs numériques indispensables au recalcul.
    //    Number(null) === 0 : un champ null doit être supprimé, sinon il serait
    //    interprété comme la valeur 0 et produirait des objectifs aberrants.
    for (const key of ['age', 'weight', 'taille', 'activite', 'adjustmentPercent']) {
        if (migrated[key] === undefined) continue;
        const usable = migrated[key] !== null && migrated[key] !== ''
            && typeof migrated[key] !== 'boolean'
            && Number.isFinite(Number(migrated[key]));
        if (!usable) {
            delete migrated[key];
            changed = true;
        }
    }

    return changed ? migrated : null;
}

/**
 * Applique la migration des objectifs si nécessaire.
 * Idempotent : ne réécrit rien quand le format est déjà à jour.
 * @returns {Promise<object|null>} Les objectifs migrés, ou null si rien à faire.
 */
export async function migrateLegacyGoals() {
    const goals = await loadGoals();
    const migrated = normalizeLegacyGoals(goals);
    if (!migrated) return null;
    await saveGoals(migrated);
    return migrated;
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
    const today = await getStatsReferenceEndDate();
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
    const today = await getStatsReferenceEndDate();
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
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel)
 * @param {Function|null} dayFilter - Filtre optionnel appliqué aux journées avant moyenne
 * @returns {Promise<Array>} Tableau des moyennes par période
 */
export async function loadAverages(periodType, numPeriods, foods, composedMeals = {}, dayFilter = null) {
    const today = await getStatsReferenceEndDate();
    const averages = [];
    
    for (let p = numPeriods - 1; p >= 0; p--) {
        let startDate, endDate, label;
        
        if (periodType === 'week') {
            // Calculer le début et la fin de la semaine
            endDate = new Date(today);
            endDate.setDate(endDate.getDate() - (p * 7));
            startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);
            
            const fmtDay = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
            label = `${fmtDay(startDate)} → ${fmtDay(endDate)}`;
        } else {
            // Calculer le mois
            // new Date(y, m, 0) renvoie le dernier jour du mois m-1 : il faut donc
            // décaler l'index de +1 pour retomber sur le mois voulu.
            endDate = new Date(today.getFullYear(), today.getMonth() - p + 1, 0); // Dernier jour du mois
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
            bellies: [],
            water: [],
            steps: []
        };
        
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const meals = await loadDayMeals(currentDate);
            const totals = calculateDayTotals(meals, foods, composedMeals);
            const weight = await loadDayWeight(currentDate);
            const belly = await loadDayBelly(currentDate);
            const waterData = await loadDayWater(currentDate);
            const stepsData = await loadDaySteps(currentDate);

            const dayData = {
                date: formatDateKey(currentDate),
                water: waterData.totalMl || 0,
                steps: stepsData || 0,
                weight,
                belly,
                ...totals
            };
            if (dayFilter && !dayFilter(dayData)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
            
            periodData.calories.push(totals.calories);
            periodData.proteins.push(totals.proteins);
            periodData.carbs.push(totals.carbs);
            periodData.fats.push(totals.fats);
            periodData.fibers.push(totals.fibers);
            if (weight) periodData.weights.push(weight);
            if (belly) periodData.bellies.push(belly);
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
            avgBelly: periodData.bellies.length > 0 ? avg(periodData.bellies) : null,
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
