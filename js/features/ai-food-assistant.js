// js/features/ai-food-assistant.js
// Assistant pour remplir un aliment depuis une recherche internet ou une analyse IA.

import { getApiKey, getModel } from './ai-meal-generator.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const BRAVE_SEARCH_API_KEY = 'brave_search_api_key';
const FOOD_SEARCH_PREFERENCE_KEY = 'food_search_preference';
const TESSERACT_OPTIONS = {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0'
};
const BRAVE_SEARCH_PROXY_URLS = [
    `${window.location.origin}/brave-search`,
    'http://127.0.0.1:8787/brave-search'
];

const CATEGORIES = ['proteins', 'vegetables', 'starches', 'fruits', 'dairy', 'fats', 'beverages', 'snacks', 'condiments', 'sauces', 'other'];

function round(value, digits = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Number(number.toFixed(digits));
}

function categoryFromTags(product) {
    const text = [
        product.categories || '',
        product.generic_name || '',
        product.product_name || '',
        product.brands || '',
        ...(product.categories_tags || [])
    ].join(' ').toLowerCase();

    if (/drink|boisson|jus|soda|eau|milk drink|thé|café/.test(text)) return 'beverages';
    if (/sauce|ketchup|mayonnaise|pesto/.test(text)) return 'sauces';
    if (/spice|épice|condiment|sel|poivre|herb/.test(text)) return 'condiments';
    if (/yogurt|yaourt|fromage|cheese|lait|dairy/.test(text)) return 'dairy';
    if (/fruit|pomme|banane|orange|berry|fraise|framboise/.test(text)) return 'fruits';
    if (/vegetable|légume|haricot|carotte|tomate|salad/.test(text)) return 'vegetables';
    if (/rice|riz|pasta|pâte|bread|pain|cereal|céréale|potato|pomme de terre/.test(text)) return 'starches';
    if (/meat|beef|chicken|poulet|fish|poisson|egg|oeuf|protein/.test(text)) return 'proteins';
    if (/oil|huile|butter|beurre|nuts|amande|noix|avocat/.test(text)) return 'fats';
    if (/snack|biscuit|cookie|chocolate|chocolat|barre|chips|bonbon/.test(text)) return 'snacks';
    return 'other';
}

function glycemicGuess(carbs, sugars, fibers, category) {
    if (category === 'proteins' || category === 'fats' || carbs <= 1) return 0;
    if (category === 'vegetables') return 20;
    if (category === 'fruits') return 40;
    if (category === 'dairy') return 30;
    if (category === 'starches') return 60;
    if (sugars > 25 && fibers < 3) return 65;
    return 50;
}

export function normalizeFoodData(raw = {}) {
    const carbs = round(raw.carbs);
    const category = CATEGORIES.includes(raw.category) ? raw.category : 'other';
    const rawPrice = Number(raw.price);
    const rawPriceQuantity = Number(raw.priceQuantity);
    const hasValidPrice = Number.isFinite(rawPrice) && Number.isFinite(rawPriceQuantity) && rawPrice > 0 && rawPriceQuantity > 0;
    // Number(null) === 0 : un IG explicitement null (champ non trouvé par l'IA)
    // était converti en 0 au lieu de déclencher l'estimation par catégorie.
    const rawGlycemicIndex = raw.glycemicIndex;
    const hasGlycemicIndex = rawGlycemicIndex !== null
        && rawGlycemicIndex !== undefined
        && rawGlycemicIndex !== ''
        && Number.isFinite(Number(rawGlycemicIndex));
    const glycemicIndex = hasGlycemicIndex
        ? Math.min(Math.max(Math.round(Number(rawGlycemicIndex)), 0), 100)
        : glycemicGuess(carbs, round(raw.sugars), round(raw.fibers), category);

    return {
        name: String(raw.name || '').trim(),
        category,
        calories: round(raw.calories, 0),
        proteins: round(raw.proteins),
        carbs,
        sugars: round(raw.sugars),
        fibers: round(raw.fibers),
        fats: round(raw.fats),
        glycemicIndex,
        price: hasValidPrice ? round(rawPrice, 2) : null,
        priceQuantity: hasValidPrice ? round(rawPriceQuantity, 0) : null,
        priceUnit: raw.priceUnit === 'portions' ? 'portions' : 'grams'
    };
}

export function saveSearchApiKey(key) {
    localStorage.setItem(BRAVE_SEARCH_API_KEY, key.trim());
}

export function getSearchApiKey() {
    return localStorage.getItem(BRAVE_SEARCH_API_KEY) || '';
}

export function clearSearchApiKey() {
    localStorage.removeItem(BRAVE_SEARCH_API_KEY);
}

export function hasSearchApiKey() {
    return !!getSearchApiKey();
}

export function getFoodSearchPreference() {
    try {
        const settings = JSON.parse(localStorage.getItem(FOOD_SEARCH_PREFERENCE_KEY) || '{}');
        const legacyRetailer = `${settings.retailer || 'Intermarché'} ${settings.location || 'Senonches France'}`.trim();
        const retailers = Array.isArray(settings.retailers)
            ? settings.retailers.map(retailer => String(retailer || '').trim()).filter(Boolean)
            : [legacyRetailer].filter(Boolean);
        return {
            enabled: Boolean(settings.enabled),
            retailers: retailers.length ? retailers : ['Intermarché Senonches France']
        };
    } catch (error) {
        return { enabled: false, retailers: ['Intermarché Senonches France'] };
    }
}

export function saveFoodSearchPreference(settings = {}) {
    const retailers = Array.isArray(settings.retailers)
        ? settings.retailers.map(retailer => String(retailer || '').trim()).filter(Boolean)
        : String(settings.retailers || '').split('\n').map(retailer => retailer.trim()).filter(Boolean);

    localStorage.setItem(FOOD_SEARCH_PREFERENCE_KEY, JSON.stringify({
        enabled: Boolean(settings.enabled),
        retailers
    }));
}

function buildNutritionQuery(query, retailer = '') {
    const priority = String(retailer || '').trim();
    return `${query} ${priority} nutrition valeurs nutritionnelles indice glycémique calories protéines glucides sucres fibres lipides pour 100g`.trim();
}

function uniqueResults(results) {
    const seen = new Set();
    return results.filter(result => {
        const key = result.url || result.title;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function requestBraveSearch(searchKey, searchParams) {
    let response;
    for (const url of BRAVE_SEARCH_PROXY_URLS) {
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey: searchKey,
                    params: searchParams
                })
            });

            if (![404, 405, 501].includes(response.status)) break;
        } catch (error) {
            response = null;
        }
    }

    if (!response) {
        throw new Error('Proxy Brave Search non démarré. Lance tools/start-nutrition-app.bat puis réessaie.');
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        if (response.status === 0 || !body) {
            throw new Error('Proxy Brave Search indisponible. Lance tools/start-nutrition-app.bat puis réessaie.');
        }
        throw new Error(`Recherche Brave impossible (${response.status}) ${body ? `: ${body.slice(0, 160)}` : ''}`);
    }

    const data = await response.json();
    return (data.web?.results || []).map(result => ({
        title: result.title || '',
        url: result.url || '',
        description: result.description || '',
        age: result.age || ''
    }));
}

export async function searchInternet(query) {
    const searchKey = getSearchApiKey();
    if (!searchKey) throw new Error('Clé Brave Search API non configurée dans Paramètres.');

    const preference = getFoodSearchPreference();
    const baseParams = {
        count: 8,
        country: 'fr',
        search_lang: 'fr',
        safesearch: 'moderate'
    };

    if (preference.enabled && preference.retailers.length) {
        let priorityResults = [];
        for (const retailer of preference.retailers) {
            // Une erreur sur une enseigne ne doit pas annuler toute la recherche :
            // le repli générique restait sinon inatteignable.
            try {
                const retailerResults = await requestBraveSearch(searchKey, {
                    ...baseParams,
                    q: buildNutritionQuery(query, retailer)
                });
                priorityResults = uniqueResults([...priorityResults, ...retailerResults]).slice(0, 8);
            } catch (error) {
                console.warn(`[Brave] enseigne ignorée (${retailer}) : ${error.message}`);
            }
            if (priorityResults.length >= 3) break;
        }

        if (priorityResults.length >= 3) {
            return priorityResults;
        }

        const fallbackResults = await requestBraveSearch(searchKey, {
            ...baseParams,
            q: buildNutritionQuery(query)
        });
        return uniqueResults([...priorityResults, ...fallbackResults]).slice(0, 8);
    }

    // Chemin direct : on applique la même déduplication et la même limite que
    // le chemin « enseignes » (sinon doublons et résultats non plafonnés).
    const directResults = await requestBraveSearch(searchKey, {
        ...baseParams,
        q: buildNutritionQuery(query)
    });
    return uniqueResults(directResults).slice(0, 8);
}

function parseFoodJson(content) {
    const clean = String(content || '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/```(?:json)?/gi, '')
        .trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('Réponse IA invalide : aucun JSON trouvé.');
    try {
        return normalizeFoodData(JSON.parse(clean.slice(start, end + 1)));
    } catch (error) {
        throw new Error(`Réponse IA invalide (JSON illisible) : ${error.message}`);
    }
}

async function callDeepSeekForFood({ prompt }) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Clé API DeepSeek non configurée.');

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: getModel(),
            messages: [
                {
                    role: 'system',
                    content: `Tu extrais des valeurs nutritionnelles pour aliment. Réponds uniquement en JSON strict avec ces champs: name, category, calories, proteins, carbs, sugars, fibers, fats, glycemicIndex, price, priceQuantity, priceUnit. Les valeurs nutritionnelles doivent être pour 100g. category doit être une des valeurs: ${CATEGORIES.join(', ')}. price/priceQuantity/priceUnit sont optionnels si un prix fiable est visible. N'invente pas une valeur nutritionnelle si une source fournit déjà la donnée; si l'IG est absent, estime-le prudemment à partir du type d'aliment et des glucides/fibres.`
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 1200
        })
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        let message = `Erreur ${response.status}`;
        try { message = JSON.parse(body)?.error?.message || message; } catch (_) {}
        throw new Error(message);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Réponse IA vide.');
    return parseFoodJson(content);
}

async function extractTextFromImage(imageDataUrl) {
    if (!imageDataUrl) return '';
    if (!window.Tesseract?.recognize) {
        throw new Error('OCR indisponible. Vérifie ta connexion internet puis recharge la page.');
    }

    const result = await window.Tesseract.recognize(imageDataUrl, 'fra+eng', TESSERACT_OPTIONS);
    return String(result?.data?.text || '').trim();
}

export async function analyzeTextOrImage({ query, imageDataUrl }) {
    // L'OCR ne doit pas bloquer l'analyse : l'utilisateur peut fournir un texte
    // ET une image, et Tesseract peut être indisponible (CDN bloqué, hors ligne).
    let imageText = '';
    try {
        imageText = await extractTextFromImage(imageDataUrl);
    } catch (error) {
        if (!query) throw error;
        console.warn(`OCR ignoré : ${error.message}`);
    }
    const combinedText = [
        query ? `Texte utilisateur:\n${query}` : '',
        imageText ? `Texte extrait de l'image par OCR:\n${imageText}` : ''
    ].filter(Boolean).join('\n\n');

    if (!combinedText) {
        throw new Error('Aucun texte détecté dans la capture. Essaie une image plus nette ou saisis le texte manuellement.');
    }

    const prompt = `Analyse l'aliment ci-dessous et remplis les valeurs pour 100g.

${combinedText}

Si le texte OCR contient des erreurs, corrige-les prudemment à partir du contexte nutritionnel.`;

    return callDeepSeekForFood({ prompt });
}

export async function extractFoodFromInternetSearch(query) {
    const results = await searchInternet(query);
    if (results.length === 0) throw new Error('Aucun résultat web trouvé.');
    const preference = getFoodSearchPreference();
    const priorityNote = preference.enabled && preference.retailers.length
        ? `Priorité utilisateur: cherche d'abord les données de ces enseignes, dans cet ordre: ${preference.retailers.join(' > ')}. Si les résultats ne permettent pas de remplir tous les champs, utilise les autres sources fiables.`
        : 'Aucune enseigne prioritaire configurée.';

    const prompt = `Recherche internet utilisateur: "${query}"

${priorityNote}

Résultats web Brave Search à exploiter:
${JSON.stringify(results, null, 2)}

Retourne toutes les propriétés des champs de saisie de l'application:
- name
- category
- calories
- proteins
- carbs
- sugars
- fibers
- fats
- glycemicIndex
- price
- priceQuantity
- priceUnit

Contraintes:
- Valeurs nutritionnelles pour 100g.
- category parmi: ${CATEGORIES.join(', ')}.
- glycemicIndex obligatoire: utilise une valeur trouvée si disponible, sinon estime prudemment.
- Si le prix n'est pas trouvé, mets price, priceQuantity à null et priceUnit à "grams".
- Réponds uniquement avec le JSON final.`;

    const foodData = await callDeepSeekForFood({ prompt });
    return { foodData, results };
}
