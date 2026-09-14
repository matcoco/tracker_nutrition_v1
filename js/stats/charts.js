// js/charts.js

import { loadPeriodMeals, loadMealsByDateRange, getAllFromStore, loadDayMeals, loadDayActivities } from '../core/db.js';
import { calculateDayTotals, calculateMealItemNutrition, formatDateKey } from '../core/utils.js';

// Un objet pour conserver les instances des graphiques afin de pouvoir les détruire avant de les redessiner.
let charts = {};

// Cache des données brutes pour l'export
let lastRawData = [];
let lastPeriodLabel = '';
let lastFoodsRef = {};
let lastMealsRef = {};
let lastStatsFilterInfo = null;

const STATS_FILTER_SETTINGS_KEY = 'nt_stats_filter_settings';
const PROTEIN_MAINTENANCE_MIN_G_PER_KG = 1.6;
const WEEKLY_WEIGHT_RANGE_KEY = 'nt_weekly_weight_range';

let weeklyWeightCustomRange = null;
let weeklyWeightControlsInitialized = false;
let weeklyWeightBaseData = [];
let weeklyWeightFoodsRef = {};
let weeklyWeightMealsRef = {};

export function getStatsFilterSettings() {
    try {
        const raw = localStorage.getItem(STATS_FILTER_SETTINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        // `Number(x) || 1500` transformait un seuil volontairement fixé à 0 en 1500.
        const threshold = Number(parsed.lowCalorieThreshold);
        return {
            excludeLowCalorieDays: Boolean(parsed.excludeLowCalorieDays),
            lowCalorieThreshold: Number.isFinite(threshold) ? Math.max(threshold, 0) : 1500
        };
    } catch (error) {
        return { excludeLowCalorieDays: false, lowCalorieThreshold: 1500 };
    }
}

export function saveStatsFilterSettings(settings) {
    const threshold = Number(settings.lowCalorieThreshold);
    const normalized = {
        excludeLowCalorieDays: Boolean(settings.excludeLowCalorieDays),
        lowCalorieThreshold: Number.isFinite(threshold) ? Math.max(threshold, 0) : 1500
    };
    localStorage.setItem(STATS_FILTER_SETTINGS_KEY, JSON.stringify(normalized));
    return normalized;
}

export function isDayAllowedByStatsFilter(day) {
    const settings = getStatsFilterSettings();
    if (!settings.excludeLowCalorieDays) return true;

    const calories = typeof day === 'number'
        ? Number(day)
        : Number(day?.calories ?? day?.calories_consumed ?? 0);
    return calories >= settings.lowCalorieThreshold;
}

export function applyStatsFilterToDailyData(data) {
    return data.filter(day => isDayAllowedByStatsFilter(day));
}

function applyLowCalorieStatsFilter(data) {
    const settings = getStatsFilterSettings();
    if (!settings.excludeLowCalorieDays) {
        lastStatsFilterInfo = { ...settings, excludedDays: 0 };
        return data;
    }

    const filtered = applyStatsFilterToDailyData(data);
    lastStatsFilterInfo = {
        ...settings,
        excludedDays: data.length - filtered.length
    };
    return filtered;
}

/**
 * Détermine si les données doivent être regroupées et comment
 * @param {number|string} period - La période sélectionnée
 * @returns {string} 'daily', 'weekly' ou 'monthly'
 */
function getGroupingMode(period) {
    if (period === 'all') return 'monthly';
    return 'daily';
}

function isCustomDateRange(period) {
    return typeof period === 'object' && period !== null && period.startDate && period.endDate;
}

function bedtimeToChartValue(time) {
    if (typeof time === 'number') return time;
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    let value = hours + (minutes / 60);
    if (value < 12) value += 24;
    return value;
}

function chartValueToBedtime(value) {
    if (!Number.isFinite(value)) return 'Non renseigné';
    let normalized = value % 24;
    if (normalized < 0) normalized += 24;
    let hours = Math.floor(normalized);
    let minutes = Math.round((normalized - hours) * 60);
    if (minutes === 60) {
        minutes = 0;
        hours = (hours + 1) % 24;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function averageBedtime(times) {
    const values = times.map(bedtimeToChartValue).filter(value => value !== null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatSleepDuration(hours) {
    if (!Number.isFinite(hours)) return 'Non renseigné';
    let wholeHours = Math.floor(hours);
    let minutes = Math.round((hours - wholeHours) * 60);
    // Sans ce report, 7,999 h s'affichait « 7h60 ».
    if (minutes === 60) { minutes = 0; wholeHours += 1; }
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h${String(minutes).padStart(2, '0')}`;
}

function getDateRangeDayCount(startDate, endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function getWeekStart(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    const monday = new Date(date);
    const dayOfWeek = monday.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + diff);
    monday.setHours(12, 0, 0, 0);
    return formatDateKey(monday);
}

function formatShortDate(dateString) {
    return new Date(`${dateString}T12:00:00`).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
}

function addDays(dateString, days) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + days);
    return formatDateKey(date);
}

function isValidDateRange(range) {
    return range?.startDate && range?.endDate && range.startDate <= range.endDate;
}

function loadWeeklyWeightRangeSetting() {
    try {
        const parsed = JSON.parse(localStorage.getItem(WEEKLY_WEIGHT_RANGE_KEY) || 'null');
        weeklyWeightCustomRange = isValidDateRange(parsed) ? parsed : null;
    } catch (error) {
        weeklyWeightCustomRange = null;
    }
}

function saveWeeklyWeightRangeSetting(range) {
    weeklyWeightCustomRange = isValidDateRange(range) ? range : null;
    if (weeklyWeightCustomRange) {
        localStorage.setItem(WEEKLY_WEIGHT_RANGE_KEY, JSON.stringify(weeklyWeightCustomRange));
    } else {
        localStorage.removeItem(WEEKLY_WEIGHT_RANGE_KEY);
    }
}

function updateWeeklyWeightRangeControls() {
    const startInput = document.getElementById('weeklyWeightStartDate');
    const endInput = document.getElementById('weeklyWeightEndDate');
    const status = document.getElementById('weeklyWeightRangeStatus');
    if (!startInput || !endInput || !status) return;

    startInput.value = weeklyWeightCustomRange?.startDate || '';
    endInput.value = weeklyWeightCustomRange?.endDate || '';
    status.textContent = weeklyWeightCustomRange
        ? `Période du tableau : ${weeklyWeightCustomRange.startDate} → ${weeklyWeightCustomRange.endDate}`
        : 'Période actuelle des statistiques.';
}

function setupWeeklyWeightLossControls() {
    if (weeklyWeightControlsInitialized) {
        updateWeeklyWeightRangeControls();
        return;
    }

    loadWeeklyWeightRangeSetting();
    const startInput = document.getElementById('weeklyWeightStartDate');
    const endInput = document.getElementById('weeklyWeightEndDate');
    const applyBtn = document.getElementById('applyWeeklyWeightRangeBtn');
    const resetBtn = document.getElementById('resetWeeklyWeightRangeBtn');
    const status = document.getElementById('weeklyWeightRangeStatus');
    if (!startInput || !endInput || !applyBtn || !resetBtn || !status) return;

    applyBtn.addEventListener('click', async () => {
        const range = { startDate: startInput.value, endDate: endInput.value };
        if (!isValidDateRange(range)) {
            status.textContent = 'Choisis une date de début antérieure ou égale à la date de fin.';
            return;
        }
        saveWeeklyWeightRangeSetting(range);
        updateWeeklyWeightRangeControls();
        await renderWeeklyWeightLossTable(weeklyWeightBaseData, weeklyWeightFoodsRef, weeklyWeightMealsRef);
    });

    resetBtn.addEventListener('click', async () => {
        saveWeeklyWeightRangeSetting(null);
        updateWeeklyWeightRangeControls();
        await renderWeeklyWeightLossTable(weeklyWeightBaseData, weeklyWeightFoodsRef, weeklyWeightMealsRef);
    });

    weeklyWeightControlsInitialized = true;
    updateWeeklyWeightRangeControls();
}

function classifyWeeklyLoss(lossPercent) {
    if (!Number.isFinite(lossPercent)) {
        return {
            className: 'neutral',
            label: 'Référence',
            advice: 'Comparer avec la semaine suivante'
        };
    }
    if (lossPercent < 0) {
        return {
            className: 'gain',
            label: 'Poids en hausse',
            advice: 'Baisser les kcal'
        };
    }
    if (lossPercent < 0.5) {
        return {
            className: 'slow',
            label: 'Pas assez de perte',
            advice: 'Baisser les kcal'
        };
    }
    if (lossPercent <= 1) {
        return {
            className: 'target',
            label: 'Parfait',
            advice: 'Ne rien changer'
        };
    }
    return {
        className: 'fast',
        label: 'Perte > 1%',
        advice: 'Monter les kcal'
    };
}

function summarizeActivityTypes(activityTypes) {
    if (!activityTypes.length) return '-';
    const counts = activityTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([type, count]) => `${type} x${count}`)
        .join(', ');
}

async function renderWeeklyWeightLossTable(rawData, foods = {}, composedMeals = {}) {
    const tbody = document.getElementById('weeklyWeightLossTableBody');
    if (!tbody) return;

    let tableData = rawData;
    if (weeklyWeightCustomRange) {
        tableData = await loadMealsByDateRange(
            weeklyWeightCustomRange.startDate,
            weeklyWeightCustomRange.endDate,
            foods,
            composedMeals
        );
    }

    const weeks = {};
    tableData.forEach(day => {
        const weight = Number(day.weight);
        const hasWeight = Number.isFinite(weight) && weight > 0;
        const calories = Number(day.calories) || 0;
        const hasNutrition = calories > 0;
        const caloriesBurned = Number(day.caloriesBurned) || 0;
        const activityCount = Number(day.activityCount) || 0;
        const activityDuration = Number(day.activityDuration) || 0;
        const hasActivity = activityCount > 0 || activityDuration > 0 || caloriesBurned > 0;
        if (!hasWeight && !hasNutrition && !hasActivity) return;

        const weekStart = getWeekStart(day.date);
        if (!weeks[weekStart]) {
            weeks[weekStart] = {
                start: weekStart,
                dates: [],
                weights: [],
                netCalorieDays: 0,
                netCalories: 0,
                activityCount: 0,
                activityDuration: 0,
                caloriesBurned: 0,
                activityTypes: []
            };
        }
        const netCalories = Number.isFinite(Number(day.netCalories))
            ? Number(day.netCalories)
            : calories - caloriesBurned;

        weeks[weekStart].dates.push(day.date);
        if (hasWeight) weeks[weekStart].weights.push(weight);
        if (hasNutrition) {
            weeks[weekStart].netCalorieDays += 1;
            weeks[weekStart].netCalories += netCalories;
        }
        weeks[weekStart].activityCount += activityCount;
        weeks[weekStart].activityDuration += activityDuration;
        weeks[weekStart].caloriesBurned += caloriesBurned;
        if (Array.isArray(day.activityTypes)) {
            weeks[weekStart].activityTypes.push(...day.activityTypes);
        }
    });

    const rows = Object.values(weeks)
        .filter(week => week.weights.length > 0)
        .sort((a, b) => a.start.localeCompare(b.start))
        .map(week => {
            const avgWeight = week.weights.reduce((sum, weight) => sum + weight, 0) / week.weights.length;
            const weekDates = week.dates.sort();
            return {
                ...week,
                avgWeight,
                avgNetCalories: week.netCalorieDays > 0 ? week.netCalories / week.netCalorieDays : null,
                end: weekDates[weekDates.length - 1] || addDays(week.start, 6)
            };
        });

    tbody.innerHTML = '';
    if (rows.length < 2) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 11;
        td.textContent = 'Il faut au moins deux semaines avec une pesée pour calculer le rythme.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    rows.forEach((row, index) => {
        const previous = index > 0 ? rows[index - 1] : null;
        const variationKg = previous ? row.avgWeight - previous.avgWeight : null;
        const lossPercent = previous ? ((previous.avgWeight - row.avgWeight) / previous.avgWeight) * 100 : null;
        const status = classifyWeeklyLoss(lossPercent);
        const lowConfidence = previous && (previous.weights.length < 3 || row.weights.length < 3);

        const tr = document.createElement('tr');
        tr.className = `weekly-weight-loss-row ${status.className}`;

        const cells = [
            `${formatShortDate(row.start)} → ${formatShortDate(row.end)}`,
            String(row.weights.length),
            `${row.avgWeight.toFixed(1)} kg`,
            variationKg === null ? '-' : `${variationKg > 0 ? '+' : ''}${variationKg.toFixed(1)} kg`,
            lossPercent === null ? '-' : `${lossPercent.toFixed(2)}%`,
            row.avgNetCalories === null ? '-' : `${Math.round(row.avgNetCalories)} kcal`,
            row.activityCount > 0 ? `${row.activityCount} : ${summarizeActivityTypes(row.activityTypes)}` : '-',
            row.activityDuration > 0 ? `${row.activityDuration} min` : '-',
            row.caloriesBurned > 0 ? `${Math.round(row.caloriesBurned)} kcal` : '-',
            lowConfidence ? `${status.label} (à confirmer)` : status.label,
            lowConfidence ? 'Ne pas ajuster seul sur cette semaine' : status.advice
        ];

        cells.forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

/**
 * Regroupe les données par semaine (moyennes)
 * @param {Array} data - Données quotidiennes
 * @returns {Array} Données regroupées par semaine
 */
function groupByWeek(data) {
    const weeks = {};
    
    data.forEach(day => {
        const date = new Date(day.date);
        // Obtenir le lundi de la semaine
        const monday = new Date(date);
        const dayOfWeek = date.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        monday.setDate(date.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        
        const weekKey = formatDateKey(monday);
        
        if (!weeks[weekKey]) {
            weeks[weekKey] = {
                date: weekKey,
                days: [],
                calories: 0,
                proteins: 0,
                carbs: 0,
                fats: 0,
                sugars: 0,
                fibers: 0,
                caloriesBurned: 0,
                netCalories: 0,
                calorieGoals: [],
                proteinGoals: [],
                carbGoals: [],
                fatGoals: [],
                weights: [],
                bellies: [],
                bedtimes: [],
                sleepDurations: [],
                water: 0,
                steps: 0
            };
        }
        
        weeks[weekKey].days.push(day);
        weeks[weekKey].calories += day.calories;
        weeks[weekKey].proteins += day.proteins;
        weeks[weekKey].carbs += day.carbs;
        weeks[weekKey].fats += day.fats;
        weeks[weekKey].sugars += day.sugars;
        weeks[weekKey].fibers += day.fibers;
        weeks[weekKey].caloriesBurned += day.caloriesBurned || 0;
        weeks[weekKey].netCalories += day.netCalories !== undefined ? day.netCalories : (day.calories - (day.caloriesBurned || 0));
        if (day.calorieGoal) weeks[weekKey].calorieGoals.push(day.calorieGoal);
        if (day.proteinGoal) weeks[weekKey].proteinGoals.push(day.proteinGoal);
        if (day.carbGoal) weeks[weekKey].carbGoals.push(day.carbGoal);
        if (day.fatGoal) weeks[weekKey].fatGoals.push(day.fatGoal);
        if (day.weight) weeks[weekKey].weights.push(day.weight);
        if (day.belly) weeks[weekKey].bellies.push(day.belly);
        if (day.bedtime) weeks[weekKey].bedtimes.push(day.bedtime);
        if (Number(day.sleepDuration) > 0) weeks[weekKey].sleepDurations.push(Number(day.sleepDuration));
        weeks[weekKey].water += day.water || 0;
        weeks[weekKey].steps += day.steps || 0;
    });
    
    // Calculer les moyennes
    return Object.values(weeks).map(week => {
        const count = week.days.length;
        return {
            date: week.date,
            calories: week.calories / count,
            proteins: week.proteins / count,
            carbs: week.carbs / count,
            fats: week.fats / count,
            sugars: week.sugars / count,
            fibers: week.fibers / count,
            caloriesBurned: week.caloriesBurned / count,
            netCalories: week.netCalories / count,
            calorieGoal: week.calorieGoals.length > 0 ? week.calorieGoals.reduce((a, b) => a + b, 0) / week.calorieGoals.length : null,
            proteinGoal: week.proteinGoals.length > 0 ? week.proteinGoals.reduce((a, b) => a + b, 0) / week.proteinGoals.length : null,
            carbGoal: week.carbGoals.length > 0 ? week.carbGoals.reduce((a, b) => a + b, 0) / week.carbGoals.length : null,
            fatGoal: week.fatGoals.length > 0 ? week.fatGoals.reduce((a, b) => a + b, 0) / week.fatGoals.length : null,
            weight: week.weights.length > 0 ? week.weights.reduce((a, b) => a + b, 0) / week.weights.length : null,
            belly: week.bellies.length > 0 ? week.bellies.reduce((a, b) => a + b, 0) / week.bellies.length : null,
            bedtime: averageBedtime(week.bedtimes),
            sleepDuration: week.sleepDurations.length > 0 ? week.sleepDurations.reduce((a, b) => a + b, 0) / week.sleepDurations.length : null,
            water: week.water / count,
            steps: week.steps / count
        };
    });
}

/**
 * Regroupe les données par mois (moyennes)
 * @param {Array} data - Données quotidiennes
 * @returns {Array} Données regroupées par mois
 */
function groupByMonth(data) {
    const months = {};
    
    data.forEach(day => {
        const date = new Date(day.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        
        if (!months[monthKey]) {
            months[monthKey] = {
                date: monthKey,
                days: [],
                calories: 0,
                proteins: 0,
                carbs: 0,
                fats: 0,
                sugars: 0,
                fibers: 0,
                caloriesBurned: 0,
                netCalories: 0,
                calorieGoals: [],
                proteinGoals: [],
                carbGoals: [],
                fatGoals: [],
                weights: [],
                bellies: [],
                bedtimes: [],
                sleepDurations: [],
                water: 0,
                steps: 0
            };
        }
        
        months[monthKey].days.push(day);
        months[monthKey].calories += day.calories;
        months[monthKey].proteins += day.proteins;
        months[monthKey].carbs += day.carbs;
        months[monthKey].fats += day.fats;
        months[monthKey].sugars += day.sugars;
        months[monthKey].fibers += day.fibers;
        months[monthKey].caloriesBurned += day.caloriesBurned || 0;
        months[monthKey].netCalories += day.netCalories !== undefined ? day.netCalories : (day.calories - (day.caloriesBurned || 0));
        if (day.calorieGoal) months[monthKey].calorieGoals.push(day.calorieGoal);
        if (day.proteinGoal) months[monthKey].proteinGoals.push(day.proteinGoal);
        if (day.carbGoal) months[monthKey].carbGoals.push(day.carbGoal);
        if (day.fatGoal) months[monthKey].fatGoals.push(day.fatGoal);
        if (day.weight) months[monthKey].weights.push(day.weight);
        if (day.belly) months[monthKey].bellies.push(day.belly);
        if (day.bedtime) months[monthKey].bedtimes.push(day.bedtime);
        if (Number(day.sleepDuration) > 0) months[monthKey].sleepDurations.push(Number(day.sleepDuration));
        months[monthKey].water += day.water || 0;
        months[monthKey].steps += day.steps || 0;
    });
    
    // Calculer les moyennes
    return Object.values(months).map(month => {
        const count = month.days.length;
        return {
            date: month.date,
            calories: month.calories / count,
            proteins: month.proteins / count,
            carbs: month.carbs / count,
            fats: month.fats / count,
            sugars: month.sugars / count,
            fibers: month.fibers / count,
            caloriesBurned: month.caloriesBurned / count,
            netCalories: month.netCalories / count,
            calorieGoal: month.calorieGoals.length > 0 ? month.calorieGoals.reduce((a, b) => a + b, 0) / month.calorieGoals.length : null,
            proteinGoal: month.proteinGoals.length > 0 ? month.proteinGoals.reduce((a, b) => a + b, 0) / month.proteinGoals.length : null,
            carbGoal: month.carbGoals.length > 0 ? month.carbGoals.reduce((a, b) => a + b, 0) / month.carbGoals.length : null,
            fatGoal: month.fatGoals.length > 0 ? month.fatGoals.reduce((a, b) => a + b, 0) / month.fatGoals.length : null,
            weight: month.weights.length > 0 ? month.weights.reduce((a, b) => a + b, 0) / month.weights.length : null,
            belly: month.bellies.length > 0 ? month.bellies.reduce((a, b) => a + b, 0) / month.bellies.length : null,
            bedtime: averageBedtime(month.bedtimes),
            sleepDuration: month.sleepDurations.length > 0 ? month.sleepDurations.reduce((a, b) => a + b, 0) / month.sleepDurations.length : null,
            water: month.water / count,
            steps: month.steps / count
        };
    });
}

/**
 * Formatte les labels en fonction du mode de regroupement
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @param {string} mode - 'daily', 'weekly' ou 'monthly'
 * @returns {string} Label formaté
 */
function formatLabel(dateStr, mode) {
    const date = new Date(dateStr);
    
    if (mode === 'daily') {
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    } else if (mode === 'weekly') {
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 6);
        return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
    } else { // monthly
        return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    }
}

// Configuration responsive commune pour les graphiques
export const getResponsiveOptions = (hasGoals = false, isDonut = false) => {
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    
    if (isDonut) {
        return {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: isMobile ? 'bottom' : 'right',
                    labels: {
                        font: {
                            size: isMobile ? 10 : 12
                        },
                        padding: isMobile ? 8 : 10,
                        boxWidth: isMobile ? 12 : 15
                    }
                },
                tooltip: {
                    bodyFont: {
                        size: isMobile ? 11 : 13
                    },
                    padding: isMobile ? 8 : 12
                }
            }
        };
    }
    
    return {
        responsive: true,
        maintainAspectRatio: isMobile ? false : true,
        aspectRatio: isMobile ? 1.2 : 2,
        plugins: {
            legend: {
                display: hasGoals,
                position: 'top',
                labels: {
                    font: {
                        size: isMobile ? 10 : 12
                    },
                    padding: isMobile ? 5 : 10,
                    boxWidth: isMobile ? 12 : 15,
                    usePointStyle: true
                }
            },
            tooltip: {
                enabled: true,
                bodyFont: {
                    size: isMobile ? 11 : 13
                },
                padding: isMobile ? 8 : 12,
                displayColors: true,
                boxWidth: isMobile ? 8 : 10
            }
        },
        scales: {
            x: {
                ticks: {
                    font: {
                        size: isMobile ? 9 : 11
                    },
                    maxRotation: isMobile ? 45 : 0,
                    minRotation: isMobile ? 45 : 0,
                    autoSkip: true,
                    maxTicksLimit: isMobile ? 7 : 15
                },
                grid: {
                    display: !isMobile
                }
            },
            y: {
                ticks: {
                    font: {
                        size: isMobile ? 9 : 11
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            }
        },
        interaction: {
            mode: 'index',
            intersect: false
        }
    };
};

/**
 * Met à jour tous les graphiques de la page des statistiques.
 * @param {number|string} period - Le nombre de jours pour la période ou 'all'.
 * @param {object} foods - Le dictionnaire de tous les aliments.
 * @param {object|null} goals - Les objectifs nutritionnels (optionnel).
 * @param {object} composedMeals - Dictionnaire des repas composés (optionnel).
 */
export async function updateCharts(period, foods, goals = null, composedMeals = {}) {
    // Charger les données
    let rawData;
    if (isCustomDateRange(period)) {
        rawData = await loadMealsByDateRange(period.startDate, period.endDate, foods, composedMeals);
    } else if (period === 'all') {
        // Charger toutes les données disponibles
        const allMeals = await getAllFromStore('dailyMeals');
        const allWater  = await getAllFromStore('dailyWater');
        const allSteps  = await getAllFromStore('dailySteps');
        const allActivities = await getAllFromStore('dailyActivities');

        // Indexer par date
        const waterByDate = {};
        const stepsByDate = {};
        const activitiesByDate = {};
        const activityDurationByDate = {};
        const activityCountByDate = {};
        const activityTypesByDate = {};
        allWater.forEach(w  => { waterByDate[w.date] = w.totalMl || 0; });
        allSteps.forEach(s  => { stepsByDate[s.date] = s.steps  || 0; });
        allActivities.forEach(a => {
            activitiesByDate[a.date] = (a.activities || []).reduce((sum, activity) => sum + (Number(activity.calories) || 0), 0);
            activityDurationByDate[a.date] = (a.activities || []).reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0);
            activityCountByDate[a.date] = (a.activities || []).length;
            activityTypesByDate[a.date] = (a.activities || []).map(activity => activity.type).filter(Boolean);
        });

        // Rassembler toutes les dates connues (repas + eau + pas)
        const allDates = new Set([
            ...allMeals.map(m => m.date),
            ...allWater.map(w => w.date),
            ...allSteps.map(s => s.date),
            ...allActivities.map(a => a.date),
        ]);

        // Créer un objet pour regrouper par date
        const dataByDate = {};
        allMeals.forEach(meal => {
            dataByDate[meal.date] = {
                date:  meal.date,
                meals: meal.meals,
                weight: meal.weight || null,
                belly:  meal.belly  || null,
                bedtime: meal.bedtime || null,
                sleepDuration: Number.isFinite(Number(meal.sleepDuration)) ? Number(meal.sleepDuration) : null,
                calorieGoal: meal.calorieGoal || null,
                proteinGoal: meal.proteinGoal || null,
                carbGoal: meal.carbGoal || null,
                fatGoal: meal.fatGoal || null,
            };
        });
        // S'assurer que les jours avec seulement eau/pas sont aussi présents
        allDates.forEach(date => {
            if (!dataByDate[date]) {
                dataByDate[date] = {
                    date,
                    meals: { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] },
                    weight: null,
                    belly: null,
                    bedtime: null,
                    sleepDuration: null,
                    calorieGoal: null,
                    proteinGoal: null,
                    carbGoal: null,
                    fatGoal: null
                };
            }
            dataByDate[date].water = waterByDate[date] || 0;
            dataByDate[date].steps = stepsByDate[date] || 0;
            dataByDate[date].caloriesBurned = activitiesByDate[date] || 0;
            dataByDate[date].activityDuration = activityDurationByDate[date] || 0;
            dataByDate[date].activityCount = activityCountByDate[date] || 0;
            dataByDate[date].activityTypes = activityTypesByDate[date] || [];
        });

        // Convertir en tableau et calculer les totaux
        rawData = Object.values(dataByDate)
            .map(day => {
                const dayTotals = calculateDayTotals(day.meals || { 'petit-dej': [], 'dejeuner': [], 'diner': [], 'snack': [] }, foods, composedMeals);
                return {
                    date:   day.date,
                    weight: day.weight || null,
                    belly:  day.belly  || null,
                    bedtime: day.bedtime || null,
                    sleepDuration: Number.isFinite(Number(day.sleepDuration)) ? Number(day.sleepDuration) : null,
                    water:  day.water  || 0,
                    steps:  day.steps  || 0,
                    caloriesBurned: day.caloriesBurned || 0,
                    activityCount: day.activityCount || 0,
                    activityDuration: day.activityDuration || 0,
                    activityTypes: Array.isArray(day.activityTypes) ? day.activityTypes : [],
                    netCalories: dayTotals.calories - (day.caloriesBurned || 0),
                    calorieGoal: day.calorieGoal || null,
                    proteinGoal: day.proteinGoal || null,
                    carbGoal: day.carbGoal || null,
                    fatGoal: day.fatGoal || null,
                    ...dayTotals
                };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    } else {
        rawData = await loadPeriodMeals(period, foods, composedMeals);
    }

    const wellnessRawData = rawData;
    rawData = applyLowCalorieStatsFilter(rawData);

    // Cacher les données brutes pour l'export
    lastRawData = rawData;
    lastFoodsRef = foods;
    lastMealsRef = composedMeals;
    if (isCustomDateRange(period)) {
        lastPeriodLabel = `${period.startDate} → ${period.endDate}`;
    } else if (period === 'all') {
        lastPeriodLabel = 'Toutes les données';
    } else {
        lastPeriodLabel = `${period} derniers jours`;
    }
    weeklyWeightBaseData = wellnessRawData;
    weeklyWeightFoodsRef = foods;
    weeklyWeightMealsRef = composedMeals;
    setupWeeklyWeightLossControls();
    await renderWeeklyWeightLossTable(wellnessRawData, foods, composedMeals);

    // Déterminer le mode de regroupement
    const groupingMode = isCustomDateRange(period)
        ? getGroupingMode(getDateRangeDayCount(period.startDate, period.endDate))
        : getGroupingMode(period);
    
    // Appliquer le regroupement si nécessaire
    let data;
    if (groupingMode === 'weekly') {
        data = groupByWeek(rawData);
    } else if (groupingMode === 'monthly') {
        data = groupByMonth(rawData);
    } else {
        data = rawData;
    }
    
    // Créer les labels en fonction du mode
    const labels = data.map(d => formatLabel(d.date, groupingMode));
    const formatWellnessLabel = dateStr => new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
    const todayKey = formatDateKey(new Date());
    const deriveGoalsFromWeight = weight => {
        if (!goals || !weight || weight <= 0 || !goals.taille || !goals.age || !goals.activite) return null;
        const adjustmentPercent = Number(goals.adjustmentPercent ?? goals.deficitPercent ?? 0) || 0;
        const formula = goals.bmrFormula || 'mifflin';
        const mb = formula === 'harris'
            ? (goals.sexe === 'homme'
                ? 66.5 + 13.75 * weight + 5.003 * goals.taille - 6.75 * goals.age
                : 655.1 + 9.563 * weight + 1.85 * goals.taille - 4.676 * goals.age)
            : (goals.sexe === 'homme'
                ? 10 * weight + 6.25 * goals.taille - 5 * goals.age + 5
                : 10 * weight + 6.25 * goals.taille - 5 * goals.age - 161);
        const calories = Math.round((mb * goals.activite) * (1 - adjustmentPercent));

        let proteins, fats;
        switch (goals.goalProfile) {
            case 'cut': proteins = Math.round(weight * 2.2); fats = Math.round(weight * 1.0); break;
            case 'weightloss': proteins = Math.round(weight * 1.8); fats = Math.round(weight * 0.9); break;
            case 'bulk': proteins = Math.round(weight * 2.0); fats = Math.round(weight * 1.1); break;
            case 'maintenance': proteins = Math.round(weight * 1.6); fats = Math.round(weight * 1.0); break;
            case 'recomp': proteins = Math.round(weight * 2.4); fats = Math.round(weight * 0.9); break;
            default: proteins = Math.round(weight * 2.0); fats = Math.round(weight * 1.0);
        }

        const carbs = Math.max(Math.round((calories - proteins * 4 - fats * 9) / 4), 0);
        return { calorieGoal: calories, proteinGoal: proteins, carbGoal: carbs, fatGoal: fats };
    };
    const buildGoalSeries = (field, fallback) => {
        const rawSeries = data.map(d => {
            if (d[field]) return d[field];
            const derivedGoals = deriveGoalsFromWeight(d.weight);
            if (derivedGoals?.[field]) return derivedGoals[field];
            return d.date === todayKey ? fallback || null : null;
        });
        if (!rawSeries.some(value => value !== null)) {
            return data.map(() => fallback || null);
        }

        const firstKnownValue = rawSeries.find(value => value !== null);
        let lastKnownValue = firstKnownValue;
        return rawSeries.map(value => {
            if (value !== null) lastKnownValue = value;
            return lastKnownValue;
        });
    };
    const hasGoalSeries = series => series.some(value => value !== null);
    const effectiveWeightForDay = d => {
        const dayWeight = Number(d.weight);
        if (Number.isFinite(dayWeight) && dayWeight > 0) return dayWeight;
        const goalWeight = Number(goals?.weight);
        return Number.isFinite(goalWeight) && goalWeight > 0 ? goalWeight : null;
    };
    const calorieGoalData = buildGoalSeries('calorieGoal', goals?.calories);
    const hasCalorieGoalData = hasGoalSeries(calorieGoalData);

    // --- Vue combinée : calories, activité, poids, sommeil ---
    if (charts.combinedStats) charts.combinedStats.destroy();
    // Number(null) === 0 : sans le test > 0, un jour sans pesée valait 0 kg et
    // la série « Poids » était toujours affichée avec une chute à zéro.
    const hasWeightData = data.some(d => Number(d.weight) > 0);
    const hasSleepDurationData = data.some(d => Number(d.sleepDuration) > 0);
    const combinedDatasets = [
        {
            type: 'bar',
            label: 'Calories consommées',
            data: data.map(d => Math.round(d.calories || 0)),
            yAxisID: 'yKcal',
            backgroundColor: 'rgba(102, 126, 234, 0.22)',
            borderColor: '#667eea',
            borderWidth: 1,
            order: 5
        },
        {
            type: 'bar',
            label: 'Calories brûlées',
            data: data.map(d => Math.round(d.caloriesBurned || 0)),
            yAxisID: 'yKcal',
            backgroundColor: 'rgba(239, 68, 68, 0.18)',
            borderColor: '#ef4444',
            borderWidth: 1,
            order: 6
        },
        {
            type: 'line',
            label: 'Calories nettes',
            data: data.map(d => Math.round(d.netCalories !== undefined ? d.netCalories : (d.calories - (d.caloriesBurned || 0)))),
            yAxisID: 'yKcal',
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 3,
            fill: false,
            order: 2
        }
    ];
    if (hasCalorieGoalData) {
        combinedDatasets.push({
            type: 'line',
            label: 'Objectif calories',
            data: calorieGoalData,
            yAxisID: 'yKcal',
            borderColor: '#f59e0b',
            borderDash: [6, 5],
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 2,
            fill: false,
            order: 1
        });
    }
    if (hasWeightData) {
        combinedDatasets.push({
            type: 'line',
            label: 'Poids',
            data: data.map(d => (Number(d.weight) > 0 ? Number(d.weight) : null)),
            yAxisID: 'yWeight',
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 3,
            fill: false,
            order: 3
        });
    }
    if (hasSleepDurationData) {
        combinedDatasets.push({
            type: 'line',
            label: 'Sommeil',
            data: data.map(d => (Number(d.sleepDuration) > 0 ? Number(d.sleepDuration) : null)),
            yAxisID: 'ySleep',
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.08)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 3,
            fill: false,
            order: 4
        });
    }
    const combinedOptions = getResponsiveOptions(true);
    combinedOptions.aspectRatio = window.innerWidth < 768 ? 1.1 : 3;
    combinedOptions.scales = {
        x: combinedOptions.scales.x,
        yKcal: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: 'kcal' },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        yWeight: {
            type: 'linear',
            position: 'right',
            display: hasWeightData,
            beginAtZero: false,
            title: { display: true, text: 'kg' },
            grid: { drawOnChartArea: false }
        },
        ySleep: {
            type: 'linear',
            position: 'right',
            display: hasSleepDurationData,
            beginAtZero: true,
            title: { display: true, text: 'sommeil' },
            ticks: { callback: value => `${value}h` },
            grid: { drawOnChartArea: false }
        }
    };
    combinedOptions.plugins.tooltip.callbacks = {
        label: context => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (context.dataset.yAxisID === 'yWeight') return `${label}: ${Number(value).toFixed(1)} kg`;
            if (context.dataset.yAxisID === 'ySleep') return `${label}: ${formatSleepDuration(Number(value))}`;
            return `${label}: ${Math.round(value)} kcal`;
        }
    };
    charts.combinedStats = new Chart(document.getElementById('combinedStatsChart'), {
        type: 'bar',
        data: {
            labels,
            datasets: combinedDatasets
        },
        options: combinedOptions
    });

    // --- Graphique des Calories (Ligne) ---
    if (charts.calories) charts.calories.destroy();
    const caloriesDatasets = [{
        label: 'Calories consommées',
        data: data.map(d => Math.round(d.calories || 0)),
        borderColor: 'var(--color-primary-start)',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true
    }, {
        label: 'Calories nettes',
        data: data.map(d => Math.round(d.netCalories !== undefined ? d.netCalories : (d.calories - (d.caloriesBurned || 0)))),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderWidth: 2,
        tension: 0.4,
        fill: false
    }];
    if (hasCalorieGoalData) {
        caloriesDatasets.push({
            label: 'Objectif',
            data: calorieGoalData,
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 3,
            fill: false
        });
    }
    charts.calories = new Chart(document.getElementById('caloriesChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: caloriesDatasets
        },
        options: getResponsiveOptions(true)
    });

    // --- Graphique des Macronutriments (Donut) ---
    const totalProteins = data.reduce((sum, d) => sum + d.proteins, 0);
    const totalCarbs = data.reduce((sum, d) => sum + d.carbs, 0);
    const totalFats = data.reduce((sum, d) => sum + d.fats, 0);
    const totalSugars = data.reduce((sum, d) => sum + d.sugars, 0); // Ajout du calcul pour les sucres
    const totalFibers = data.reduce((sum, d) => sum + d.fibers, 0); // Ajout du calcul pour les fibres

    if (charts.macros) charts.macros.destroy();
    const macrosTotalGrams = totalProteins + totalCarbs + totalFats + totalSugars + totalFibers;
    const macrosLabels = ['Protéines', 'Glucides', 'Lipides', 'Sucres', 'Fibres'];
    const macrosValues = [totalProteins, totalCarbs, totalFats, totalSugars, totalFibers];
    const macrosPercentages = macrosValues.map(v => macrosTotalGrams > 0 ? (v / macrosTotalGrams * 100) : 0);
    const macrosOptions = getResponsiveOptions(false, true);
    macrosOptions.plugins.tooltip = {
        callbacks: {
            label: function(context) {
                const label = context.label || '';
                const pct = macrosPercentages[context.dataIndex].toFixed(1);
                const grams = macrosValues[context.dataIndex].toFixed(1);
                return ` ${label} : ${pct}% (${grams} g)`;
            }
        }
    };
    macrosOptions.plugins.legend.labels = Object.assign(
        {},
        macrosOptions.plugins.legend.labels,
        {
            generateLabels: function(chart) {
                const ds = chart.data.datasets[0];
                return chart.data.labels.map(function(label, i) {
                    const pct = macrosPercentages[i].toFixed(1);
                    return {
                        text: `${label} (${pct}%)`,
                        fillStyle: ds.backgroundColor[i],
                        strokeStyle: ds.backgroundColor[i],
                        hidden: false,
                        index: i
                    };
                });
            }
        }
    );
    charts.macros = new Chart(document.getElementById('macrosChart'), {
        type: 'doughnut',
        data: {
            labels: macrosLabels,
            datasets: [{
                data: macrosPercentages,
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#84cc16']
            }]
        },
        options: macrosOptions
    });
    // --- Graphique des Protéines (Barres) ---
    if (charts.proteins) charts.proteins.destroy();
    const proteinsDatasets = [{ label: 'Protéines (g)', data: data.map(d => d.proteins.toFixed(1)), backgroundColor: '#10b981', order: 2 }];
    const proteinMaintenanceData = data.map(d => {
        const effectiveWeight = effectiveWeightForDay(d);
        return effectiveWeight ? Number((effectiveWeight * PROTEIN_MAINTENANCE_MIN_G_PER_KG).toFixed(1)) : null;
    });
    const hasProteinMaintenanceData = hasGoalSeries(proteinMaintenanceData);
    const proteinGoalData = buildGoalSeries('proteinGoal', goals?.proteins);
    const hasProteinGoalData = hasGoalSeries(proteinGoalData);
    if (hasProteinMaintenanceData) {
        proteinsDatasets.push({
            label: 'Minimum maintien musculaire',
            type: 'line',
            data: proteinMaintenanceData,
            borderColor: '#0ea5e9',
            borderDash: [4, 4],
            borderWidth: 2,
            pointRadius: 2,
            fill: false,
            order: 1
        });
    }
    if (hasProteinGoalData) {
        proteinsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: proteinGoalData,
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
            order: 1
        });
    }
    charts.proteins = new Chart(document.getElementById('proteinsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: proteinsDatasets
        },
        options: getResponsiveOptions(hasProteinGoalData || hasProteinMaintenanceData)
    });

    // --- Ratio protéines / poids (g/kg) ---
    if (charts.proteinRatio) charts.proteinRatio.destroy();
    const proteinRatioData = data.map(d => {
        const effectiveWeight = effectiveWeightForDay(d);
        return effectiveWeight ? Number(((Number(d.proteins) || 0) / effectiveWeight).toFixed(2)) : null;
    });
    const hasProteinRatioData = hasGoalSeries(proteinRatioData);
    const proteinRatioOptions = getResponsiveOptions(true);
    proteinRatioOptions.scales.y.beginAtZero = true;
    proteinRatioOptions.scales.y.title = { display: true, text: 'g/kg' };
    proteinRatioOptions.scales.y.ticks.callback = value => `${value} g/kg`;
    proteinRatioOptions.plugins.tooltip.callbacks = {
        label: context => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)} g/kg`
    };
    charts.proteinRatio = new Chart(document.getElementById('proteinRatioChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Ratio protéines',
                data: proteinRatioData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 3,
                fill: true
            }, {
                label: 'Minimum maintien musculaire',
                data: data.map(() => hasProteinRatioData ? PROTEIN_MAINTENANCE_MIN_G_PER_KG : null),
                borderColor: '#0ea5e9',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }]
        },
        options: proteinRatioOptions
    });

    // --- Graphique des Glucides (Barres) ---
    if (charts.carbs) charts.carbs.destroy();
    const carbsDatasets = [{ label: 'Glucides (g)', data: data.map(d => d.carbs.toFixed(1)), backgroundColor: '#f59e0b', order: 2 }];
    const carbGoalData = buildGoalSeries('carbGoal', goals?.carbs);
    const hasCarbGoalData = hasGoalSeries(carbGoalData);
    if (hasCarbGoalData) {
        carbsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: carbGoalData,
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
            order: 1
        });
    }
    charts.carbs = new Chart(document.getElementById('carbsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: carbsDatasets
        },
        options: getResponsiveOptions(hasCarbGoalData)
    });

    // --- Graphique des Lipides (Barres) ---
    if (charts.lipids) charts.lipids.destroy();
    const lipidsDatasets = [{ label: 'Lipides (g)', data: data.map(d => d.fats.toFixed(1)), backgroundColor: '#ef4444', order: 2 }];
    const fatGoalData = buildGoalSeries('fatGoal', goals?.fats);
    const hasFatGoalData = hasGoalSeries(fatGoalData);
    if (hasFatGoalData) {
        lipidsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: fatGoalData,
            borderColor: '#8b5cf6',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
            order: 1
        });
    }
    charts.lipids = new Chart(document.getElementById('lipidsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: lipidsDatasets
        },
        options: getResponsiveOptions(hasFatGoalData)
    });

    // --- NOUVEAU : Graphique des Sucres (Barres) ---
    if (charts.sugars) charts.sugars.destroy();
    const sugarsDatasets = [{
        label: 'Sucres (g)',
        data: data.map(d => d.sugars.toFixed(1)),
        backgroundColor: '#8b5cf6',
        order: 4
    }];
    
    // Seuil 1 : Min à privilégier (25g) - VERT FONCÉ
    sugarsDatasets.push({
        label: 'Seuil Idéal (25g)',
        type: 'line',
        data: Array(labels.length).fill(25),
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        order: 3
    });
    
    // Seuil 2 : Recommandé (50g) - ORANGE
    sugarsDatasets.push({
        label: 'Seuil Recommandé (50g)',
        type: 'line',
        data: Array(labels.length).fill(50),
        borderColor: '#f59e0b',
        borderDash: [8, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        order: 2
    });
    
    // Seuil 3 : Maximum absolu (100g) - ROUGE
    sugarsDatasets.push({
        label: 'Seuil Max (100g)',
        type: 'line',
        data: Array(labels.length).fill(100),
        borderColor: '#ef4444',
        borderDash: [10, 5],
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        order: 1
    });
    
    charts.sugars = new Chart(document.getElementById('sugarsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: sugarsDatasets
        },
        options: getResponsiveOptions(true)
    });

    // --- NOUVEAU : Graphique des Fibres (Barres) ---
    if (charts.fibers) charts.fibers.destroy();
    const fibersDatasets = [{
        label: 'Fibres (g)',
        data: data.map(d => d.fibers.toFixed(1)),
        backgroundColor: '#84cc16',
        order: 2
    }];
    if (goals && goals.fibersMin) {
        fibersDatasets.push({
            label: 'Seuil Min',
            type: 'line',
            data: Array(labels.length).fill(goals.fibersMin),
            borderColor: '#10b981',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    charts.fibers = new Chart(document.getElementById('fibersChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: fibersDatasets
        },
        options: getResponsiveOptions(goals && goals.fibersMin)
    });

    // --- NOUVEAU : Graphique du Poids (Ligne) ---
    // Les mesures corporelles restent quotidiennes, même si les macros sont regroupées par mois.
    const weightRows = wellnessRawData.filter(d => Number(d.weight) > 0);
    const weightData = weightRows.map(d => Number(d.weight));
    const weightLabels = weightRows.map(d => formatWellnessLabel(d.date));
    
    if (charts.weight) charts.weight.destroy();
    const weightOptions = getResponsiveOptions(false);
    weightOptions.plugins.tooltip.callbacks = {
        label: function(context) {
            if (context.parsed.y !== null) {
                return 'Poids: ' + context.parsed.y.toFixed(1) + ' kg';
            }
            return 'Non renseigné';
        }
    };
    weightOptions.scales.y.beginAtZero = false;
    
    charts.weight = new Chart(document.getElementById('weightChart'), {
        type: 'line',
        data: {
            labels: weightLabels,
            datasets: [{
                label: 'Poids (kg)',
                data: weightData,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.4,
                fill: true,
                spanGaps: true // Pour connecter les points même s'il y a des valeurs nulles
            }]
        },
        options: weightOptions
    });

    // --- NOUVEAU : Graphique du Tour de ventre (Ligne) ---
    const bellyRows = wellnessRawData.filter(d => Number(d.belly) > 0);
    const bellyData = bellyRows.map(d => Number(d.belly));
    const bellyLabels = bellyRows.map(d => formatWellnessLabel(d.date));
    
    if (charts.belly) charts.belly.destroy();
    const bellyOptions = getResponsiveOptions(false);
    bellyOptions.plugins.tooltip.callbacks = {
        label: function(context) {
            if (context.parsed.y !== null) {
                return 'Tour de ventre: ' + context.parsed.y.toFixed(1) + ' cm';
            }
            return 'Non renseigné';
        }
    };
    bellyOptions.scales.y.beginAtZero = false;
    
    charts.belly = new Chart(document.getElementById('bellyChart'), {
        type: 'line',
        data: {
            labels: bellyLabels,
            datasets: [{
                label: 'Tour de ventre (cm)',
                data: bellyData,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true,
                spanGaps: true
            }]
        },
        options: bellyOptions
    });

    // --- Graphique de l'heure de coucher (Ligne) ---
    const bedtimeRows = wellnessRawData.filter(d => d.bedtime);
    const bedtimeData = bedtimeRows.map(d => bedtimeToChartValue(d.bedtime));
    const bedtimeLabels = bedtimeRows.map(d => formatWellnessLabel(d.date));

    if (charts.bedtime) charts.bedtime.destroy();
    const bedtimeOptions = getResponsiveOptions(false);
    bedtimeOptions.plugins.tooltip.callbacks = {
        label: function(context) {
            if (context.parsed.y !== null) {
                return 'Coucher: ' + chartValueToBedtime(context.parsed.y);
            }
            return 'Non renseigné';
        }
    };
    bedtimeOptions.scales.y.beginAtZero = false;
    bedtimeOptions.scales.y.ticks.callback = value => chartValueToBedtime(Number(value));

    charts.bedtime = new Chart(document.getElementById('bedtimeChart'), {
        type: 'line',
        data: {
            labels: bedtimeLabels,
            datasets: [{
                label: 'Heure de coucher',
                data: bedtimeData,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                tension: 0.35,
                fill: true,
                spanGaps: true
            }]
        },
        options: bedtimeOptions
    });

    // --- Graphique de la durée du sommeil (Ligne) ---
    const sleepDurationRows = wellnessRawData.filter(d => Number(d.sleepDuration) > 0);
    const sleepDurationData = sleepDurationRows.map(d => Number(d.sleepDuration));
    const sleepDurationLabels = sleepDurationRows.map(d => formatWellnessLabel(d.date));

    if (charts.sleepDuration) charts.sleepDuration.destroy();
    const sleepDurationOptions = getResponsiveOptions(false);
    sleepDurationOptions.plugins.tooltip.callbacks = {
        label: function(context) {
            if (context.parsed.y !== null) {
                return 'Sommeil: ' + formatSleepDuration(context.parsed.y);
            }
            return 'Non renseigné';
        }
    };
    sleepDurationOptions.scales.y.beginAtZero = false;
    sleepDurationOptions.scales.y.ticks.callback = value => formatSleepDuration(Number(value));

    charts.sleepDuration = new Chart(document.getElementById('sleepDurationChart'), {
        type: 'line',
        data: {
            labels: sleepDurationLabels,
            datasets: [{
                label: 'Durée du sommeil',
                data: sleepDurationData,
                borderColor: '#14b8a6',
                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                tension: 0.35,
                fill: true,
                spanGaps: true
            }]
        },
        options: sleepDurationOptions
    });

    // --- NOUVEAU : Graphique de l'Hydratation (Barres) ---
    const waterDatasets = [{
        label: 'Hydratation (ml)',
        data: data.map(d => d.water || 0),
        backgroundColor: '#06b6d4',
        order: 2
    }];
    
    if (goals && goals.waterGoal) {
        waterDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.waterGoal),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    if (charts.water) charts.water.destroy();
    charts.water = new Chart(document.getElementById('waterChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: waterDatasets
        },
        options: getResponsiveOptions(goals && goals.waterGoal)
    });

    // --- NOUVEAU : Graphique des Pas (Barres) ---
    const stepsDatasets = [{
        label: 'Nombre de pas',
        data: data.map(d => d.steps || 0),
        backgroundColor: '#f97316',
        order: 2
    }];
    
    if (goals && goals.stepsGoal) {
        stepsDatasets.push({
            label: 'Objectif',
            type: 'line',
            data: Array(labels.length).fill(goals.stepsGoal),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
        });
    }
    
    if (charts.steps) charts.steps.destroy();
    charts.steps = new Chart(document.getElementById('stepsChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: stepsDatasets
        },
        options: getResponsiveOptions(goals && goals.stepsGoal)
    });
}

// Écouter les changements de taille de fenêtre pour redessiner les graphiques
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        Object.keys(charts).forEach(key => { if (charts[key]) charts[key].resize(); });
    }, 250);
});


/**
 * Exporte les données de la période sélectionnée en JSON pour analyse IA.
 */
export async function exportStatsData(foods, composedMeals) {
    const resolvedFoods = (foods && Object.keys(foods).length) ? foods : lastFoodsRef;
    const resolvedMeals = composedMeals || lastMealsRef;

    const MEAL_NAMES = {
        'petit-dej': 'Petit-déjeuner',
        'dejeuner':  'Déjeuner',
        'diner':     'Dîner',
        'snack':     'Snack',
    };
    const SHARED_TIME_MEALS = ['petit-dej', 'dejeuner', 'diner'];
    const DEFAULT_MEAL_TIMES = { 'petit-dej': '08:00', 'dejeuner': '12:30', 'diner': '19:30' };

    const hasSharedMealTime = mealKey => SHARED_TIME_MEALS.includes(mealKey);
    const getMealTime = (mealKey, items) => {
        if (!hasSharedMealTime(mealKey)) return null;
        return items.find(item => item.time)?.time || DEFAULT_MEAL_TIMES[mealKey] || null;
    };

    // Helper : calcul nutritionnel d'un item
    function itemNutrition(item, mealKey) {
        let food;
        if (item.isMeal && resolvedMeals[item.id]) {
            food = resolvedMeals[item.id];
        } else {
            food = resolvedFoods[item.id];
        }
        if (!food) return null;

        const nutrition = calculateMealItemNutrition(item, resolvedFoods, resolvedMeals);
        const glycemicIndex = Number.isFinite(Number(food.glycemicIndex))
            ? Math.min(Math.max(Number(food.glycemicIndex), 0), 100)
            : null;
        const glycemicLoad = glycemicIndex !== null
            ? parseFloat(((glycemicIndex * nutrition.carbs) / 100).toFixed(2))
            : null;
        const data = {
            name: food.name || item.id,
            weight_g: item.weight || 0,
            calories:  Math.round(nutrition.calories),
            proteins_g: parseFloat(nutrition.proteins.toFixed(1)),
            carbs_g:    parseFloat(nutrition.carbs.toFixed(1)),
            fats_g:     parseFloat(nutrition.fats.toFixed(1)),
            sugars_g:   parseFloat(nutrition.sugars.toFixed(1)),
            fibers_g:   parseFloat(nutrition.fibers.toFixed(1)),
            glycemic_index: glycemicIndex,
            glycemic_load: glycemicLoad,
        };
        if (!hasSharedMealTime(mealKey) && item.time) {
            data.time = item.time;
        }
        return data;
    }

    function formatTimeFromTimestamp(timestamp, expectedDate) {
        const value = Number(timestamp);
        if (!Number.isFinite(value) || value <= 0) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        if (expectedDate && formatDateKey(date) !== expectedDate) return null;
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function activityTime(activity, date) {
        return activity.time || formatTimeFromTimestamp(activity.id, date);
    }

    // Construire daily_data avec totaux + détail des repas + activités
    const days = await Promise.all(lastRawData.map(async day => {
        const dateObj = new Date(day.date + 'T12:00:00');
        const rawMeals = await loadDayMeals(dateObj);
        const meals = {};
        for (const [mealKey, mealLabel] of Object.entries(MEAL_NAMES)) {
            const rawItems = rawMeals[mealKey] || [];
            const items = rawItems.map(item => itemNutrition(item, mealKey)).filter(Boolean);
            if (items.length > 0) {
                meals[mealLabel] = {
                    time: getMealTime(mealKey, rawItems),
                    items
                };
            }
        }

        // Activités physiques
        const rawActivities = await loadDayActivities(dateObj);
        const activities = rawActivities.map(a => ({
            id:                a.id || null,
            time:              activityTime(a, day.date),
            type:              a.type,
            duration_min:      a.duration,
            calories_burned:   a.calories,
            strength_exercises: Array.isArray(a.strengthExercises) && a.strengthExercises.length > 0
                ? a.strengthExercises.map(exercise => ({
                    name: exercise.name || null,
                    muscle: exercise.muscle || null,
                    sets: Number(exercise.sets) || 0,
                    reps: Number(exercise.reps) || 0,
                    dumbbell_weight_kg: Number(exercise.dumbbellWeight) || 0,
                    weighted_vest_kg: Number(exercise.vestWeight) || 0
                }))
                : undefined,
        })).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
        const totalCaloriesBurned = activities.reduce((s, a) => s + (a.calories_burned || 0), 0);

        const dayObj = {
            date:          day.date,
            calories_consumed: Math.round(day.calories),
            calories_burned:   totalCaloriesBurned,
            net_calories:      Math.round(day.calories) - totalCaloriesBurned,
            calories_goal:     day.calorieGoal || null,
            proteins_goal_g:   day.proteinGoal || null,
            carbs_goal_g:      day.carbGoal || null,
            fats_goal_g:       day.fatGoal || null,
            proteins_g:  parseFloat(day.proteins.toFixed(1)),
            carbs_g:     parseFloat(day.carbs.toFixed(1)),
            fats_g:      parseFloat(day.fats.toFixed(1)),
            sugars_g:    parseFloat(day.sugars.toFixed(1)),
            fibers_g:    parseFloat(day.fibers.toFixed(1)),
            weight_kg:   day.weight || null,
            belly_cm:    day.belly  || null,
            bedtime:     day.bedtime || null,
            sleep_duration_h: day.sleepDuration || null,
            water_ml:    day.water  || 0,
            steps:       day.steps  || 0,
        };
        if (Object.keys(meals).length > 0)     dayObj.meals      = meals;
        if (activities.length > 0)              dayObj.activities = activities;
        return dayObj;
    }));

    // Moyennes et totaux
    const n = days.length;
    const avg   = key => n > 0 ? parseFloat((days.reduce((s, d) => s + (d[key] || 0), 0) / n).toFixed(1)) : 0;
    const total  = key => parseFloat(days.reduce((s, d) => s + (d[key] || 0), 0).toFixed(1));

    const totalP   = total('proteins_g');
    const totalC   = total('carbs_g');
    const totalF   = total('fats_g');
    const totalS   = total('sugars_g');
    const totalFib = total('fibers_g');
    const macroTotal = totalP + totalC + totalF + totalS + totalFib;
    const pct = v => macroTotal > 0 ? parseFloat((v / macroTotal * 100).toFixed(1)) : 0;

    const exportData = {
        export_info: {
            generated_at: new Date().toISOString(),
            period: lastPeriodLabel,
            days_count: n,
            meals_format: 'shared time for petit-dejeuner/dejeuner/diner; per-item time for snacks',
            low_calorie_filter: lastStatsFilterInfo,
        },
        summary: {
            avg_calories_kcal: avg('calories_consumed'),
            avg_proteins_g:    avg('proteins_g'),
            avg_carbs_g:       avg('carbs_g'),
            avg_fats_g:        avg('fats_g'),
            avg_sugars_g:      avg('sugars_g'),
            avg_fibers_g:      avg('fibers_g'),
            avg_water_ml:      avg('water_ml'),
            avg_steps:         avg('steps'),
            total_proteins_g:  totalP,
            total_carbs_g:     totalC,
            total_fats_g:      totalF,
            total_sugars_g:    totalS,
            total_fibers_g:    totalFib,
        },
        macros_distribution_percent: {
            proteins: pct(totalP),
            carbs:    pct(totalC),
            fats:     pct(totalF),
            sugars:   pct(totalS),
            fibers:   pct(totalFib),
        },
        daily_data: days,
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `nutrition_export_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
