// js/handlers/ai-handlers.js
// Gère les interactions UI pour la génération de repas par l'IA GLM

import state from '../core/state.js';
import * as ui from '../ui/ui-core.js';
import * as aiGen from '../features/ai-meal-generator.js';
import * as aiFood from '../features/ai-food-assistant.js';
import * as db from '../core/db.js';

let _loadCurrentDay = null;

export function initAIHandlers({ loadCurrentDay }) {
    _loadCurrentDay = loadCurrentDay;
}

// ─────────────────────────────────────────────────────────────
// Ouvrir la modale de génération IA
// ─────────────────────────────────────────────────────────────
export function openAIModal() {
    if (!aiGen.hasApiKey()) {
        ui.showNotification('⚠️ Configurez d\'abord votre clé API DeepSeek dans les Paramètres.', 'error');
        return;
    }

    // Mise à jour du label de date
    const dateLabel = document.getElementById('aiModalDateLabel');
    if (dateLabel) {
        const dateStr = new Date(state.currentDate).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
        dateLabel.textContent = `Pour ${dateStr}`;
    }

    // Pré-cocher tous les repas par défaut
    ['petit-dej', 'dejeuner', 'diner', 'snack'].forEach(mt => {
        const cb = document.getElementById(`ai-meal-${mt}`);
        if (cb) cb.checked = true;
    });

    // Source par défaut = les deux
    const sourceEl = document.getElementById('ai-source-type');
    if (sourceEl) sourceEl.value = 'both';

    // Regénérer le prompt de prévisualisation
    refreshPromptPreview();

    ui.showModal('aiMealModal');
}

// ─────────────────────────────────────────────────────────────
// Rafraîchir la prévisualisation du prompt
// ─────────────────────────────────────────────────────────────
export function refreshPromptPreview() {
    const mealTypes = getSelectedMealTypes();
    const sourceType = document.getElementById('ai-source-type')?.value || 'both';

    const prompt = aiGen.buildPrompt({
        goals: state.goals,
        foods: state.foods,
        meals: state.meals,
        mealTypes,
        sourceType,
        date: state.currentDate
    });

    const textarea = document.getElementById('aiPromptPreview');
    if (textarea) textarea.value = prompt;
}

// ─────────────────────────────────────────────────────────────
// Récupérer les types de repas cochés
// ─────────────────────────────────────────────────────────────
function getSelectedMealTypes() {
    return ['petit-dej', 'dejeuner', 'diner', 'snack'].filter(mt => {
        const cb = document.getElementById(`ai-meal-${mt}`);
        return cb && cb.checked;
    });
}

// ─────────────────────────────────────────────────────────────
// Lancer la génération
// ─────────────────────────────────────────────────────────────
export async function handleGenerateMeals() {
    const mealTypes = getSelectedMealTypes();
    if (mealTypes.length === 0) {
        ui.showNotification('⚠️ Sélectionnez au moins un type de repas.', 'error');
        return;
    }

    const generateBtn = document.getElementById('aiGenerateBtn');
    const statusEl = document.getElementById('aiGenerationStatus');

    // UI : état chargement
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '⏳ Génération en cours...';
    }
    if (statusEl) {
        statusEl.className = 'ai-status ai-status--loading';
        statusEl.textContent = '💭 L\'IA compose vos repas...';
        statusEl.style.display = 'block';
    }

    try {
        // Récupérer le prompt (édité ou généré)
        const promptEl = document.getElementById('aiPromptPreview');
        const prompt = promptEl?.value || aiGen.buildPrompt({
            goals: state.goals,
            foods: state.foods,
            meals: state.meals,
            mealTypes,
            sourceType: document.getElementById('ai-source-type')?.value || 'both',
            date: state.currentDate
        });

        // Appel API
        const rawResponse = await aiGen.callGLM(prompt);

        // Parsing
        const parsed = aiGen.parseAIResponse(rawResponse);

        // Afficher le résumé de l'IA si présent
        if (parsed.resume && statusEl) {
            statusEl.className = 'ai-status ai-status--info';
            statusEl.innerHTML = `💡 <em>${parsed.resume}</em>`;
        }

        // Injection dans la DB
        const results = await aiGen.injectMealsIntoDay({
            plan: parsed.plan,
            date: state.currentDate,
            foods: state.foods,
            meals: state.meals
        });

        // Rafraîchir l'affichage
        if (_loadCurrentDay) await _loadCurrentDay();

        // Fermer la modale
        ui.hideModal('aiMealModal');

        // Notification de succès
        const msg = `✅ ${results.added} élément(s) ajouté(s) à vos repas !${results.skipped > 0 ? ` (${results.skipped} ignoré(s))` : ''}`;
        ui.showNotification(msg, 'success');

    } catch (error) {
        console.error('Erreur génération IA:', error);
        if (statusEl) {
            statusEl.className = 'ai-status ai-status--error';
            statusEl.textContent = `❌ ${error.message}`;
            statusEl.style.display = 'block';
        }
    } finally {
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '✨ Générer mes repas';
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Copier le prompt dans le presse-papiers
// ─────────────────────────────────────────────────────────────
export async function handleCopyPrompt() {
    const promptEl = document.getElementById('aiPromptPreview');
    const text = promptEl?.value;
    if (!text) { ui.showNotification('⚠️ Le prompt est vide.', 'error'); return; }
    try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('aiCopyPromptBtn');
        if (btn) { btn.textContent = '✅ Copié !'; setTimeout(() => { btn.textContent = '📋 Copier le prompt'; }, 2000); }
    } catch (e) {
        ui.showNotification('❌ Impossible de copier dans le presse-papiers.', 'error');
    }
}

// ─────────────────────────────────────────────────────────────
// Toggle de la section Mode Manuel
// ─────────────────────────────────────────────────────────────
export function handleToggleManualSection() {
    const body = document.getElementById('aiManualBody');
    const arrow = document.getElementById('aiManualArrow');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

// ─────────────────────────────────────────────────────────────
// Traiter un JSON collé manuellement (Mode Manuel)
// ─────────────────────────────────────────────────────────────
export async function handleProcessManualResponse() {
    const inputEl = document.getElementById('aiManualResponseInput');
    const statusEl = document.getElementById('aiGenerationStatus');
    const processBtn = document.getElementById('aiProcessManualBtn');
    const rawText = inputEl?.value?.trim();

    if (!rawText) {
        ui.showNotification('⚠️ Collez d\'abord une réponse JSON dans le champ.', 'error');
        return;
    }

    if (processBtn) { processBtn.disabled = true; processBtn.textContent = '⏳ Traitement...'; }
    if (statusEl) { statusEl.style.display = 'none'; }

    try {
        const parsed = aiGen.parseAIResponse(rawText);

        if (parsed.resume && statusEl) {
            statusEl.className = 'ai-status ai-status--info';
            statusEl.innerHTML = `💡 <em>${parsed.resume}</em>`;
            statusEl.style.display = 'block';
        }

        const results = await aiGen.injectMealsIntoDay({
            plan: parsed.plan,
            date: state.currentDate,
            foods: state.foods,
            meals: state.meals
        });

        if (_loadCurrentDay) await _loadCurrentDay();
        ui.hideModal('aiMealModal');
        const msg = `✅ ${results.added} élément(s) ajouté(s) depuis le JSON manuel !${results.skipped > 0 ? ` (${results.skipped} ignoré(s))` : ''}`;
        ui.showNotification(msg, 'success');

    } catch (error) {
        console.error('Erreur traitement manuel:', error);
        if (statusEl) {
            statusEl.className = 'ai-status ai-status--error';
            statusEl.textContent = `❌ ${error.message}`;
            statusEl.style.display = 'block';
        }
        ui.showNotification(`❌ JSON invalide : ${error.message}`, 'error');
    } finally {
        if (processBtn) { processBtn.disabled = false; processBtn.textContent = '▶ Traiter et injecter le JSON'; }
    }
}

// ─────────────────────────────────────────────────────────────
// Sauvegarder la clé API depuis les paramètres
// ─────────────────────────────────────────────────────────────
export async function handleSaveApiKey() {
    const keyInput = document.getElementById('glmApiKeyInput');
    const key = keyInput?.value?.trim();
    if (!key) {
        ui.showNotification('⚠️ Entrez une clé API valide.', 'error');
        return;
    }

    // Sauvegarder le modèle sélectionné
    const modelSelect = document.getElementById('glmModelSelect');
    if (modelSelect) aiGen.saveModel(modelSelect.value);

    const saveBtn = document.getElementById('saveGlmApiKeyBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Test...'; }

    try {
        aiGen.saveApiKey(key);
        await aiGen.testApiConnection();
        ui.showNotification('✅ Clé API DeepSeek sauvegardée et connexion validée !', 'success');
        updateApiKeyStatus(true);
    } catch (error) {
        ui.showNotification(`❌ Connexion échouée : ${error.message}`, 'error');
        updateApiKeyStatus(false);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Sauvegarder & Tester'; }
    }
}

export function handleClearApiKey() {
    localStorage.removeItem('deepseek_api_key');
    // `getApiKey()` retombe sur l'ancienne clé Groq : sans cette suppression,
    // hasApiKey() restait vrai après un effacement.
    localStorage.removeItem('groq_api_key');
    const keyInput = document.getElementById('glmApiKeyInput');
    if (keyInput) keyInput.value = '';
    updateApiKeyStatus(false);
    ui.showNotification('🗑️ Clé API supprimée.', 'success');
}

export function handleSaveSearchApiKey() {
    const input = document.getElementById('braveSearchApiKeyInput');
    const key = input?.value?.trim();
    if (!key) {
        ui.showNotification('⚠️ Entrez une clé Brave Search API valide.', 'error');
        return;
    }
    aiFood.saveSearchApiKey(key);
    if (input) input.value = '';
    initApiKeySettings();
    ui.showNotification('✅ Clé Brave Search sauvegardée !', 'success');
}

export function handleClearSearchApiKey() {
    aiFood.clearSearchApiKey();
    const input = document.getElementById('braveSearchApiKeyInput');
    if (input) input.value = '';
    initApiKeySettings();
    ui.showNotification('🗑️ Clé Brave Search supprimée.', 'success');
}

export function handleSaveFoodSearchPreference() {
    const enabledInput = document.getElementById('preferRetailerSearchInput');
    const retailersInput = document.getElementById('preferredRetailersInput');
    const retailers = String(retailersInput?.value || '')
        .split('\n')
        .map(retailer => retailer.trim())
        .filter(Boolean);

    if (enabledInput?.checked && retailers.length === 0) {
        ui.showNotification('⚠️ Indique au moins une enseigne à prioriser.', 'error');
        return;
    }

    aiFood.saveFoodSearchPreference({
        enabled: Boolean(enabledInput?.checked),
        retailers: retailers.length ? retailers : ['Intermarché Senonches France']
    });
    initApiKeySettings();
    ui.showNotification('✅ Enseignes prioritaires sauvegardées !', 'success');
}

// ─────────────────────────────────────────────────────────────
// Initialiser l'affichage de la clé API dans les paramètres
// ─────────────────────────────────────────────────────────────
export function initApiKeySettings() {
    const key = aiGen.getApiKey();
    const keyInput = document.getElementById('glmApiKeyInput');
    if (keyInput && key) {
        keyInput.placeholder = key.length > 12
            ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
            : '(configurée)';
    }
    // Restaurer le modèle choisi
    const modelSelect = document.getElementById('glmModelSelect');
    if (modelSelect) modelSelect.value = aiGen.getModel();

    const searchInput = document.getElementById('braveSearchApiKeyInput');
    const searchKey = aiFood.getSearchApiKey();
    if (searchInput && searchKey) {
        searchInput.placeholder = searchKey.length > 12
            ? `${searchKey.substring(0, 8)}...${searchKey.substring(searchKey.length - 4)}`
            : '(configurée)';
    }
    const searchStatus = document.getElementById('braveSearchApiStatus');
    if (searchStatus) {
        searchStatus.className = `glm-status glm-status--${searchKey ? 'ok' : 'missing'}`;
        searchStatus.textContent = searchKey ? '✅ Recherche web configurée' : '⚠️ Recherche web non configurée';
    }

    const preference = aiFood.getFoodSearchPreference();
    const preferRetailerInput = document.getElementById('preferRetailerSearchInput');
    const retailersInput = document.getElementById('preferredRetailersInput');
    if (preferRetailerInput) preferRetailerInput.checked = preference.enabled;
    if (retailersInput) retailersInput.value = preference.retailers.join('\n');

    updateApiKeyStatus(!!key);
}

function updateApiKeyStatus(connected) {
    const statusEl = document.getElementById('glmApiStatus');
    if (!statusEl) return;
    statusEl.className = `glm-status glm-status--${connected ? 'ok' : 'missing'}`;
    statusEl.textContent = connected ? '✅ Clé configurée' : '⚠️ Non configurée';
}
