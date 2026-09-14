// tests/unit/stats-activities-charts.test.js
// Tests unitaires de js/stats/activities-charts.js : updateActivityCharts().

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { ChartStub } from '../setup/setup.js';
import * as db from '../../js/core/db.js';
import { foodsFixture, dayFixture } from '../helpers/fixtures.js';
import { saveStatsFilterSettings } from '../../js/stats/charts.js';
import { updateActivityCharts } from '../../js/stats/activities-charts.js';

const STORES = [
    'foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps',
    'dailyActivities', 'customActivities', 'healthEvents',
];

const ACTIVITY_CHART_IDS = [
    'activityCaloriesChart', 'activityTimeChart', 'activityTypeDistChart',
    'topActivitiesChart', 'caloriesByTypeChart', 'activityComparisonChart',
];

function todayNoon() {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
}

async function seedToday(activities = [{ type: 'Course', calories: 300, duration: 30 }]) {
    await db.saveDayMeals(todayNoon(), dayFixture(), 70);
    await db.saveDayActivities(todayNoon(), activities);
}

function chartById(id) {
    return ChartStub.instances.find((instance) => instance.ctx && instance.ctx.id === id);
}

async function waitFor(predicate, { timeout = 2000, interval = 5 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) {
            throw new Error('Condition non satisfaite dans le délai imparti');
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}

/** Les comparaisons hebdo/mensuelles sont construites de façon asynchrone :
 *  on laisse le travail en attente se terminer avant le test suivant. */
async function drainPendingCharts() {
    let previous = -1;
    let stable = 0;
    const start = Date.now();
    while (stable < 4 && Date.now() - start < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (ChartStub.instances.length === previous) {
            stable += 1;
        } else {
            stable = 0;
            previous = ChartStub.instances.length;
        }
    }
}

beforeAll(async () => {
    await db.initDB();
});

beforeEach(async () => {
    loadAppDom();
    for (const store of STORES) {
        await db.clearStore(store);
    }
});

afterEach(async () => {
    await drainPendingCharts();
    document.body.innerHTML = '';
});

describe('activities.updateActivityCharts — création des graphiques', () => {
    it('crée les 5 graphiques synchrones', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});
        for (const id of ACTIVITY_CHART_IDS.slice(0, 5)) {
            expect(chartById(id), `graphique ${id} attendu`).toBeTruthy();
        }
    });

    it('crée aussi la comparaison hebdo/mensuelle (asynchrone)', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});
        await waitFor(() => chartById('activityComparisonChart') !== undefined);
        expect(ChartStub.instances).toHaveLength(ACTIVITY_CHART_IDS.length);
    });

    it('ne jette pas sans aucune donnée', async () => {
        await expect(updateActivityCharts(7, foodsFixture(), {})).resolves.toBeUndefined();
        const chart = chartById('activityCaloriesChart');
        expect(chart.data.labels).toHaveLength(7);
        expect(chart.data.datasets[0].data.every((value) => value === 0)).toBe(true);
    });
});

describe('activities.updateActivityCharts — contenu des graphiques', () => {
    it('rapporte les calories brûlées du jour', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});

        const calories = chartById('activityCaloriesChart');
        expect(calories.config.type).toBe('bar');
        expect(calories.data.labels).toHaveLength(7);
        // Dernier jour = aujourd'hui.
        expect(calories.data.datasets[0].data.at(-1)).toBe(300);
    });

    it('rapporte la durée d’activité et l’objectif de 30 min', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});

        const time = chartById('activityTimeChart');
        expect(time.data.datasets[0].data.at(-1)).toBe(30);
        expect(time.data.datasets[1].label).toBe('Objectif recommandé');
        expect(time.data.datasets[1].data).toEqual(Array(7).fill(30));
    });

    it('agrège la répartition par type d’activité', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});

        const distribution = chartById('activityTypeDistChart');
        expect(distribution.config.type).toBe('doughnut');
        expect(distribution.data.labels).toEqual(['Course']);
        expect(distribution.data.datasets[0].data).toEqual([30]);
    });

    it('compte les sessions par type d’activité', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});

        const top = chartById('topActivitiesChart');
        expect(top.data.labels).toEqual(['Course']);
        expect(top.data.datasets[0].data).toEqual([1]);
    });

    it('agrège les calories par type d’activité', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});

        const byType = chartById('caloriesByTypeChart');
        expect(byType.data.labels).toEqual(['Course']);
        expect(byType.data.datasets[0].data).toEqual([300]);
    });

    it('agrège plusieurs types d’activité dans la même journée', async () => {
        await seedToday([
            { type: 'Course', calories: 300, duration: 30 },
            { type: 'Yoga', calories: 100, duration: 45 },
            { type: 'Course', calories: 50, duration: 10 },
        ]);
        await updateActivityCharts(7, foodsFixture(), {});

        const distribution = chartById('activityTypeDistChart');
        // Course : 40 min cumulées, Yoga : 45 min -> tri décroissant.
        expect(distribution.data.labels).toEqual(['Yoga', 'Course']);
        expect(distribution.data.datasets[0].data).toEqual([45, 40]);

        const top = chartById('topActivitiesChart');
        // Course : 2 sessions, Yoga : 1 session.
        expect(top.data.labels).toEqual(['Course', 'Yoga']);
        expect(top.data.datasets[0].data).toEqual([2, 1]);

        const byType = chartById('caloriesByTypeChart');
        expect(byType.data.labels).toEqual(['Course', 'Yoga']);
        expect(byType.data.datasets[0].data).toEqual([350, 100]);

        const time = chartById('activityTimeChart');
        expect(time.data.datasets[0].data.at(-1)).toBe(85);
    });

    it('compare les moyennes 7 j et 30 j', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});
        await waitFor(() => chartById('activityComparisonChart') !== undefined);

        const comparison = chartById('activityComparisonChart');
        expect(comparison.data.labels).toEqual(['Moyenne 7j', 'Moyenne 30j']);
        // 300 kcal / 7 jours et / 30 jours ; 30 min / 7 et / 30.
        expect(comparison.data.datasets[0].data).toEqual([(300 / 7).toFixed(0), (300 / 30).toFixed(0)]);
        expect(comparison.data.datasets[1].data).toEqual([(30 / 7).toFixed(0), (30 / 30).toFixed(0)]);
    });
});

describe('activities.updateActivityCharts — filtres et cycle de vie', () => {
    it('exclut les journées filtrées', async () => {
        await seedToday();
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 500 });
        await updateActivityCharts(7, foodsFixture(), {});

        const calories = chartById('activityCaloriesChart');
        // Seule la journée du jour (758 kcal) passe le seuil.
        expect(calories.data.labels).toHaveLength(1);
        expect(calories.data.datasets[0].data).toEqual([300]);
    });

    it('détruit les graphiques précédents au second appel', async () => {
        await seedToday();
        await updateActivityCharts(7, foodsFixture(), {});
        await waitFor(() => ChartStub.instances.length >= ACTIVITY_CHART_IDS.length);
        const firstRun = ChartStub.instances.slice();
        expect(firstRun).toHaveLength(ACTIVITY_CHART_IDS.length);

        await updateActivityCharts(7, foodsFixture(), {});
        await waitFor(() => ChartStub.instances.length >= ACTIVITY_CHART_IDS.length * 2);
        for (const instance of firstRun) {
            expect(instance.destroyed).toBe(true);
        }
    });

    it('utilise les canvas attendues', () => {
        for (const id of ACTIVITY_CHART_IDS) {
            expect(el(id)).toBeInstanceOf(HTMLCanvasElement);
        }
    });
});
