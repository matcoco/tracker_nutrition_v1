// js/features/ai-meal-generator.js
// Gère la génération de repas via l'API DeepSeek

import * as db from '../core/db.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// Model selection — configurable via paramètres
export function getModel() {
    return localStorage.getItem('deepseek_model') || 'deepseek-v4-flash';
}

export function saveModel(model) {
    localStorage.setItem('deepseek_model', model);
}

// ─────────────────────────────────────────────────────────────
// Clé API : stockée en localStorage
// ─────────────────────────────────────────────────────────────
export function saveApiKey(key) {
    localStorage.setItem('deepseek_api_key', key.trim());
    localStorage.removeItem('groq_api_key'); // compat
}

export function getApiKey() {
    return localStorage.getItem('deepseek_api_key') || localStorage.getItem('groq_api_key') || '';
}

export function hasApiKey() {
    return !!getApiKey();
}

// ─────────────────────────────────────────────────────────────
// Appel API DeepSeek
// ─────────────────────────────────────────────────────────────
export async function callGLM(prompt) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Clé API DeepSeek non configurée. Configurez-la dans les Paramètres.');

    const model = getModel();
    const payload = {
        model,
        messages: [
            {
                role: 'system',
                content: 'Tu es un nutritionniste expert. Tu génères des plans alimentaires personnalisés en JSON strict. Tu dois ABSOLUMENT respecter les cibles caloriques par repas et utiliser EXACTEMENT les identifiants fournis entre crochets [id:...] dans ton output JSON.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 1.0,
        max_tokens: 4000
    };

    console.log('[DeepSeek] Envoi requête → model:', model, 'prompt length:', prompt.length);

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('[DeepSeek] Erreur HTTP', response.status, errBody);
        let errMsg = `Erreur ${response.status}`;
        try { errMsg = JSON.parse(errBody)?.error?.message || errMsg; } catch (_) {}
        throw new Error(`Erreur API DeepSeek (${response.status}) : ${errMsg}`);
    }

    const data = await response.json();
    console.log('[DeepSeek] Réponse brute:', JSON.stringify(data).substring(0, 500));

    // Format OpenAI compatible
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
        console.error('[DeepSeek] Réponse inattendue:', JSON.stringify(data));
        throw new Error(`Réponse vide de l'API DeepSeek.`);
    }
    console.log('[DeepSeek] Réponse reçue ✓', content.substring(0, 100));
    return content;
}

export function buildPrompt({ goals, foods, meals, mealTypes, sourceType, date }) {
    const dateStr = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Résumé des objectifs
    const goalsText = goals
        ? `- Calories : ${goals.calories || 2000} kcal\n- Protéines : ${goals.proteins || 150} g\n- Glucides : ${goals.carbs || 200} g\n- Lipides : ${goals.fats || 70} g`
        : '- Objectifs non définis (utilise 2000 kcal, 150g prot, 200g gluc, 70g lip par défaut)';

    // Liste des ingrédients disponibles
    let sourceLines = '';

    // Fonction utilitaire pour mélanger un tableau
    const shuffle = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    if (sourceType === 'foods' || sourceType === 'both') {
        const allFoods = Object.entries(foods || {}).filter(([, f]) => f.category !== 'meals');
        const foodEntries = shuffle(allFoods)
            .slice(0, 100) // Augmenté à 100 pour plus de choix
            .map(([id, f]) =>
                `  • ${f.name} (${f.calories} kcal/100g | P:${f.proteins}g G:${f.carbs}g L:${f.fats}g) [id:${id}]`
            ).join('\n');
        sourceLines += `\n### INGRÉDIENTS DISPONIBLES (Sélection aléatoire parmi vos aliments) :\n${foodEntries || '(aucun)'}`;
    }

    if (sourceType === 'meals' || sourceType === 'both') {
        const allMeals = Object.entries(meals || {});
        const mealEntries = shuffle(allMeals)
            .slice(0, 50) // Augmenté à 50 pour plus de choix
            .map(([id, m]) =>
                `  • ${m.name} (${m.calories || '?'} kcal | P:${m.proteins || 0}g G:${m.carbs || 0}g L:${m.fats || 0}g) [meal_id:${id}]`
            ).join('\n');
        sourceLines += `\n### REPAS COMPOSÉS DISPONIBLES (Sélection aléatoire parmi vos repas) :\n${mealEntries || '(aucun)'}`;
    }

    // Types de repas à générer
    const mealTypeLabels = {
        'petit-dej': 'Petit Déjeuner',
        'dejeuner': 'Déjeuner',
        'diner': 'Dîner',
        'snack': 'Snack'
    };
    // Aucun repas coché donnerait une division par zéro (cible « Infinity kcal »).
    const requestedTypes = Array.isArray(mealTypes) && mealTypes.length
        ? mealTypes
        : ['petit-dej', 'dejeuner', 'diner', 'snack'];
    const mealTypesText = requestedTypes.map(mt => mealTypeLabels[mt] || mt).join(', ');

    // Calcul des cibles caloriques par repas, renormalisées sur les repas demandés
    const totalCal = goals?.calories || 2000;
    const mealWeights = {
        'petit-dej': 0.25,
        'dejeuner': 0.35,
        'diner': 0.30,
        'snack': 0.10,
    };
    const totalWeight = requestedTypes.reduce((sum, mt) => sum + (mealWeights[mt] || 1 / requestedTypes.length), 0) || 1;
    const distribLines = requestedTypes
        .map(mt => `  - ${mealTypeLabels[mt] || mt} : ~${Math.round(totalCal * (mealWeights[mt] || 1 / requestedTypes.length) / totalWeight)} kcal`)
        .join('\n');

    return `Tu es un nutritionniste expert. Pour la journée du ${dateStr}, génère un plan alimentaire équilibré.

## MES OBJECTIFS NUTRITIONNELS JOURNALIERS :
${goalsText}

## RÉPARTITION CALORIQUE CIBLE PAR REPAS (à respecter au plus près) :
${distribLines}
→ La somme des repas doit atteindre l'objectif journalier total.

## REPAS À GÉNÉRER : ${mealTypesText}

## SOURCES AUTORISÉES : ${sourceType === 'foods' ? 'Ingrédients uniquement' : sourceType === 'meals' ? 'Repas composés uniquement' : 'Ingrédients et repas composés'}
${sourceLines}

## RÈGLES IMPÉRATIVES :
1. Utilise UNIQUEMENT les aliments/repas listés dans les sources ci-dessus.
2. ⚠️ CRITIQUE – IDENTIFIANTS : dans le JSON de réponse, le champ "id" doit contenir EXACTEMENT la chaîne entre crochets [id:...] ou [meal_id:...] (ex: "chabrior-corn-flakes", pas "corn flakes"). Ne l'invente jamais.
3. La quantité de chaque aliment doit être cohérente et réaliste (pas plus de 500g par item).
4. Chaque repas doit atteindre sa cible calorique en combinant plusieurs aliments si nécessaire.
5. Équilibre protéines/glucides/lipides en accord avec les objectifs journaliers.

## FORMAT DE RÉPONSE (JSON STRICT, AUCUN TEXTE AUTOUR) :
{
  "plan": {
    "petit-dej": [
      { "id": "id_exact_entre_crochets", "type": "food", "quantite": 150 },
      { "id": "id_exact_repas", "type": "meal", "quantite": 200 }
    ],
    "dejeuner": [...],
    "diner": [...],
    "snack": [...]
  },
  "resume": "Brève explication du plan nutritionnel (2 lignes max)"
}

N'inclus que les repas demandés (${mealTypes.join(', ')}). Réponds UNIQUEMENT avec le JSON, sans aucun texte avant ou après.`;
}

// ─────────────────────────────────────────────────────────────

// Parsing de la réponse JSON de l'IA
// ─────────────────────────────────────────────────────────────
export function parseAIResponse(content) {
    const cleanContent = String(content || '').replace(/<think>[\s\S]*?<\/think>/g, '');

    // Extraction délimitée à la première { et à la dernière } : la regex gloutonne
    // capturait aussi toute prose contenant une accolade après le JSON.
    const start = cleanContent.indexOf('{');
    const end = cleanContent.lastIndexOf('}');
    if (start === -1 || end <= start) {
        throw new Error('Format de réponse invalide : aucun JSON trouvé.');
    }

    let parsed;
    try {
        parsed = JSON.parse(cleanContent.slice(start, end + 1));
    } catch (e) {
        throw new Error('Impossible de parser la réponse JSON de l\'IA.');
    }

    if (!parsed.plan || typeof parsed.plan !== 'object' || Array.isArray(parsed.plan)) {
        throw new Error('Structure de réponse invalide : "plan" doit être un objet.');
    }

    const knownMealTypes = ['petit-dej', 'dejeuner', 'diner', 'snack'];
    if (!Object.keys(parsed.plan).some(key => knownMealTypes.includes(key))) {
        throw new Error('Aucun type de repas reconnu dans le plan généré.');
    }

    return parsed;
}

// ─────────────────────────────────────────────────────────────
// Injection des repas générés dans la DB
// ─────────────────────────────────────────────────────────────
function getDefaultMealTime(mealType) {
    const defaults = { 'petit-dej': '08:00', 'dejeuner': '12:30', 'diner': '19:30' };
    if (defaults[mealType]) return defaults[mealType];
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// `Date.now()` seul pouvait produire deux identifiants identiques lorsque
// plusieurs aliments étaient injectés dans la même milliseconde.
let lastMealItemId = 0;
function incrementingId() {
    const now = Date.now();
    lastMealItemId = now > lastMealItemId ? now : lastMealItemId + 1;
    return `${lastMealItemId}-${Math.random().toString(36).slice(2, 7)}`;
}

const VALID_MEAL_TYPES = ['petit-dej', 'dejeuner', 'diner', 'snack'];

export async function injectMealsIntoDay({ plan, date, foods, meals }) {
    const results = { added: 0, skipped: 0, errors: [] };

    // Charger les repas existants du jour
    const existingMeals = await db.loadDayMeals(date);

    for (const [mealType, items] of Object.entries(plan || {})) {
        if (!Array.isArray(items)) continue;
        // Un type de repas inventé par l'IA serait compté dans les totaux sans
        // jamais être affiché ni supprimable depuis l'interface.
        if (!VALID_MEAL_TYPES.includes(mealType)) {
            results.skipped += items.length;
            continue;
        }
        if (!existingMeals[mealType]) existingMeals[mealType] = [];

        for (const item of items) {
            try {
                const { id, type } = item;
                const qty = Number(item.quantite);
                // Quantité absente, nulle, négative ou absurde : on refuse.
                if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) {
                    results.skipped++;
                    continue;
                }

                if (type === 'food') {
                    if (!foods[id]) {
                        results.skipped++;
                        continue;
                    }
                    existingMeals[mealType].push({
                        id,           // ← champ attendu par tout le reste de l'app
                        weight: qty,
                        time: item.time || getDefaultMealTime(mealType),
                        uniqueId: incrementingId(),
                    });
                    results.added++;
                } else if (type === 'meal') {
                    if (!meals[id]) {
                        results.skipped++;
                        continue;
                    }
                    existingMeals[mealType].push({
                        id,           // ← champ attendu par tout le reste de l'app
                        weight: qty,
                        isMeal: true,
                        time: item.time || getDefaultMealTime(mealType),
                        uniqueId: incrementingId(),
                    });
                    results.added++;
                } else {
                    results.skipped++;
                }
            } catch (err) {
                results.errors.push(err.message);
            }
        }
    }

    // Sauvegarder les repas mis à jour
    await db.saveDayMeals(date, existingMeals);
    return results;
}

// Helper date key
function formatDateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// Test de connexion API
// ─────────────────────────────────────────────────────────────
export async function testApiConnection() {
    const apiKey = getApiKey();
    // Sans cette garde, l'appel partait avec « Authorization: Bearer » vide et
    // renvoyait une erreur API incompréhensible.
    if (!apiKey) throw new Error('Clé API DeepSeek non configurée.');
    const model = getModel();
    console.log('[DeepSeek] Test connexion → model:', model);

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 10
        })
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('[DeepSeek] Test échoué', response.status, errBody);
        let errMsg = `Erreur ${response.status}`;
        try { errMsg = JSON.parse(errBody)?.error?.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
    }
    console.log('[DeepSeek] Test connexion réussi ✓');
    return true;
}
