// tests/unit/stats-charts-averages.test.js
// Tests unitaires de js/stats/charts-averages.js : updateAverageCharts().

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { ChartStub } from '../setup/setup.js';
import * as db from '../../js/core/db.js';
import { foodsFixture, goalsFixture, dayFixture } from '../helpers/fixtures.js';
import { updateAverageCharts } from '../../js/stats/charts-averages.js';

const STORES = [
    'foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps',
    'dailyActivities', 'customActivities', 'healthEvents',
];

const AVERAGE_CHART_IDS = [
    'avgCaloriesChart', 'avgProteinsChart', 'avgCarbsChart', 'avgFatsChart',
    'avgFibersChart', 'avgWeightChart', 'avgBellyChart', 'avgWaterChart',
    'avgStepsChart',
];

function todayNoon() {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
}

async function seedToday() {
    await db.saveDayMeals(todayNoon(), dayFixture(), 70);
    await db.saveDayBelly(todayNoon(), 85);
    await db.saveDayWater(todayNoon(), { totalMl: 1400, history: [] });
    await db.saveDaySteps(todayNoon(), 8000);
}

function chartById(id) {
    return ChartStub.instances.find((instance) => instance.ctx && instance.ctx.id === id);
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

afterEach(() => {
    document.body.innerHTML = '';
});

describe('averages.updateAverageCharts — mode semaine', () => {
    it('crée les 9 graphiques de moyennes', async () => {
        await updateAverageCharts('week', foodsFixture(), goalsFixture(), {});
        expect(ChartStub.instances).toHaveLength(AVERAGE_CHART_IDS.length);
        for (const id of AVERAGE_CHART_IDS) {
            expect(chartById(id)).toBeTruthy();
        }
    });

    it('produit 12 périodes hebdomadaires', async () => {
        await updateAverageCharts('week', foodsFixture(), null, {});
        const chart = chartById('avgCaloriesChart');
        expect(chart.data.labels).toHaveLength(12);
        expect(chart.data.datasets[0].data).toHaveLength(12);
    });

    it('calcule les moyennes à partir des données enregistrées', async () => {
        await seedToday();
        await updateAverageCharts('week', foodsFixture(), null, {});

        const chart = chartById('avgCaloriesChart');
        // Dernière période = semaine en cours (7 jours), dont 1 seul jour nourri.
        expect(Number(chart.data.datasets[0].data.at(-1))).toBeCloseTo(758 / 7, 0);

        const weight = chartById('avgWeightChart');
        expect(weight.data.datasets[0].data.at(-1)).toBeCloseTo(70, 6);

        const water = chartById('avgWaterChart');
        expect(Number(water.data.datasets[0].data.at(-1))).toBeCloseTo(1400 / 7, 0);
    });

    it('ajoute les séries d’objectifs pour les métriques concernées', async () => {
        await updateAverageCharts('week', foodsFixture(), goalsFixture({ waterGoal: 2000, stepsGoal: 9000 }), {});

        for (const id of ['avgCaloriesChart', 'avgProteinsChart', 'avgCarbsChart', 'avgFatsChart', 'avgWaterChart', 'avgStepsChart']) {
            expect(chartById(id).data.datasets).toHaveLength(2);
        }
        // Pas d'objectif défini pour ces trois métriques : une seule série.
        for (const id of ['avgFibersChart', 'avgWeightChart', 'avgBellyChart']) {
            expect(chartById(id).data.datasets).toHaveLength(1);
        }

        const calories = chartById('avgCaloriesChart');
        expect(calories.data.datasets[1].label).toBe('Objectif');
        expect(calories.data.datasets[1].data).toEqual(Array(12).fill(goalsFixture().calories));
    });

    it('n’ajoute aucune série d’objectif sans goals', async () => {
        await updateAverageCharts('week', foodsFixture(), null, {});
        for (const id of AVERAGE_CHART_IDS) {
            expect(chartById(id).data.datasets).toHaveLength(1);
        }
    });

    it('renvoie null pour le poids quand aucune pesée n’existe', async () => {
        await updateAverageCharts('week', foodsFixture(), null, {});
        const weight = chartById('avgWeightChart');
        expect(weight.data.datasets[0].data.every((value) => value === null)).toBe(true);
    });

    it('détruit les graphiques précédents au second appel', async () => {
        await updateAverageCharts('week', foodsFixture(), null, {});
        const first = ChartStub.instances.slice();

        await updateAverageCharts('week', foodsFixture(), null, {});
        expect(first).toHaveLength(AVERAGE_CHART_IDS.length);
        for (const instance of first) {
            expect(instance.destroyed).toBe(true);
        }
    });
});

describe('averages.updateAverageCharts — mode mois', () => {
    it('crée les 9 graphiques et 6 périodes mensuelles', async () => {
        await updateAverageCharts('month', foodsFixture(), goalsFixture(), {});
        expect(ChartStub.instances).toHaveLength(AVERAGE_CHART_IDS.length);
        expect(chartById('avgCaloriesChart').data.labels).toHaveLength(6);
    });

    it('les libellés mensuels contiennent l’année', async () => {
        await updateAverageCharts('month', foodsFixture(), null, {});
        const labels = chartById('avgCaloriesChart').data.labels;
        expect(labels.every((label) => /\d{4}/.test(label))).toBe(true);
    });

    it('les libellés hebdomadaires sont des plages de dates', async () => {
        await updateAverageCharts('week', foodsFixture(), null, {});
        expect(chartById('avgCaloriesChart').data.labels.every((label) => label.includes('→'))).toBe(true);
    });

    it('ne jette pas et crée bien les graphiques sans aucune donnée', async () => {
        await expect(updateAverageCharts('month', foodsFixture(), null, {})).resolves.toBeUndefined();
        expect(ChartStub.instances).toHaveLength(AVERAGE_CHART_IDS.length);
    });

    it('reflète les calories du mois en cours', async () => {
        await seedToday();
        await updateAverageCharts('month', foodsFixture(), null, {});
        const chart = chartById('avgCaloriesChart');
        const daysElapsed = new Date().getDate();
        expect(Number(chart.data.datasets[0].data.at(-1))).toBeCloseTo(758 / daysElapsed, 0);
    });
});

describe('averages.updateAverageCharts — interface', () => {
    it('le DOM contient bien les canvas utilisées', () => {
        for (const id of AVERAGE_CHART_IDS) {
            expect(el(id)).toBeInstanceOf(HTMLCanvasElement);
        }
    });
});
