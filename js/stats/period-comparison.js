// js/stats/period-comparison.js
// Comparaison de deux plages de dates indépendantes dans l'onglet Statistiques.

import { loadMealsByDateRange } from '../core/db.js';
import { applyStatsFilterToDailyData } from './charts.js';

const STORAGE_KEY = 'nt_period_comparison';
const PROTEIN_MAINTENANCE_MIN_G_PER_KG = 1.6;

const METRICS = {
    calories: { label: 'Calories consommées', unit: 'kcal', digits: 0, neutral: true },
    netCalories: { label: 'Calories nettes', unit: 'kcal', digits: 0, neutral: true },
    calorieGoal: { label: 'Objectif calorique', unit: 'kcal', digits: 0, neutral: true },
    weight: { label: 'Poids moyen', unit: 'kg', digits: 1, neutral: true },
    proteinRatio: { label: 'Protéines / poids', unit: 'g/kg', digits: 2, higherIsBetter: true },
    carbs: { label: 'Glucides', unit: 'g', digits: 1, neutral: true },
    sugars: { label: 'Sucres', unit: 'g', digits: 1, lowerIsBetter: true },
    fibers: { label: 'Fibres', unit: 'g', digits: 1, higherIsBetter: true },
    caloriesBurned: { label: 'Activité physique', unit: 'kcal', digits: 0, higherIsBetter: true },
    water: { label: 'Hydratation', unit: 'ml', digits: 0, higherIsBetter: true }
};

let chart = null;
let lastComparison = null;

function formatDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function shiftDate(date, days) {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + days);
    return shifted;
}

function setDefaultDates() {
    const endB = new Date();
    const startB = shiftDate(endB, -6);
    const endA = shiftDate(startB, -1);
    const startA = shiftDate(endA, -6);
    return {
        aStart: formatDateKey(startA),
        aEnd: formatDateKey(endA),
        bStart: formatDateKey(startB),
        bEnd: formatDateKey(endB)
    };
}

function readSavedDates() {
    try {
        return { ...setDefaultDates(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch (error) {
        return setDefaultDates();
    }
}

function readDatesFromUI() {
    return {
        aStart: document.getElementById('comparisonPeriodAStart')?.value || '',
        aEnd: document.getElementById('comparisonPeriodAEnd')?.value || '',
        bStart: document.getElementById('comparisonPeriodBStart')?.value || '',
        bEnd: document.getElementById('comparisonPeriodBEnd')?.value || ''
    };
}

function writeDatesToUI(dates) {
    document.getElementById('comparisonPeriodAStart').value = dates.aStart;
    document.getElementById('comparisonPeriodAEnd').value = dates.aEnd;
    document.getElementById('comparisonPeriodBStart').value = dates.bStart;
    document.getElementById('comparisonPeriodBEnd').value = dates.bEnd;
}

function isValidRange(startDate, endDate) {
    return /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
        && new Date(`${startDate}T12:00:00`) <= new Date(`${endDate}T12:00:00`);
}

function average(values) {
    // Number(null) === 0 : sans ce filtre, une journée sans donnée tirait la
    // moyenne vers 0 (ex. [71 kg, null] donnait 35,5 kg).
    const validValues = values
        .filter(value => value !== null && value !== undefined && value !== '')
        .map(Number)
        .filter(Number.isFinite);
    if (!validValues.length) return null;
    return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function getEffectiveWeight(day, goals) {
    const dayWeight = Number(day.weight);
    if (Number.isFinite(dayWeight) && dayWeight > 0) return dayWeight;
    const goalsWeight = Number(goals?.weight);
    return Number.isFinite(goalsWeight) && goalsWeight > 0 ? goalsWeight : null;
}

function enrichDays(days, goals) {
    return days.map(day => {
        const weight = getEffectiveWeight(day, goals);
        return {
            ...day,
            calorieGoal: Number(day.calorieGoal) > 0 ? Number(day.calorieGoal) : Number(goals?.calories) || null,
            proteinRatio: weight ? (Number(day.proteins) || 0) / weight : null
        };
    });
}

function metricAverage(days, metric) {
    return average(days.map(day => day[metric]));
}

/** Indique si une valeur est exploitable (null/'' ne sont pas des nombres). */
function isUsableNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function formatValue(value, metric) {
    if (!isUsableNumber(value)) return 'Non renseigné';
    const config = METRICS[metric];
    return `${Number(value).toFixed(config.digits)} ${config.unit}`;
}

function formatDifference(a, b, metric) {
    if (!isUsableNumber(a) || !isUsableNumber(b)) {
        return { text: 'Non calculable', className: 'neutral' };
    }

    const difference = Number(b) - Number(a);
    const percent = Number(a) !== 0 ? (difference / Math.abs(Number(a))) * 100 : null;
    const sign = difference > 0 ? '+' : '';
    const percentText = percent === null ? '' : ` (${sign}${percent.toFixed(1)} %)`;
    const config = METRICS[metric];
    let className = 'neutral';
    if (!config.neutral && difference !== 0) {
        const isBetter = config.higherIsBetter ? difference > 0 : difference < 0;
        className = isBetter ? 'positive' : 'negative';
    }
    return {
        text: `${sign}${difference.toFixed(config.digits)} ${config.unit}${percentText}`,
        className
    };
}

function renderTable(periodA, periodB) {
    const tbody = document.getElementById('periodComparisonTableBody');
    tbody.innerHTML = '';
    Object.keys(METRICS).forEach(metric => {
        const averageA = metricAverage(periodA, metric);
        const averageB = metricAverage(periodB, metric);
        const difference = formatDifference(averageA, averageB, metric);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${METRICS[metric].label}</td>
            <td>${formatValue(averageA, metric)}</td>
            <td>${formatValue(averageB, metric)}</td>
            <td class="period-comparison-diff ${difference.className}">${difference.text}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderChart() {
    if (!lastComparison) return;
    const metric = document.getElementById('periodComparisonMetric')?.value || 'calories';
    const config = METRICS[metric];
    const { periodA, periodB } = lastComparison;
    const count = Math.max(periodA.length, periodB.length);
    const labels = Array.from({ length: count }, (_, index) => `Jour ${index + 1}`);
    const valuesA = labels.map((_, index) => periodA[index]?.[metric] ?? null);
    const valuesB = labels.map((_, index) => periodB[index]?.[metric] ?? null);
    const datasets = [{
        label: 'Période A',
        data: valuesA,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.10)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 3,
        fill: false
    }, {
        label: 'Période B',
        data: valuesB,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.10)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 3,
        fill: false
    }];

    if (metric === 'proteinRatio') {
        datasets.push({
            label: 'Minimum maintien musculaire',
            data: labels.map(() => PROTEIN_MAINTENANCE_MIN_G_PER_KG),
            borderColor: '#0ea5e9',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        });
    }

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('periodComparisonChart'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: window.innerWidth >= 768,
            aspectRatio: window.innerWidth >= 768 ? 3 : 1.1,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top', labels: { usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: context => `${context.dataset.label}: ${formatValue(context.parsed.y, metric)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: metric !== 'weight',
                    title: { display: true, text: config.unit },
                    ticks: { callback: value => `${value} ${config.unit}` }
                }
            }
        }
    });
}

function setStatus(message, type = 'info') {
    const status = document.getElementById('periodComparisonStatus');
    status.textContent = message;
    status.className = `period-comparison-status ${type}`;
}

export async function comparePeriods(foods, goals, composedMeals) {
    const dates = readDatesFromUI();
    if (!isValidRange(dates.aStart, dates.aEnd) || !isValidRange(dates.bStart, dates.bEnd)) {
        setStatus('Vérifie les dates des deux périodes.', 'error');
        return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
    setStatus('Calcul de la comparaison...', 'loading');
    const [rawA, rawB] = await Promise.all([
        loadMealsByDateRange(dates.aStart, dates.aEnd, foods, composedMeals),
        loadMealsByDateRange(dates.bStart, dates.bEnd, foods, composedMeals)
    ]);
    const periodA = enrichDays(applyStatsFilterToDailyData(rawA), goals);
    const periodB = enrichDays(applyStatsFilterToDailyData(rawB), goals);
    lastComparison = { periodA, periodB };
    renderTable(periodA, periodB);
    renderChart();
    setStatus(`${periodA.length} jour(s) retenu(s) pour A, ${periodB.length} pour B. Les moyennes sont quotidiennes.`);
}

export function initPeriodComparison(getContext) {
    writeDatesToUI(readSavedDates());

    // Garde d'idempotence portée par l'élément lui-même : un second appel
    // n'empile pas un nouvel écouteur (chaque clic déclenchait sinon la
    // comparaison plusieurs fois), tout en restant correct si le DOM est remplacé.
    const compareButton = document.getElementById('comparePeriodsBtn');
    if (compareButton && !compareButton.dataset.periodComparisonBound) {
        compareButton.dataset.periodComparisonBound = 'true';
        compareButton.addEventListener('click', () => {
            const { foods, goals, composedMeals } = getContext();
            comparePeriods(foods, goals, composedMeals).catch(error => {
                setStatus(`Erreur : ${error.message}`, 'error');
            });
        });
    }

    const metricSelect = document.getElementById('periodComparisonMetric');
    if (metricSelect && !metricSelect.dataset.periodComparisonBound) {
        metricSelect.dataset.periodComparisonBound = 'true';
        metricSelect.addEventListener('change', renderChart);
    }
}
