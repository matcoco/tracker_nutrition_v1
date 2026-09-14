// tests/unit/handlers-misc.test.js
// Handlers statistiques, activités physiques et IA.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadAppDom } from '../helpers/dom.js';
import { goalsFixture } from '../helpers/fixtures.js';

let statsHandlers;
let activityHandlers;
let aiHandlers;
let db;
let state;

beforeAll(async () => {
    loadAppDom();
    db = await import('../../js/core/db.js');
    state = (await import('../../js/core/state.js')).default;
    await import('../../js/ui/ui-core.js');
    statsHandlers = await import('../../js/handlers/stats-handlers.js');
    activityHandlers = await import('../../js/handlers/activity-handlers.js');
    aiHandlers = await import('../../js/handlers/ai-handlers.js');
    await db.initDB();
});

beforeEach(async () => {
    for (const s of ['dailyActivities', 'customActivities', 'dailyMeals']) await db.clearStore(s);
    localStorage.clear();
    state.currentDate = new Date(2026, 4, 15, 12, 0, 0);
    state.currentPeriod = 7;
    state.currentCustomStatsRange = null;
    state.currentAveragePeriod = 'week';
    state.currentCostPeriod = 7;
    state.currentActivityPeriod = 7;
    state.currentFoodAnalysisPeriod = 7;
    state.activities = [];
    state.customActivities = [];
    state.allActivities = [];
    state.foods = {};
    state.meals = {};
    state.goals = goalsFixture();
    aiHandlers.initAIHandlers({ loadCurrentDay: vi.fn() });
    activityHandlers.initStrengthActivityControls();
});

// ─────────────────────────────── STATS ───────────────────────────────
describe('getCurrentStatsPeriodFilter', () => {
    it('retourne la période simple quand aucune plage personnalisée n’est définie', () => {
        state.currentPeriod = 30;
        expect(statsHandlers.getCurrentStatsPeriodFilter()).toBe(30);
    });

    it('priorise la plage personnalisée quand elle existe', () => {
        state.currentPeriod = 30;
        state.currentCustomStatsRange = { startDate: '2026-01-01', endDate: '2026-01-31' };
        expect(statsHandlers.getCurrentStatsPeriodFilter()).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
    });

    it('gère la valeur "all"', () => {
        state.currentPeriod = 'all';
        expect(statsHandlers.getCurrentStatsPeriodFilter()).toBe('all');
    });
});

describe('saveStatsState / restoreStatsState', () => {
    it('enregistre puis restaure l’état des statistiques', () => {
        state.currentPeriod = 30;
        state.currentAveragePeriod = 'month';
        state.currentCostPeriod = 14;
        state.currentActivityPeriod = 3;
        state.currentFoodAnalysisPeriod = 90;
        statsHandlers.saveStatsState();

        state.currentPeriod = 7;
        state.currentAveragePeriod = 'week';
        statsHandlers.restoreStatsState();

        expect(state.currentPeriod).toBe(30);
        expect(state.currentAveragePeriod).toBe('month');
        expect(state.currentCostPeriod).toBe(14);
        expect(state.currentActivityPeriod).toBe(3);
        expect(state.currentFoodAnalysisPeriod).toBe(90);
    });

    it('restaure le bouton de période actif', () => {
        state.currentPeriod = 30;
        state.currentCustomStatsRange = null;
        statsHandlers.saveStatsState();
        state.currentPeriod = 7;
        statsHandlers.restoreStatsState();
        expect(document.querySelector('.period-btn[data-period="30"]').classList.contains('active')).toBe(true);
    });

    it('ne lève pas si le stockage est vide', () => {
        localStorage.clear();
        expect(() => statsHandlers.restoreStatsState()).not.toThrow();
    });

    it('ne lève pas si le stockage est corrompu', () => {
        localStorage.setItem('nt_stats_state', '{{{ pas du json');
        expect(() => statsHandlers.restoreStatsState()).not.toThrow();
    });
});

describe('applyCustomStatsDateRange', () => {
    it('applique une plage valide', () => {
        document.getElementById('statsStartDate').value = '2026-01-01';
        document.getElementById('statsEndDate').value = '2026-01-31';
        statsHandlers.applyCustomStatsDateRange();
        expect(state.currentCustomStatsRange).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
    });

    it('refuse une plage inversée', () => {
        document.getElementById('statsStartDate').value = '2026-02-01';
        document.getElementById('statsEndDate').value = '2026-01-01';
        statsHandlers.applyCustomStatsDateRange();
        expect(state.currentCustomStatsRange).toBeNull();
    });

    it('refuse une plage incomplète', () => {
        document.getElementById('statsStartDate').value = '';
        document.getElementById('statsEndDate').value = '2026-01-31';
        statsHandlers.applyCustomStatsDateRange();
        expect(state.currentCustomStatsRange).toBeNull();
    });
});

describe('handleStatsNavigation', () => {
    it('active le bouton cliqué et scrolle vers la section', () => {
        const btn = document.querySelector('.stats-nav-btn[data-section="evolution"]');
        statsHandlers.handleStatsNavigation({ currentTarget: btn });
        expect(btn.classList.contains('active')).toBe(true);
    });
});

// ───────────────────────────── ACTIVITÉS ─────────────────────────────
describe('updateActivitySelects', () => {
    it('peuple les listes déroulantes avec les activités par défaut et personnalisées', async () => {
        await db.saveCustomActivity('Escalade');
        state.customActivities = await db.loadCustomActivities();

        activityHandlers.updateActivitySelects();

        const options = [...document.getElementById('activitySelect').options].map((o) => o.value);
        expect(options).toContain('Escalade');
        expect(options).toContain('🚶 Marche');
        expect(options[0]).toBe('');
    });

    it('conserve la sélection courante', () => {
        state.customActivities = [];
        document.getElementById('activitySelect').innerHTML = '<option value="🚴 Vélo" selected>Vélo</option>';
        document.getElementById('activitySelect').value = '🚴 Vélo';
        activityHandlers.updateActivitySelects();
        expect(document.getElementById('activitySelect').value).toBe('🚴 Vélo');
    });
});

describe('handleAddActivity', () => {
    function remplir({ type = '🚶 Marche', time = '08:30', duration = '45', calories = '250' } = {}) {
        document.getElementById('activitySelect').value = type;
        document.getElementById('activityTime').value = time;
        document.getElementById('activityDuration').value = duration;
        document.getElementById('activityCalories').value = calories;
    }

    it('ajoute une activité et la persiste', async () => {
        remplir();
        const load = vi.fn();
        await activityHandlers.handleAddActivity(load);

        const activities = await db.loadDayActivities(state.currentDate);
        expect(activities).toHaveLength(1);
        expect(activities[0].type).toBe('🚶 Marche');
        expect(activities[0].duration).toBe(45);
        expect(activities[0].calories).toBe(250);
        expect(load).toHaveBeenCalled();
    });

    it('vide le formulaire après ajout', async () => {
        remplir();
        await activityHandlers.handleAddActivity(vi.fn());
        expect(document.getElementById('activitySelect').value).toBe('');
        expect(document.getElementById('activityDuration').value).toBe('');
    });

    it('refuse une activité incomplète', async () => {
        remplir({ type: '' });
        await activityHandlers.handleAddActivity(vi.fn());
        expect(state.activities).toHaveLength(0);
    });

    it('refuse une durée nulle ou négative', async () => {
        remplir({ duration: '0' });
        await activityHandlers.handleAddActivity(vi.fn());
        expect(state.activities).toHaveLength(0);

        remplir({ duration: '-10' });
        await activityHandlers.handleAddActivity(vi.fn());
        expect(state.activities).toHaveLength(0);
    });

    it('accumule plusieurs activités dans la journée', async () => {
        remplir();
        await activityHandlers.handleAddActivity(vi.fn());
        remplir({ type: '🏃 Course à pied', calories: '400' });
        await activityHandlers.handleAddActivity(vi.fn());

        const activities = await db.loadDayActivities(state.currentDate);
        expect(activities).toHaveLength(2);
    });
});

describe('handleEditActivity / handleSaveEditActivity', () => {
    beforeEach(() => {
        state.activities = [{ id: 111, type: '🚶 Marche', time: '08:00', duration: 30, calories: 150 }];
    });

    it('pré-remplit la modale d’édition', () => {
        activityHandlers.handleEditActivity(111);
        expect(document.getElementById('editActivityIndex').value).toBe('111');
        expect(document.getElementById('editActivityType').value).toBe('🚶 Marche');
        expect(document.getElementById('editActivityDuration').value).toBe('30');
    });

    it('ne fait rien pour un identifiant inconnu', () => {
        expect(() => activityHandlers.handleEditActivity(999)).not.toThrow();
    });

    it('enregistre les modifications', async () => {
        activityHandlers.handleEditActivity(111);
        document.getElementById('editActivityDuration').value = '60';
        document.getElementById('editActivityCalories').value = '300';

        await activityHandlers.handleSaveEditActivity({ preventDefault: vi.fn() }, vi.fn());

        const activities = await db.loadDayActivities(state.currentDate);
        expect(activities[0].duration).toBe(60);
        expect(activities[0].calories).toBe(300);
        expect(activities[0].id).toBe(111);
    });
});

describe('handleDeleteActivity', () => {
    it('supprime l’activité après confirmation', async () => {
        state.activities = [{ id: 1, type: 'A', duration: 10, calories: 10 }];
        await db.saveDayActivities(state.currentDate, state.activities);
        globalThis.confirm = vi.fn(() => true);

        await activityHandlers.handleDeleteActivity(1, vi.fn());

        expect(state.activities).toHaveLength(0);
        expect(await db.loadDayActivities(state.currentDate)).toHaveLength(0);
    });

    it('ne supprime rien si l’utilisateur refuse', async () => {
        state.activities = [{ id: 1, type: 'A', duration: 10, calories: 10 }];
        globalThis.confirm = vi.fn(() => false);

        await activityHandlers.handleDeleteActivity(1, vi.fn());

        expect(state.activities).toHaveLength(1);
    });
});

describe('handleAddCustomActivity', () => {
    it('ajoute une activité personnalisée', async () => {
        document.getElementById('customActivityName').value = 'Escalade';
        await activityHandlers.handleAddCustomActivity({ preventDefault: vi.fn() });

        const list = await db.loadCustomActivities();
        expect(list.map((a) => a.name)).toContain('Escalade');
        expect(state.allActivities).toContain('Escalade');
    });

    it('refuse un nom vide', async () => {
        document.getElementById('customActivityName').value = '   ';
        await activityHandlers.handleAddCustomActivity({ preventDefault: vi.fn() });
        expect(await db.loadCustomActivities()).toHaveLength(0);
    });

    it('refuse un doublon', async () => {
        state.allActivities = ['🚶 Marche'];
        document.getElementById('customActivityName').value = '🚶 Marche';
        await activityHandlers.handleAddCustomActivity({ preventDefault: vi.fn() });
        expect(await db.loadCustomActivities()).toHaveLength(0);
    });
});

// ─────────────────────────────── IA ───────────────────────────────
describe('clés API et préférences (ai-handlers)', () => {
    it('sauvegarde puis supprime la clé Brave Search', () => {
        document.getElementById('braveSearchApiKeyInput').value = 'brave-key-123';
        aiHandlers.handleSaveSearchApiKey();
        expect(localStorage.getItem('brave_search_api_key')).toBe('brave-key-123');

        aiHandlers.handleClearSearchApiKey();
        expect(localStorage.getItem('brave_search_api_key')).toBeNull();
    });

    it('refuse une clé Brave vide', () => {
        document.getElementById('braveSearchApiKeyInput').value = '  ';
        aiHandlers.handleSaveSearchApiKey();
        expect(localStorage.getItem('brave_search_api_key')).toBeNull();
    });

    it('sauvegarde la préférence de recherche enseignes', () => {
        document.getElementById('preferRetailerSearchInput').checked = true;
        document.getElementById('preferredRetailersInput').value = 'Carrefour\nMonoprix\n\n';
        aiHandlers.handleSaveFoodSearchPreference();

        const pref = JSON.parse(localStorage.getItem('food_search_preference'));
        expect(pref.enabled).toBe(true);
        expect(pref.retailers).toEqual(['Carrefour', 'Monoprix']);
    });

    it('refuse la préférence activée sans enseigne', () => {
        document.getElementById('preferRetailerSearchInput').checked = true;
        document.getElementById('preferredRetailersInput').value = '';
        aiHandlers.handleSaveFoodSearchPreference();
        expect(localStorage.getItem('food_search_preference')).toBeNull();
    });

    it('supprime la clé DeepSeek et la clé héritée', () => {
        localStorage.setItem('deepseek_api_key', 'ds-key');
        localStorage.setItem('groq_api_key', 'ancienne-cle');
        aiHandlers.handleClearApiKey();
        expect(localStorage.getItem('deepseek_api_key')).toBeNull();
        expect(localStorage.getItem('groq_api_key')).toBeNull();
    });
});

describe('refreshPromptPreview / openAIModal', () => {
    it('génère un prompt dans la zone de prévisualisation', () => {
        state.goals = goalsFixture({ weight: 80, taille: 180, age: 30, sexe: 'homme', activite: 1.55, goalProfile: 'cut' });
        state.foods = { poulet: { name: 'Poulet', calories: 165 } };
        ['petit-dej', 'dejeuner', 'diner', 'snack'].forEach((mt) => {
            document.getElementById(`ai-meal-${mt}`).checked = true;
        });

        aiHandlers.refreshPromptPreview();

        const prompt = document.getElementById('aiPromptPreview').value;
        expect(prompt.length).toBeGreaterThan(0);
        expect(prompt).toContain('Poulet');
    });

    it('refuse d’ouvrir la modale sans clé API', () => {
        localStorage.removeItem('deepseek_api_key');
        localStorage.removeItem('groq_api_key');
        expect(() => aiHandlers.openAIModal()).not.toThrow();
    });

    it('ouvre la modale quand une clé API est présente', () => {
        localStorage.setItem('deepseek_api_key', 'ds-key');
        aiHandlers.openAIModal();
        expect(document.getElementById('aiMealModal').classList.contains('show')).toBe(true);
    });
});
