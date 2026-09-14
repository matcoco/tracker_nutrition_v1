// tests/unit/features-health-events.test.js
// Tests de js/features/health-events.js : rendu des événements actifs,
// onglet de gestion et initialisation des écouteurs.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as db from '../../js/core/db.js';
import * as healthEvents from '../../js/features/health-events.js';
import { loadAppDom, el } from '../helpers/dom.js';

beforeAll(async () => {
    loadAppDom();
    await db.initDB();
});

beforeEach(async () => {
    loadAppDom();
    await db.clearStore('healthEvents');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

function eventFixture(overrides = {}) {
    return {
        id: 'e1',
        type: 'sick',
        comment: 'Grippe',
        startDate: '2026-03-10',
        endDate: null,
        createdAt: '2026-03-10T08:00:00.000Z',
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// renderActiveEvents
// ─────────────────────────────────────────────────────────────────────────────

describe('healthEvents.renderActiveEvents', () => {
    it('ne jette pas et affiche le message vide par défaut', () => {
        expect(() => healthEvents.renderActiveEvents()).not.toThrow();
        const list = el('dailyEventsList');
        expect(list.querySelectorAll('.daily-event-item')).toHaveLength(0);
        expect(list.querySelector('.no-daily-events').textContent).toBe('Aucun événement actif ce jour');
    });

    it('affiche le message vide pour un tableau vide', () => {
        healthEvents.renderActiveEvents([]);
        expect(el('dailyEventsList').querySelector('.no-daily-events')).toBeTruthy();
    });

    it('affiche un événement avec icône, période et commentaire', () => {
        healthEvents.renderActiveEvents([eventFixture()]);
        const list = el('dailyEventsList');
        expect(list.querySelectorAll('.daily-event-item')).toHaveLength(1);
        expect(list.querySelector('.daily-event-type').textContent).toBe('🤒 Malade');
        expect(list.querySelector('.daily-event-period').textContent).toBe('10/03/2026 → En cours');
        expect(list.querySelector('.daily-event-comment').textContent).toBe('Grippe');
    });

    it('affiche une date de fin quand elle existe', () => {
        healthEvents.renderActiveEvents([eventFixture({ startDate: '2026-03-01', endDate: '2026-03-05' })]);
        expect(el('dailyEventsList').querySelector('.daily-event-period').textContent)
            .toBe('01/03/2026 → 05/03/2026');
    });

    it('utilise les libellés dédiés pour fatigue et good-sleep', () => {
        healthEvents.renderActiveEvents([
            eventFixture({ id: 'a', type: 'fatigue' }),
            eventFixture({ id: 'b', type: 'good-sleep' }),
        ]);
        const types = [...el('dailyEventsList').querySelectorAll('.daily-event-type')].map((n) => n.textContent);
        expect(types).toEqual(['😴 Fatigue', '🛌 Bien dormi']);
    });

    it('utilise un libellé générique pour un type inconnu', () => {
        healthEvents.renderActiveEvents([eventFixture({ type: 'mystere' })]);
        expect(el('dailyEventsList').querySelector('.daily-event-type').textContent).toBe('📝 Événement');
    });

    it('n’ajoute pas de commentaire quand il est absent', () => {
        healthEvents.renderActiveEvents([eventFixture({ comment: '' })]);
        expect(el('dailyEventsList').querySelector('.daily-event-comment')).toBeNull();
    });

    it('affiche plusieurs événements dans l’ordre fourni', () => {
        healthEvents.renderActiveEvents([
            eventFixture({ id: 'a', type: 'sick' }),
            eventFixture({ id: 'b', type: 'fatigue' }),
            eventFixture({ id: 'c', type: 'good-sleep' }),
        ]);
        expect(el('dailyEventsList').querySelectorAll('.daily-event-item')).toHaveLength(3);
    });

    it('n’ajoute pas de boutons d’action dans la vue du jour', () => {
        healthEvents.renderActiveEvents([eventFixture()]);
        expect(el('dailyEventsList').querySelectorAll('.daily-event-actions')).toHaveLength(0);
        expect(el('dailyEventsList').querySelectorAll('button')).toHaveLength(0);
    });

    it('ne jette pas si le conteneur est absent', () => {
        el('dailyEventsList').remove();
        expect(() => healthEvents.renderActiveEvents([eventFixture()])).not.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// refreshHealthEventsTab
// ─────────────────────────────────────────────────────────────────────────────

describe('healthEvents.refreshHealthEventsTab', () => {
    it('affiche le message vide quand la base ne contient rien', async () => {
        await healthEvents.refreshHealthEventsTab();
        expect(el('healthEventsManageList').querySelector('.no-daily-events').textContent)
            .toBe('Aucun événement enregistré');
    });

    it('charge, trie du plus récent au plus ancien et affiche les actions', async () => {
        await db.saveHealthEvent(eventFixture({ id: 'old', startDate: '2026-03-01' }));
        await db.saveHealthEvent(eventFixture({ id: 'recent', startDate: '2026-03-20' }));

        await healthEvents.refreshHealthEventsTab();

        const list = el('healthEventsManageList');
        expect(list.querySelectorAll('.daily-event-item')).toHaveLength(2);
        const periods = [...list.querySelectorAll('.daily-event-period')].map((n) => n.textContent);
        expect(periods[0]).toContain('20/03/2026');
        expect(periods[1]).toContain('01/03/2026');
        expect(list.querySelectorAll('.daily-event-actions')).toHaveLength(2);
        expect(list.querySelectorAll('.daily-event-edit-btn')).toHaveLength(2);
        expect(list.querySelectorAll('.daily-event-delete-btn')).toHaveLength(2);
    });

    it('supprime un événement via le bouton 🗑️', async () => {
        await db.saveHealthEvent(eventFixture({ id: 'e1' }));
        await healthEvents.refreshHealthEventsTab();

        el('healthEventsManageList').querySelector('.daily-event-delete-btn').click();

        await vi.waitFor(() => {
            expect(el('healthEventsManageList').querySelector('.no-daily-events')).toBeTruthy();
        });
        expect(await db.loadHealthEvents()).toHaveLength(0);
    });

    it('pré-remplit le formulaire via le bouton ✏️', async () => {
        await db.saveHealthEvent(eventFixture({ id: 'e1', type: 'fatigue', comment: 'coup de barre' }));
        await healthEvents.refreshHealthEventsTab();

        el('healthEventsManageList').querySelector('.daily-event-edit-btn').click();

        expect(el('healthEventId').value).toBe('e1');
        expect(el('healthEventType').value).toBe('fatigue');
        expect(el('healthEventStartDate').value).toBe('2026-03-10');
        expect(el('healthEventComment').value).toBe('coup de barre');
        expect(el('healthEventSubmitBtn').textContent).toBe('💾 Enregistrer');
        expect(el('healthEventCancelBtn').style.display).toBe('');
    });

    it('ne jette pas si le conteneur est absent', async () => {
        el('healthEventsManageList').remove();
        await expect(healthEvents.refreshHealthEventsTab()).resolves.toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// submitEvent via le formulaire (module partagé, DOM neuf à chaque test)
// ─────────────────────────────────────────────────────────────────────────────

describe('healthEvents — formulaire', () => {
    it('enregistre un événement valide et réinitialise le formulaire', async () => {
        healthEvents.initHealthEvents();
        el('healthEventType').value = 'sick';
        el('healthEventStartDate').value = '2026-03-10';
        el('healthEventEndDate').value = '2026-03-12';
        el('healthEventComment').value = '  grippe  ';

        el('healthEventForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        await vi.waitFor(async () => {
            expect(await db.loadHealthEvents()).toHaveLength(1);
        });
        const [saved] = await db.loadHealthEvents();
        expect(saved.type).toBe('sick');
        expect(saved.startDate).toBe('2026-03-10');
        expect(saved.endDate).toBe('2026-03-12');
        expect(saved.comment).toBe('grippe'); // trim
        expect(saved.createdAt).toBeTruthy();
        expect(el('healthEventId').value).toBe('');
        expect(el('healthEventSubmitBtn').textContent).toBe('➕ Ajouter');
    });

    it('refuse un événement sans type', async () => {
        healthEvents.initHealthEvents();
        el('healthEventType').value = '';
        el('healthEventStartDate').value = '2026-03-10';

        el('healthEventForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        expect(document.querySelector('.notification').textContent).toContain('type et une date');
        expect(await db.loadHealthEvents()).toHaveLength(0);
    });

    it('refuse un événement sans date de début', async () => {
        healthEvents.initHealthEvents();
        el('healthEventType').value = 'sick';
        el('healthEventStartDate').value = '';

        el('healthEventForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        expect(document.querySelector('.notification').textContent).toContain('type et une date');
        expect(await db.loadHealthEvents()).toHaveLength(0);
    });

    it('refuse une date de fin antérieure à la date de début', async () => {
        healthEvents.initHealthEvents();
        el('healthEventType').value = 'sick';
        el('healthEventStartDate').value = '2026-03-10';
        el('healthEventEndDate').value = '2026-03-01';

        el('healthEventForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        expect(document.querySelector('.notification').textContent).toContain('date de fin');
        expect(await db.loadHealthEvents()).toHaveLength(0);
    });

    it('modifie un événement existant sans créer de doublon', async () => {
        await db.saveHealthEvent(eventFixture({ id: 'e1', type: 'sick', comment: 'a' }));
        healthEvents.initHealthEvents();
        await healthEvents.refreshHealthEventsTab();

        el('healthEventsManageList').querySelector('.daily-event-edit-btn').click();
        el('healthEventType').value = 'fatigue';
        el('healthEventComment').value = 'b';

        el('healthEventForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        await vi.waitFor(async () => {
            const events = await db.loadHealthEvents();
            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('fatigue');
        });
        expect((await db.loadHealthEvents())[0].comment).toBe('b');
    });

    it('le bouton Annuler réinitialise le formulaire', () => {
        healthEvents.initHealthEvents();
        el('healthEventId').value = 'e1';
        el('healthEventType').value = 'sick';
        el('healthEventCancelBtn').click();
        expect(el('healthEventId').value).toBe('');
        expect(el('healthEventType').value).toBe('');
        expect(el('healthEventSubmitBtn').textContent).toBe('➕ Ajouter');
        expect(el('healthEventCancelBtn').style.display).toBe('none');
    });

    it('le bouton d’ouverture d’onglet active l’onglet Événements et rafraîchit la liste', async () => {
        await db.saveHealthEvent(eventFixture({ id: 'e1' }));
        healthEvents.initHealthEvents();

        el('openHealthEventsTabBtn').click();

        await vi.waitFor(() => {
            expect(document.querySelector('.nav-tab[data-tab="events"]').classList.contains('active')).toBe(true);
        });
        expect(el('events-tab').classList.contains('active')).toBe(true);
        await vi.waitFor(() => {
            expect(el('healthEventsManageList').querySelectorAll('.daily-event-item')).toHaveLength(1);
        });
    });

    it('appelle loadCurrentDay après un ajout quand l’option est fournie', async () => {
        const loadCurrentDay = vi.fn(async () => {});
        healthEvents.initHealthEvents({ loadCurrentDay });
        el('healthEventType').value = 'sick';
        el('healthEventStartDate').value = '2026-03-10';

        el('healthEventForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        await vi.waitFor(() => expect(loadCurrentDay).toHaveBeenCalled());
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// initHealthEvents sur un module neuf (isolation de l'état de module)
// ─────────────────────────────────────────────────────────────────────────────

describe('healthEvents.initHealthEvents (module neuf)', () => {
    beforeEach(() => {
        loadAppDom();
        vi.resetModules();
    });

    it('ne jette pas et branche les trois écouteurs', async () => {
        const mod = await import('../../js/features/health-events.js');
        const submitSpy = vi.spyOn(el('healthEventForm'), 'addEventListener');
        const cancelSpy = vi.spyOn(el('healthEventCancelBtn'), 'addEventListener');
        const openSpy = vi.spyOn(el('openHealthEventsTabBtn'), 'addEventListener');

        expect(() => mod.initHealthEvents()).not.toThrow();

        expect(submitSpy).toHaveBeenCalledWith('submit', expect.any(Function));
        expect(cancelSpy).toHaveBeenCalledWith('click', expect.any(Function));
        expect(openSpy).toHaveBeenCalledWith('click', expect.any(Function));
        expect(submitSpy).toHaveBeenCalledTimes(1);
    });

    it('est idempotent : deux appels ne dupliquent pas les écouteurs', async () => {
        // Corrigé : initHealthEvents marque chaque élément (dataset.boundSubmit…)
        // avant d'attacher l'écouteur, donc un second appel n'ajoute rien.
        const mod = await import('../../js/features/health-events.js');
        const submitSpy = vi.spyOn(el('healthEventForm'), 'addEventListener');

        mod.initHealthEvents();
        mod.initHealthEvents();

        expect(submitSpy).toHaveBeenCalledTimes(1);
    });
});
