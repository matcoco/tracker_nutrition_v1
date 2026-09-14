// tests/unit/features-ai.test.js
// Tests de js/features/ai-food-assistant.js et js/features/ai-meal-generator.js.
// Aucun appel réseau réel : globalThis.fetch est toujours remplacé par un vi.fn().

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as db from '../../js/core/db.js';
import { loadAppDom } from '../helpers/dom.js';
import { foodsFixture, composedMeal, simpleFood, dayFixture, localDate } from '../helpers/fixtures.js';

let ai; // ai-food-assistant
let gen; // ai-meal-generator

const BRAVE_KEY = 'brave_search_api_key';
const PREF_KEY = 'food_search_preference';
const DEEPSEEK_KEY = 'deepseek_api_key';

/** Réponse fetch factice compatible avec response.ok/status/json()/text(). */
function jsonResponse(body, { ok = true, status = 200 } = {}) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        ok,
        status,
        json: vi.fn(async () => body),
        text: vi.fn(async () => text),
    };
}

/** Réponse fetch dont response.json() échoue (JSON invalide). */
function invalidJsonResponse({ ok = true, status = 200 } = {}) {
    return {
        ok,
        status,
        json: vi.fn(async () => { throw new SyntaxError('JSON invalide'); }),
        text: vi.fn(async () => ''),
    };
}

beforeAll(async () => {
    loadAppDom();
    await db.initDB();
    ai = await import('../../js/features/ai-food-assistant.js');
    gen = await import('../../js/features/ai-meal-generator.js');
});

beforeEach(async () => {
    await db.clearStore('dailyMeals');
    delete window.Tesseract;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-food-assistant.js — normalizeFoodData
// ═════════════════════════════════════════════════════════════════════════════

describe('aiFoodAssistant.normalizeFoodData', () => {
    it('normalise et arrondit toutes les valeurs', () => {
        const food = ai.normalizeFoodData({
            name: '  Poulet rôti  ',
            category: 'proteins',
            calories: '165.4',
            proteins: '31.26',
            carbs: 0,
            sugars: 1.54,
            fibers: 2.26,
            fats: 3.66,
            glycemicIndex: '55.6',
            price: '3.456',
            priceQuantity: '1000',
            priceUnit: 'portions',
        });

        expect(food).toEqual({
            name: 'Poulet rôti',
            category: 'proteins',
            calories: 165,
            proteins: 31.3,
            carbs: 0,
            sugars: 1.5,
            fibers: 2.3,
            fats: 3.7,
            glycemicIndex: 56,
            price: 3.46,
            priceQuantity: 1000,
            priceUnit: 'portions',
        });
    });

    it('fournit des valeurs par défaut pour un objet vide', () => {
        expect(ai.normalizeFoodData()).toEqual({
            name: '',
            category: 'other',
            calories: 0,
            proteins: 0,
            carbs: 0,
            sugars: 0,
            fibers: 0,
            fats: 0,
            glycemicIndex: 0,
            price: null,
            priceQuantity: null,
            priceUnit: 'grams',
        });
    });

    it('remplace une catégorie inconnue par "other"', () => {
        expect(ai.normalizeFoodData({ category: 'nourriture' }).category).toBe('other');
        expect(ai.normalizeFoodData({ category: 'fruits' }).category).toBe('fruits');
        expect(ai.normalizeFoodData({ category: 'other' }).category).toBe('other');
    });

    it('traite les valeurs non numériques comme 0', () => {
        const food = ai.normalizeFoodData({
            calories: 'abc', proteins: null, carbs: {}, sugars: undefined, fibers: '', fats: '12.34',
        });
        expect(food.calories).toBe(0);
        expect(food.proteins).toBe(0);
        expect(food.carbs).toBe(0);
        expect(food.sugars).toBe(0);
        expect(food.fibers).toBe(0);
        expect(food.fats).toBe(12.3);
    });

    it('borne l’indice glycémique entre 0 et 100', () => {
        expect(ai.normalizeFoodData({ glycemicIndex: 150 }).glycemicIndex).toBe(100);
        expect(ai.normalizeFoodData({ glycemicIndex: -10 }).glycemicIndex).toBe(0);
        expect(ai.normalizeFoodData({ glycemicIndex: 55.4 }).glycemicIndex).toBe(55);
        expect(ai.normalizeFoodData({ glycemicIndex: 55.6 }).glycemicIndex).toBe(56);
    });

    it('estime l’indice glycémique à partir de la catégorie si absent', () => {
        expect(ai.normalizeFoodData({ carbs: 10, category: 'vegetables' }).glycemicIndex).toBe(20);
        expect(ai.normalizeFoodData({ carbs: 10, category: 'fruits' }).glycemicIndex).toBe(40);
        expect(ai.normalizeFoodData({ carbs: 10, category: 'dairy' }).glycemicIndex).toBe(30);
        expect(ai.normalizeFoodData({ carbs: 10, category: 'starches' }).glycemicIndex).toBe(60);
    });

    it('estime un IG élevé pour un aliment très sucré et pauvre en fibres', () => {
        expect(ai.normalizeFoodData({ carbs: 30, sugars: 30, fibers: 1 }).glycemicIndex).toBe(65);
        expect(ai.normalizeFoodData({ carbs: 30, sugars: 30, fibers: 5 }).glycemicIndex).toBe(50);
    });

    it('renvoie un IG nul pour les protéines, les lipides et les aliments sans glucides', () => {
        expect(ai.normalizeFoodData({ carbs: 10, category: 'proteins' }).glycemicIndex).toBe(0);
        expect(ai.normalizeFoodData({ carbs: 10, category: 'fats' }).glycemicIndex).toBe(0);
        expect(ai.normalizeFoodData({ carbs: 0.5, category: 'fruits' }).glycemicIndex).toBe(0);
    });

    it('retombe sur l’estimation si l’IG fourni est non numérique', () => {
        expect(ai.normalizeFoodData({ glycemicIndex: 'abc', carbs: 10, category: 'fruits' }).glycemicIndex).toBe(40);
    });

    it('interprète un IG null comme 0 (comportement observé)', () => {
        // Number(null) === 0, donc la valeur est considérée comme fournie.
        expect(ai.normalizeFoodData({ glycemicIndex: null }).glycemicIndex).toBe(0);
    });

    it('n’accepte un prix que si le prix et la quantité sont valides', () => {
        const valid = ai.normalizeFoodData({ price: 5, priceQuantity: 500 });
        expect(valid.price).toBe(5);
        expect(valid.priceQuantity).toBe(500);
        expect(valid.priceUnit).toBe('grams');

        expect(ai.normalizeFoodData({ price: 0, priceQuantity: 500 }).price).toBeNull();
        expect(ai.normalizeFoodData({ price: 5, priceQuantity: 0 }).price).toBeNull();
        expect(ai.normalizeFoodData({ price: -1, priceQuantity: 500 }).price).toBeNull();
        expect(ai.normalizeFoodData({ price: 'abc', priceQuantity: 500 }).price).toBeNull();
        expect(ai.normalizeFoodData({ price: 5 }).priceQuantity).toBeNull();
        expect(ai.normalizeFoodData({ price: 5 }).price).toBeNull();
    });

    it('ne conserve l’unité "portions" que si elle est exacte', () => {
        expect(ai.normalizeFoodData({ price: 5, priceQuantity: 10, priceUnit: 'portions' }).priceUnit).toBe('portions');
        expect(ai.normalizeFoodData({ price: 5, priceQuantity: 10, priceUnit: 'Portions' }).priceUnit).toBe('grams');
        expect(ai.normalizeFoodData({ price: 5, priceQuantity: 10, priceUnit: 'litres' }).priceUnit).toBe('grams');
    });

    it('retire les espaces autour du nom', () => {
        expect(ai.normalizeFoodData({ name: '   Riz   ' }).name).toBe('Riz');
        expect(ai.normalizeFoodData({ name: null }).name).toBe('');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-food-assistant.js — clés et préférences (localStorage)
// ═════════════════════════════════════════════════════════════════════════════

describe('aiFoodAssistant — clé Brave Search', () => {
    it('enregistre la clé en supprimant les espaces', () => {
        ai.saveSearchApiKey('  MA_CLE  ');
        expect(localStorage.getItem(BRAVE_KEY)).toBe('MA_CLE');
        expect(ai.getSearchApiKey()).toBe('MA_CLE');
        expect(ai.hasSearchApiKey()).toBe(true);
    });

    it('retourne une chaîne vide et false quand aucune clé n’existe', () => {
        expect(ai.getSearchApiKey()).toBe('');
        expect(ai.hasSearchApiKey()).toBe(false);
    });

    it('efface la clé', () => {
        ai.saveSearchApiKey('MA_CLE');
        ai.clearSearchApiKey();
        expect(localStorage.getItem(BRAVE_KEY)).toBeNull();
        expect(ai.getSearchApiKey()).toBe('');
        expect(ai.hasSearchApiKey()).toBe(false);
    });
});

describe('aiFoodAssistant — préférences de recherche', () => {
    it('retourne la valeur par défaut quand rien n’est configuré', () => {
        expect(ai.getFoodSearchPreference()).toEqual({
            enabled: false,
            retailers: ['Intermarché Senonches France'],
        });
    });

    it('sauvegarde une liste d’enseignes nettoyée', () => {
        ai.saveFoodSearchPreference({ enabled: 1, retailers: ['  Carrefour  ', '', null, ' Leclerc '] });
        expect(JSON.parse(localStorage.getItem(PREF_KEY))).toEqual({
            enabled: true,
            retailers: ['Carrefour', 'Leclerc'],
        });
        expect(ai.getFoodSearchPreference()).toEqual({
            enabled: true,
            retailers: ['Carrefour', 'Leclerc'],
        });
    });

    it('accepte une chaîne multi-lignes comme liste d’enseignes', () => {
        ai.saveFoodSearchPreference({ enabled: false, retailers: 'A\n B \n\nC' });
        expect(ai.getFoodSearchPreference().retailers).toEqual(['A', 'B', 'C']);
    });

    it('convertit l’ancien format retailer/location', () => {
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: true, retailer: 'Carrefour', location: 'Paris' }));
        expect(ai.getFoodSearchPreference()).toEqual({
            enabled: true,
            retailers: ['Carrefour Paris'],
        });
    });

    it('retombe sur le libellé par défaut si la liste est vide', () => {
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: true, retailers: [] }));
        expect(ai.getFoodSearchPreference().retailers).toEqual(['Intermarché Senonches France']);
    });

    it('retombe sur la valeur par défaut si le JSON est corrompu', () => {
        localStorage.setItem(PREF_KEY, '{pas du json');
        expect(ai.getFoodSearchPreference()).toEqual({
            enabled: false,
            retailers: ['Intermarché Senonches France'],
        });
    });

    it('cohérence saveFoodSearchPreference / getFoodSearchPreference', () => {
        ai.saveFoodSearchPreference({ enabled: true, retailers: ['X'] });
        const pref = ai.getFoodSearchPreference();
        expect(pref.enabled).toBe(true);
        expect(pref.retailers).toEqual(['X']);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-food-assistant.js — searchInternet
// ═════════════════════════════════════════════════════════════════════════════

describe('aiFoodAssistant.searchInternet', () => {
    it('exige une clé Brave Search et n’appelle pas le réseau sans elle', async () => {
        await expect(ai.searchInternet('poulet')).rejects.toThrow(
            'Clé Brave Search API non configurée dans Paramètres.'
        );
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('interroge le proxy local et mappe les résultats', async () => {
        ai.saveSearchApiKey('BRAVE');
        globalThis.fetch = vi.fn(async () => jsonResponse({
            web: { results: [{ title: 'T', url: 'https://u', description: 'D', age: '2' }] },
        }));

        const results = await ai.searchInternet('poulet');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch.mock.calls[0][0]).toBe(`${window.location.origin}/brave-search`);
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.apiKey).toBe('BRAVE');
        expect(body.params.count).toBe(8);
        expect(body.params.country).toBe('fr');
        expect(body.params.q).toContain('poulet');
        expect(body.params.q).toContain('pour 100g');
        expect(results).toEqual([{ title: 'T', url: 'https://u', description: 'D', age: '2' }]);
    });

    it('normalise les champs manquants des résultats', async () => {
        ai.saveSearchApiKey('BRAVE');
        globalThis.fetch = vi.fn(async () => jsonResponse({ web: { results: [{ url: 'https://u' }] } }));
        expect(await ai.searchInternet('x')).toEqual([{ title: '', url: 'https://u', description: '', age: '' }]);
    });

    it('déduplique les résultats sur le chemin direct', async () => {
        // Corrigé : le retour direct applique désormais uniqueResults() comme
        // le chemin « enseignes ».
        ai.saveSearchApiKey('BRAVE');
        globalThis.fetch = vi.fn(async () => jsonResponse({
            web: {
                results: [
                    { title: 'A', url: 'u1' },
                    { title: 'B', url: 'u1' },
                    { title: 'C', url: 'u2' },
                ],
            },
        }));
        const results = await ai.searchInternet('x');
        expect(results.map((r) => r.url)).toEqual(['u1', 'u2']);
    });

    it('déduplique les résultats quand des enseignes sont configurées', async () => {
        ai.saveSearchApiKey('BRAVE');
        ai.saveFoodSearchPreference({ enabled: true, retailers: ['Carrefour'] });
        globalThis.fetch = vi.fn(async () => jsonResponse({
            web: {
                results: [
                    { title: 'A', url: 'u1' },
                    { title: 'B', url: 'u1' },
                    { title: 'C', url: 'u2' },
                    { title: 'D', url: 'u3' },
                ],
            },
        }));

        const results = await ai.searchInternet('x');

        expect(results.map((r) => r.url)).toEqual(['u1', 'u2', 'u3']);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('rejette quand res.ok vaut false (avec corps de réponse)', async () => {
        ai.saveSearchApiKey('BRAVE');
        globalThis.fetch = vi.fn(async () => jsonResponse('serveur en panne', { ok: false, status: 500 }));
        await expect(ai.searchInternet('x')).rejects.toThrow(/Recherche Brave impossible \(500\)/);
        await expect(ai.searchInternet('x')).rejects.toThrow(/serveur en panne/);
    });

    it('rejette quand la réponse n’est pas du JSON valide', async () => {
        ai.saveSearchApiKey('BRAVE');
        globalThis.fetch = vi.fn(async () => invalidJsonResponse());
        await expect(ai.searchInternet('x')).rejects.toThrow(SyntaxError);
    });

    it('essaie le second proxy quand le premier échoue', async () => {
        ai.saveSearchApiKey('BRAVE');
        let call = 0;
        globalThis.fetch = vi.fn(async () => {
            call += 1;
            if (call === 1) throw new Error('connexion refusée');
            return jsonResponse({ web: { results: [{ title: 'ok', url: 'u' }] } });
        });

        const results = await ai.searchInternet('x');

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        expect(globalThis.fetch.mock.calls[1][0]).toBe('http://127.0.0.1:8787/brave-search');
        expect(results).toHaveLength(1);
    });

    it('rejette avec un message clair si aucun proxy ne répond', async () => {
        ai.saveSearchApiKey('BRAVE');
        globalThis.fetch = vi.fn(async () => { throw new Error('boom'); });
        await expect(ai.searchInternet('x')).rejects.toThrow(/Proxy Brave Search non démarré/);
    });

    it('privilégie les enseignes configurées', async () => {
        ai.saveSearchApiKey('BRAVE');
        ai.saveFoodSearchPreference({ enabled: true, retailers: ['Carrefour'] });
        globalThis.fetch = vi.fn(async () => jsonResponse({
            web: { results: [{ title: 'a', url: '1' }, { title: 'b', url: '2' }, { title: 'c', url: '3' }] },
        }));

        const results = await ai.searchInternet('poulet');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
        expect(body.params.q).toContain('Carrefour');
        expect(results).toHaveLength(3);
    });

    it('complète avec une recherche générique si les enseignes donnent trop peu de résultats', async () => {
        ai.saveSearchApiKey('BRAVE');
        ai.saveFoodSearchPreference({ enabled: true, retailers: ['Carrefour'] });
        let call = 0;
        globalThis.fetch = vi.fn(async () => {
            call += 1;
            return jsonResponse({
                web: {
                    results: call === 1
                        ? [{ title: 'a', url: '1' }]
                        : [{ title: 'b', url: '2' }, { title: 'c', url: '3' }],
                },
            });
        });

        const results = await ai.searchInternet('poulet');

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        const fallbackBody = JSON.parse(globalThis.fetch.mock.calls[1][1].body);
        expect(fallbackBody.params.q).not.toContain('Carrefour');
        expect(results.map((r) => r.url)).toEqual(['1', '2', '3']);
    });

    it('limite à 8 résultats sur le chemin direct', async () => {
        // Corrigé : le chemin direct applique désormais slice(0, 8).
        ai.saveSearchApiKey('BRAVE');
        const many = Array.from({ length: 15 }, (_, i) => ({ title: `t${i}`, url: `u${i}` }));
        globalThis.fetch = vi.fn(async () => jsonResponse({ web: { results: many } }));
        expect(await ai.searchInternet('x')).toHaveLength(8);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-food-assistant.js — analyzeTextOrImage
// ═════════════════════════════════════════════════════════════════════════════

describe('aiFoodAssistant.analyzeTextOrImage', () => {
    it('rejette si aucun texte n’est fourni', async () => {
        await expect(ai.analyzeTextOrImage({})).rejects.toThrow(/Aucun texte détecté/);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('rejette si l’OCR est indisponible', async () => {
        await expect(ai.analyzeTextOrImage({ imageDataUrl: 'data:image/png;base64,AAA' }))
            .rejects.toThrow(/OCR indisponible/);
    });

    it('exige une clé API DeepSeek', async () => {
        await expect(ai.analyzeTextOrImage({ query: 'poulet' }))
            .rejects.toThrow('Clé API DeepSeek non configurée.');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('envoie la requête à DeepSeek et normalise la réponse', async () => {
        gen.saveApiKey('DEEP');
        let captured;
        globalThis.fetch = vi.fn(async (url, options) => {
            captured = { url, options: { ...options, body: JSON.parse(options.body) } };
            return jsonResponse({
                choices: [{
                    message: {
                        content: '```json\n{"name":"Poulet","category":"proteins","calories":165,"proteins":31,"carbs":0,"sugars":0,"fibers":0,"fats":3.6,"glycemicIndex":0}\n```',
                    },
                }],
            });
        });

        const food = await ai.analyzeTextOrImage({ query: 'valeurs du poulet' });

        expect(food.name).toBe('Poulet');
        expect(food.calories).toBe(165);
        expect(food.category).toBe('proteins');
        expect(captured.url).toBe('https://api.deepseek.com/chat/completions');
        expect(captured.options.method).toBe('POST');
        expect(captured.options.headers.Authorization).toBe('Bearer DEEP');
        expect(captured.options.body.model).toBe('deepseek-v4-flash');
        expect(captured.options.body.messages[1].content).toContain('valeurs du poulet');
    });

    it('combine le texte saisi et le texte extrait par OCR', async () => {
        gen.saveApiKey('DEEP');
        window.Tesseract = { recognize: vi.fn(async () => ({ data: { text: '  Nutella  ' } })) };
        let captured;
        globalThis.fetch = vi.fn(async (url, options) => {
            captured = JSON.parse(options.body);
            return jsonResponse({ choices: [{ message: { content: '{"name":"Nutella"}' } }] });
        });

        const food = await ai.analyzeTextOrImage({ query: 'ma requête', imageDataUrl: 'data:image/png;base64,AAA' });

        expect(window.Tesseract.recognize).toHaveBeenCalledWith('data:image/png;base64,AAA', 'fra+eng', expect.any(Object));
        expect(captured.messages[1].content).toContain('ma requête');
        expect(captured.messages[1].content).toContain('Nutella');
        expect(food.name).toBe('Nutella');
    });

    it('remonte le message d’erreur JSON de l’API', async () => {
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async () => jsonResponse(
            { error: { message: 'Invalid API key' } },
            { ok: false, status: 401 }
        ));
        await expect(ai.analyzeTextOrImage({ query: 'x' })).rejects.toThrow('Invalid API key');
    });

    it('rejette une réponse sans contenu', async () => {
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async () => jsonResponse({ choices: [] }));
        await expect(ai.analyzeTextOrImage({ query: 'x' })).rejects.toThrow('Réponse IA vide.');
    });

    it('rejette une réponse sans JSON', async () => {
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'bonjour' } }] }));
        await expect(ai.analyzeTextOrImage({ query: 'x' })).rejects.toThrow(/aucun JSON trouvé/);
    });

    it('rejette un JSON malformé avec un message explicite', async () => {
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async () => jsonResponse({ choices: [{ message: { content: '{oops}' } }] }));
        await expect(ai.analyzeTextOrImage({ query: 'x' })).rejects.toThrow(/JSON illisible/);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-food-assistant.js — extractFoodFromInternetSearch
// ═════════════════════════════════════════════════════════════════════════════

describe('aiFoodAssistant.extractFoodFromInternetSearch', () => {
    it('exige la clé Brave Search', async () => {
        await expect(ai.extractFoodFromInternetSearch('poulet')).rejects.toThrow(/Clé Brave Search API/);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('rejette quand la recherche ne renvoie aucun résultat', async () => {
        ai.saveSearchApiKey('BRAVE');
        globalThis.fetch = vi.fn(async () => jsonResponse({ web: { results: [] } }));
        await expect(ai.extractFoodFromInternetSearch('poulet')).rejects.toThrow('Aucun résultat web trouvé.');
    });

    it('renvoie les données normalisées et les résultats web', async () => {
        ai.saveSearchApiKey('BRAVE');
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async (url) => {
            if (String(url).includes('brave-search')) {
                return jsonResponse({ web: { results: [{ title: 'T', url: 'https://x', description: 'D', age: '1' }] } });
            }
            return jsonResponse({
                choices: [{ message: { content: '{"name":"Poulet","calories":165,"proteins":31}' } }],
            });
        });

        const { foodData, results } = await ai.extractFoodFromInternetSearch('poulet');

        expect(foodData.name).toBe('Poulet');
        expect(foodData.calories).toBe(165);
        expect(results).toEqual([{ title: 'T', url: 'https://x', description: 'D', age: '1' }]);
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('transmet la priorité enseignes dans le prompt IA', async () => {
        ai.saveSearchApiKey('BRAVE');
        gen.saveApiKey('DEEP');
        ai.saveFoodSearchPreference({ enabled: true, retailers: ['Carrefour', 'Leclerc'] });
        globalThis.fetch = vi.fn(async (url) => {
            if (String(url).includes('brave-search')) {
                return jsonResponse({
                    web: { results: [{ title: 'a', url: '1' }, { title: 'b', url: '2' }, { title: 'c', url: '3' }] },
                });
            }
            return jsonResponse({ choices: [{ message: { content: '{"name":"X"}' } }] });
        });

        await ai.extractFoodFromInternetSearch('poulet');

        const deepseekCall = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('api.deepseek.com'));
        const prompt = JSON.parse(deepseekCall[1].body).messages[1].content;
        expect(prompt).toContain('Priorité utilisateur');
        expect(prompt).toContain('Carrefour > Leclerc');
    });

    it('indique l’absence d’enseigne prioritaire dans le prompt IA', async () => {
        ai.saveSearchApiKey('BRAVE');
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async (url) => {
            if (String(url).includes('brave-search')) {
                return jsonResponse({ web: { results: [{ title: 'a', url: '1' }] } });
            }
            return jsonResponse({ choices: [{ message: { content: '{"name":"X"}' } }] });
        });

        await ai.extractFoodFromInternetSearch('poulet');

        const deepseekCall = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('api.deepseek.com'));
        const prompt = JSON.parse(deepseekCall[1].body).messages[1].content;
        expect(prompt).toContain('Aucune enseigne prioritaire configurée.');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-meal-generator.js — modèle et clés
// ═════════════════════════════════════════════════════════════════════════════

describe('aiMealGenerator — modèle et clés API', () => {
    it('retourne le modèle par défaut', () => {
        expect(gen.getModel()).toBe('deepseek-v4-flash');
    });

    it('sauvegarde et relit le modèle', () => {
        gen.saveModel('deepseek-chat');
        expect(localStorage.getItem('deepseek_model')).toBe('deepseek-chat');
        expect(gen.getModel()).toBe('deepseek-chat');
    });

    it('retourne une chaîne vide et false sans clé API', () => {
        expect(gen.getApiKey()).toBe('');
        expect(gen.hasApiKey()).toBe(false);
    });

    it('sauvegarde la clé API en supprimant les espaces', () => {
        gen.saveApiKey('  MA_CLE  ');
        expect(localStorage.getItem(DEEPSEEK_KEY)).toBe('MA_CLE');
        expect(gen.getApiKey()).toBe('MA_CLE');
        expect(gen.hasApiKey()).toBe(true);
    });

    it('supprime l’ancienne clé groq lors d’une sauvegarde', () => {
        localStorage.setItem('groq_api_key', 'GROQ');
        gen.saveApiKey('DEEP');
        expect(localStorage.getItem('groq_api_key')).toBeNull();
        expect(gen.getApiKey()).toBe('DEEP');
    });

    it('retombe sur l’ancienne clé groq si la clé DeepSeek est absente', () => {
        localStorage.setItem('groq_api_key', 'GROQ');
        expect(gen.getApiKey()).toBe('GROQ');
        expect(gen.hasApiKey()).toBe(true);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-meal-generator.js — callGLM
// ═════════════════════════════════════════════════════════════════════════════

describe('aiMealGenerator.callGLM', () => {
    it('exige une clé API et n’appelle pas le réseau sans elle', async () => {
        await expect(gen.callGLM('prompt')).rejects.toThrow('Clé API DeepSeek non configurée. Configurez-la dans les Paramètres.');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('envoie le prompt et retourne le contenu de la réponse', async () => {
        gen.saveApiKey('DEEP');
        let captured;
        globalThis.fetch = vi.fn(async (url, options) => {
            captured = { url, options };
            return jsonResponse({ choices: [{ message: { content: 'contenu généré' } }] });
        });

        const content = await gen.callGLM('mon prompt');

        expect(content).toBe('contenu généré');
        expect(captured.url).toBe('https://api.deepseek.com/chat/completions');
        expect(captured.options.headers.Authorization).toBe('Bearer DEEP');
        const body = JSON.parse(captured.options.body);
        expect(body.model).toBe('deepseek-v4-flash');
        expect(body.messages).toHaveLength(2);
        expect(body.messages[0].role).toBe('system');
        expect(body.messages[1]).toEqual({ role: 'user', content: 'mon prompt' });
    });

    it('utilise le modèle enregistré', async () => {
        gen.saveApiKey('DEEP');
        gen.saveModel('deepseek-reasoner');
        let captured;
        globalThis.fetch = vi.fn(async (url, options) => {
            captured = JSON.parse(options.body);
            return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
        });
        await gen.callGLM('p');
        expect(captured.model).toBe('deepseek-reasoner');
    });

    it('rejette en remontant le message d’erreur JSON de l’API', async () => {
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async () => jsonResponse(
            { error: { message: 'Invalid API key' } },
            { ok: false, status: 401 }
        ));
        await expect(gen.callGLM('p')).rejects.toThrow('Erreur API DeepSeek (401) : Invalid API key');
    });

    it('rejette avec un message générique pour un corps d’erreur non JSON', async () => {
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async () => jsonResponse('oups', { ok: false, status: 500 }));
        await expect(gen.callGLM('p')).rejects.toThrow('Erreur API DeepSeek (500) : Erreur 500');
    });

    it('rejette quand la réponse ne contient pas de contenu', async () => {
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async () => jsonResponse({ choices: [] }));
        await expect(gen.callGLM('p')).rejects.toThrow("Réponse vide de l'API DeepSeek.");
    });

    it('rejette quand le JSON de la réponse est invalide', async () => {
        gen.saveApiKey('DEEP');
        globalThis.fetch = vi.fn(async () => invalidJsonResponse());
        await expect(gen.callGLM('p')).rejects.toThrow(SyntaxError);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-meal-generator.js — buildPrompt
// ═════════════════════════════════════════════════════════════════════════════

describe('aiMealGenerator.buildPrompt', () => {
    const goals = { calories: 2200, proteins: 160, carbs: 220, fats: 75 };

    it('inclut la date, les objectifs et la répartition calorique', () => {
        const prompt = gen.buildPrompt({
            goals,
            foods: { poulet: simpleFood() },
            meals: { 'poulet-riz': composedMeal() },
            mealTypes: ['petit-dej', 'dejeuner'],
            sourceType: 'foods',
            date: localDate(2026, 3, 10),
        });

        expect(prompt).toContain('mardi 10 mars 2026');
        expect(prompt).toContain('Calories : 2200 kcal');
        expect(prompt).toContain('Protéines : 160 g');
        expect(prompt).toContain('Glucides : 220 g');
        expect(prompt).toContain('Lipides : 75 g');
        expect(prompt).toContain('Petit Déjeuner');
        expect(prompt).toContain('Déjeuner');
        // Les cibles sont renormalisées sur les seuls repas demandés, de façon à
        // ce que leur somme égale bien l'objectif journalier (2200 kcal).
        // petit-dej : 2200 × 0,25 / 0,60 = 917 ; dejeuner : 2200 × 0,35 / 0,60 = 1283.
        expect(prompt).toContain('917 kcal');
        expect(prompt).toContain('1283 kcal');
        expect(917 + 1283).toBe(2200);
    });

    it('liste les aliments avec leur identifiant entre crochets', () => {
        const prompt = gen.buildPrompt({
            goals,
            foods: { poulet: simpleFood() },
            meals: {},
            mealTypes: ['dejeuner'],
            sourceType: 'foods',
            date: localDate(2026, 3, 10),
        });

        expect(prompt).toContain('INGRÉDIENTS DISPONIBLES');
        expect(prompt).toContain('• Poulet (165 kcal/100g | P:31g G:0g L:3.6g) [id:poulet]');
        expect(prompt).not.toContain('REPAS COMPOSÉS DISPONIBLES');
    });

    it('liste les repas composés avec [meal_id:...]', () => {
        const prompt = gen.buildPrompt({
            goals,
            foods: {},
            meals: { 'poulet-riz': composedMeal() },
            mealTypes: ['diner'],
            sourceType: 'meals',
            date: localDate(2026, 3, 10),
        });

        expect(prompt).toContain('REPAS COMPOSÉS DISPONIBLES');
        expect(prompt).toContain('[meal_id:poulet-riz]');
        expect(prompt).not.toContain('INGRÉDIENTS DISPONIBLES');
    });

    it('exclut de la liste des ingrédients les entrées de catégorie "meals"', () => {
        const prompt = gen.buildPrompt({
            goals,
            foods: {
                poulet: simpleFood(),
                'poulet-riz': simpleFood({ name: 'Poulet riz', category: 'meals' }),
            },
            meals: {},
            mealTypes: ['dejeuner'],
            sourceType: 'both',
            date: localDate(2026, 3, 10),
        });

        expect(prompt).toContain('[id:poulet]');
        expect(prompt).not.toContain('[id:poulet-riz]');
    });

    it('utilise les objectifs par défaut si goals est absent', () => {
        const prompt = gen.buildPrompt({
            goals: null,
            foods: {},
            meals: {},
            mealTypes: ['dejeuner'],
            sourceType: 'foods',
            date: localDate(2026, 3, 10),
        });
        expect(prompt).toContain('Objectifs non définis');
        expect(prompt).toContain('2000 kcal');
    });

    it('signale l’absence de sources disponibles', () => {
        const prompt = gen.buildPrompt({
            goals,
            foods: {},
            meals: {},
            mealTypes: ['dejeuner', 'diner'],
            sourceType: 'both',
            date: localDate(2026, 3, 10),
        });
        expect(prompt).toContain('(aucun)');
    });

    it('affiche le type brut et une cible unique pour un type de repas inconnu', () => {
        // Corrigé : le libellé retombe sur le type brut au lieu d'afficher
        // « undefined », et la cible est désormais calculée (plus de division
        // par zéro quand la liste est vide).
        const prompt = gen.buildPrompt({
            goals,
            foods: {},
            meals: {},
            mealTypes: ['brunch'],
            sourceType: 'foods',
            date: localDate(2026, 3, 10),
        });
        expect(prompt).toContain('REPAS À GÉNÉRER : brunch');
        expect(prompt).toContain('brunch : ~2200 kcal');
        expect(prompt).not.toContain('undefined');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-meal-generator.js — parseAIResponse
// ═════════════════════════════════════════════════════════════════════════════

describe('aiMealGenerator.parseAIResponse', () => {
    it('parse un JSON entouré de texte', () => {
        const parsed = gen.parseAIResponse('Voici le plan :\n{"plan":{"dejeuner":[]},"resume":"ok"}\nFin.');
        expect(parsed.plan).toEqual({ dejeuner: [] });
        expect(parsed.resume).toBe('ok');
    });

    it('parse un JSON dans un bloc markdown', () => {
        const parsed = gen.parseAIResponse('```json\n{"plan":{"diner":[]}}\n```');
        expect(parsed.plan).toEqual({ diner: [] });
    });

    it('supprime les blocs <think> des modèles de raisonnement', () => {
        const parsed = gen.parseAIResponse('<think>réflexion interne {pas du json}</think>{"plan":{"snack":[]}}');
        expect(parsed.plan).toEqual({ snack: [] });
    });

    it('rejette une réponse sans JSON', () => {
        expect(() => gen.parseAIResponse('aucun objet ici')).toThrow('Format de réponse invalide : aucun JSON trouvé.');
    });

    it('rejette un JSON malformé', () => {
        expect(() => gen.parseAIResponse('{ plan: }')).toThrow("Impossible de parser la réponse JSON de l'IA.");
    });

    it('rejette un JSON sans clé "plan"', () => {
        expect(() => gen.parseAIResponse('{"resume":"seulement un résumé"}'))
            .toThrow('Structure de réponse invalide : "plan" doit être un objet.');
    });

    it('rejette un plan qui n’est pas un objet', () => {
        expect(() => gen.parseAIResponse('{"plan":[1,2,3]}'))
            .toThrow('Structure de réponse invalide : "plan" doit être un objet.');
        expect(() => gen.parseAIResponse('{"plan":"texte"}'))
            .toThrow('Structure de réponse invalide : "plan" doit être un objet.');
    });

    it('rejette un plan sans aucun type de repas connu', () => {
        expect(() => gen.parseAIResponse('{"plan":{"collation":[]}}'))
            .toThrow('Aucun type de repas reconnu dans le plan généré.');
    });

    it('retourne l’objet complet', () => {
        const parsed = gen.parseAIResponse('{"plan":{"petit-dej":[{"id":"poulet","type":"food","quantite":100}]},"resume":"r"}');
        expect(parsed.plan['petit-dej']).toHaveLength(1);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-meal-generator.js — injectMealsIntoDay
// ═════════════════════════════════════════════════════════════════════════════

describe('aiMealGenerator.injectMealsIntoDay', () => {
    const date = localDate(2026, 3, 10);

    it('injecte aliments et repas dans la journée et ignore les inconnus', async () => {
        const foods = foodsFixture();
        const meals = { 'poulet-riz': composedMeal() };
        const plan = {
            dejeuner: [{ id: 'poulet', type: 'food', quantite: 150 }],
            diner: [{ id: 'poulet-riz', type: 'meal', quantite: 200 }],
            snack: [{ id: 'inconnu', type: 'food' }],
            'petit-dej': 'pas un tableau',
        };

        const results = await gen.injectMealsIntoDay({ plan, date, foods, meals });

        expect(results).toEqual({ added: 2, skipped: 1, errors: [] });

        const day = await db.loadDayMeals(date);
        expect(day.dejeuner).toHaveLength(1);
        expect(day.dejeuner[0].id).toBe('poulet');
        expect(day.dejeuner[0].weight).toBe(150);
        expect(day.dejeuner[0].time).toBe('12:30');
        expect(typeof day.dejeuner[0].uniqueId).toBe('string');
        expect(day.diner[0].id).toBe('poulet-riz');
        expect(day.diner[0].isMeal).toBe(true);
        expect(day.diner[0].time).toBe('19:30');
        expect(day.snack).toEqual([]);
    });

    it('refuse une quantité absente, nulle, négative ou absurde', async () => {
        const foods = foodsFixture();
        const plan = {
            dejeuner: [
                { id: 'poulet', type: 'food' },
                { id: 'riz', type: 'food', quantite: 'abc' },
                { id: 'pomme', type: 'food', quantite: -50 },
                { id: 'pates', type: 'food', quantite: 5000 },
            ],
        };

        const results = await gen.injectMealsIntoDay({ plan, date, foods, meals: {} });

        // Corrigé : une quantité non finie ou hors bornes est ignorée au lieu
        // d'être remplacée par 100 g (ou injectée négative).
        expect(results).toEqual({ added: 0, skipped: 4, errors: [] });
        expect((await db.loadDayMeals(date)).dejeuner).toEqual([]);
    });

    it('accepte une quantité valide fournie en chaîne', async () => {
        const foods = foodsFixture();
        const plan = { dejeuner: [{ id: 'poulet', type: 'food', quantite: '150' }] };
        const results = await gen.injectMealsIntoDay({ plan, date, foods, meals: {} });
        expect(results.added).toBe(1);
        expect((await db.loadDayMeals(date)).dejeuner[0].weight).toBe(150);
    });

    it('ignore les types de repas inconnus inventés par l’IA', async () => {
        const foods = foodsFixture();
        const plan = {
            collation: [{ id: 'poulet', type: 'food', quantite: 100 }],
            'petit_dej': [{ id: 'riz', type: 'food', quantite: 100 }],
        };

        const results = await gen.injectMealsIntoDay({ plan, date, foods, meals: {} });

        expect(results.skipped).toBe(2);
        const day = await db.loadDayMeals(date);
        expect(day.collation).toBeUndefined();
        expect(Object.keys(day).sort()).toEqual(['dejeuner', 'diner', 'petit-dej', 'snack']);
    });

    it('conserve les aliments déjà présents dans la journée', async () => {
        const foods = foodsFixture();
        await db.saveDayMeals(date, dayFixture());

        const results = await gen.injectMealsIntoDay({
            plan: { dejeuner: [{ id: 'pomme', type: 'food', quantite: 50 }] },
            date,
            foods,
            meals: {},
        });

        expect(results.added).toBe(1);
        const day = await db.loadDayMeals(date);
        expect(day.dejeuner.map((i) => i.id)).toEqual(['poulet', 'pomme']);
    });

    it('ignore un type inconnu et un repas introuvable', async () => {
        const foods = foodsFixture();
        const plan = {
            dejeuner: [
                { id: 'poulet', type: 'autre' },
                { id: 'fantome', type: 'meal' },
            ],
        };

        const results = await gen.injectMealsIntoDay({ plan, date, foods, meals: {} });

        expect(results).toEqual({ added: 0, skipped: 2, errors: [] });
        expect((await db.loadDayMeals(date)).dejeuner).toEqual([]);
    });

    it('génère un uniqueId différent pour chaque élément', async () => {
        const foods = foodsFixture();
        const plan = {
            dejeuner: [
                { id: 'poulet', type: 'food', quantite: 100 },
                { id: 'riz', type: 'food', quantite: 100 },
            ],
        };
        await gen.injectMealsIntoDay({ plan, date, foods, meals: {} });
        const day = await db.loadDayMeals(date);
        expect(day.dejeuner).toHaveLength(2);
        expect(day.dejeuner[0].uniqueId).not.toBe(day.dejeuner[1].uniqueId);
    });

    it('accepte une date au format chaîne YYYY-MM-DD', async () => {
        const foods = foodsFixture();
        await gen.injectMealsIntoDay({
            plan: { dejeuner: [{ id: 'poulet', type: 'food', quantite: 100 }] },
            date: '2026-03-11',
            foods,
            meals: {},
        });
        const day = await db.loadDayMeals(localDate(2026, 3, 11));
        expect(day.dejeuner).toHaveLength(1);
    });

    it('ne fait rien pour un plan vide', async () => {
        const results = await gen.injectMealsIntoDay({
            plan: {},
            date,
            foods: foodsFixture(),
            meals: {},
        });
        expect(results).toEqual({ added: 0, skipped: 0, errors: [] });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ai-meal-generator.js — testApiConnection
// ═════════════════════════════════════════════════════════════════════════════

describe('aiMealGenerator.testApiConnection', () => {
    beforeEach(() => {
        gen.saveApiKey('DEEP');
    });

    it('retourne true quand l’API répond correctement', async () => {
        globalThis.fetch = vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'OK' } }] }));
        await expect(gen.testApiConnection()).resolves.toBe(true);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('envoie le modèle courant et une autorisation Bearer', async () => {
        gen.saveApiKey('DEEP');
        gen.saveModel('deepseek-chat');
        let captured;
        globalThis.fetch = vi.fn(async (url, options) => {
            captured = { url, options };
            return jsonResponse({});
        });

        await gen.testApiConnection();

        expect(captured.url).toBe('https://api.deepseek.com/chat/completions');
        expect(captured.options.headers.Authorization).toBe('Bearer DEEP');
        const body = JSON.parse(captured.options.body);
        expect(body.model).toBe('deepseek-chat');
        expect(body.max_tokens).toBe(10);
    });

    it('rejette en remontant le message d’erreur de l’API', async () => {
        globalThis.fetch = vi.fn(async () => jsonResponse(
            { error: { message: 'Clé invalide' } },
            { ok: false, status: 401 }
        ));
        await expect(gen.testApiConnection()).rejects.toThrow('Clé invalide');
    });

    it('rejette avec un message générique pour un corps non JSON', async () => {
        globalThis.fetch = vi.fn(async () => jsonResponse('', { ok: false, status: 503 }));
        await expect(gen.testApiConnection()).rejects.toThrow('Erreur 503');
    });

    it('rejette immédiatement si aucune clé API n’est configurée', async () => {
        // Corrigé : sans cette garde, l'appel partait avec « Bearer » vide.
        localStorage.removeItem('deepseek_api_key');
        localStorage.removeItem('groq_api_key');
        globalThis.fetch = vi.fn(async () => jsonResponse({}));
        await expect(gen.testApiConnection()).rejects.toThrow('Clé API DeepSeek non configurée.');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});
