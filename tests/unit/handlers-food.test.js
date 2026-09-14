// tests/unit/handlers-food.test.js
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadAppDom } from '../helpers/dom.js';
import { foodsFixture } from '../helpers/fixtures.js';

let food;
let db;
let state;
let ui;
let loadCurrentDay;

beforeAll(async () => {
    loadAppDom();
    db = await import('../../js/core/db.js');
    state = (await import('../../js/core/state.js')).default;
    ui = await import('../../js/ui/ui-core.js');
    food = await import('../../js/handlers/food-handlers.js');
    await db.initDB();
});

beforeEach(async () => {
    for (const s of ['foods', 'meals', 'dailyMeals']) await db.clearStore(s);
    state.currentDate = new Date(2026, 4, 15, 12, 0, 0);
    state.foods = {};
    state.meals = {};
    state.selectedCategory = 'all';
    state.selectedCategoryManage = 'all';
    state.displayedFoodsCount = 10;
    state.maxFoodsPerLoad = 10;
    loadCurrentDay = vi.fn();
    food.initFoodHandlers({
        loadCurrentDay,
        handleDragStart: vi.fn(),
        handleQuickAdd: vi.fn(),
        editFoodClick: food.handleEditFoodClick,
        deleteFoodClick: food.handleDeleteFoodClick,
    });
    // remet les formulaires dans un état neutre
    document.querySelectorAll('input[name="foodNutritionType"]').forEach((r) => { r.checked = r.value === 'per100g'; });
    document.querySelectorAll('input[name="foodPriceType"]').forEach((r) => { r.checked = r.value === 'grams'; });
    document.getElementById('addFoodForm').reset();
    document.getElementById('editFoodForm').reset();
});

function setFormValues(form, prefix, values) {
    for (const [suffix, value] of Object.entries(values)) {
        const el = document.getElementById(`${prefix}${suffix}`);
        if (el) el.value = value;
    }
}

function submitEvent(formId) {
    return { preventDefault: vi.fn(), target: document.getElementById(formId) };
}

describe('updateCategoryCounts', () => {
    it('compte les aliments par catégorie et met à jour les badges', () => {
        state.foods = {
            a: { name: 'A', category: 'proteins' },
            b: { name: 'B', category: 'proteins' },
            c: { name: 'C', category: 'fruits' },
            d: { name: 'D' },
        };
        state.meals = { m1: {}, m2: {} };
        const badge = document.querySelector('[data-count="all"]');
        badge.textContent = '';

        food.updateCategoryCounts();

        expect(document.querySelector('[data-count="all"]').textContent).toBe('4');
        expect(document.querySelector('[data-count="proteins"]').textContent).toBe('2');
        expect(document.querySelector('[data-count="fruits"]').textContent).toBe('1');
        expect(document.querySelector('[data-count="other"]').textContent).toBe('1');
        expect(document.querySelector('[data-count="meals"]').textContent).toBe('2');
    });

    it('classe les catégories inconnues dans "other"', () => {
        state.foods = { a: { name: 'A', category: 'catégorie-inexistante' } };
        food.updateCategoryCounts();
        expect(document.querySelector('[data-count="other"]').textContent).toBe('1');
    });

    it('ne lève pas si les badges sont absents du DOM', () => {
        expect(() => food.updateCategoryCounts()).not.toThrow();
    });
});

describe('handleFoodSearch', () => {
    beforeEach(() => {
        state.foods = {
            poulet: { name: 'Poulet', category: 'proteins', calories: 165 },
            pomme: { name: 'Pomme', category: 'fruits', calories: 52 },
        };
        ui.displayFoods(state.foods, vi.fn(), vi.fn(), 0, {}, 'all');
    });

    it('masque les aliments qui ne correspondent pas à la recherche', () => {
        food.handleFoodSearch({ target: { value: 'pom' } });
        const items = document.querySelectorAll('.food-item');
        const visibles = [...items].filter((i) => !i.classList.contains('hidden'));
        expect(visibles).toHaveLength(1);
        expect(visibles[0].dataset.foodName).toBe('Pomme');
    });

    it('affiche le message "aucun résultat" quand rien ne correspond', () => {
        food.handleFoodSearch({ target: { value: 'zzz' } });
        expect(document.getElementById('noResultsMessage').style.display).toBe('block');
    });

    it('restaure la liste complète quand la recherche est vidée', () => {
        food.handleFoodSearch({ target: { value: 'pom' } });
        food.handleFoodSearch({ target: { value: '' } });
        const items = document.querySelectorAll('.food-item');
        expect([...items].some((i) => i.classList.contains('hidden'))).toBe(false);
        expect(document.getElementById('noResultsMessage').style.display).toBe('none');
    });

    it('est insensible à la casse', () => {
        food.handleFoodSearch({ target: { value: 'POULET' } });
        const visibles = [...document.querySelectorAll('.food-item')].filter((i) => !i.classList.contains('hidden'));
        expect(visibles).toHaveLength(1);
    });
});

describe('handleCategoryFilter / handleCategoryFilterManage', () => {
    beforeEach(() => {
        state.foods = { poulet: { name: 'Poulet', category: 'proteins', calories: 165 } };
    });

    it('met à jour la catégorie sélectionnée et la classe active', () => {
        const btn = document.querySelector('.category-filter-btn[data-category="proteins"]');
        food.handleCategoryFilter({ target: btn });
        expect(state.selectedCategory).toBe('proteins');
        expect(btn.classList.contains('active')).toBe(true);
    });

    it('ignore un clic hors d’un bouton de catégorie', () => {
        const before = state.selectedCategory;
        food.handleCategoryFilter({ target: document.createElement('div') });
        expect(state.selectedCategory).toBe(before);
    });

    it('gère le filtre de l’onglet gestion', () => {
        const btn = document.querySelector('.category-filter-btn-manage[data-category-manage="proteins"]');
        food.handleCategoryFilterManage({ currentTarget: btn });
        expect(state.selectedCategoryManage).toBe('proteins');
    });
});

describe('handleLoadMoreFoods', () => {
    it('augmente le nombre d’aliments affichés', () => {
        state.displayedFoodsCount = 10;
        state.maxFoodsPerLoad = 10;
        food.handleLoadMoreFoods();
        expect(state.displayedFoodsCount).toBe(20);
    });
});

describe('handleFoodSearchManage', () => {
    it('filtre la liste de gestion', () => {
        state.foods = {
            poulet: { name: 'Poulet', category: 'proteins' },
            pomme: { name: 'Pomme', category: 'fruits' },
        };
        ui.displayFoodsManage(state.foods, vi.fn(), vi.fn(), 'all');

        food.handleFoodSearchManage({ target: { value: 'poulet' } });

        const items = document.querySelectorAll('#foodsListManage .food-item');
        const visibles = [...items].filter((i) => !i.classList.contains('hidden'));
        expect(visibles).toHaveLength(1);
    });
});

describe('handleAddFood', () => {
    it('crée un aliment avec un identifiant normalisé', async () => {
        setFormValues(document, 'food', {
            Name: 'Poulet Rôti', Category: 'proteins', Calories: '165', Proteins: '31',
            Carbs: '0', Sugars: '0', Fibers: '0', Fats: '3.6',
        });

        await food.handleAddFood(submitEvent('addFoodForm'));

        expect(state.foods['poulet-roti']).toBeDefined();
        expect(state.foods['poulet-roti'].calories).toBe(165);
        expect(await db.loadFoods()).toHaveProperty('poulet-roti');
    });

    it('refuse un aliment dont le nom existe déjà', async () => {
        state.foods.poulet = { name: 'Poulet', calories: 100 };
        setFormValues(document, 'food', { Name: 'Poulet', Calories: '100' });

        await food.handleAddFood(submitEvent('addFoodForm'));

        expect(state.foods.poulet.calories).toBe(100);
    });

    it('ne fait rien si le nom est vide', async () => {
        setFormValues(document, 'food', { Name: '' });
        await food.handleAddFood(submitEvent('addFoodForm'));
        expect(Object.keys(state.foods)).toHaveLength(0);
    });

    it('convertit les valeurs "par portion" en valeurs pour 100 g', async () => {
        document.querySelector('input[name="foodNutritionType"][value="perPortion"]').checked = true;
        setFormValues(document, 'food', {
            Name: 'Yaourt', Calories: '60', Proteins: '5', Carbs: '6', Sugars: '6', Fibers: '0', Fats: '2',
            PortionWeight: '125',
        });

        await food.handleAddFood(submitEvent('addFoodForm'));

        const yaourt = state.foods.yaourt;
        expect(yaourt.isPortionBased).toBe(true);
        expect(yaourt.portionWeight).toBe(125);
        expect(yaourt.calories).toBeCloseTo(60 * (100 / 125), 5);
    });

    it('borne l’indice glycémique entre 0 et 100 et calcule la charge', async () => {
        setFormValues(document, 'food', {
            Name: 'Pain', Calories: '250', Carbs: '50', GlycemicIndex: '150',
        });

        await food.handleAddFood(submitEvent('addFoodForm'));

        expect(state.foods.pain.glycemicIndex).toBe(100);
        expect(state.foods.pain.glycemicLoad).toBeCloseTo(50, 5);
    });

    it('enregistre un prix valide', async () => {
        setFormValues(document, 'food', {
            Name: 'Riz', Calories: '350', Price: '3', PriceQuantity: '1000',
        });

        await food.handleAddFood(submitEvent('addFoodForm'));

        expect(state.foods.riz.price).toBe(3);
        expect(state.foods.riz.priceQuantity).toBe(1000);
        expect(state.foods.riz.priceUnit).toBe('grams');
    });

    it('ignore un prix incomplet', async () => {
        setFormValues(document, 'food', { Name: 'Riz', Calories: '350', Price: '3', PriceQuantity: '' });
        await food.handleAddFood(submitEvent('addFoodForm'));
        expect(state.foods.riz.price).toBeUndefined();
    });
});

describe('handleUpdateFood', () => {
    beforeEach(async () => {
        state.foods.poulet = { name: 'Poulet', calories: 165, proteins: 31, carbs: 0, sugars: 0, fibers: 0, fats: 3.6, category: 'proteins' };
        await db.saveFood('poulet', state.foods.poulet);
    });

    it('met à jour l’aliment quand le nom ne change pas', async () => {
        setFormValues(document, 'editFood', {
            Id: 'poulet', Name: 'Poulet', Category: 'proteins', Calories: '200', Proteins: '35',
            Carbs: '0', Sugars: '0', Fibers: '0', Fats: '4',
        });

        await food.handleUpdateFood(submitEvent('editFoodForm'));

        expect(state.foods.poulet.calories).toBe(200);
        const stored = await db.loadFoods();
        expect(stored.poulet.calories).toBe(200);
    });

    it('renomme l’aliment et propage le nouvel id dans les repas journaliers', async () => {
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [], dejeuner: [{ id: 'poulet', weight: 100, uniqueId: 1 }], diner: [], snack: [],
        });
        setFormValues(document, 'editFood', {
            Id: 'poulet', Name: 'Poulet grille', Category: 'proteins', Calories: '200',
            Proteins: '35', Carbs: '0', Sugars: '0', Fibers: '0', Fats: '4',
        });

        await food.handleUpdateFood(submitEvent('editFoodForm'));

        expect(state.foods['poulet']).toBeUndefined();
        expect(state.foods['poulet-grille']).toBeDefined();
        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner[0].id).toBe('poulet-grille');
    });

    it('ne laisse pas le champ id du nouvel aliment écraser la nouvelle clé', async () => {
        setFormValues(document, 'editFood', {
            Id: 'poulet', Name: 'Poulet grille', Category: 'proteins', Calories: '200',
            Proteins: '35', Carbs: '0', Sugars: '0', Fibers: '0', Fats: '4',
        });

        await food.handleUpdateFood(submitEvent('editFoodForm'));

        const stored = await db.loadFoods();
        expect(stored['poulet-grille']).toBeDefined();
        expect(stored['poulet']).toBeUndefined();
    });

    it('refuse de renommer vers un nom déjà utilisé', async () => {
        state.foods.riz = { name: 'Riz', calories: 350 };
        await db.saveFood('riz', state.foods.riz);
        setFormValues(document, 'editFood', {
            Id: 'poulet', Name: 'Riz', Category: 'proteins', Calories: '1',
        });

        await food.handleUpdateFood(submitEvent('editFoodForm'));

        expect(state.foods.poulet).toBeDefined();
        expect(state.foods.riz.calories).toBe(350);
    });

    it('conserve le prix existant si les champs de prix sont vidés', async () => {
        state.foods.poulet.price = 2;
        state.foods.poulet.priceQuantity = 1000;
        state.foods.poulet.priceUnit = 'grams';
        await db.saveFood('poulet', state.foods.poulet);

        setFormValues(document, 'editFood', {
            Id: 'poulet', Name: 'Poulet', Category: 'proteins', Calories: '165',
            Price: '', PriceQuantity: '',
        });

        await food.handleUpdateFood(submitEvent('editFoodForm'));

        expect(state.foods.poulet.price).toBe(2);
    });
});

describe('handleDeleteFoodClick', () => {
    it('supprime l’aliment après confirmation', async () => {
        state.foods.poulet = { name: 'Poulet', calories: 165 };
        await db.saveFood('poulet', state.foods.poulet);
        globalThis.confirm = vi.fn(() => true);

        await food.handleDeleteFoodClick({ currentTarget: { dataset: { foodId: 'poulet', foodName: 'Poulet' } } });

        expect(state.foods.poulet).toBeUndefined();
        expect(await db.loadFoods()).not.toHaveProperty('poulet');
        expect(loadCurrentDay).toHaveBeenCalled();
    });

    it('ne supprime rien si l’utilisateur refuse', async () => {
        state.foods.poulet = { name: 'Poulet' };
        await db.saveFood('poulet', state.foods.poulet);
        globalThis.confirm = vi.fn(() => false);

        await food.handleDeleteFoodClick({ currentTarget: { dataset: { foodId: 'poulet', foodName: 'Poulet' } } });

        expect(state.foods.poulet).toBeDefined();
    });
});

describe('handleEditFoodClick', () => {
    it('ouvre la modale d’édition avec les données de l’aliment', () => {
        state.foods.poulet = { name: 'Poulet', calories: 165, proteins: 31, carbs: 0, sugars: 0, fibers: 0, fats: 3.6 };
        food.handleEditFoodClick({ currentTarget: { dataset: { foodId: 'poulet' } } });
        expect(document.getElementById('editFoodName').value).toBe('Poulet');
        expect(document.getElementById('editFoodId').value).toBe('poulet');
    });

    it('ne fait rien pour un aliment inconnu', () => {
        expect(() => food.handleEditFoodClick({ currentTarget: { dataset: { foodId: 'inconnu' } } })).not.toThrow();
    });
});

describe('ajustement des portions', () => {
    beforeEach(() => {
        state.foods = foodsFixture();
        state.meals = {
            'poulet-riz': {
                name: 'Poulet riz', isPortionAdjustable: true, totalWeight: 400,
                ingredients: [{ foodId: 'poulet', weight: 200 }, { foodId: 'riz', weight: 200 }],
                calories: 400, proteins: 40, carbs: 50, fats: 8,
            },
        };
    });

    it('remplit la modale avec une ligne par ingrédient', () => {
        food.handleAdjustPortions('dejeuner', 1, 'poulet-riz');
        const rows = document.querySelectorAll('#adjustPortionsContainer > div');
        expect(rows).toHaveLength(2);
        expect(document.getElementById('adjustPortionsMealName').textContent).toBe('Poulet riz');
    });

    it('reprend les portions personnalisées existantes', () => {
        food.handleAdjustPortions('dejeuner', 1, 'poulet-riz', { poulet: 150, riz: 50 });
        const inputs = [...document.querySelectorAll('#adjustPortionsContainer .portion-input')];
        expect(inputs.map((i) => i.value)).toEqual(['150', '50']);
    });

    it('calcule l’aperçu nutritionnel et le coût', () => {
        food.handleAdjustPortions('dejeuner', 1, 'poulet-riz');
        const inputs = [...document.querySelectorAll('#adjustPortionsContainer .portion-input')];
        inputs[0].value = '200'; // poulet
        inputs[1].value = '200'; // riz

        food.updateAdjustmentPreview();

        // poulet 200 g = 330 kcal ; riz 200 g = 700 kcal
        expect(document.getElementById('adjustCal').textContent).toBe('1030');
        expect(document.getElementById('adjustCostSection').style.display).toBe('block');
    });

    it('ne fait rien pour un repas non ajustable', () => {
        state.meals.fixe = { name: 'Fixe', isPortionAdjustable: false };
        document.getElementById('adjustPortionsContainer').innerHTML = '';
        expect(() => food.handleAdjustPortions('dejeuner', 2, 'fixe')).not.toThrow();
        expect(document.getElementById('adjustPortionsContainer').children).toHaveLength(0);
    });

    it('enregistre les portions personnalisées et le prix personnalisé', async () => {
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [], dejeuner: [{ id: 'poulet-riz', isMeal: true, weight: 400, uniqueId: 1 }], diner: [], snack: [],
        });
        food.handleAdjustPortions('dejeuner', 1, 'poulet-riz');
        const inputs = [...document.querySelectorAll('#adjustPortionsContainer .portion-input')];
        inputs[0].value = '100';
        inputs[1].value = '300';
        document.getElementById('customPriceCheckbox').checked = true;
        document.getElementById('customPriceInput').value = '4.5';

        await food.saveAdjustedPortions();

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner[0].customPortions).toEqual({ poulet: 100, riz: 300 });
        expect(meals.dejeuner[0].customPrice).toBe(4.5);
    });

    it('supprime le prix personnalisé quand la case est décochée', async () => {
        await db.saveDayMeals(state.currentDate, {
            'petit-dej': [], dejeuner: [{ id: 'poulet-riz', isMeal: true, weight: 400, uniqueId: 1, customPrice: 3 }], diner: [], snack: [],
        });
        food.handleAdjustPortions('dejeuner', 1, 'poulet-riz');
        document.getElementById('customPriceCheckbox').checked = false;

        await food.saveAdjustedPortions();

        const meals = await db.loadDayMeals(state.currentDate);
        expect(meals.dejeuner[0].customPrice).toBeUndefined();
    });

    it('ne fait rien si aucune portion n’est en cours d’ajustement', async () => {
        food.closeAdjustPortionsModal();
        await expect(food.saveAdjustedPortions()).resolves.toBeUndefined();
    });
});
