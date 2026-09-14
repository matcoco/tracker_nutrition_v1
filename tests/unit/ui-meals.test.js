// tests/unit/ui-meals.test.js
// Tests de js/ui/ui-meals.js.
//
// ui-meals.js ne met PAS les éléments du DOM en cache au niveau module (contrairement
// à ui-core.js) : toutes les fonctions testées ici font leurs document.getElementById
// à l'appel. On peut donc réinjecter le DOM avant chaque test, ce qui garantit un
// état parfaitement isolé (et notamment des listeners de type change rebranchés).
//
// BUG CONNU (hors périmètre de ce fichier) : openEditModal() et closeEditModal()
// exportées par ui-meals.js référencent une variable `elements` qui n'est jamais
// déclarée dans ce module (elle n'existe que dans ui-core.js). Les appeler lève
// donc une ReferenceError. Ces deux fonctions ne figurent pas dans la liste des
// fonctions à tester ici ; elles ne sont volontairement pas couvertes.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { simpleFood, pricedFood, composedMeal } from '../helpers/fixtures.js';

let ui;

beforeAll(async () => {
    loadAppDom();
    ui = await import('../../js/ui/ui-meals.js');
});

beforeEach(() => {
    loadAppDom();
    document.querySelectorAll('.notification').forEach((n) => n.remove());
    delete window.handleDuplicateMealItem;
    delete window.handleAdjustPortions;
    delete window.handleMealItemDragStart;
    delete window.handleMealItemDragEnd;
});

/** Aliments de travail : simple, avec prix, et "en portions". */
function makeFoods() {
    return {
        poulet: simpleFood(), // 165 kcal / 100 g, sans prix
        riz: pricedFood(), // 350 kcal / 100 g, 3 € / 1000 g
        oeuf: simpleFood({
            name: 'Œuf',
            calories: 70,
            proteins: 6,
            carbs: 0.5,
            fats: 5,
            sugars: 0.3,
            fibers: 0,
            isPortionBased: true,
            portionWeight: 50,
        }),
    };
}

/** Repas composé ajustable : recette complète de 400 g, 400 kcal, 5 €. */
function makeComposed() {
    return { 'poulet-riz': composedMeal() };
}

/** Journée type couvrant les 4 repas. */
function makeMeals() {
    return {
        'petit-dej': [{ id: 'poulet', weight: 200, uniqueId: 'u1', time: '08:15' }],
        dejeuner: [{ id: 'poulet-riz', isMeal: true, weight: 200, uniqueId: 'u2' }],
        diner: [],
        snack: [{ id: 'oeuf', weight: 100, uniqueId: 'u3', time: '16:00' }],
    };
}

function emptyMeals() {
    return { 'petit-dej': [], dejeuner: [], diner: [], snack: [] };
}

function totalsFixture(overrides = {}) {
    return { calories: 500, proteins: 30, carbs: 40, sugars: 10, fibers: 5, fats: 20, ...overrides };
}

// ---------------------------------------------------------------------------
// displayMeals
// ---------------------------------------------------------------------------

describe('ui-meals.displayMeals', () => {
    it('affiche une ligne par aliment avec les dataset attendus', () => {
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn());

        const items = el('petit-dej').querySelectorAll('.meal-item');
        expect(items).toHaveLength(1);
        expect(items[0].dataset.sourceMeal).toBe('petit-dej');
        expect(items[0].dataset.uniqueId).toBe('u1');
        expect(items[0].dataset.foodId).toBe('poulet');
        expect(items[0].dataset.weight).toBe('200');
        expect(items[0].querySelector('.ci-name').textContent).toBe('Poulet');
        expect(items[0].querySelector('.ci-btn-del')).not.toBeNull();
        expect(items[0].querySelector('.ci-btn-dup')).not.toBeNull();
    });

    it('affiche les totaux du repas dans le résumé', () => {
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn());

        const summary = el('summary-petit-dej').innerHTML;
        expect(summary).toContain('<strong>Calories:</strong> 330 kcal'); // poulet 200 g
        expect(summary).toContain('<strong>Protéines:</strong> 62.0 g');
        expect(summary).toContain('<strong>Fibres:</strong> 0.0 g');
        // Dîner vide : totaux à zéro, pas de coût.
        expect(el('summary-diner').innerHTML).toContain('<strong>Calories:</strong> 0 kcal');
    });

    it('affiche un repas composé avec le badge REPAS et la zone d’ajustement', () => {
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn(), null, null, makeComposed());

        const item = el('dejeuner').querySelector('.meal-item');
        expect(item.classList.contains('composed-meal-item')).toBe(true);
        expect(item.dataset.isMeal).toBe('true');
        expect(item.dataset.foodId).toBe('poulet-riz');
        expect(item.textContent).toContain('REPAS');
        expect(item.querySelector('.ci-adjust-btn')).not.toBeNull();
        expect(item.querySelector('.ci-full-recipe-cb').checked).toBe(false); // 200 g sur 400 g
        expect(item.querySelector('.ci-qty-input').value).toBe('200');
        expect(item.querySelector('.ci-qty-hint').textContent).toBe('sur 400 g');
        // Le résumé du repas applique le prorata 200/400 et affiche le coût.
        expect(el('summary-dejeuner').innerHTML).toContain('<strong>Calories:</strong> 200 kcal');
        expect(el('summary-dejeuner').innerHTML).toContain('2.50 €');
    });

    it('coche « recette entière » et désactive la quantité pour la recette complète', () => {
        const meals = makeMeals();
        meals.dejeuner[0].weight = 400;
        ui.displayMeals(meals, makeFoods(), vi.fn(), vi.fn(), null, null, makeComposed());

        const item = el('dejeuner').querySelector('.meal-item');
        expect(item.querySelector('.ci-full-recipe-cb').checked).toBe(true);
        expect(item.querySelector('.ci-qty-input').disabled).toBe(true);
        expect(item.querySelector('.ci-qty-hint').textContent).toBe('sur 400 g');
    });

    it('affiche un aliment « en portions » en portions (p) et convertit en grammes', () => {
        const weightChange = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), weightChange);

        const item = el('snack').querySelector('.meal-item');
        expect(item.dataset.isPortionBased).toBe('true');
        expect(item.dataset.portionWeight).toBe('50');
        expect(item.querySelector('.ci-qty-unit').textContent).toBe('p');
        expect(item.querySelector('.ci-qty-input').value).toBe('2.0'); // 100 g / 50 g

        const input = item.querySelector('.ci-qty-input');
        input.value = '3';
        input.dispatchEvent(new Event('change'));
        expect(weightChange).toHaveBeenCalledWith('snack', 'u3', 150); // 3 portions * 50 g
    });

    it('appelle le handler de suppression avec le type de repas et l’uniqueId', () => {
        const remove = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), remove, vi.fn());

        el('petit-dej').querySelector('.ci-btn-del').click();
        expect(remove).toHaveBeenCalledWith('petit-dej', 'u1');

        el('snack').querySelector('.ci-btn-del').click();
        expect(remove).toHaveBeenCalledWith('snack', 'u3');
    });

    it('appelle le handler de changement de poids en grammes', () => {
        const weightChange = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), weightChange);

        const input = el('petit-dej').querySelector('.ci-qty-input');
        input.value = '150';
        input.dispatchEvent(new Event('change'));
        expect(weightChange).toHaveBeenCalledWith('petit-dej', 'u1', 150);
    });

    it('valide aussi le changement de poids avec la touche Entrée', () => {
        const weightChange = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), weightChange);

        const input = el('petit-dej').querySelector('.ci-qty-input');
        input.value = '175';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(weightChange).toHaveBeenCalledWith('petit-dej', 'u1', 175);
    });

    it('ignore les quantités invalides (0, négative, non numérique)', () => {
        const weightChange = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), weightChange);

        const input = el('petit-dej').querySelector('.ci-qty-input');
        for (const value of ['0', '-5', 'abc', '']) {
            input.value = value;
            input.dispatchEvent(new Event('change'));
        }
        expect(weightChange).not.toHaveBeenCalled();
    });

    it('décoche « recette entière » et réactive la quantité', () => {
        const weightChange = vi.fn();
        const meals = makeMeals();
        meals.dejeuner[0].weight = 400;
        ui.displayMeals(meals, makeFoods(), vi.fn(), weightChange, null, null, makeComposed());

        const item = el('dejeuner').querySelector('.meal-item');
        const cb = item.querySelector('.ci-full-recipe-cb');
        const input = item.querySelector('.ci-qty-input');
        expect(input.disabled).toBe(true);

        cb.checked = false;
        cb.dispatchEvent(new Event('change'));
        expect(input.disabled).toBe(false);
        // Le décochage ne déclenche pas de changement de poids.
        expect(weightChange).not.toHaveBeenCalled();
    });

    it('coche « recette entière » et force le poids de la recette', () => {
        const weightChange = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), weightChange, null, null, makeComposed());

        const item = el('dejeuner').querySelector('.meal-item');
        const cb = item.querySelector('.ci-full-recipe-cb');
        const input = item.querySelector('.ci-qty-input');

        cb.checked = true;
        cb.dispatchEvent(new Event('change'));
        expect(input.value).toBe('400');
        expect(input.disabled).toBe(true);
        expect(weightChange).toHaveBeenCalledWith('dejeuner', 'u2', 400);
    });

    it('branche le handler d’heure propre aux repas non partagés (snack)', () => {
        const timeChange = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn(), timeChange);

        // Les repas "partagés" n'ont pas d'input d'heure individuel.
        expect(el('petit-dej').querySelector('.ci-time-input')).toBeNull();

        const snack = el('snack').querySelector('.meal-item');
        const timeInput = snack.querySelector('.ci-time-input');
        expect(timeInput.value).toBe('16:00');

        timeInput.value = '17:00';
        timeInput.dispatchEvent(new Event('change'));
        expect(timeChange).toHaveBeenCalledWith('snack', 'u3', '17:00');
    });

    it('pré-remplit l’heure d’en-tête des repas partagés (item puis défaut)', () => {
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn());
        expect(el('mealTime-petit-dej').value).toBe('08:15'); // heure du 1er item
        expect(el('mealTime-dejeuner').value).toBe('12:30'); // valeur par défaut
        expect(el('mealTime-diner').value).toBe('19:30'); // valeur par défaut
    });

    it('appelle le handler d’heure d’en-tête quand elle change', () => {
        const mealTimeChange = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn(), null, mealTimeChange);

        const input = el('mealTime-petit-dej');
        input.value = '09:00';
        input.dispatchEvent(new Event('change'));
        expect(mealTimeChange).toHaveBeenCalledWith('petit-dej', '09:00');
    });

    it('délègue la duplication au handler global', () => {
        window.handleDuplicateMealItem = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn());

        el('petit-dej').querySelector('.ci-btn-dup').click();
        expect(window.handleDuplicateMealItem).toHaveBeenCalledWith(
            'petit-dej',
            expect.objectContaining({ uniqueId: 'u1', id: 'poulet' })
        );
        expect(window.handleDuplicateMealItem).toHaveBeenCalledTimes(1);
    });

    it('délègue l’ajustement des portions au handler global', () => {
        window.handleAdjustPortions = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn(), null, null, makeComposed());

        el('dejeuner').querySelector('.ci-adjust-btn').click();
        expect(window.handleAdjustPortions).toHaveBeenCalledWith('dejeuner', 'u2', 'poulet-riz', undefined, undefined);
    });

    it('branche les handlers de drag globaux si présents', () => {
        window.handleMealItemDragStart = vi.fn();
        window.handleMealItemDragEnd = vi.fn();
        ui.displayMeals(makeMeals(), makeFoods(), vi.fn(), vi.fn());

        const item = el('petit-dej').querySelector('.meal-item');
        item.dispatchEvent(new Event('dragstart'));
        item.dispatchEvent(new Event('dragend'));
        expect(window.handleMealItemDragStart).toHaveBeenCalledTimes(1);
        expect(window.handleMealItemDragEnd).toHaveBeenCalledTimes(1);
    });

    it('ignore les aliments inconnus sans planter', () => {
        const meals = { ...emptyMeals(), 'petit-dej': [{ id: 'inconnu', weight: 100, uniqueId: 'z' }] };
        expect(() => ui.displayMeals(meals, makeFoods(), vi.fn(), vi.fn())).not.toThrow();
        expect(el('petit-dej').querySelectorAll('.meal-item')).toHaveLength(0);
        expect(el('summary-petit-dej').innerHTML).toContain('0 kcal');
    });

    it('ignore les types de repas sans conteneur dans le DOM', () => {
        expect(() => ui.displayMeals({ 'repas-inconnu': [{ id: 'poulet', weight: 100 }] }, makeFoods(), vi.fn(), vi.fn())).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// updateWaterDisplay / updateStepsDisplay
// ---------------------------------------------------------------------------

describe('ui-meals.updateWaterDisplay', () => {
    it('affiche l’hydratation avec l’objectif par défaut (2000 ml)', () => {
        ui.updateWaterDisplay({ totalMl: 1500 });
        expect(el('waterGoal').textContent).toBe('2000');
        expect(el('waterValue').textContent).toBe('1500 ml / 2000 ml');
        expect(el('waterProgress').style.width).toBe('75%');
    });

    it('utilise l’objectif fourni et plafonne la barre à 100 %', () => {
        ui.updateWaterDisplay({ totalMl: 4000 }, { waterGoal: 3000 });
        expect(el('waterGoal').textContent).toBe('3000');
        expect(el('waterValue').textContent).toBe('4000 ml / 3000 ml');
        expect(el('waterProgress').style.width).toBe('100%');
    });

    it('traite l’absence de données comme 0 ml', () => {
        ui.updateWaterDisplay({});
        expect(el('waterValue').textContent).toBe('0 ml / 2000 ml');
        expect(el('waterProgress').style.width).toBe('0%');
    });
});

describe('ui-meals.updateStepsDisplay', () => {
    it('affiche les pas avec l’objectif par défaut (10000)', () => {
        ui.updateStepsDisplay(5000);
        expect(el('stepsGoal').textContent).toBe('10000');
        expect(el('stepsValue').textContent).toBe('5000 / 10000 pas');
        expect(el('stepsProgress').style.width).toBe('50%');
        expect(el('stepsInput').value).toBe('5000');
    });

    it('utilise l’objectif fourni et plafonne la barre à 100 %', () => {
        ui.updateStepsDisplay(20000, { stepsGoal: 12000 });
        expect(el('stepsGoal').textContent).toBe('12000');
        expect(el('stepsValue').textContent).toBe('20000 / 12000 pas');
        expect(el('stepsProgress').style.width).toBe('100%');
        expect(el('stepsInput').value).toBe('20000');
    });

    it('gère 0 pas', () => {
        ui.updateStepsDisplay(0);
        expect(el('stepsValue').textContent).toBe('0 / 10000 pas');
        expect(el('stepsProgress').style.width).toBe('0%');
        expect(el('stepsInput').value).toBe('0');
    });
});

// ---------------------------------------------------------------------------
// updateDailySummary
// ---------------------------------------------------------------------------

describe('ui-meals.updateDailySummary', () => {
    it('affiche un message quand aucun aliment n’est présent', () => {
        ui.updateDailySummary(emptyMeals(), makeFoods(), totalsFixture(), 'lundi 1 juin');
        expect(el('dailySummaryContent').innerHTML).toContain('Aucun aliment ajouté pour cette journée.');
    });

    it('génère un résumé HTML complet (repas, eau, pas, activités, coût)', () => {
        const activities = [{ id: 'a1', type: 'Course', duration: 30, calories: 300, time: '07:00' }];
        ui.updateDailySummary(
            makeMeals(),
            makeFoods(),
            totalsFixture(),
            'lundi 1 juin',
            { totalMl: 1500 },
            8000,
            activities,
            { waterGoal: 2500, stepsGoal: 12000 },
            makeComposed()
        );

        const html = el('dailySummaryContent').innerHTML;
        expect(html).toContain('lundi 1 juin');
        expect(html).toContain('💧 HYDRATATION');
        expect(html).toContain('1500 ml / 2500 ml');
        expect(html).toContain('👟 ACTIVITÉ QUOTIDIENNE');
        expect(html).toContain('8000 pas / 12000 pas');
        expect(html).toContain('🏃 ACTIVITÉS SPORTIVES');
        expect(html).toContain('Course - 30 min (300 kcal)');
        expect(html).toContain('🌅 PETIT-DÉJEUNER');
        expect(html).toContain('☀️ DÉJEUNER');
        expect(html).toContain('🍎 SNACK');
        expect(html).toContain('📊 TOTAUX DE LA JOURNÉE');
        expect(html).toContain('🔥 Calories Consommées : 500 kcal');
        expect(html).toContain('💰 Coût Total : 2.50 €');
        // Les sauts de ligne du texte sont convertis en <br> pour l'affichage.
        expect(html).toContain('<br>');
    });

    it('n’affiche ni activités ni coût quand il n’y en a pas', () => {
        ui.updateDailySummary(emptyMeals(), {}, totalsFixture(), 'd');
        // repas vides -> message d'absence
        expect(el('dailySummaryContent').innerHTML).toContain('Aucun aliment');

        ui.updateDailySummary(makeMeals(), makeFoods(), totalsFixture(), 'd');
        const html = el('dailySummaryContent').innerHTML;
        expect(html).not.toContain('🏃 ACTIVITÉS SPORTIVES');
        expect(html).not.toContain('💰 Coût Total');
    });

    it('utilise les objectifs par défaut eau / pas', () => {
        ui.updateDailySummary(makeMeals(), makeFoods(), totalsFixture(), 'd');
        const html = el('dailySummaryContent').innerHTML;
        expect(html).toContain('0 ml / 2000 ml');
        expect(html).toContain('0 pas / 10000 pas');
    });
});

// ---------------------------------------------------------------------------
// generateSummaryText (fonction pure)
// ---------------------------------------------------------------------------

describe('ui-meals.generateSummaryText', () => {
    const foods = makeFoods();
    const composed = makeComposed();
    const totals = totalsFixture();

    it('retourne une chaîne commençant par la date et contenant tous les totaux', () => {
        const text = ui.generateSummaryText(emptyMeals(), foods, totals, 'mardi 2 juin');
        expect(typeof text).toBe('string');
        expect(text.startsWith('📅 mardi 2 juin')).toBe(true);
        expect(text).toContain('📊 TOTAUX DE LA JOURNÉE');
        expect(text).toContain('🔥 Calories Consommées : 500 kcal');
        expect(text).toContain('🥩 Protéines : 30.0 g');
        expect(text).toContain('🍚 Glucides : 40.0 g');
        expect(text).toContain('🍬 Sucres : 10.0 g');
        expect(text).toContain('🌾 Fibres : 5.0 g');
        expect(text).toContain('🥑 Lipides : 20.0 g');
    });

    it('n’affiche aucun repas ni activité quand la journée est vide', () => {
        const text = ui.generateSummaryText(emptyMeals(), foods, totals, 'd');
        expect(text).not.toContain('🌅 PETIT-DÉJEUNER');
        expect(text).not.toContain('☀️ DÉJEUNER');
        expect(text).not.toContain('🌙 DÎNER');
        expect(text).not.toContain('🍎 SNACK');
        expect(text).not.toContain('🏃 ACTIVITÉS SPORTIVES');
        expect(text).not.toContain('🔥 Calories Brûlées');
        expect(text).not.toContain('💰 Coût Total');
    });

    it('affiche l’hydratation et les pas avec les objectifs par défaut', () => {
        const text = ui.generateSummaryText(emptyMeals(), foods, totals, 'd');
        expect(text).toContain('💧 HYDRATATION');
        expect(text).toContain('  • Total : 0 ml / 2000 ml');
        expect(text).toContain('👟 ACTIVITÉ QUOTIDIENNE');
        expect(text).toContain('  • Nombre de pas : 0 pas / 10000 pas');
    });

    it('respecte les objectifs eau / pas personnalisés', () => {
        const text = ui.generateSummaryText(emptyMeals(), foods, totals, 'd', { totalMl: 1200 }, 9000, [], {
            waterGoal: 3000,
            stepsGoal: 12000,
        });
        expect(text).toContain('  • Total : 1200 ml / 3000 ml');
        expect(text).toContain('  • Nombre de pas : 9000 pas / 12000 pas');
    });

    it('affiche l’en-tête des repas non vides avec leur heure', () => {
        const text = ui.generateSummaryText(makeMeals(), foods, totals, 'd', 0, 0, [], null, composed);
        expect(text).toContain('🌅 PETIT-DÉJEUNER (08:15)');
        expect(text).toContain('☀️ DÉJEUNER (12:30)'); // heure par défaut
        expect(text).toContain('🍎 SNACK');
        expect(text).not.toContain('🌙 DÎNER'); // dîner vide
    });

    it('liste les aliments simples avec leur poids et leur prix', () => {
        const meals = { ...emptyMeals(), dejeuner: [{ id: 'riz', weight: 250, uniqueId: 'r1' }] };
        const text = ui.generateSummaryText(meals, foods, totals, 'd');
        expect(text).toContain('  • Riz - 250g (0.75€)');
        expect(text).toContain('  ➜ Total : 875 kcal | P: 17.5g | G: 195.0g | L: 1.5g | 💰 0.75€');
        expect(text).toContain('💰 Coût Total : 0.75 €');
    });

    it('affiche un aliment sans prix sans suffixe de coût', () => {
        const meals = { ...emptyMeals(), 'petit-dej': [{ id: 'poulet', weight: 100, uniqueId: 'p1' }] };
        const text = ui.generateSummaryText(meals, foods, totals, 'd');
        expect(text).toContain('  • Poulet - 100g');
        expect(text).not.toContain('💰 Coût Total');
    });

    it('applique le prorata à un repas composé ajustable', () => {
        const meals = { ...emptyMeals(), dejeuner: [{ id: 'poulet-riz', isMeal: true, weight: 200, uniqueId: 'm1' }] };
        const text = ui.generateSummaryText(meals, foods, totals, 'd', 0, 0, [], null, composed);
        expect(text).toContain('  • 🍽️ Poulet riz - 200g (2.50€)');
        expect(text).toContain('  ➜ Total : 200 kcal | P: 20.0g | G: 25.0g | L: 4.0g | 💰 2.50€');
    });

    it('détaille les ingrédients d’un repas à composition personnalisée (dont 0 g)', () => {
        const meals = {
            ...emptyMeals(),
            dejeuner: [
                {
                    id: 'poulet-riz',
                    isMeal: true,
                    weight: 400,
                    uniqueId: 'm2',
                    customPortions: { poulet: 100, riz: 0 },
                },
            ],
        };
        const text = ui.generateSummaryText(meals, foods, totals, 'd', 0, 0, [], null, composed);
        expect(text).toContain('  • 🍽️ Poulet riz :');
        expect(text).toContain('    ◦ Poulet - 100g');
        expect(text).toContain('    ◦ <s>Riz</s> - 0g (0.00€)');
        expect(text).toContain('  ➜ Total : 165 kcal');
    });

    it('utilise le prix personnalisé d’un item de repas', () => {
        const meals = {
            ...emptyMeals(),
            dejeuner: [{ id: 'poulet-riz', isMeal: true, weight: 200, uniqueId: 'm3', customPrice: 1.25 }],
        };
        const text = ui.generateSummaryText(meals, foods, totals, 'd', 0, 0, [], null, composed);
        expect(text).toContain('(1.25€)');
        expect(text).toContain('💰 Coût Total : 1.25 €');
    });

    it('affiche les activités, les calories brûlées et le bilan net', () => {
        const activities = [
            { id: 'a1', type: 'Course', duration: 30, calories: 300, time: '07:00' },
            {
                id: 'a2',
                type: 'Muscu',
                duration: 45,
                calories: 200,
                strengthExercises: [{ name: 'Squat', muscle: 'Jambes', sets: 4, reps: 10, dumbbellWeight: 20 }],
            },
        ];
        const text = ui.generateSummaryText(emptyMeals(), foods, totals, 'd', 0, 0, activities);
        expect(text).toContain('🏃 ACTIVITÉS SPORTIVES');
        expect(text).toContain('  • 07:00 - Course - 30 min (300 kcal)');
        expect(text).toContain('  • Muscu - 45 min (200 kcal)');
        expect(text).toContain('    🏋️ Squat (Jambes, 4x10, haltères 20 kg)');
        expect(text).toContain('  ➜ Total : 75 min | 500 kcal brûlées');
        expect(text).toContain('🔥 Calories Brûlées : 500 kcal');
        expect(text).toContain('📊 Bilan Net : 0 kcal'); // 500 consommées - 500 brûlées
    });

    it('préfixe l’heure des items de repas non partagés', () => {
        const meals = { ...emptyMeals(), snack: [{ id: 'poulet', weight: 100, uniqueId: 's1', time: '16:30' }] };
        const text = ui.generateSummaryText(meals, foods, totals, 'd');
        expect(text).toContain('  • 16:30 - Poulet - 100g');
    });

    it('ignore les aliments inconnus', () => {
        const meals = { ...emptyMeals(), 'petit-dej': [{ id: 'inconnu', weight: 100, uniqueId: 'z1' }] };
        const text = ui.generateSummaryText(meals, foods, totals, 'd');
        expect(text).toContain('🌅 PETIT-DÉJEUNER');
        expect(text).toContain('  ➜ Total : 0 kcal');
        expect(text).not.toContain('inconnu');
    });
});

// ---------------------------------------------------------------------------
// displayActivities / displayGoals / switchTab / modales (copies ui-meals)
// ---------------------------------------------------------------------------

describe('ui-meals.displayActivities', () => {
    it('affiche un message quand la liste est vide', () => {
        ui.displayActivities([], vi.fn(), vi.fn());
        expect(el('activitiesList').textContent).toContain('Aucune activité');
        expect(el('activitiesSummary').style.display).toBe('none');
    });

    it('affiche les activités, les totaux et les exercices de musculation', () => {
        const activities = [
            { id: 'a1', type: 'Course', duration: 30, calories: 300, time: '07:00' },
            {
                id: 'a2',
                type: 'Muscu',
                duration: 45,
                calories: 200,
                strengthExercises: [{ name: 'Squat', muscle: 'Jambes', sets: 4, reps: 10 }],
            },
        ];
        const edit = vi.fn();
        const del = vi.fn();
        ui.displayActivities(activities, edit, del);

        const items = el('activitiesList').querySelectorAll('.activity-item');
        expect(items).toHaveLength(2);
        expect(el('totalDuration').textContent).toBe('75 min');
        expect(el('totalActivityCalories').textContent).toBe('500 kcal');
        expect(el('activitiesSummary').style.display).toBe('flex');
        expect(items[1].textContent).toContain('Squat (Jambes, 4x10)');

        items[0].querySelector('.activity-edit-btn').click();
        expect(edit).toHaveBeenCalledWith('a1');
        items[0].querySelector('.activity-delete-btn').click();
        expect(del).toHaveBeenCalledWith('a1');
    });
});

describe('ui-meals.displayGoals', () => {
    it('ne fait rien sans objectifs', () => {
        expect(() => ui.displayGoals(null)).not.toThrow();
        expect(el('goalsResults').style.display).not.toBe('block');
    });

    it('remplit les résultats et les champs du formulaire', () => {
        ui.displayGoals({ calories: 2200, proteins: 160, carbs: 210, fats: 75, goalProfile: 'bulk' });
        expect(el('goalsResults').style.display).toBe('block');
        expect(el('goalCalories').textContent).toBe('2200 kcal');
        expect(el('goalProteins').textContent).toBe('160 g');
        expect(el('goalCarbs').textContent).toBe('210 g');
        expect(el('goalFats').textContent).toBe('75 g');
        expect(el('goalCaloriesLabel').textContent).toBe('💪 Calories pour la Prise de Masse');
        expect(el('goalProteinsInput').value).toBe('160');
        expect(el('goalWaterDisplay').textContent).toBe('2000 ml');
        expect(el('goalStepsDisplay').textContent).toBe('10000 pas');
    });
});

describe('ui-meals.switchTab / showModal / hideModal', () => {
    it('active l’onglet demandé et désactive les autres', () => {
        ui.switchTab('settings');
        expect(document.querySelector('.nav-tab[data-tab="settings"]').classList.contains('active')).toBe(true);
        expect(el('settings-tab').classList.contains('active')).toBe(true);
        expect(document.querySelectorAll('.nav-tab.active')).toHaveLength(1);
        expect(document.querySelectorAll('.tab-content.active')).toHaveLength(1);
    });

    it('affiche et masque une modale existante', () => {
        ui.showModal('exportModal');
        expect(el('exportModal').classList.contains('show')).toBe(true);
        ui.hideModal('exportModal');
        expect(el('exportModal').classList.contains('show')).toBe(false);
    });

    it('ignore un identifiant de modale inconnu', () => {
        expect(() => ui.showModal('inconnue')).not.toThrow();
        expect(() => ui.hideModal('inconnue')).not.toThrow();
    });
});
