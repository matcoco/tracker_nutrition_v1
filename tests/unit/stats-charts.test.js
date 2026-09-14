// tests/unit/stats-charts.test.js
// Tests unitaires de js/stats/charts.js : filtres statistiques, options
// responsives et intégration de updateCharts().

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { ChartStub } from '../setup/setup.js';
import * as db from '../../js/core/db.js';
import { foodsFixture, goalsFixture, dayFixture } from '../helpers/fixtures.js';
import {
    getStatsFilterSettings,
    saveStatsFilterSettings,
    isDayAllowedByStatsFilter,
    applyStatsFilterToDailyData,
    getResponsiveOptions,
    updateCharts,
} from '../../js/stats/charts.js';

const STORES = [
    'foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps',
    'dailyActivities', 'customActivities', 'healthEvents',
];

const FILTER_KEY = 'nt_stats_filter_settings';

// Toutes les canvas créées par updateCharts().
const UPDATE_CHARTS_IDS = [
    'combinedStatsChart', 'caloriesChart', 'macrosChart', 'proteinsChart',
    'proteinRatioChart', 'carbsChart', 'lipidsChart', 'sugarsChart',
    'fibersChart', 'weightChart', 'bellyChart', 'bedtimeChart',
    'sleepDurationChart', 'waterChart', 'stepsChart',
];

/** Date « aujourd'hui » à midi, pour rester stable entre fuseaux. */
function todayNoon() {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
}

/** Remplit les repas du jour à la date de référence. */
async function seedToday(meals = dayFixture(), weight = 70) {
    await db.saveDayMeals(todayNoon(), meals, weight);
}

/** Ids des canvas passés à chaque instance Chart créée. */
function chartIds() {
    return ChartStub.instances.map((instance) => instance.ctx && instance.ctx.id);
}

beforeAll(async () => {
    await db.initDB();
});

beforeEach(async () => {
    loadAppDom();
    for (const store of STORES) {
        await db.clearStore(store);
    }
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 });
});

afterEach(() => {
    document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// getStatsFilterSettings
// ---------------------------------------------------------------------------
describe('charts.getStatsFilterSettings', () => {
    it('renvoie les valeurs par défaut quand rien n’est enregistré', () => {
        expect(getStatsFilterSettings()).toEqual({
            excludeLowCalorieDays: false,
            lowCalorieThreshold: 1500,
        });
    });

    it('relit les valeurs enregistrées', () => {
        localStorage.setItem(FILTER_KEY, JSON.stringify({ excludeLowCalorieDays: true, lowCalorieThreshold: 1200 }));
        expect(getStatsFilterSettings()).toEqual({
            excludeLowCalorieDays: true,
            lowCalorieThreshold: 1200,
        });
    });

    it('convertit excludeLowCalorieDays en booléen', () => {
        localStorage.setItem(FILTER_KEY, JSON.stringify({ excludeLowCalorieDays: 0, lowCalorieThreshold: 1800 }));
        expect(getStatsFilterSettings().excludeLowCalorieDays).toBe(false);

        localStorage.setItem(FILTER_KEY, JSON.stringify({ excludeLowCalorieDays: 'oui', lowCalorieThreshold: 1800 }));
        expect(getStatsFilterSettings().excludeLowCalorieDays).toBe(true);
    });

    it('retombe sur 1500 si le seuil est absent ou non numérique', () => {
        localStorage.setItem(FILTER_KEY, JSON.stringify({ excludeLowCalorieDays: true }));
        expect(getStatsFilterSettings().lowCalorieThreshold).toBe(1500);

        localStorage.setItem(FILTER_KEY, JSON.stringify({ lowCalorieThreshold: 'abc' }));
        expect(getStatsFilterSettings().lowCalorieThreshold).toBe(1500);
    });

    it('ne jette pas sur un JSON corrompu et renvoie les valeurs par défaut', () => {
        localStorage.setItem(FILTER_KEY, '{ ceci nest pas du json');
        expect(getStatsFilterSettings()).toEqual({
            excludeLowCalorieDays: false,
            lowCalorieThreshold: 1500,
        });
    });
});

// ---------------------------------------------------------------------------
// saveStatsFilterSettings
// ---------------------------------------------------------------------------
describe('charts.saveStatsFilterSettings', () => {
    it('normalise, persiste et renvoie les réglages', () => {
        const result = saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 1700 });

        expect(result).toEqual({ excludeLowCalorieDays: true, lowCalorieThreshold: 1700 });
        expect(JSON.parse(localStorage.getItem(FILTER_KEY))).toEqual({
            excludeLowCalorieDays: true,
            lowCalorieThreshold: 1700,
        });
    });

    it('applique les valeurs par défaut pour un seuil manquant ou non numérique', () => {
        expect(saveStatsFilterSettings({})).toEqual({
            excludeLowCalorieDays: false,
            lowCalorieThreshold: 1500,
        });
        expect(saveStatsFilterSettings({ lowCalorieThreshold: 'pas un nombre' }).lowCalorieThreshold).toBe(1500);
    });

    it('borne un seuil négatif à 0', () => {
        expect(saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: -50 }).lowCalorieThreshold).toBe(0);
    });

    it('aller-retour avec getStatsFilterSettings', () => {
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 1600 });
        expect(getStatsFilterSettings()).toEqual({
            excludeLowCalorieDays: true,
            lowCalorieThreshold: 1600,
        });
    });
});

// ---------------------------------------------------------------------------
// isDayAllowedByStatsFilter
// ---------------------------------------------------------------------------
describe('charts.isDayAllowedByStatsFilter', () => {
    it('autorise toujours les journées quand le filtre est désactivé', () => {
        expect(isDayAllowedByStatsFilter(0)).toBe(true);
        expect(isDayAllowedByStatsFilter({ calories: 0 })).toBe(true);
        expect(isDayAllowedByStatsFilter(null)).toBe(true);
    });

    it('accepte un nombre de calories quand le filtre est actif', () => {
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 1500 });
        expect(isDayAllowedByStatsFilter(1500)).toBe(true);
        expect(isDayAllowedByStatsFilter(2000)).toBe(true);
        expect(isDayAllowedByStatsFilter(1499)).toBe(false);
    });

    it('lit la propriété calories d’un objet journée', () => {
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 1000 });
        expect(isDayAllowedByStatsFilter({ date: '2026-09-14', calories: 1200 })).toBe(true);
        expect(isDayAllowedByStatsFilter({ date: '2026-09-14', calories: 900 })).toBe(false);
    });

    it('accepte calories_consumed comme alias', () => {
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 1000 });
        expect(isDayAllowedByStatsFilter({ calories_consumed: 1100 })).toBe(true);
        expect(isDayAllowedByStatsFilter({ calories_consumed: 500 })).toBe(false);
    });

    it('traite une journée sans calories comme 0 (donc exclue avec un seuil > 0)', () => {
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 1000 });
        expect(isDayAllowedByStatsFilter({ date: '2026-09-14' })).toBe(false);
        expect(isDayAllowedByStatsFilter(null)).toBe(false);
    });

    it('accepte un seuil explicitement réglé à 0', () => {
        // Corrigé : `Number(x) || 1500` traitait 0 comme une valeur absente.
        const saved = saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 0 });
        expect(saved.lowCalorieThreshold).toBe(0);
        expect(isDayAllowedByStatsFilter({ calories: 0 })).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// applyStatsFilterToDailyData
// ---------------------------------------------------------------------------
describe('charts.applyStatsFilterToDailyData', () => {
    const data = [
        { date: '2026-09-12', calories: 800 },
        { date: '2026-09-13', calories: 2100 },
        { date: '2026-09-14', calories: 1500 },
    ];

    it('renvoie toutes les journées quand le filtre est désactivé', () => {
        expect(applyStatsFilterToDailyData(data)).toHaveLength(3);
    });

    it('exclut les journées sous le seuil quand le filtre est actif', () => {
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 1500 });
        const filtered = applyStatsFilterToDailyData(data);
        expect(filtered.map((d) => d.date)).toEqual(['2026-09-13', '2026-09-14']);
    });

    it('gère un tableau vide', () => {
        expect(applyStatsFilterToDailyData([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// getResponsiveOptions
// ---------------------------------------------------------------------------
describe('charts.getResponsiveOptions', () => {
    it('configure un graphique desktop classique', () => {
        const options = getResponsiveOptions(false);
        expect(options.responsive).toBe(true);
        expect(options.maintainAspectRatio).toBe(true);
        expect(options.aspectRatio).toBe(2);
        expect(options.plugins.legend.display).toBe(false);
        expect(options.plugins.legend.position).toBe('top');
        expect(options.scales.x.grid.display).toBe(true);
        expect(options.scales.x.ticks.maxTicksLimit).toBe(15);
        expect(options.interaction).toEqual({ mode: 'index', intersect: false });
    });

    it('affiche la légende quand des objectifs sont fournis', () => {
        expect(getResponsiveOptions(true).plugins.legend.display).toBe(true);
    });

    it('configure un donut desktop avec une légende à droite', () => {
        const options = getResponsiveOptions(true, true);
        expect(options.maintainAspectRatio).toBe(true);
        expect(options.plugins.legend.position).toBe('right');
        expect(options.plugins.legend.labels.boxWidth).toBe(15);
        // Un donut ne définit pas d'axes
        expect(options.scales).toBeUndefined();
    });

    it('adapte le rendu au mobile', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 480 });
        const options = getResponsiveOptions(false);
        expect(options.maintainAspectRatio).toBe(false);
        expect(options.aspectRatio).toBe(1.2);
        expect(options.scales.x.grid.display).toBe(false);
        expect(options.scales.x.ticks.maxTicksLimit).toBe(7);
        expect(options.scales.x.ticks.maxRotation).toBe(45);
    });

    it('place la légende du donut en bas sur mobile', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 480 });
        const options = getResponsiveOptions(false, true);
        expect(options.plugins.legend.position).toBe('bottom');
        expect(options.plugins.legend.labels.boxSize ?? options.plugins.legend.labels.boxWidth).toBe(12);
    });
});

// ---------------------------------------------------------------------------
// updateCharts — intégration légère
// ---------------------------------------------------------------------------
describe('charts.updateCharts — intégration', () => {
    it('ne jette pas sur une période vide', async () => {
        await expect(updateCharts(7, foodsFixture(), null, {})).resolves.toBeUndefined();
    });

    it('crée les 15 graphiques attendus', async () => {
        await seedToday();
        await updateCharts(7, foodsFixture(), goalsFixture(), {});

        expect(ChartStub.instances).toHaveLength(UPDATE_CHARTS_IDS.length);
        for (const id of UPDATE_CHARTS_IDS) {
            expect(chartIds()).toContain(id);
        }
    });

    it('alimente les graphiques avec les données de la journée', async () => {
        await seedToday();
        await updateCharts(7, foodsFixture(), goalsFixture(), {});

        const combined = ChartStub.instances.find((c) => c.ctx.id === 'combinedStatsChart');
        expect(combined.data.labels).toHaveLength(7);
        // Dernier jour = aujourd'hui : 78 + 330 + 350 kcal
        expect(combined.data.datasets[0].data.at(-1)).toBe(758);

        const calories = ChartStub.instances.find((c) => c.ctx.id === 'caloriesChart');
        expect(calories.data.labels).toHaveLength(7);
    });

    it('ajoute les séries d’objectifs quand goals les fournit', async () => {
        await seedToday();
        await updateCharts(7, foodsFixture(), goalsFixture({ waterGoal: 2000, stepsGoal: 8000 }), {});

        const water = ChartStub.instances.find((c) => c.ctx.id === 'waterChart');
        expect(water.data.datasets).toHaveLength(2);
        expect(water.data.datasets[1].label).toBe('Objectif');

        const steps = ChartStub.instances.find((c) => c.ctx.id === 'stepsChart');
        expect(steps.data.datasets).toHaveLength(2);
    });

    it('détruit les instances précédentes au lieu de les empiler', async () => {
        await seedToday();
        await updateCharts(7, foodsFixture(), goalsFixture(), {});
        const firstRun = ChartStub.instances.slice();

        await updateCharts(7, foodsFixture(), goalsFixture(), {});
        const secondRun = ChartStub.instances.slice(UPDATE_CHARTS_IDS.length);

        expect(secondRun).toHaveLength(UPDATE_CHARTS_IDS.length);
        // Les instances du 1er passage sont explicitement détruites...
        expect(firstRun).toHaveLength(UPDATE_CHARTS_IDS.length);
        for (const instance of firstRun) {
            expect(instance.destroyed).toBe(true);
        }
        // ...et un nouvel exemplaire est créé pour chaque canvas.
        expect(new Set(chartIds()).size).toBe(UPDATE_CHARTS_IDS.length);
    });

    it('gère aussi la période "all" sans jeter', async () => {
        await seedToday();
        await db.saveDayWater(todayNoon(), { totalMl: 1500, history: [] });
        await db.saveDaySteps(todayNoon(), 9000);
        await db.saveDayActivities(todayNoon(), [{ type: 'Course', calories: 300, duration: 30 }]);

        await expect(updateCharts('all', foodsFixture(), goalsFixture(), {})).resolves.toBeUndefined();
        expect(ChartStub.instances.length).toBeGreaterThanOrEqual(UPDATE_CHARTS_IDS.length);
    });

    it('prend en compte une plage de dates personnalisée', async () => {
        await seedToday();
        const today = todayNoon();
        const start = new Date(today);
        start.setDate(start.getDate() - 2);
        const period = { startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`, endDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` };

        await updateCharts(period, foodsFixture(), goalsFixture(), {});
        const combined = ChartStub.instances.find((c) => c.ctx.id === 'combinedStatsChart');
        expect(combined.data.labels).toHaveLength(3);
    });

    it('exclut les journées filtrées des graphiques', async () => {
        await seedToday();
        // Aujourd'hui = 758 kcal, les 6 autres journées = 0 kcal.
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 500 });
        await updateCharts(7, foodsFixture(), goalsFixture(), {});

        const combined = ChartStub.instances.find((c) => c.ctx.id === 'combinedStatsChart');
        // Seule la journée du jour dépasse le seuil ; les 6 autres sont exclues.
        expect(combined.data.labels).toHaveLength(1);
    });

    it('met à jour le tableau de perte de poids hebdomadaire', async () => {
        await seedToday();
        await updateCharts(7, foodsFixture(), goalsFixture(), {});
        expect(el('weeklyWeightLossTableBody').textContent).toContain('semaine');
    });
});
