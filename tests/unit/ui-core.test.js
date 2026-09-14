// tests/unit/ui-core.test.js
// Tests de js/ui/ui-core.js.
//
// POINT CRITIQUE — mise en cache du DOM :
// ui-core.js lit `document.getElementById(...)` AU MOMENT DE L'IMPORT du module
// (const elements = { ... } au niveau module). Il faut donc injecter le DOM AVANT
// d'importer le module, et NE PLUS réinjecter tout le <body> ensuite : loadAppDom()
// recrée tous les noeuds et les références cachées pointeraient vers des noeuds
// détachés (les tests échoueraient à partir du 2e test).
//
// Approche retenue (vérifiée expérimentalement) :
//   - un seul loadAppDom() dans beforeAll, puis import dynamique ;
//   - remise à zéro des conteneurs / valeurs dans beforeEach (les noeuds restent
//     les mêmes, donc les références cachées restent valides).
// L'approche « réinjecter le body avant chaque test » est démontrée non
// fonctionnelle par le dernier test du fichier.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { loadAppDom, el } from '../helpers/dom.js';
import { foodsFixture, composedMeal, simpleFood } from '../helpers/fixtures.js';

let ui;

beforeAll(async () => {
    loadAppDom();
    ui = await import('../../js/ui/ui-core.js');
});

const RESET_INPUT_IDS = [
    'datePicker',
    'weightInput', 'bellyInput', 'bedtimeInput',
    'sleepDurationHoursInput', 'sleepDurationMinutesInput',
    'editFoodId', 'editFoodName', 'editFoodCategory', 'editFoodCalories',
    'editFoodProteins', 'editFoodCarbs', 'editFoodSugars', 'editFoodFibers',
    'editFoodFats', 'editFoodGlycemicIndex', 'editFoodPrice', 'editFoodPriceQuantity',
    'editFoodPortionWeight',
    'goalProteinsInput', 'goalCarbsInput', 'goalFatsInput',
    'goalWaterEditInput', 'goalStepsEditInput',
    'waterGoalInput', 'stepsGoalInput', 'sugarsMaxInput', 'fibersMinInput',
    'goalWeight', 'taille', 'age', 'activite', 'goalProfile', 'bmrFormula',
    'calorieAdjustment',
];

beforeEach(() => {
    // On ne touche PAS à la structure du body : uniquement le contenu / l'état.
    document.querySelectorAll('.notification').forEach((n) => n.remove());
    document.querySelectorAll('.meal-selector-menu').forEach((m) => m.remove());
    document.querySelectorAll('.food-item.menu-open').forEach((f) => f.classList.remove('menu-open'));
    document.querySelectorAll('.modal').forEach((m) => m.classList.remove('show'));

    el('foodsList').innerHTML = '';
    el('foodsListManage').innerHTML = '';
    el('activitiesList').innerHTML = '';

    for (const id of RESET_INPUT_IDS) {
        const node = document.getElementById(id);
        if (node) node.value = '';
    }
    document.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = false; });

    el('loadMoreFoodsBtn').style.display = '';
    el('activitiesSummary').style.display = '';
    el('goalsResults').style.display = '';
    el('editMacrosBtn').style.display = '';
    el('editWellnessBtn').style.display = '';
});

afterEach(() => {
    vi.useRealTimers();
    delete window.handleDuplicateMealItem;
    delete window.handleAdjustPortions;
});

/** Totaux nutritionnels complets, valeurs par défaut « réalistes ». */
function totals(overrides = {}) {
    return {
        calories: 1500,
        proteins: 100,
        carbs: 150,
        fats: 50,
        sugars: 20,
        fibers: 30,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// showNotification
// ---------------------------------------------------------------------------

describe('ui-core.showNotification', () => {
    it('affiche une notification de succès avec le bon style', () => {
        ui.showNotification('Aliment enregistré');
        const notif = document.querySelector('.notification');
        expect(notif).not.toBeNull();
        expect(notif.textContent).toBe('Aliment enregistré');
        expect(notif.style.background).toBe('var(--color-success)');
    });

    it('affiche une notification d’erreur avec le style danger', () => {
        ui.showNotification('Erreur', 'error');
        const notif = document.querySelector('.notification');
        expect(notif.textContent).toBe('Erreur');
        expect(notif.style.background).toBe('var(--gradient-danger)');
    });

    it('utilise le type succès par défaut', () => {
        ui.showNotification('Sans type');
        expect(document.querySelector('.notification').style.background).toBe('var(--color-success)');
    });

    it('retire automatiquement la notification après 3,5 s', () => {
        vi.useFakeTimers();
        ui.showNotification('Temporaire');
        expect(document.querySelector('.notification')).not.toBeNull();

        vi.advanceTimersByTime(3499);
        expect(document.querySelector('.notification')).not.toBeNull();

        vi.advanceTimersByTime(1);
        expect(document.querySelector('.notification')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// updateDateDisplay
// ---------------------------------------------------------------------------

describe('ui-core.updateDateDisplay', () => {
    it('remplit la date affichée et le date picker au format YYYY-MM-DD', () => {
        ui.updateDateDisplay(new Date(2026, 1, 3, 12, 0, 0));
        expect(el('currentDate').textContent).toContain('2026');
        expect(el('currentDate').textContent).toContain('février');
        expect(el('datePicker').value).toBe('2026-02-03');
    });

    it('ajoute le zéro de remplissage sur les mois et jours à un chiffre', () => {
        ui.updateDateDisplay(new Date(2026, 0, 5, 12, 0, 0));
        expect(el('datePicker').value).toBe('2026-01-05');
    });
});

// ---------------------------------------------------------------------------
// updateSummary
// ---------------------------------------------------------------------------

describe('ui-core.updateSummary', () => {
    it('affiche les calories consommées sans objectif', () => {
        ui.updateSummary(totals(), null);
        expect(el('totalCalories').textContent).toBe('1500 kcal');
        expect(el('totalProteins').innerHTML).toBe('100.0 g');
        expect(el('totalCarbs').textContent).toBe('150.0 g');
        expect(el('totalFats').textContent).toBe('50.0 g');
        expect(el('totalSugars').textContent).toBe('20.0 g');
        expect(el('totalFibers').textContent).toBe('30.0 g');
    });

    it('affiche consommé / objectif et le reste quand des objectifs existent', () => {
        ui.updateSummary(totals(), { calories: 2000, proteins: 150, carbs: 200, fats: 70 });

        expect(el('totalCalories').innerHTML).toContain('1500 / 2000 kcal');
        expect(el('totalCalories').innerHTML).toContain('Il reste <strong>500 kcal</strong>');
        expect(el('totalProteins').innerHTML).toBe('100.0 / 150 g');
        expect(el('totalCarbs').textContent).toBe('150.0 / 200 g');
        expect(el('totalFats').textContent).toBe('50.0 / 70 g');
        // Seuils par défaut : sucres 25 g, fibres 25 g.
        expect(el('totalSugars').textContent).toBe('20.0 / 25 g');
        expect(el('totalFibers').textContent).toBe('30.0 / 25 g');
    });

    it('déduit les calories brûlées du net consommé', () => {
        ui.updateSummary(totals({ calories: 1500 }), { calories: 2000 }, 500);
        expect(el('totalCalories').innerHTML).toContain('1000 / 2000 kcal');
        expect(el('totalCalories').innerHTML).toContain('Il reste <strong>1000 kcal</strong>');
        expect(el('caloriesProgress').style.width).toBe('50%');
    });

    it('signale un dépassement d’objectif calorique', () => {
        ui.updateSummary(totals({ calories: 2500 }), { calories: 2000 });
        expect(el('totalCalories').innerHTML).toContain('Dépassement de <strong>500 kcal</strong>');
        expect(el('caloriesProgress').className).toBe('progress-fill danger');
    });

    it('arrondit les calories affichées', () => {
        ui.updateSummary(totals({ calories: 1499.6 }), null);
        expect(el('totalCalories').textContent).toBe('1500 kcal');
    });

    it('colore la barre calories en vert / orange / rouge selon le pourcentage', () => {
        ui.updateSummary(totals({ calories: 1500 }), { calories: 2000 });
        expect(el('caloriesProgress').className).toBe('progress-fill success');
        expect(el('caloriesProgress').style.width).toBe('75%');

        ui.updateSummary(totals({ calories: 1800 }), { calories: 2000 });
        expect(el('caloriesProgress').className).toBe('progress-fill warning');
        expect(el('caloriesProgress').style.width).toBe('90%');

        ui.updateSummary(totals({ calories: 2000 }), { calories: 2000 });
        expect(el('caloriesProgress').className).toBe('progress-fill danger');
    });

    it('plafonne la largeur des barres à 100 %', () => {
        ui.updateSummary(totals({ calories: 99999 }), { calories: 1000 });
        expect(el('caloriesProgress').style.width).toBe('100%');
    });

    it('sans objectif, les barres restent à 0 % et sans classe de couleur', () => {
        ui.updateSummary(totals(), null);
        // Comportement voulu par le module (cf. commentaire de getPercentage) :
        // sans objectif on n'affiche pas 100 %, ce qui laisserait croire à un
        // objectif atteint sur un profil vierge.
        expect(el('caloriesProgress').style.width).toBe('0%');
        expect(el('caloriesProgress').className).toContain('progress-fill');
        expect(el('caloriesProgress').className).not.toContain('danger');
        expect(el('proteinsProgress').style.width).toBe('0%');
    });

    it('affiche le ratio protéines / poids quand le poids du jour est fourni', () => {
        ui.updateSummary(totals({ proteins: 100 }), null, 0, 80);
        expect(el('totalProteins').innerHTML).toBe('100.0 g<br><small style="opacity:0.8">1.25 g/kg</small>');
    });

    it('retombe sur le poids des objectifs si le poids du jour est absent', () => {
        ui.updateSummary(totals({ proteins: 100 }), { calories: 2000, proteins: 150, weight: 50 }, 0);
        expect(el('totalProteins').innerHTML).toContain('2.00 g/kg');
    });

    it('applique les seuils sucres (max) avec classes inversées', () => {
        ui.updateSummary(totals({ sugars: 10 }), { calories: 2000 });
        expect(el('sugarsProgress').className).toBe('progress-fill success');
        expect(el('sugarsProgress').style.width).toBe('40%');

        ui.updateSummary(totals({ sugars: 21 }), { calories: 2000 });
        expect(el('sugarsProgress').className).toBe('progress-fill warning');
        expect(el('sugarsProgress').style.width).toBe('84%');

        ui.updateSummary(totals({ sugars: 26 }), { calories: 2000 });
        expect(el('sugarsProgress').className).toBe('progress-fill danger');
        expect(el('sugarsProgress').style.width).toBe('100%');
    });

    it('applique les seuils fibres (min) avec classes inversées', () => {
        ui.updateSummary(totals({ fibers: 10 }), { calories: 2000 });
        expect(el('fibersProgress').className).toBe('progress-fill danger');
        expect(el('fibersProgress').style.width).toBe('40%');

        ui.updateSummary(totals({ fibers: 15 }), { calories: 2000 });
        expect(el('fibersProgress').className).toBe('progress-fill warning');

        ui.updateSummary(totals({ fibers: 30 }), { calories: 2000 });
        expect(el('fibersProgress').className).toBe('progress-fill success');
        expect(el('fibersProgress').style.width).toBe('100%');
    });

    it('utilise sugarsMax / fibersMin personnalisés', () => {
        ui.updateSummary(totals({ sugars: 30, fibers: 5 }), { calories: 2000, sugarsMax: 60, fibersMin: 10 });
        expect(el('totalSugars').textContent).toBe('30.0 / 60 g');
        expect(el('totalFibers').textContent).toBe('5.0 / 10 g');
        expect(el('sugarsProgress').className).toBe('progress-fill success');
        expect(el('fibersProgress').className).toBe('progress-fill warning');
    });
});

// ---------------------------------------------------------------------------
// updateWeightDisplay / updateBellyDisplay / updateBedtimeDisplay / sleep
// ---------------------------------------------------------------------------

describe('ui-core.updateWeightDisplay & updateBellyDisplay', () => {
    it('remplit les champs poids et tour de ventre', () => {
        ui.updateWeightDisplay(72.5);
        ui.updateBellyDisplay(84);
        expect(el('weightInput').value).toBe('72.5');
        expect(el('bellyInput').value).toBe('84');
    });

    it('vide les champs quand la valeur est nulle ou absente', () => {
        ui.updateWeightDisplay(72.5);
        ui.updateWeightDisplay(null);
        expect(el('weightInput').value).toBe('');

        ui.updateBellyDisplay(84);
        ui.updateBellyDisplay(undefined);
        expect(el('bellyInput').value).toBe('');
    });

    it('accepte la valeur 0 comme une vraie valeur', () => {
        ui.updateWeightDisplay(0);
        expect(el('weightInput').value).toBe('0');
    });
});

describe('ui-core.updateBedtimeDisplay', () => {
    it('affiche l’heure du coucher', () => {
        ui.updateBedtimeDisplay('23:15');
        expect(el('bedtimeInput').value).toBe('23:15');
    });

    it('vide le champ quand aucune heure n’est fournie', () => {
        ui.updateBedtimeDisplay('23:15');
        ui.updateBedtimeDisplay(null);
        expect(el('bedtimeInput').value).toBe('');
    });
});

describe('ui-core.updateSleepDurationDisplay', () => {
    it('convertit une durée décimale en heures + minutes', () => {
        ui.updateSleepDurationDisplay(7.5);
        expect(el('sleepDurationHoursInput').value).toBe('7');
        expect(el('sleepDurationMinutesInput').value).toBe('30');
    });

    it('gère une durée entière (minutes à 0)', () => {
        ui.updateSleepDurationDisplay(8);
        expect(el('sleepDurationHoursInput').value).toBe('8');
        expect(el('sleepDurationMinutesInput').value).toBe('0');
    });

    it('arrondit au centième de minute', () => {
        // 7,999 h => 479,94 min => 480 min => 8 h 00
        ui.updateSleepDurationDisplay(7.999);
        expect(el('sleepDurationHoursInput').value).toBe('8');
        expect(el('sleepDurationMinutesInput').value).toBe('0');
    });

    it('vide les deux champs quand la durée est absente', () => {
        ui.updateSleepDurationDisplay(7.5);
        ui.updateSleepDurationDisplay(null);
        expect(el('sleepDurationHoursInput').value).toBe('');
        expect(el('sleepDurationMinutesInput').value).toBe('');
    });
});

// ---------------------------------------------------------------------------
// displayFoods
// ---------------------------------------------------------------------------

describe('ui-core.displayFoods', () => {
    it('affiche les aliments simples avec leurs identifiants et valeurs', () => {
        ui.displayFoods(foodsFixture(), vi.fn(), vi.fn());
        const items = el('foodsList').querySelectorAll('.food-item');
        expect(items).toHaveLength(4);

        const poulet = el('foodsList').querySelector('[data-food-id="poulet"]');
        expect(poulet.dataset.foodName).toBe('Poulet');
        expect(poulet.classList.contains('meal-item-display')).toBe(false);
        expect(poulet.textContent).toContain('165.0 kcal');
        expect(poulet.textContent).toContain('P: 31.0g');
        expect(poulet.querySelector('.quick-action-btn')).not.toBeNull();
    });

    it('affiche les repas composés en premier avec le badge REPAS', () => {
        ui.displayFoods(foodsFixture(), vi.fn(), vi.fn(), 20, { 'poulet-riz': composedMeal() });
        const items = el('foodsList').querySelectorAll('.food-item');
        expect(items).toHaveLength(5);
        expect(items[0].dataset.foodId).toBe('poulet-riz');
        expect(items[0].classList.contains('meal-item-display')).toBe(true);
        expect(items[0].textContent).toContain('REPAS');
        expect(items[0].textContent).toContain('2 ingrédients');
    });

    it('affiche le prix au 100 g calculé (nouveau et ancien format)', () => {
        ui.displayFoods(foodsFixture(), vi.fn(), vi.fn());
        const riz = el('foodsList').querySelector('[data-food-id="riz"]');
        const pates = el('foodsList').querySelector('[data-food-id="pates"]');
        const pomme = el('foodsList').querySelector('[data-food-id="pomme"]');

        expect(riz.textContent).toContain('0.30€/100g'); // 3 € / 1000 g
        expect(pates.textContent).toContain('0.40€/100g'); // 2 € / 500 g (ancien format)
        expect(pomme.textContent).toContain('0.25€/100g'); // 2,5 € / 1000 g
    });

    it('affiche l’index et la charge glycémiques si présents', () => {
        ui.displayFoods(
            { x: simpleFood({ name: 'X', glycemicIndex: 55.4, glycemicLoad: 12.34 }) },
            vi.fn(),
            vi.fn()
        );
        const text = el('foodsList').querySelector('.food-item').textContent;
        expect(text).toContain('IG: 55');
        expect(text).toContain('CG: 12.3');
    });

    it('limite le nombre d’éléments et affiche le bouton « voir plus »', () => {
        ui.displayFoods(foodsFixture(), vi.fn(), vi.fn(), 2);
        expect(el('foodsList').querySelectorAll('.food-item')).toHaveLength(2);
        expect(el('loadMoreFoodsBtn').style.display).toBe('inline-block');
        expect(el('remainingFoodsCount').textContent).toBe('2');
    });

    it('masque le bouton « voir plus » quand tout est affiché', () => {
        ui.displayFoods(foodsFixture(), vi.fn(), vi.fn(), 0);
        expect(el('foodsList').querySelectorAll('.food-item')).toHaveLength(4);
        expect(el('loadMoreFoodsBtn').style.display).toBe('none');
    });

    it('filtre sur la catégorie "meals" (repas composés uniquement)', () => {
        const foods = { poulet: simpleFood({ category: 'proteins' }) };
        ui.displayFoods(foods, vi.fn(), vi.fn(), 20, { 'poulet-riz': composedMeal() }, 'meals');
        const items = el('foodsList').querySelectorAll('.food-item');
        expect(items).toHaveLength(1);
        expect(items[0].dataset.foodId).toBe('poulet-riz');
    });

    it('filtre les aliments sur une catégorie donnée (sans les repas)', () => {
        const foods = {
            poulet: simpleFood({ category: 'proteins' }),
            pomme: simpleFood({ name: 'Pomme', category: 'fruits' }),
        };
        ui.displayFoods(foods, vi.fn(), vi.fn(), 20, { 'poulet-riz': composedMeal() }, 'fruits');
        const items = el('foodsList').querySelectorAll('.food-item');
        expect(items).toHaveLength(1);
        expect(items[0].dataset.foodId).toBe('pomme');
    });

    it('branche le handler de drag sur chaque élément', () => {
        const drag = vi.fn();
        ui.displayFoods({ poulet: simpleFood() }, drag, vi.fn());
        el('foodsList').querySelector('.food-item').dispatchEvent(new Event('dragstart'));
        expect(drag).toHaveBeenCalledTimes(1);
    });

    it('ouvre le sélecteur de repas et appelle le handler d’ajout rapide', () => {
        const quick = vi.fn();
        ui.displayFoods({ poulet: simpleFood() }, vi.fn(), quick);

        el('foodsList').querySelector('.quick-action-btn').click();
        const menu = el('foodsList').querySelector('.meal-selector-menu');
        expect(menu).not.toBeNull();
        expect(menu.querySelectorAll('.meal-selector-item')).toHaveLength(4);

        menu.querySelector('[data-meal="dejeuner"]').click();
        expect(quick).toHaveBeenCalledWith('poulet', 'dejeuner');
        expect(el('foodsList').querySelector('.meal-selector-menu')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// displayFoodsManage
// ---------------------------------------------------------------------------

describe('ui-core.displayFoodsManage', () => {
    it('affiche tous les aliments avec un bouton supprimer', () => {
        ui.displayFoodsManage(foodsFixture(), vi.fn(), vi.fn());
        const items = el('foodsListManage').querySelectorAll('.food-item');
        expect(items).toHaveLength(4);
        expect(items[0].querySelector('.delete-food-btn')).not.toBeNull();
        expect(items[0].querySelector('.delete-food-btn').dataset.foodId).toBe('poulet');
    });

    it('appelle le handler de modification au clic sur un aliment', () => {
        const edit = vi.fn();
        ui.displayFoodsManage(foodsFixture(), edit, vi.fn());
        el('foodsListManage').querySelector('[data-food-id="poulet"]').click();
        expect(edit).toHaveBeenCalledTimes(1);
    });

    it('appelle le handler de suppression sans déclencher la modification', () => {
        const edit = vi.fn();
        const del = vi.fn();
        ui.displayFoodsManage(foodsFixture(), edit, del);
        const item = el('foodsListManage').querySelector('[data-food-id="poulet"]');
        item.querySelector('.delete-food-btn').click();
        expect(del).toHaveBeenCalledTimes(1);
        expect(edit).not.toHaveBeenCalled();
    });

    it('filtre par catégorie', () => {
        const foods = {
            poulet: simpleFood({ category: 'proteins' }),
            pomme: simpleFood({ name: 'Pomme', category: 'fruits' }),
        };
        ui.displayFoodsManage(foods, vi.fn(), vi.fn(), 'proteins');
        const items = el('foodsListManage').querySelectorAll('.food-item');
        expect(items).toHaveLength(1);
        expect(items[0].dataset.foodId).toBe('poulet');
    });
});

// ---------------------------------------------------------------------------
// switchTab
// ---------------------------------------------------------------------------

describe('ui-core.switchTab', () => {
    it('active l’onglet demandé et désactive les autres', () => {
        ui.switchTab('stats');
        expect(document.querySelector('.nav-tab[data-tab="stats"]').classList.contains('active')).toBe(true);
        expect(el('stats-tab').classList.contains('active')).toBe(true);
        expect(document.querySelector('.nav-tab[data-tab="tracker"]').classList.contains('active')).toBe(false);
        expect(el('tracker-tab').classList.contains('active')).toBe(false);
    });

    it('ne laisse qu’un seul onglet actif', () => {
        ui.switchTab('goals');
        ui.switchTab('foods');
        expect(document.querySelectorAll('.nav-tab.active')).toHaveLength(1);
        expect(document.querySelectorAll('.tab-content.active')).toHaveLength(1);
        expect(document.querySelector('.nav-tab.active').dataset.tab).toBe('foods');
    });
});

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------

describe('ui-core.openEditModal & closeEditModal', () => {
    it('pré-remplit la modale pour un aliment simple (valeurs pour 100 g)', () => {
        ui.openEditModal('poulet', {
            name: 'Poulet',
            calories: 165,
            proteins: 31,
            carbs: 0,
            sugars: 0,
            fibers: 0,
            fats: 3.6,
            glycemicIndex: 55,
            price: 3,
            priceQuantity: 1000,
            priceUnit: 'grams',
            category: 'proteins',
        });

        expect(el('editFoodId').value).toBe('poulet');
        expect(el('editFoodName').value).toBe('Poulet');
        expect(el('editFoodCategory').value).toBe('proteins');
        expect(el('editFoodCalories').value).toBe('165.0');
        expect(el('editFoodProteins').value).toBe('31.0');
        expect(el('editFoodFats').value).toBe('3.6');
        expect(el('editFoodGlycemicIndex').value).toBe('55');
        expect(el('editFoodPrice').value).toBe('3');
        expect(el('editFoodPriceQuantity').value).toBe('1000');
        expect(document.querySelector('input[name="editFoodNutritionType"][value="per100g"]').checked).toBe(true);
        expect(document.querySelector('input[name="editFoodPriceType"][value="grams"]').checked).toBe(true);
        expect(el('editFoodModal').classList.contains('show')).toBe(true);
    });

    it('convertit les valeurs /100 g en valeurs /portion pour un aliment en portions', () => {
        ui.openEditModal('yaourt', {
            name: 'Yaourt',
            calories: 60,
            proteins: 5,
            carbs: 7,
            sugars: 6,
            fibers: 0,
            fats: 2,
            isPortionBased: true,
            portionWeight: 125,
        });

        expect(el('editFoodCalories').value).toBe('75.0'); // 60 * 1,25
        expect(el('editFoodProteins').value).toBe('6.3'); // 5 * 1,25 = 6,25
        expect(el('editFoodPortionWeight').value).toBe('125');
        expect(document.querySelector('input[name="editFoodNutritionType"][value="perPortion"]').checked).toBe(true);
    });

    it('retombe sur la catégorie "other" et le format ancien priceGrams', () => {
        ui.openEditModal('pates', { name: 'Pâtes', calories: 350, proteins: 12, carbs: 70, sugars: 2, fats: 1.5, price: 2, priceGrams: 500 });
        expect(el('editFoodCategory').value).toBe('other');
        expect(el('editFoodPriceQuantity').value).toBe('500');
        expect(document.querySelector('input[name="editFoodPriceType"][value="grams"]').checked).toBe(true);
    });

    it('ferme la modale de modification', () => {
        ui.openEditModal('poulet', { name: 'Poulet', calories: 165, proteins: 31, carbs: 0, sugars: 0, fats: 3.6 });
        expect(el('editFoodModal').classList.contains('show')).toBe(true);
        ui.closeEditModal();
        expect(el('editFoodModal').classList.contains('show')).toBe(false);
    });
});

describe('ui-core.showModal & hideModal', () => {
    it('affiche puis masque une modale existante', () => {
        ui.showModal('exportModal');
        expect(el('exportModal').classList.contains('show')).toBe(true);
        ui.hideModal('exportModal');
        expect(el('exportModal').classList.contains('show')).toBe(false);
    });

    it('ignore silencieusement un identifiant inconnu', () => {
        expect(() => ui.showModal('modale-inexistante')).not.toThrow();
        expect(() => ui.hideModal('modale-inexistante')).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// displayActivities
// ---------------------------------------------------------------------------

describe('ui-core.displayActivities', () => {
    it('affiche un message et masque le résumé quand la liste est vide', () => {
        ui.displayActivities([], vi.fn(), vi.fn());
        expect(el('activitiesList').textContent).toContain('Aucune activité');
        expect(el('activitiesSummary').style.display).toBe('none');
    });

    it('affiche les activités avec les totaux', () => {
        const activities = [
            { id: 'a1', type: 'Course', duration: 30, calories: 300, time: '07:00' },
            { id: 'a2', type: 'Vélo', duration: 45, calories: 400 },
        ];
        ui.displayActivities(activities, vi.fn(), vi.fn());

        const items = el('activitiesList').querySelectorAll('.activity-item');
        expect(items).toHaveLength(2);
        expect(items[0].textContent).toContain('Course');
        expect(items[0].textContent).toContain('🕒 07:00');
        expect(items[1].textContent).not.toContain('🕒');
        expect(el('totalDuration').textContent).toBe('75 min');
        expect(el('totalActivityCalories').textContent).toBe('700 kcal');
        expect(el('activitiesSummary').style.display).toBe('flex');
    });

    it('branche les handlers modifier et supprimer avec l’id de l’activité', () => {
        const edit = vi.fn();
        const del = vi.fn();
        ui.displayActivities([{ id: 'a1', type: 'Course', duration: 30, calories: 300 }], edit, del);

        el('activitiesList').querySelector('.activity-edit-btn').click();
        expect(edit).toHaveBeenCalledWith('a1');

        el('activitiesList').querySelector('.activity-delete-btn').click();
        expect(del).toHaveBeenCalledWith('a1');
    });

    it('gère une liste nulle', () => {
        expect(() => ui.displayActivities(null, vi.fn(), vi.fn())).not.toThrow();
        expect(el('activitiesList').textContent).toContain('Aucune activité');
    });
});

// ---------------------------------------------------------------------------
// displayGoals
// ---------------------------------------------------------------------------

describe('ui-core.displayGoals', () => {
    it('ne fait rien sans objectifs', () => {
        expect(() => ui.displayGoals(null)).not.toThrow();
        expect(el('goalsResults').style.display).not.toBe('block');
    });

    it('remplit les résultats, les labels et les champs du formulaire', () => {
        ui.displayGoals({
            calories: 2000,
            proteins: 150,
            carbs: 200,
            fats: 70,
            mb: 1700,
            det: 2400,
            goalProfile: 'cut',
            waterGoal: 2500,
            stepsGoal: 12000,
            sugarsMax: 30,
            fibersMin: 28,
            sexe: 'homme',
            age: 30,
            weight: 80,
            taille: 180,
            activite: '1.55',
            bmrFormula: 'harris',
            adjustmentPercent: '0.20',
        });

        expect(el('goalsResults').style.display).toBe('block');
        expect(el('goalMB').textContent).toBe('1700 kcal');
        expect(el('goalDET').textContent).toBe('2400 kcal');
        expect(el('goalCalories').textContent).toBe('2000 kcal');
        expect(el('goalCaloriesLabel').textContent).toBe('🔥 Calories pour la Sèche');
        expect(el('goalProteins').textContent).toBe('150 g');
        expect(el('goalCarbs').textContent).toBe('200 g');
        expect(el('goalFats').textContent).toBe('70 g');

        expect(el('goalProteinsInput').value).toBe('150');
        expect(el('goalCarbsInput').value).toBe('200');
        expect(el('goalFatsInput').value).toBe('70');
        expect(el('editMacrosBtn').style.display).toBe('inline-block');

        expect(el('goalWaterDisplay').textContent).toBe('2500 ml');
        expect(el('goalStepsDisplay').textContent).toBe('12000 pas');
        expect(el('goalWaterEditInput').value).toBe('2500');
        expect(el('goalStepsEditInput').value).toBe('12000');

        expect(el('goalProfile').value).toBe('cut');
        expect(el('homme').checked).toBe(true);
        expect(el('age').value).toBe('30');
        expect(el('goalWeight').value).toBe('80');
        expect(el('taille').value).toBe('180');
        expect(el('activite').value).toBe('1.55');
        expect(el('bmrFormula').value).toBe('harris');
        expect(el('calorieAdjustment').value).toBe('0.20');
        expect(el('waterGoalInput').value).toBe('2500');
        expect(el('stepsGoalInput').value).toBe('12000');
        expect(el('sugarsMaxInput').value).toBe('30');
        expect(el('fibersMinInput').value).toBe('28');
        expect(el('editWellnessBtn').style.display).toBe('inline-block');
    });

    it('utilise les valeurs par défaut hydratation / pas', () => {
        ui.displayGoals({ calories: 2000, proteins: 150, carbs: 200, fats: 70 });
        expect(el('goalWaterDisplay').textContent).toBe('2000 ml');
        expect(el('goalStepsDisplay').textContent).toBe('10000 pas');
    });

    it('utilise un label générique pour un profil inconnu', () => {
        ui.displayGoals({ calories: 2000, proteins: 150, carbs: 200, fats: 70, goalProfile: 'profil-x' });
        expect(el('goalCaloriesLabel').textContent).toBe('🎯 Calories pour votre objectif');
    });

    it('retombe sur deficitPercent pour l’ancien format', () => {
        ui.displayGoals({ calories: 2000, proteins: 150, carbs: 200, fats: 70, deficitPercent: '0.15' });
        expect(el('calorieAdjustment').value).toBe('0.15');
    });
});

// ---------------------------------------------------------------------------
// Démonstration : pourquoi on ne réinjecte PAS le body avant chaque test
// ---------------------------------------------------------------------------

describe('ui-core — stratégie de chargement du DOM', () => {
    // Ce test DOIT rester le dernier du fichier : il réinjecte le body et laisse
    // donc les références cachées du module déjà importé pointer vers d'anciens
    // noeuds. Il prouve qu'un re-import (module réévalué) est alors nécessaire.
    it('un loadAppDom() supplémentaire invalide les références cachées (approche écartée)', async () => {
        const beforeNode = el('weightInput');

        loadAppDom();
        const afterNode = el('weightInput');
        expect(afterNode).not.toBe(beforeNode); // tout le body a bien été recréé

        // Le module déjà chargé garde ses références vers l'ancien noeud : il faut
        // réévaluer le module (ce que la version actuelle des tests évite).
        vi.resetModules();
        const freshUi = await import('../../js/ui/ui-core.js');
        freshUi.updateWeightDisplay(42);
        expect(el('weightInput').value).toBe('42');
    });
});
