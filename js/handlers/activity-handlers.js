// js/handlers/activity-handlers.js
// Handlers pour les activités physiques.

import state from '../core/state.js';
import * as db from '../core/db.js';
import * as ui from '../ui/ui-core.js';
import { defaultActivities } from '../config.js';

const CUSTOM_STRENGTH_EXERCISES_KEY = 'nt_custom_strength_exercises';
const BASE_STRENGTH_MUSCLES = ['Pectoraux', 'Dos', 'Biceps', 'Triceps', 'Épaules', 'Jambes', 'Abdos', 'Fessiers', 'Mollets'];
const DEFAULT_STRENGTH_EXERCISES = [
    { name: 'Pompe', muscle: 'Pectoraux / triceps' },
    { name: 'Traction supination', muscle: 'Dos / biceps' },
    { name: 'Traction pronation', muscle: 'Dos' },
    { name: 'Dips', muscle: 'Pectoraux / triceps' }
];

function escapeAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function isStrengthActivity(type) {
    return String(type || '').toLowerCase().includes('musculation');
}

function normalizeStrengthExerciseEntry(entry) {
    if (typeof entry === 'string') return { name: entry.trim(), muscle: '' };
    return {
        name: String(entry?.name || '').trim(),
        muscle: String(entry?.muscle || '').trim()
    };
}

function getCustomStrengthExerciseCatalog() {
    try {
        const raw = JSON.parse(localStorage.getItem(CUSTOM_STRENGTH_EXERCISES_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw.map(normalizeStrengthExerciseEntry).filter(exercise => exercise.name);
    } catch (error) {
        return [];
    }
}

function getStrengthExerciseCatalog() {
    const catalog = [...DEFAULT_STRENGTH_EXERCISES, ...getCustomStrengthExerciseCatalog()];
    const seen = new Set();
    return catalog.filter(exercise => {
        const key = exercise.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function saveCustomStrengthExerciseCatalog(catalog) {
    const cleaned = [];
    const seen = new Set();
    catalog.map(normalizeStrengthExerciseEntry).forEach(exercise => {
        const key = exercise.name.toLowerCase();
        if (!exercise.name || seen.has(key)) return;
        seen.add(key);
        cleaned.push(exercise);
    });
    localStorage.setItem(CUSTOM_STRENGTH_EXERCISES_KEY, JSON.stringify(cleaned));
}

function getStrengthExerciseNames() {
    return getStrengthExerciseCatalog().map(exercise => exercise.name);
}

function getStrengthMuscles() {
    return [...new Set([
        ...BASE_STRENGTH_MUSCLES,
        ...getStrengthExerciseCatalog().map(exercise => exercise.muscle).filter(Boolean)
    ])];
}

function findStrengthExercise(name) {
    const key = String(name || '').trim().toLowerCase();
    return getStrengthExerciseCatalog().find(exercise => exercise.name.toLowerCase() === key);
}

function saveStrengthExercisesFromRows(exercises) {
    const defaults = new Set(DEFAULT_STRENGTH_EXERCISES.map(exercise => exercise.name.toLowerCase()));
    const existing = getCustomStrengthExerciseCatalog();
    const byName = new Map(existing.map(exercise => [exercise.name.toLowerCase(), exercise]));

    exercises.map(normalizeStrengthExerciseEntry).forEach(exercise => {
        const key = exercise.name.toLowerCase();
        if (!exercise.name || defaults.has(key)) return;
        byName.set(key, {
            name: exercise.name,
            muscle: exercise.muscle || byName.get(key)?.muscle || ''
        });
    });

    saveCustomStrengthExerciseCatalog([...byName.values()]);
    refreshStrengthExerciseOptions();
    renderStrengthExerciseSettingsList();
}

function refreshStrengthExerciseOptions() {
    const exerciseDatalist = document.getElementById('strengthExerciseOptions');
    const muscleDatalist = document.getElementById('strengthMuscleOptions');

    if (exerciseDatalist) exerciseDatalist.innerHTML = '';
    getStrengthExerciseNames().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        exerciseDatalist?.appendChild(option);
    });

    if (muscleDatalist) muscleDatalist.innerHTML = '';
    getStrengthMuscles().forEach(muscle => {
        const option = document.createElement('option');
        option.value = muscle;
        muscleDatalist?.appendChild(option);
    });
}

function createStrengthExerciseRow(container, exercise = {}) {
    const row = document.createElement('div');
    row.className = 'strength-exercise-row';
    row.innerHTML = `
        <input type="text" class="strength-exercise-name" list="strengthExerciseOptions" placeholder="Exercice" value="${escapeAttribute(exercise.name)}">
        <input type="text" class="strength-exercise-muscle" list="strengthMuscleOptions" placeholder="Muscle" value="${escapeAttribute(exercise.muscle)}">
        <input type="number" class="strength-exercise-sets" min="0" step="1" placeholder="Séries" value="${exercise.sets || ''}">
        <input type="number" class="strength-exercise-reps" min="0" step="1" placeholder="Répétitions" value="${exercise.reps || ''}">
        <input type="number" class="strength-exercise-dumbbell" min="0" step="0.5" placeholder="Haltères kg" value="${exercise.dumbbellWeight || ''}">
        <input type="number" class="strength-exercise-vest" min="0" step="0.5" placeholder="Gilet kg" value="${exercise.vestWeight || ''}">
        <button type="button" class="strength-remove-btn" title="Supprimer cet exercice">🗑️</button>
    `;
    row.querySelector('.strength-exercise-name').addEventListener('change', event => {
        const knownExercise = findStrengthExercise(event.target.value);
        const muscleInput = row.querySelector('.strength-exercise-muscle');
        if (knownExercise?.muscle && muscleInput && !muscleInput.value.trim()) {
            muscleInput.value = knownExercise.muscle;
        }
    });
    row.querySelector('.strength-remove-btn').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function readStrengthExercises(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.strength-exercise-row'))
        .map(row => ({
            name: row.querySelector('.strength-exercise-name')?.value.trim() || '',
            muscle: row.querySelector('.strength-exercise-muscle')?.value.trim() || '',
            sets: Number(row.querySelector('.strength-exercise-sets')?.value) || 0,
            reps: Number(row.querySelector('.strength-exercise-reps')?.value) || 0,
            dumbbellWeight: Number(row.querySelector('.strength-exercise-dumbbell')?.value) || 0,
            vestWeight: Number(row.querySelector('.strength-exercise-vest')?.value) || 0
        }))
        .filter(exercise => exercise.name || exercise.muscle || exercise.sets || exercise.reps || exercise.dumbbellWeight || exercise.vestWeight);
}

function resetStrengthExercises(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
}

function setStrengthPanelVisibility(selectId, panelId, listId) {
    const select = document.getElementById(selectId);
    const panel = document.getElementById(panelId);
    if (!select || !panel) return;
    const shouldShow = isStrengthActivity(select.value);
    panel.style.display = shouldShow ? '' : 'none';
    if (shouldShow && document.getElementById(listId)?.children.length === 0) {
        createStrengthExerciseRow(document.getElementById(listId));
    }
}

function renderStrengthExerciseSettingsList() {
    const container = document.getElementById('strengthExerciseSettingsList');
    if (!container) return;

    const defaults = new Set(DEFAULT_STRENGTH_EXERCISES.map(exercise => exercise.name.toLowerCase()));
    const catalog = getStrengthExerciseCatalog();
    if (!catalog.length) {
        container.innerHTML = '<p class="strength-settings-empty">Aucun mouvement configuré.</p>';
        return;
    }

    container.innerHTML = catalog.map(exercise => {
        const isDefault = defaults.has(exercise.name.toLowerCase());
        return `
            <div class="strength-settings-item">
                <div>
                    <strong>${escapeAttribute(exercise.name)}</strong>
                    <span class="strength-settings-muscle">${escapeAttribute(exercise.muscle || 'Muscle non renseigné')}</span>
                </div>
                ${isDefault
                    ? '<span class="strength-settings-badge">Base</span>'
                    : `<button type="button" class="strength-settings-delete-btn" data-name="${escapeAttribute(exercise.name)}">Supprimer</button>`}
            </div>
        `;
    }).join('');

    container.querySelectorAll('.strength-settings-delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const name = button.dataset.name;
            const custom = getCustomStrengthExerciseCatalog()
                .filter(exercise => exercise.name.toLowerCase() !== String(name || '').toLowerCase());
            saveCustomStrengthExerciseCatalog(custom);
            refreshStrengthExerciseOptions();
            renderStrengthExerciseSettingsList();
            ui.showNotification('🗑️ Mouvement supprimé');
        });
    });
}

function handleAddStrengthExerciseSetting() {
    const nameInput = document.getElementById('strengthExerciseNameInput');
    const muscleInput = document.getElementById('strengthExerciseMuscleInput');
    const name = nameInput?.value.trim() || '';
    const muscle = muscleInput?.value.trim() || '';

    if (!name) {
        ui.showNotification('⚠️ Indiquez un mouvement', 'error');
        return;
    }

    const defaultExists = DEFAULT_STRENGTH_EXERCISES.some(exercise => exercise.name.toLowerCase() === name.toLowerCase());
    if (defaultExists) {
        ui.showNotification('⚠️ Ce mouvement est déjà dans la liste de base', 'error');
        return;
    }

    const custom = getCustomStrengthExerciseCatalog();
    const existingIndex = custom.findIndex(exercise => exercise.name.toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) custom[existingIndex] = { name, muscle };
    else custom.push({ name, muscle });

    saveCustomStrengthExerciseCatalog(custom);
    refreshStrengthExerciseOptions();
    renderStrengthExerciseSettingsList();
    if (nameInput) nameInput.value = '';
    if (muscleInput) muscleInput.value = '';
    ui.showNotification(existingIndex >= 0 ? '✅ Mouvement mis à jour' : '✅ Mouvement ajouté');
}

export function initStrengthActivityControls() {
    refreshStrengthExerciseOptions();
    renderStrengthExerciseSettingsList();
    document.getElementById('activitySelect')?.addEventListener('change', () => {
        setStrengthPanelVisibility('activitySelect', 'strengthDetailsPanel', 'strengthExercisesList');
    });
    document.getElementById('editActivityType')?.addEventListener('change', () => {
        setStrengthPanelVisibility('editActivityType', 'editStrengthDetailsPanel', 'editStrengthExercisesList');
    });
    document.getElementById('addStrengthExerciseBtn')?.addEventListener('click', () => {
        createStrengthExerciseRow(document.getElementById('strengthExercisesList'));
    });
    document.getElementById('editAddStrengthExerciseBtn')?.addEventListener('click', () => {
        createStrengthExerciseRow(document.getElementById('editStrengthExercisesList'));
    });
    document.getElementById('addStrengthExerciseSettingBtn')?.addEventListener('click', handleAddStrengthExerciseSetting);
}

export function updateActivitySelects() {
    state.allActivities = [...defaultActivities, ...state.customActivities.map(a => a.name)];
    const selects = [document.getElementById('activitySelect'), document.getElementById('editActivityType')];
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Sélectionner une activité...</option>';
        state.allActivities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity;
            option.textContent = activity;
            select.appendChild(option);
        });
        select.value = currentValue;
    });
}

export async function handleAddActivity(loadCurrentDay) {
    const activityType = document.getElementById('activitySelect').value;
    const time = document.getElementById('activityTime').value;
    const duration = parseInt(document.getElementById('activityDuration').value);
    const calories = parseInt(document.getElementById('activityCalories').value);

    if (!activityType || !time || !duration || !calories || duration <= 0 || calories < 0) {
        ui.showNotification('⚠️ Veuillez remplir tous les champs correctement', 'error');
        return;
    }

    const strengthExercises = isStrengthActivity(activityType) ? readStrengthExercises('strengthExercisesList') : [];
    if (strengthExercises.length) saveStrengthExercisesFromRows(strengthExercises);
    state.activities.push({ id: Date.now(), type: activityType, time, duration, calories, strengthExercises });
    await db.saveDayActivities(state.currentDate, state.activities);

    document.getElementById('activitySelect').value = '';
    document.getElementById('activityTime').value = '';
    document.getElementById('activityDuration').value = '';
    document.getElementById('activityCalories').value = '';
    resetStrengthExercises('strengthExercisesList');
    setStrengthPanelVisibility('activitySelect', 'strengthDetailsPanel', 'strengthExercisesList');

    await loadCurrentDay();
    ui.showNotification('✅ Activité ajoutée !');
}

export function handleEditActivity(id) {
    const activity = state.activities.find(a => a.id === id);
    if (!activity) return;
    document.getElementById('editActivityIndex').value = id;
    document.getElementById('editActivityType').value = activity.type;
    document.getElementById('editActivityTime').value = activity.time || '';
    document.getElementById('editActivityDuration').value = activity.duration;
    document.getElementById('editActivityCalories').value = activity.calories;
    resetStrengthExercises('editStrengthExercisesList');
    (activity.strengthExercises || []).forEach(exercise => {
        createStrengthExerciseRow(document.getElementById('editStrengthExercisesList'), exercise);
    });
    setStrengthPanelVisibility('editActivityType', 'editStrengthDetailsPanel', 'editStrengthExercisesList');
    ui.showModal('editActivityModal');
}

export async function handleSaveEditActivity(event, loadCurrentDay) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editActivityIndex').value);
    const type = document.getElementById('editActivityType').value;
    const time = document.getElementById('editActivityTime').value;
    const duration = parseInt(document.getElementById('editActivityDuration').value);
    const calories = parseInt(document.getElementById('editActivityCalories').value);

    const activityIndex = state.activities.findIndex(a => a.id === id);
    if (activityIndex === -1) return;

    const strengthExercises = isStrengthActivity(type) ? readStrengthExercises('editStrengthExercisesList') : [];
    if (strengthExercises.length) saveStrengthExercisesFromRows(strengthExercises);
    state.activities[activityIndex] = { id, type, time, duration, calories, strengthExercises };
    await db.saveDayActivities(state.currentDate, state.activities);

    ui.hideModal('editActivityModal');
    await loadCurrentDay();
    ui.showNotification('✅ Activité modifiée !');
}

export async function handleDeleteActivity(id, loadCurrentDay) {
    if (!confirm('Supprimer cette activité ?')) return;
    state.activities = state.activities.filter(a => a.id !== id);
    await db.saveDayActivities(state.currentDate, state.activities);
    await loadCurrentDay();
    ui.showNotification('🗑️ Activité supprimée');
}

export async function handleAddCustomActivity(event) {
    event.preventDefault();
    const name = document.getElementById('customActivityName').value.trim();
    if (!name) { ui.showNotification('⚠️ Veuillez entrer un nom d\'activité', 'error'); return; }
    if (state.allActivities.includes(name)) { ui.showNotification('⚠️ Cette activité existe déjà', 'error'); return; }
    await db.saveCustomActivity(name);
    state.customActivities = await db.loadCustomActivities();
    updateActivitySelects();
    document.getElementById('customActivityName').value = '';
    ui.hideModal('customActivityModal');
    ui.showNotification('✅ Nouvelle activité ajoutée !');
}
