// js/meal-history.js - Journal chronologique des repas par jour

import * as db from './db.js';
import { getAllFromStore } from './db.js';
import { calculateDayTotals, formatDateKey } from './utils.js';

const MEAL_LABELS = {
    'petit-dej': { label: 'Petit-déjeuner', icon: '🌅' },
    'dejeuner':  { label: 'Déjeuner',       icon: '☀️' },
    'diner':     { label: 'Dîner',           icon: '🌙' },
    'snack':     { label: 'Snacks',          icon: '🍎' },
};

let currentPeriod = 7;

/**
 * Met à jour le journal des repas pour la période donnée.
 * @param {number|string|{startDate,endDate}} period - même format que les autres graphiques
 */
export async function updateMealHistory(period, foods, composedMeals = {}) {
    currentPeriod = period;
    const container = document.getElementById('journalTimeline');
    if (!container) return;

    container.innerHTML = '<p class="journal-empty">Chargement...</p>';

    // Mettre à jour le libellé de période
    const infoEl = document.getElementById('journalPeriodInfo');
    if (infoEl) {
        if (period && typeof period === 'object' && period.startDate && period.endDate) {
            const s = new Date(period.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            const e = new Date(period.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            infoEl.textContent = `Période : du ${s} au ${e}`;
        } else if (period === 'all') {
            infoEl.textContent = 'Toutes les données disponibles';
        } else {
            infoEl.textContent = `${period} derniers jours`;
        }
    }

    const today = new Date();
    const days = [];

    if (period && typeof period === 'object' && period.startDate && period.endDate) {
        // Plage personnalisée
        const start = new Date(period.startDate + 'T12:00:00');
        const end   = new Date(period.endDate   + 'T12:00:00');
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const date = new Date(d);
            await _pushDay(date, days, foods, composedMeals);
        }
    } else if (period === 'all') {
        // Charger toutes les entrées connues depuis IndexedDB
        const allMealsRaw = await getAllFromStore('dailyMeals');
        const sorted = allMealsRaw.sort((a, b) => a.date.localeCompare(b.date));
        for (const entry of sorted) {
            const date = new Date(entry.date + 'T12:00:00');
            await _pushDay(date, days, foods, composedMeals);
        }
    } else {
        // N derniers jours
        const numDays = parseInt(period, 10) || 7;
        for (let i = numDays - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            await _pushDay(date, days, foods, composedMeals);
        }
    }

    // Inverser : du plus récent au plus ancien
    days.reverse();

    const nonEmptyDays = days.filter(d => d.itemCount > 0);

    if (nonEmptyDays.length === 0) {
        container.innerHTML = '<p class="journal-empty">Aucun repas enregistré sur cette période.</p>';
        return;
    }

    container.innerHTML = '';

    nonEmptyDays.forEach((day, idx) => {
        const card = buildDayCard(day, foods, composedMeals, idx === 0);
        container.appendChild(card);
    });
}

/**
 * Charge un jour et l'ajoute au tableau days
 */
async function _pushDay(date, days, foods, composedMeals) {
    const meals = await db.loadDayMeals(date);
    const totals = calculateDayTotals(meals, foods, composedMeals);
    const itemCount = Object.values(meals).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
    days.push({ date: new Date(date), dateKey: formatDateKey(date), meals, totals, itemCount });
}

/**
 * Construit la card d'un jour
 */
function buildDayCard(day, foods, composedMeals, expanded = false) {
    const { date, meals, totals, itemCount } = day;

    const dateLabel = date.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    const isToday = formatDateKey(date) === formatDateKey(new Date());
    const todayBadge = isToday ? '<span class="journal-today-badge">Aujourd\'hui</span>' : '';

    const card = document.createElement('div');
    card.className = 'journal-day-card' + (expanded ? ' open' : '');

    // Barres de macros compactes
    const macroBar = buildMacroBar(totals);

    card.innerHTML = `
        <button class="journal-day-header" aria-expanded="${expanded}">
            <div class="journal-day-header-left">
                <span class="journal-day-date">${dateLabel}</span>
                ${todayBadge}
                <span class="journal-day-count">${itemCount} aliment${itemCount > 1 ? 's' : ''}</span>
            </div>
            <div class="journal-day-header-right">
                <div class="journal-day-macros-inline">
                    <span class="jm-cal">${Math.round(totals.calories)} kcal</span>
                    <span class="jm-prot">P ${totals.proteins.toFixed(0)}g</span>
                    <span class="jm-carb">G ${totals.carbs.toFixed(0)}g</span>
                    <span class="jm-fat">L ${totals.fats.toFixed(0)}g</span>
                </div>
                <span class="journal-chevron">${expanded ? '▲' : '▼'}</span>
            </div>
        </button>
        <div class="journal-day-body">
            ${macroBar}
            <div class="journal-meal-list">
                ${buildMealSections(meals, foods, composedMeals)}
            </div>
        </div>
    `;

    // Toggle open/close
    card.querySelector('.journal-day-header').addEventListener('click', () => {
        const isOpen = card.classList.toggle('open');
        card.querySelector('.journal-day-header').setAttribute('aria-expanded', isOpen);
        card.querySelector('.journal-chevron').textContent = isOpen ? '▲' : '▼';
    });

    return card;
}

/**
 * Barre de macros colorée
 */
function buildMacroBar(totals) {
    const total = totals.proteins + totals.carbs + totals.fats;
    if (total === 0) return '';
    const pPct = ((totals.proteins * 4 / (totals.calories || 1)) * 100).toFixed(1);
    const cPct = ((totals.carbs   * 4 / (totals.calories || 1)) * 100).toFixed(1);
    const fPct = ((totals.fats    * 9 / (totals.calories || 1)) * 100).toFixed(1);

    return `
        <div class="journal-macro-bar-wrap">
            <div class="journal-macro-bar">
                <div class="jmb-prot" style="width:${pPct}%" title="Protéines ${pPct}%"></div>
                <div class="jmb-carb" style="width:${cPct}%" title="Glucides ${cPct}%"></div>
                <div class="jmb-fat"  style="width:${fPct}%" title="Lipides ${fPct}%"></div>
            </div>
            <div class="journal-macro-legend">
                <span class="jml-prot">■ Prot. ${pPct}%</span>
                <span class="jml-carb">■ Gluc. ${cPct}%</span>
                <span class="jml-fat">■ Lip. ${fPct}%</span>
            </div>
        </div>
    `;
}

/**
 * Construit les sections par type de repas (petit-dej, dejeuner…)
 */
function buildMealSections(meals, foods, composedMeals) {
    const sections = [];

    for (const [mealType, items] of Object.entries(meals)) {
        if (!Array.isArray(items) || items.length === 0) continue;
        const meta = MEAL_LABELS[mealType] || { label: mealType, icon: '🍽️' };

        const rows = items.map(item => buildItemRow(item, foods, composedMeals)).join('');

        sections.push(`
            <div class="journal-meal-section">
                <div class="journal-meal-type-header">
                    <span class="jmt-icon">${meta.icon}</span>
                    <span class="jmt-label">${meta.label}</span>
                </div>
                <ul class="journal-item-list">${rows}</ul>
            </div>
        `);
    }

    return sections.join('') || '<p class="journal-empty-day">Aucun aliment enregistré.</p>';
}

/**
 * Construit une ligne pour un aliment/repas consommé
 */
function buildItemRow(item, foods, composedMeals) {
    let food = null;
    let isMeal = false;

    if (item.isMeal && composedMeals[item.id]) {
        food = composedMeals[item.id];
        isMeal = true;
    } else {
        food = foods[item.id];
    }

    if (!food) {
        return `<li class="journal-item-row journal-item-unknown">
            <span class="ji-name">Aliment inconnu (${item.id})</span>
        </li>`;
    }

    // Calcul des macros affichées
    let cal, prot, carb, fat;
    if (isMeal && food.isPortionAdjustable) {
        const totalW = food.totalWeight || 1;
        const consumed = item.weight || totalW;
        const factor = consumed / totalW;
        cal  = Math.round((food.calories  || 0) * factor);
        prot = ((food.proteins || 0) * factor).toFixed(1);
        carb = ((food.carbs    || 0) * factor).toFixed(1);
        fat  = ((food.fats     || 0) * factor).toFixed(1);
    } else {
        const w = item.weight || 0;
        cal  = Math.round((food.calories  || 0) * w / 100);
        prot = ((food.proteins || 0) * w / 100).toFixed(1);
        carb = ((food.carbs    || 0) * w / 100).toFixed(1);
        fat  = ((food.fats     || 0) * w / 100).toFixed(1);
    }

    const badge = isMeal ? '<span class="ji-meal-badge">REPAS</span>' : '';
    const weight = item.weight ? `${item.weight}g` : '';

    return `
        <li class="journal-item-row">
            <div class="ji-left">
                ${badge}
                <span class="ji-name">${food.name}</span>
                ${weight ? `<span class="ji-weight">${weight}</span>` : ''}
            </div>
            <div class="ji-right">
                <span class="ji-cal">${cal} kcal</span>
                <span class="ji-macros">P${prot} G${carb} L${fat}</span>
            </div>
        </li>
    `;
}
