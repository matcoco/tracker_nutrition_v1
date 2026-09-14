// tests/unit/stats-costs.test.js
// Tests unitaires de js/stats/costs.js : updateCostCharts().

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { ChartStub } from '../setup/setup.js';
import * as db from '../../js/core/db.js';
import { calculateDayCost } from '../../js/core/utils.js';
import { foodsFixture, dayFixture } from '../helpers/fixtures.js';
import { saveStatsFilterSettings } from '../../js/stats/charts.js';
import { updateCostCharts } from '../../js/stats/costs.js';

const STORES = [
    'foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps',
    'dailyActivities', 'customActivities', 'healthEvents',
];

const COST_CHART_IDS = ['dailyCostsChart', 'costsByMealChart', 'topCostsChart', 'costComparisonChart'];

function todayNoon() {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
}

async function seedToday(meals = dayFixture()) {
    await db.saveDayMeals(todayNoon(), meals, 70);
}

function chartById(id) {
    return ChartStub.instances.find((instance) => instance.ctx && instance.ctx.id === id);
}

/** Attend qu'une condition devienne vraie (les 2 derniers graphiques sont créés
 *  par des fonctions async non attendues par updateCostCharts). */
async function waitFor(predicate, { timeout = 2000, interval = 5 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) {
            throw new Error('Condition non satisfaite dans le délai imparti');
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}

/** Laisse toutes les créations de graphiques asynchrones se terminer avant le
 *  test suivant (sinon elles polluent le ChartStub du test d'après). */
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
    await seedToday();
});

afterEach(async () => {
    await drainPendingCharts();
    document.body.innerHTML = '';
});

// Coût de la journée type : pomme 150 g (2,5 €/kg) = 0,375 € ; riz 100 g (3 €/kg) = 0,30 €.
const DAY_COST = calculateDayCost(dayFixture(), foodsFixture());

describe('costs.updateCostCharts — cartes de synthèse', () => {
    it('affiche le coût total de la période', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        expect(el('totalCost').textContent).toBe(`${DAY_COST.toFixed(2)} €`);
        expect(el('totalCostPeriod').textContent).toBe('7 derniers jours');
        // Le coût réel est 0,675 € ; l'affichage arrondit à 0,68 €.
        expect(DAY_COST).toBeCloseTo(0.675, 6);
        expect(el('totalCost').textContent).toBe('0.68 €');
    });

    it('affiche le coût moyen par jour et le nombre de jours comptabilisés', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        expect(el('avgDailyCost').textContent).toBe(`${(DAY_COST / 7).toFixed(2)} €`);
        expect(el('avgCostPeriod').textContent).toBe('7 jours comptabilisés');
    });

    it('projette le coût mensuel sur 30 jours', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        expect(el('monthlyCost').textContent).toBe(`${((DAY_COST / 7) * 30).toFixed(2)} €`);
    });

    it('accorde le libellé au singulier pour un seul jour comptabilisé', async () => {
        // Seule la journée du jour dépasse 500 kcal, les 6 autres valent 0.
        saveStatsFilterSettings({ excludeLowCalorieDays: true, lowCalorieThreshold: 500 });
        await updateCostCharts(7, foodsFixture(), {});
        expect(el('avgCostPeriod').textContent).toBe('1 jour comptabilisé');
        expect(el('avgDailyCost').textContent).toBe(`${DAY_COST.toFixed(2)} €`);
    });

    it('affiche des zéros sans données', async () => {
        await updateCostCharts(7, {}, {});
        expect(el('totalCost').textContent).toBe('0.00 €');
        expect(el('avgDailyCost').textContent).toBe('0.00 €');
        expect(el('monthlyCost').textContent).toBe('0.00 €');
        expect(el('avgCostPeriod').textContent).toBe('7 jours comptabilisés');
    });

    it('affiche la période demandée dans la carte de période', async () => {
        await updateCostCharts(30, foodsFixture(), {});
        expect(el('totalCostPeriod').textContent).toBe('30 derniers jours');
        expect(el('avgCostPeriod').textContent).toBe('30 jours comptabilisés');
    });
});

describe('costs.updateCostCharts — graphiques', () => {
    it('crée les 4 graphiques de coûts', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        await waitFor(() => ChartStub.instances.length >= COST_CHART_IDS.length);

        for (const id of COST_CHART_IDS) {
            expect(chartById(id), `graphique ${id} attendu`).toBeTruthy();
        }
    });

    it('alimente l’évolution quotidienne des coûts', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        const chart = chartById('dailyCostsChart');
        expect(chart.data.labels).toHaveLength(7);
        expect(chart.data.datasets[0].data).toHaveLength(7);
        // Dernier jour = aujourd'hui.
        expect(chart.data.datasets[0].data.at(-1)).toBe(DAY_COST.toFixed(2));
    });

    it('répartit les coûts par type de repas', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        const chart = chartById('costsByMealChart');
        expect(chart.config.type).toBe('doughnut');
        expect(chart.data.labels).toEqual(['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Snack']);
        // pomme au petit-déjeuner (0,375 €) et riz au dîner (0,30 €).
        expect(chart.data.datasets[0].data).toEqual([
            (0.375).toFixed(2),
            (0).toFixed(2),
            (0.3).toFixed(2),
            (0).toFixed(2),
        ]);
    });

    it('classe le top des aliments les plus chers', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        await waitFor(() => chartById('topCostsChart') !== undefined);
        const chart = chartById('topCostsChart');
        expect(chart.data.labels).toEqual(['Pomme', 'Riz']);
        expect(chart.data.datasets[0].data).toEqual(['0.38', '0.30']);
    });

    it('compare les moyennes 7 j et 30 j', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        await waitFor(() => chartById('costComparisonChart') !== undefined);
        const chart = chartById('costComparisonChart');
        expect(chart.data.labels).toEqual(['Moyenne 7j', 'Moyenne 30j']);
        expect(chart.data.datasets[0].data).toEqual([(DAY_COST / 7).toFixed(2), (DAY_COST / 30).toFixed(2)]);
    });

    it('détruit les graphiques précédents au second appel', async () => {
        await updateCostCharts(7, foodsFixture(), {});
        await waitFor(() => ChartStub.instances.length >= COST_CHART_IDS.length);
        const firstRun = ChartStub.instances.slice();
        expect(firstRun).toHaveLength(COST_CHART_IDS.length);

        await updateCostCharts(7, foodsFixture(), {});
        // Les 2 graphiques async du 2e passage doivent être recréés pour que les
        // anciens aient été détruits.
        await waitFor(() => ChartStub.instances.length >= COST_CHART_IDS.length * 2);
        for (const instance of firstRun) {
            expect(instance.destroyed).toBe(true);
        }
    });

    it('prend en compte les repas composés ajustables', async () => {
        const composedMeals = {
            'poulet-riz': {
                name: 'Poulet riz',
                totalWeight: 400,
                isPortionAdjustable: true,
                calories: 400,
                proteins: 40,
                carbs: 50,
                fats: 8,
                sugars: 1,
                fibers: 2,
                price: 5,
                priceQuantity: 400,
                priceUnit: 'grams',
                ingredients: [{ foodId: 'poulet', weight: 200 }, { foodId: 'riz', weight: 200 }],
            },
        };
        const meals = {
            'petit-dej': [],
            dejeuner: [{ id: 'poulet-riz', isMeal: true, weight: 200 }],
            diner: [],
            snack: [],
        };
        await db.saveDayMeals(todayNoon(), meals, 70);

        await updateCostCharts(7, foodsFixture(), composedMeals);
        await waitFor(() => chartById('topCostsChart') !== undefined);
        // 200 g consommés sur 400 g => 2,50 €.
        expect(Number(el('totalCost').textContent.replace(' €', ''))).toBeCloseTo(2.5, 6);
    });
});
