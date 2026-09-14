// tests/unit/features-meal-history.test.js
// Tests de js/features/meal-history.js : journal chronologique des repas.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as db from '../../js/core/db.js';
import { updateMealHistory } from '../../js/features/meal-history.js';
import { loadAppDom, el } from '../helpers/dom.js';
import {
    dayFixture,
    composedMeal,
    foodsFixture,
    localDate,
} from '../helpers/fixtures.js';

beforeAll(async () => {
    loadAppDom();
    await db.initDB();
});

beforeEach(async () => {
    loadAppDom();
    await db.clearStore('dailyMeals');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** Journée ne contenant qu'un seul élément. */
function singleItemDay(item) {
    return { 'petit-dej': [], dejeuner: [item], diner: [], snack: [] };
}

describe('mealHistory.updateMealHistory — période et état vide', () => {
    it('affiche le message vide quand aucun repas n’est enregistré', async () => {
        await updateMealHistory(7, foodsFixture());
        expect(el('journalTimeline').textContent).toContain('Aucun repas enregistré sur cette période.');
    });

    it('affiche le libellé "N derniers jours"', async () => {
        await updateMealHistory(7, foodsFixture());
        expect(el('journalPeriodInfo').textContent).toBe('7 derniers jours');
    });

    it('accepte une période fournie sous forme de chaîne numérique', async () => {
        await updateMealHistory('3', foodsFixture());
        expect(el('journalPeriodInfo').textContent).toBe('3 derniers jours');
    });

    it('affiche "Toutes les données disponibles" pour la période "all"', async () => {
        await updateMealHistory('all', foodsFixture());
        expect(el('journalPeriodInfo').textContent).toBe('Toutes les données disponibles');
    });

    it('affiche la plage personnalisée avec des dates françaises', async () => {
        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-04' }, foodsFixture());
        expect(el('journalPeriodInfo').textContent).toBe('Période : du 1 juin 2026 au 4 juin 2026');
    });

    it('ne fait rien si le conteneur est absent', async () => {
        el('journalTimeline').remove();
        await expect(updateMealHistory(7, foodsFixture())).resolves.toBeUndefined();
    });
});

describe('mealHistory.updateMealHistory — N derniers jours', () => {
    it('affiche la journée du jour avec ses aliments', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayMeals(today, dayFixture());

        await updateMealHistory(7, foodsFixture());

        const cards = el('journalTimeline').querySelectorAll('.journal-day-card');
        expect(cards).toHaveLength(1);
        const card = cards[0];
        expect(card.querySelector('.journal-today-badge').textContent).toBe("Aujourd'hui");
        expect(card.querySelector('.journal-day-count').textContent).toBe('3 aliments');
        expect(card.querySelector('.jm-cal').textContent).toContain('kcal');
    });

    it('accorde le compteur au singulier pour un seul aliment', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayMeals(today, singleItemDay({ id: 'poulet', weight: 100 }));

        await updateMealHistory(7, foodsFixture());

        expect(el('journalTimeline').querySelector('.journal-day-count').textContent).toBe('1 aliment');
    });

    it('n’affiche que les journées non vides', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        await db.saveDayMeals(yesterday, dayFixture());

        await updateMealHistory(7, foodsFixture());

        const cards = el('journalTimeline').querySelectorAll('.journal-day-card');
        expect(cards).toHaveLength(1);
        expect(cards[0].querySelector('.journal-today-badge')).toBeNull();
    });

    it('affiche les sections de repas avec leurs libellés', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayMeals(today, dayFixture());

        await updateMealHistory(7, foodsFixture());

        const labels = [...el('journalTimeline').querySelectorAll('.jmt-label')].map((n) => n.textContent);
        expect(labels).toEqual(['Petit-déjeuner', 'Déjeuner', 'Dîner']);
    });

    it('signale un aliment inconnu', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayMeals(today, singleItemDay({ id: 'inconnu', weight: 100 }));

        await updateMealHistory(7, foodsFixture());

        expect(el('journalTimeline').querySelector('.journal-item-unknown').textContent)
            .toContain('Aliment inconnu (inconnu)');
    });

    it('se limite à la fenêtre demandée', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const old = new Date(today);
        old.setDate(old.getDate() - 10);
        await db.saveDayMeals(old, dayFixture());

        await updateMealHistory(7, foodsFixture());

        expect(el('journalTimeline').textContent).toContain('Aucun repas enregistré sur cette période.');
    });
});

describe('mealHistory.updateMealHistory — plage personnalisée', () => {
    it('couvre les bornes incluses', async () => {
        await db.saveDayMeals(localDate(2026, 6, 1), dayFixture());
        await db.saveDayMeals(localDate(2026, 6, 4), dayFixture());

        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-04' }, foodsFixture());

        expect(el('journalTimeline').querySelectorAll('.journal-day-card')).toHaveLength(2);
    });

    it('exclut les jours hors plage', async () => {
        await db.saveDayMeals(localDate(2026, 6, 10), dayFixture());

        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-04' }, foodsFixture());

        expect(el('journalTimeline').textContent).toContain('Aucun repas enregistré sur cette période.');
    });

    it('affiche un seul jour pour une plage d’un jour', async () => {
        await db.saveDayMeals(localDate(2026, 6, 2), dayFixture());

        await updateMealHistory({ startDate: '2026-06-02', endDate: '2026-06-02' }, foodsFixture());

        expect(el('journalTimeline').querySelectorAll('.journal-day-card')).toHaveLength(1);
    });
});

describe('mealHistory.updateMealHistory — période "all"', () => {
    it('affiche toutes les journées connues, du plus récent au plus ancien', async () => {
        await db.saveDayMeals(localDate(2026, 6, 1), dayFixture());
        await db.saveDayMeals(localDate(2026, 6, 3), dayFixture());

        await updateMealHistory('all', foodsFixture());

        const cards = [...el('journalTimeline').querySelectorAll('.journal-day-card')];
        expect(cards).toHaveLength(2);
        const labels = cards.map((c) => c.querySelector('.journal-day-date').textContent);
        expect(labels[0]).toContain('3 juin');
        expect(labels[1]).toContain('1 juin');
    });

    it('ignore les entrées sans données exploitables', async () => {
        await updateMealHistory('all', foodsFixture());
        expect(el('journalTimeline').textContent).toContain('Aucun repas enregistré sur cette période.');
    });
});

describe('mealHistory.updateMealHistory — filtres statistiques', () => {
    it('exclut les journées sous le seuil quand le filtre est activé', async () => {
        localStorage.setItem(
            'nt_stats_filter_settings',
            JSON.stringify({ excludeLowCalorieDays: true, lowCalorieThreshold: 100000 })
        );
        await db.saveDayMeals(localDate(2026, 6, 1), dayFixture());

        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-01' }, foodsFixture());

        expect(el('journalTimeline').textContent).toContain('Aucun repas enregistré sur cette période.');
    });

    it('réintègre la journée quand le filtre est désactivé', async () => {
        localStorage.setItem(
            'nt_stats_filter_settings',
            JSON.stringify({ excludeLowCalorieDays: false, lowCalorieThreshold: 100000 })
        );
        await db.saveDayMeals(localDate(2026, 6, 1), dayFixture());

        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-01' }, foodsFixture());

        expect(el('journalTimeline').querySelectorAll('.journal-day-card')).toHaveLength(1);
    });
});

describe('mealHistory.updateMealHistory — repas composés', () => {
    it('affiche un repas ajustable au prorata du poids consommé', async () => {
        const composedMeals = { 'poulet-riz': composedMeal({ totalWeight: 400 }) };
        await db.saveDayMeals(
            localDate(2026, 6, 1),
            singleItemDay({ id: 'poulet-riz', isMeal: true, weight: 200 })
        );

        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-01' }, foodsFixture(), composedMeals);

        const row = el('journalTimeline').querySelector('.journal-item-row');
        expect(row.querySelector('.ji-meal-badge').textContent).toBe('REPAS');
        expect(row.querySelector('.ji-name').textContent).toBe('Poulet riz');
        expect(row.querySelector('.ji-weight').textContent).toBe('200g');
        expect(row.querySelector('.ji-cal').textContent).toBe('200 kcal');
        expect(row.querySelector('.ji-macros').textContent).toBe('P20.0 G25.0 L4.0');
    });

    it('affiche un repas non ajustable avec les valeurs pour 100 g', async () => {
        const composedMeals = {
            salade: composedMeal({ isPortionAdjustable: false, calories: 120, proteins: 6, carbs: 10, fats: 6 }),
        };
        await db.saveDayMeals(
            localDate(2026, 6, 1),
            singleItemDay({ id: 'salade', isMeal: true, weight: 100 })
        );

        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-01' }, foodsFixture(), composedMeals);

        const row = el('journalTimeline').querySelector('.journal-item-row');
        expect(row.querySelector('.ji-cal').textContent).toBe('120 kcal');
        expect(row.querySelector('.ji-macros').textContent).toBe('P6.0 G10.0 L6.0');
    });

    it('traite un repas composé absent comme un aliment inconnu', async () => {
        await db.saveDayMeals(
            localDate(2026, 6, 1),
            singleItemDay({ id: 'poulet-riz', isMeal: true, weight: 200 })
        );

        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-01' }, foodsFixture(), {});

        expect(el('journalTimeline').querySelector('.journal-item-unknown')).toBeTruthy();
    });
});

describe('mealHistory — interaction carte', () => {
    beforeEach(async () => {
        await db.saveDayMeals(localDate(2026, 6, 1), dayFixture());
        await updateMealHistory({ startDate: '2026-06-01', endDate: '2026-06-01' }, foodsFixture());
    });

    it('ouvre la première carte par défaut', () => {
        const card = el('journalTimeline').querySelector('.journal-day-card');
        expect(card.classList.contains('open')).toBe(true);
        expect(card.querySelector('.journal-day-header').getAttribute('aria-expanded')).toBe('true');
        expect(card.querySelector('.journal-chevron').textContent).toBe('▲');
    });

    it('bascule l’ouverture au clic sur l’en-tête', () => {
        const card = el('journalTimeline').querySelector('.journal-day-card');
        const header = card.querySelector('.journal-day-header');

        header.click();
        expect(card.classList.contains('open')).toBe(false);
        expect(header.getAttribute('aria-expanded')).toBe('false');
        expect(card.querySelector('.journal-chevron').textContent).toBe('▼');

        header.click();
        expect(card.classList.contains('open')).toBe(true);
        expect(header.getAttribute('aria-expanded')).toBe('true');
    });

    it('affiche la barre de macros quand les calories sont positives', () => {
        expect(el('journalTimeline').querySelector('.journal-macro-bar-wrap')).toBeTruthy();
    });
});
