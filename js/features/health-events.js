import * as db from '../core/db.js';
import * as ui from '../ui/ui-core.js';

const EVENT_LABELS = {
    sick: { icon: '🤒', label: 'Malade' },
    fatigue: { icon: '😴', label: 'Fatigue' },
    'good-sleep': { icon: '🛌', label: 'Bien dormi' }
};

let loadCurrentDay = null;

function getMetadata(type) {
    return EVENT_LABELS[type] || { icon: '📝', label: 'Événement' };
}

function formatDate(date) {
    if (!date) return 'En cours';
    const parsed = new Date(`${date}T12:00:00`);
    // Une date ISO complète importée affichait « Invalid Date ».
    if (Number.isNaN(parsed.getTime())) return String(date);
    return parsed.toLocaleDateString('fr-FR');
}

function createActionButton(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
}

function resetForm() {
    editingEvent = null;
    document.getElementById('healthEventId').value = '';
    document.getElementById('healthEventType').value = '';
    document.getElementById('healthEventStartDate').value = '';
    document.getElementById('healthEventEndDate').value = '';
    document.getElementById('healthEventComment').value = '';
    document.getElementById('healthEventSubmitBtn').textContent = '➕ Ajouter';
    document.getElementById('healthEventCancelBtn').style.display = 'none';
}

let editingEvent = null;

function editEvent(event) {
    editingEvent = event;
    document.getElementById('healthEventId').value = event.id;
    document.getElementById('healthEventType').value = event.type;
    document.getElementById('healthEventStartDate').value = event.startDate;
    document.getElementById('healthEventEndDate').value = event.endDate || '';
    document.getElementById('healthEventComment').value = event.comment || '';
    document.getElementById('healthEventSubmitBtn').textContent = '💾 Enregistrer';
    document.getElementById('healthEventCancelBtn').style.display = '';
    document.getElementById('healthEventType').focus();
}

async function deleteEvent(eventId) {
    // Suppression définitive d'un historique de santé : on demande confirmation.
    if (!confirm('Supprimer définitivement cet événement de santé ?')) return;
    try {
        await db.deleteHealthEvent(eventId);
    } catch (error) {
        console.error('Suppression de l\'événement impossible:', error);
        ui.showNotification('Suppression impossible.', 'error');
        return;
    }
    await refreshHealthEventsTab();
    if (loadCurrentDay) await loadCurrentDay();
    ui.showNotification('Événement supprimé.');
}

function createEventItem(event, withActions = false) {
    const metadata = getMetadata(event.type);
    const item = document.createElement('div');
    item.className = 'daily-event-item';

    const copy = document.createElement('div');
    copy.className = 'daily-event-copy';

    const title = document.createElement('strong');
    title.className = 'daily-event-type';
    title.textContent = `${metadata.icon} ${metadata.label}`;
    copy.appendChild(title);

    const period = document.createElement('span');
    period.className = 'daily-event-period';
    period.textContent = `${formatDate(event.startDate)} → ${formatDate(event.endDate)}`;
    copy.appendChild(period);

    if (event.comment) {
        const comment = document.createElement('span');
        comment.className = 'daily-event-comment';
        comment.textContent = event.comment;
        copy.appendChild(comment);
    }

    item.appendChild(copy);
    if (withActions) {
        const actions = document.createElement('div');
        actions.className = 'daily-event-actions';
        actions.appendChild(createActionButton('✏️', 'daily-event-edit-btn', () => editEvent(event)));
        actions.appendChild(createActionButton('🗑️', 'daily-event-delete-btn', () => deleteEvent(event.id)));
        item.appendChild(actions);
    }
    return item;
}

async function submitEvent(event) {
    event.preventDefault();
    const id = document.getElementById('healthEventId').value;
    const type = document.getElementById('healthEventType').value;
    const startDate = document.getElementById('healthEventStartDate').value;
    const endDate = document.getElementById('healthEventEndDate').value;
    const comment = document.getElementById('healthEventComment').value.trim();

    if (!EVENT_LABELS[type] || !startDate) {
        ui.showNotification('Veuillez choisir un type et une date de début.', 'error');
        return;
    }
    if (endDate && endDate < startDate) {
        ui.showNotification('La date de fin doit suivre la date de début.', 'error');
        return;
    }

    await db.saveHealthEvent({
        id: id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        startDate,
        endDate: endDate || null,
        comment,
        // La date de création ne doit pas être réinitialisée à chaque édition.
        createdAt: editingEvent && editingEvent.id === id ? (editingEvent.createdAt || new Date().toISOString()) : new Date().toISOString()
    });
    resetForm();
    await refreshHealthEventsTab();
    if (loadCurrentDay) await loadCurrentDay();
    ui.showNotification(id ? 'Événement modifié !' : 'Événement ajouté !');
}

export function renderActiveEvents(events = []) {
    const list = document.getElementById('dailyEventsList');
    if (!list) return;
    list.innerHTML = '';

    if (!events.length) {
        const empty = document.createElement('p');
        empty.className = 'no-daily-events';
        empty.textContent = 'Aucun événement actif ce jour';
        list.appendChild(empty);
        return;
    }
    events.forEach(event => list.appendChild(createEventItem(event)));
}

export async function refreshHealthEventsTab() {
    const list = document.getElementById('healthEventsManageList');
    if (!list) return;
    const events = await db.loadHealthEvents();
    events.sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
    list.innerHTML = '';

    if (!events.length) {
        const empty = document.createElement('p');
        empty.className = 'no-daily-events';
        empty.textContent = 'Aucun événement enregistré';
        list.appendChild(empty);
        return;
    }
    events.forEach(event => list.appendChild(createEventItem(event, true)));
}

/**
 * Attache un écouteur une seule fois par élément.
 * Un simple drapeau de module resterait bloqué si le DOM est reconstruit,
 * et un appel répété empilait sinon un second écouteur `submit`
 * (double enregistrement de l'événement).
 */
function bindOnce(element, eventName, handler) {
    if (!element || element.dataset[`bound${eventName}`]) return;
    element.dataset[`bound${eventName}`] = 'true';
    element.addEventListener(eventName, handler);
}

export function initHealthEvents(options = {}) {
    loadCurrentDay = options.loadCurrentDay || null;
    bindOnce(document.getElementById('healthEventForm'), 'submit', submitEvent);
    bindOnce(document.getElementById('healthEventCancelBtn'), 'click', resetForm);
    bindOnce(document.getElementById('openHealthEventsTabBtn'), 'click', async () => {
        ui.switchTab('events');
        await refreshHealthEventsTab();
    });
}
