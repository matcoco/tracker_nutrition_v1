// tests/unit/stats-period-comparison.test.js
// Tests unitaires de js/stats/period-comparison.js :
// comparePeriods() et initPeriodComparison().

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { ChartStub } from '../setup/setup.js';
import * as db from '../../js/core/db.js';
import { foodsFixture, goalsFixture, dayFixture } from '../helpers/fixtures.js';
import { comparePeriods, initPeriodComparison } from '../../js/stats/period-comparison.js';

const STORES = [
    'foods', 'meals', 'dailyMeals', 'goals', 'dailyWater', 'dailySteps',
    'dailyActivities', 'customActivities', 'healthEvents',
];

const STORAGE_KEY = 'nt_period_comparison';

/** Clé AAAA-MM-JJ d'un décalage de jours par rapport à aujourd'hui. */
function dateKey(offsetDays) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
    ].join('-');
}

function setComparisonDates(aStart, aEnd, bStart, bEnd) {
    el('comparisonPeriodAStart').value = aStart;
    el('comparisonPeriodAEnd').value = aEnd;
    el('comparisonPeriodBStart').value = bStart;
    el('comparisonPeriodBEnd').value = bEnd;
}

function tableRows() {
    return [...el('periodComparisonTableBody').querySelectorAll('tr')];
}

async function seedTwoDays() {
    const yesterday = new Date();
    yesterday.setHours(12, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    await db.saveDayMeals(yesterday, dayFixture(), 71);
    await db.saveDayMeals(today, dayFixture(), 70);
}

async function drainPendingWork() {
    await new Promise((resolve) => setTimeout(resolve, 25));
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
    await drainPendingWork();
    document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// comparePeriods
// ---------------------------------------------------------------------------
describe('periodComparison.comparePeriods', () => {
    it('compare deux journées et remplit le tableau de 10 métriques', async () => {
        await seedTwoDays();
        setComparisonDates(dateKey(-1), dateKey(-1), dateKey(0), dateKey(0));

        await comparePeriods(foodsFixture(), goalsFixture({ weight: 70 }), {});

        const rows = tableRows();
        expect(rows).toHaveLength(10);
        expect(rows[0].textContent).toContain('Calories consommées');
        // Les deux journées sont identiques : 758 kcal de chaque côté.
        expect(rows[0].textContent).toContain('758 kcal');

        const names = rows.map((row) => row.querySelector('td').textContent);
        expect(names).toContain('Poids moyen');
        expect(names).toContain('Protéines / poids');
        expect(names).toContain('Activité physique');
        expect(names).toContain('Hydratation');
    });

    it('écrit un statut de succès avec le nombre de jours retenus', async () => {
        await seedTwoDays();
        setComparisonDates(dateKey(-1), dateKey(-1), dateKey(0), dateKey(0));

        await comparePeriods(foodsFixture(), goalsFixture({ weight: 70 }), {});

        expect(el('periodComparisonStatus').textContent).toBe(
            '1 jour(s) retenu(s) pour A, 1 pour B. Les moyennes sont quotidiennes.'
        );
        expect(el('periodComparisonStatus').className).toContain('period-comparison-status');
    });

    it('crée le graphique de comparaison avec deux séries', async () => {
        await seedTwoDays();
        setComparisonDates(dateKey(-1), dateKey(-1), dateKey(0), dateKey(0));

        await comparePeriods(foodsFixture(), goalsFixture({ weight: 70 }), {});

        const chart = ChartStub.instances.find((instance) => instance.ctx && instance.ctx.id === 'periodComparisonChart');
        expect(chart).toBeTruthy();
        expect(chart.config.type).toBe('line');
        expect(chart.data.datasets.map((d) => d.label)).toEqual(['Période A', 'Période B']);
    });

    it('ajoute la ligne de maintien musculaire pour le ratio protéines/poids', async () => {
        await seedTwoDays();
        setComparisonDates(dateKey(-1), dateKey(-1), dateKey(0), dateKey(0));
        el('periodComparisonMetric').value = 'proteinRatio';

        await comparePeriods(foodsFixture(), goalsFixture({ weight: 70 }), {});

        const chart = ChartStub.instances.find((instance) => instance.ctx && instance.ctx.id === 'periodComparisonChart');
        expect(chart.data.datasets).toHaveLength(3);
        expect(chart.data.datasets[2].label).toBe('Minimum maintien musculaire');
        expect(chart.data.datasets[2].data[0]).toBe(1.6);
    });

    it('enregistre les dates comparées dans localStorage', async () => {
        await seedTwoDays();
        setComparisonDates(dateKey(-1), dateKey(-1), dateKey(0), dateKey(0));

        await comparePeriods(foodsFixture(), goalsFixture(), {});

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({
            aStart: dateKey(-1),
            aEnd: dateKey(-1),
            bStart: dateKey(0),
            bEnd: dateKey(0),
        });
    });

    it('refuse une plage invalide sans créer de graphique', async () => {
        await seedTwoDays();
        setComparisonDates('', '', '', '');

        await comparePeriods(foodsFixture(), goalsFixture(), {});

        expect(el('periodComparisonStatus').textContent).toBe('Vérifie les dates des deux périodes.');
        expect(el('periodComparisonStatus').className).toContain('error');
        expect(ChartStub.instances).toHaveLength(0);
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('refuse une plage dont la fin précède le début', async () => {
        setComparisonDates(dateKey(0), dateKey(-3), dateKey(0), dateKey(0));

        await comparePeriods(foodsFixture(), goalsFixture(), {});

        expect(el('periodComparisonStatus').textContent).toBe('Vérifie les dates des deux périodes.');
        expect(ChartStub.instances).toHaveLength(0);
    });

    it('accepte une plage de plusieurs jours', async () => {
        await seedTwoDays();
        setComparisonDates(dateKey(-1), dateKey(0), dateKey(-1), dateKey(0));

        await comparePeriods(foodsFixture(), goalsFixture(), {});

        expect(el('periodComparisonStatus').textContent).toBe(
            '2 jour(s) retenu(s) pour A, 2 pour B. Les moyennes sont quotidiennes.'
        );
    });

    it('ignore les jours sans pesée dans la moyenne', async () => {
        // Corrigé : average() convertissait les null en 0 (Number(null) === 0),
        // ce qui donnait (71 + 0) / 2 = 35,5 kg au lieu de 71 kg.
        const yesterday = new Date();
        yesterday.setHours(12, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1);
        await db.saveDayMeals(yesterday, dayFixture(), 71);
        // Aujourd'hui : aucune donnée (poids null).
        setComparisonDates(dateKey(-1), dateKey(0), dateKey(0), dateKey(0));

        await comparePeriods(foodsFixture(), goalsFixture(), {});

        const rows = tableRows();
        const weightRow = rows.find((row) => row.textContent.includes('Poids moyen'));
        expect(weightRow.textContent).toContain('71.0 kg');
    });
});

// ---------------------------------------------------------------------------
// initPeriodComparison
// ---------------------------------------------------------------------------
describe('periodComparison.initPeriodComparison', () => {
    it('pré-remplit les dates par défaut (période A puis période B)', () => {
        initPeriodComparison(() => ({}));

        const aStart = el('comparisonPeriodAStart').value;
        const aEnd = el('comparisonPeriodAEnd').value;
        const bStart = el('comparisonPeriodBStart').value;
        const bEnd = el('comparisonPeriodBEnd').value;

        for (const value of [aStart, aEnd, bStart, bEnd]) {
            expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        // Les deux périodes sont des semaines consécutives de 7 jours.
        expect(aStart < aEnd).toBe(true);
        expect(aEnd < bStart).toBe(true);
        expect(bStart < bEnd).toBe(true);
    });

    it('restaure les dates enregistrées dans localStorage', () => {
        const saved = { aStart: '2026-01-01', aEnd: '2026-01-07', bStart: '2026-01-08', bEnd: '2026-01-14' };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

        initPeriodComparison(() => ({}));

        expect(el('comparisonPeriodAStart').value).toBe('2026-01-01');
        expect(el('comparisonPeriodAEnd').value).toBe('2026-01-07');
        expect(el('comparisonPeriodBStart').value).toBe('2026-01-08');
        expect(el('comparisonPeriodBEnd').value).toBe('2026-01-14');
    });

    it('déclenche la comparaison au clic sur le bouton', async () => {
        await seedTwoDays();
        const getContext = vi.fn(() => ({
            foods: foodsFixture(),
            goals: goalsFixture(),
            composedMeals: {},
        }));

        initPeriodComparison(getContext);
        el('comparePeriodsBtn').click();

        expect(getContext).toHaveBeenCalledTimes(1);
        await waitFor(() => el('periodComparisonStatus').textContent.includes('jour(s) retenu(s)'));
    });

    it('recalcule le graphique quand la métrique change', async () => {
        await seedTwoDays();
        initPeriodComparison(() => ({ foods: foodsFixture(), goals: goalsFixture(), composedMeals: {} }));
        el('comparePeriodsBtn').click();
        await waitFor(() => el('periodComparisonStatus').textContent.includes('jour(s) retenu(s)'));

        const before = ChartStub.instances.length;
        el('periodComparisonMetric').value = 'weight';
        el('periodComparisonMetric').dispatchEvent(new Event('change'));

        expect(ChartStub.instances.length).toBeGreaterThan(before);
        const last = ChartStub.instances.at(-1);
        expect(last.ctx.id).toBe('periodComparisonChart');
    });

    it('est idempotent : un second appel ne duplique pas les écouteurs', async () => {
        // Corrigé : initPeriodComparison() marque désormais l'élément
        // (data-period-comparison-bound) avant d'attacher l'écouteur.
        const getContext = vi.fn(() => ({ foods: foodsFixture(), goals: goalsFixture(), composedMeals: {} }));

        initPeriodComparison(getContext);
        initPeriodComparison(getContext);
        el('comparePeriodsBtn').click();

        await drainPendingWork();
        expect(getContext).toHaveBeenCalledTimes(1);
    });

    it('ne jette pas si le bouton est absent', () => {
        document.getElementById('comparePeriodsBtn').remove();
        expect(() => initPeriodComparison(() => ({}))).not.toThrow();
    });
});
