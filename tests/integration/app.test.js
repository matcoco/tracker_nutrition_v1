// tests/integration/app.test.js
// Test de fumée : l'application complète doit démarrer sans erreur.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadAppDom } from '../helpers/dom.js';

let db;
const consoleErrors = [];

/** Attend qu'une condition devienne vraie (avec délai maximum). */
async function waitFor(predicate, { timeout = 4000, interval = 20 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error('Condition non satisfaite dans le délai imparti');
}

beforeAll(async () => {
    loadAppDom();

    // jsdom n'implémente pas IntersectionObserver (utilisé par la navigation stats).
    globalThis.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
    };

    globalThis.alert = vi.fn();
    globalThis.confirm = vi.fn(() => false);

    db = await import('../../js/core/db.js');

    // Capture les erreurs réellement journalisées pendant l'initialisation.
    const originalError = console.error;
    vi.spyOn(console, 'error').mockImplementation((...args) => {
        consoleErrors.push(args.map(String).join(' '));
        originalError(...args);
    });

    // app.js s'auto-exécute : init() est lancé à l'import.
    await import('../../js/app.js');

    // init() est asynchrone : on attend que l'état global soit exposé.
    await waitFor(() => Boolean(window.appState));
    // ... puis que la journée soit effectivement rendue.
    await waitFor(() => (document.getElementById('totalCalories')?.textContent || '').length > 0);
}, 20000);

describe('démarrage de l’application', () => {
    it('expose l’état global de l’application', () => {
        expect(window.appState).toBeDefined();
        expect(window.appState).toHaveProperty('foods');
        expect(window.appState).toHaveProperty('currentDate');
    });

    it('expose les fonctions globales utilisées par le HTML', () => {
        expect(typeof window.refreshAvailableFoods).toBe('function');
        expect(typeof window.handleAdjustPortions).toBe('function');
        expect(typeof window.handleDuplicateMealItem).toBe('function');
        expect(typeof window.handleMealItemDragStart).toBe('function');
        expect(typeof window.handleMealItemDragEnd).toBe('function');
    });

    it('expose les outils de diagnostic de la base de données', () => {
        expect(typeof window.dbDiagnose).toBe('function');
        expect(typeof window.dbCheck).toBe('function');
        expect(typeof window.dbExport).toBe('function');
        expect(typeof window.dbFixStructure).toBe('function');
    });

    it('ne journalise aucune erreur pendant l’initialisation', () => {
        expect(consoleErrors).toEqual([]);
    });

    it('affiche la date courante et le sélecteur de date', () => {
        const today = new Date();
        const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        expect(document.getElementById('datePicker').value).toBe(expected);
        expect(document.getElementById('currentDate').textContent.length).toBeGreaterThan(0);
    });

    it('rend les cartes de suivi quotidien', () => {
        for (const id of ['totalCalories', 'totalProteins', 'totalCarbs', 'totalFats', 'totalSugars', 'totalFibers']) {
            expect(document.getElementById(id), id).not.toBeNull();
        }
    });

    it('rend les colonnes de repas', () => {
        for (const meal of ['petit-dej', 'dejeuner', 'diner', 'snack']) {
            expect(document.getElementById(meal), meal).not.toBeNull();
            expect(document.getElementById(`summary-${meal}`), meal).not.toBeNull();
        }
    });

    it('a branché les écouteurs principaux (navigation par onglets)', async () => {
        const mealsTab = document.querySelector('.nav-tab[data-tab="meals"]');
        mealsTab.click();
        await waitFor(() => document.getElementById('meals-tab').classList.contains('active'));
        expect(mealsTab.classList.contains('active')).toBe(true);
    });

    it('charge les repas composites depuis la base', async () => {
        const meals = await db.loadMeals();
        expect(typeof meals).toBe('object');
    });
});
