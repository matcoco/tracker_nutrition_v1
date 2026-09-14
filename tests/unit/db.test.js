// tests/unit/db.test.js
// Tests de la couche IndexedDB (js/core/db.js) avec fake-indexeddb.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as db from '../../js/core/db.js';
import { DB_NAME, DB_VERSION } from '../../js/config.js';
import { formatDateKey } from '../../js/core/utils.js';
import { foodsFixture, dayFixture, localDate } from '../helpers/fixtures.js';

const STORES = [
    'foods',
    'meals',
    'dailyMeals',
    'goals',
    'dailyWater',
    'dailySteps',
    'dailyActivities',
    'customActivities',
    'healthEvents',
];

beforeAll(async () => {
    await db.initDB();
});

beforeEach(async () => {
    for (const store of STORES) {
        await db.clearStore(store);
    }
});

describe('db.initDB', () => {
    it('crée tous les object stores attendus', () => {
        // On repasse par une ouverture directe pour inspecter le schéma.
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const names = [...request.result.objectStoreNames];
                for (const store of STORES) expect(names).toContain(store);
                request.result.close();
                resolve();
            };
        });
    });

    it('expose une version de schéma numérique', () => {
        expect(Number.isInteger(DB_VERSION)).toBe(true);
        expect(DB_VERSION).toBeGreaterThan(0);
    });
});

describe('db — aliments', () => {
    it('sauvegarde et recharge un aliment, en injectant l’id dans l’objet', async () => {
        await db.saveFood('poulet', { name: 'Poulet', calories: 165 });
        const foods = await db.loadFoods();
        expect(Object.keys(foods)).toEqual(['poulet']);
        expect(foods.poulet.name).toBe('Poulet');
        // loadFoods retire l'id de la valeur (il devient la clé du dictionnaire)
        expect(foods.poulet.id).toBeUndefined();
    });

    it('remplace un aliment existant', async () => {
        await db.saveFood('poulet', { name: 'Poulet', calories: 165 });
        await db.saveFood('poulet', { name: 'Poulet grille', calories: 200 });
        const foods = await db.loadFoods();
        expect(foods.poulet.calories).toBe(200);
        expect(Object.keys(foods)).toHaveLength(1);
    });

    it('supprime un aliment', async () => {
        await db.saveFood('poulet', { name: 'Poulet' });
        await db.deleteFood('poulet');
        expect(await db.loadFoods()).toEqual({});
    });

    it('retourne un dictionnaire vide quand aucun aliment n’est stocké', async () => {
        expect(await db.loadFoods()).toEqual({});
    });
});

describe('db — repas composés', () => {
    it('sauvegarde, recharge et supprime un repas composé', async () => {
        await db.saveMeal('poulet-riz', { name: 'Poulet riz', totalWeight: 400 });
        let meals = await db.loadMeals();
        expect(meals['poulet-riz'].name).toBe('Poulet riz');
        expect(meals['poulet-riz'].id).toBeUndefined();

        await db.deleteMeal('poulet-riz');
        meals = await db.loadMeals();
        expect(meals).toEqual({});
    });
});

describe('db — objectifs', () => {
    it('sauvegarde et recharge les objectifs sous la clé "current"', async () => {
        await db.saveGoals({ calories: 2200, proteins: 160 });
        const goals = await db.loadGoals();
        expect(goals).toEqual({ calories: 2200, proteins: 160 });
    });

    it('retourne null si aucun objectif n’est défini', async () => {
        expect(await db.loadGoals()).toBeNull();
    });
});

describe('db — repas du jour', () => {
    const date = localDate(2026, 3, 10);

    it('sauvegarde et recharge les repas d’une journée', async () => {
        const meals = dayFixture();
        await db.saveDayMeals(date, meals);
        const loaded = await db.loadDayMeals(date);
        expect(loaded.dejeuner).toHaveLength(1);
        expect(loaded.dejeuner[0].id).toBe('poulet');
    });

    it('retourne les 4 repas vides par défaut pour un jour inconnu', async () => {
        const loaded = await db.loadDayMeals(localDate(1999, 1, 1));
        expect(loaded).toEqual({ 'petit-dej': [], dejeuner: [], diner: [], snack: [] });
    });

    it('préserve le poids, le ventre, le coucher et le sommeil lors d’une sauvegarde de repas', async () => {
        await db.saveDayMeals(date, dayFixture());
        await db.saveDayWeight(date, 72.5);
        await db.saveDayBelly(date, 84);
        await db.saveDayBedtime(date, '23:15');
        await db.saveDaySleepDuration(date, 7.5);

        await db.saveDayMeals(date, { 'petit-dej': [], dejeuner: [], diner: [], snack: [] });

        expect(await db.loadDayWeight(date)).toBe(72.5);
        expect(await db.loadDayBelly(date)).toBe(84);
        expect(await db.loadDayBedtime(date)).toBe('23:15');
        expect(await db.loadDaySleepDuration(date)).toBe(7.5);
    });

    it('préserve les objectifs historisés du jour lors d’une sauvegarde de repas', async () => {
        await db.saveDayNutritionGoals(date, { calories: 2100, proteins: 150, carbs: 210, fats: 70 });
        await db.saveDayMeals(date, dayFixture());
        const goals = await db.loadDayNutritionGoals(date);
        expect(goals).toEqual({ calories: 2100, proteins: 150, carbs: 210, fats: 70 });
    });

    it('remplace le poids quand une nouvelle valeur est fournie', async () => {
        await db.saveDayMeals(date, dayFixture(), 70);
        expect(await db.loadDayWeight(date)).toBe(70);
        await db.saveDayMeals(date, dayFixture(), 71);
        expect(await db.loadDayWeight(date)).toBe(71);
    });

    it('conserve le poids existant quand la sauvegarde ne fournit pas de poids', async () => {
        await db.saveDayWeight(date, 68);
        await db.saveDayMeals(date, dayFixture());
        expect(await db.loadDayWeight(date)).toBe(68);
    });
});

describe('db — poids, ventre, coucher, sommeil', () => {
    const date = localDate(2026, 3, 11);

    it('efface le poids quand on passe null', async () => {
        await db.saveDayWeight(date, 80);
        await db.saveDayWeight(date, null);
        expect(await db.loadDayWeight(date)).toBeNull();
    });

    it('retourne null pour un poids absent', async () => {
        expect(await db.loadDayWeight(date)).toBeNull();
    });

    it('sauvegarde et efface le tour de ventre', async () => {
        await db.saveDayBelly(date, 90);
        expect(await db.loadDayBelly(date)).toBe(90);
        await db.saveDayBelly(date, null);
        expect(await db.loadDayBelly(date)).toBeNull();
    });

    it('sauvegarde et efface l’heure de coucher', async () => {
        await db.saveDayBedtime(date, '22:45');
        expect(await db.loadDayBedtime(date)).toBe('22:45');
        await db.saveDayBedtime(date, null);
        expect(await db.loadDayBedtime(date)).toBeNull();
    });

    it('sauvegarde une durée de sommeil numérique', async () => {
        await db.saveDaySleepDuration(date, 8.25);
        expect(await db.loadDaySleepDuration(date)).toBe(8.25);
    });

    it('efface la durée de sommeil quand on passe null', async () => {
        await db.saveDaySleepDuration(date, 7);
        await db.saveDaySleepDuration(date, null);
        expect(await db.loadDaySleepDuration(date)).toBeNull();
    });

    it('ignore une durée de sommeil non numérique', async () => {
        await db.saveDaySleepDuration(date, 7);
        await db.saveDaySleepDuration(date, 'abc');
        expect(await db.loadDaySleepDuration(date)).toBe(7);
    });

    it('accepte la durée de sommeil 0 (nuit blanche)', async () => {
        await db.saveDaySleepDuration(date, 0);
        expect(await db.loadDaySleepDuration(date)).toBe(0);
    });
});

describe('db — objectifs nutritionnels journaliers', () => {
    const date = localDate(2026, 3, 12);

    it('arrondit les objectifs enregistrés', async () => {
        await db.saveDayNutritionGoals(date, { calories: 2000.6, proteins: 149.4, carbs: 200.2, fats: 69.8 });
        expect(await db.loadDayNutritionGoals(date)).toEqual({
            calories: 2001, proteins: 149, carbs: 200, fats: 70,
        });
    });

    it('conserve les valeurs existantes quand un champ est absent', async () => {
        await db.saveDayNutritionGoals(date, { calories: 2000, proteins: 150, carbs: 200, fats: 70 });
        await db.saveDayNutritionGoals(date, { calories: 2200 });
        const goals = await db.loadDayNutritionGoals(date);
        expect(goals.calories).toBe(2200);
        expect(goals.proteins).toBe(150);
        expect(goals.carbs).toBe(200);
        expect(goals.fats).toBe(70);
    });

    it('conserve les valeurs existantes quand un champ vaut null', async () => {
        await db.saveDayNutritionGoals(date, { calories: 2000, proteins: 150 });
        await db.saveDayNutritionGoals(date, { calories: null, proteins: null });
        const goals = await db.loadDayNutritionGoals(date);
        expect(goals.calories).toBe(2000);
        expect(goals.proteins).toBe(150);
    });

    it('retourne des null pour un jour sans objectifs', async () => {
        expect(await db.loadDayNutritionGoals(date)).toEqual({ calories: null, proteins: null, carbs: null, fats: null });
    });

    it('saveDayCalorieGoal est un raccourci valide', async () => {
        await db.saveDayCalorieGoal(date, 1900);
        expect(await db.loadDayCalorieGoal(date)).toBe(1900);
    });
});

describe('db — événements de santé', () => {
    it('sauvegarde, charge et supprime un événement', async () => {
        await db.saveHealthEvent({ id: 'e1', type: 'migraine', startDate: '2026-03-10', endDate: null });
        let events = await db.loadHealthEvents();
        expect(events).toHaveLength(1);

        await db.deleteHealthEvent('e1');
        events = await db.loadHealthEvents();
        expect(events).toHaveLength(0);
    });

    it('filtre les événements actifs à une date donnée', async () => {
        await db.saveHealthEvent({ id: 'e1', type: 'a', startDate: '2026-03-01', endDate: '2026-03-05' });
        await db.saveHealthEvent({ id: 'e2', type: 'b', startDate: '2026-03-04', endDate: null });
        await db.saveHealthEvent({ id: 'e3', type: 'c', startDate: '2026-03-20', endDate: '2026-03-25' });

        const actifs = await db.loadHealthEventsForDate(localDate(2026, 3, 10));
        expect(actifs.map((e) => e.id)).toEqual(['e2']);
    });

    it('inclut les bornes de début et de fin', async () => {
        await db.saveHealthEvent({ id: 'e1', type: 'a', startDate: '2026-03-01', endDate: '2026-03-05' });
        expect((await db.loadHealthEventsForDate(localDate(2026, 3, 1))).map((e) => e.id)).toEqual(['e1']);
        expect((await db.loadHealthEventsForDate(localDate(2026, 3, 5))).map((e) => e.id)).toEqual(['e1']);
        expect(await db.loadHealthEventsForDate(localDate(2026, 2, 28))).toHaveLength(0);
    });

    it('migre les événements hérités stockés dans les journées', async () => {
        const date = localDate(2026, 3, 15);
        const meals = dayFixture();
        await db.saveDayMeals(date, meals, null);
        // On écrit directement un enregistrement "ancien format" avec events[]
        await db.getAllFromStore('dailyMeals');
        const raw = await db.getAllFromStore('dailyMeals');
        raw[0].events = [{ id: 'x1', type: 'allergie', comment: 'test' }];
        await db.bulkPut('dailyMeals', raw);

        await db.migrateLegacyDayEvents();

        const events = await db.loadHealthEvents();
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('allergie');
        expect(events[0].startDate).toBe(formatDateKey(date));

        const stillRaw = await db.getAllFromStore('dailyMeals');
        expect(stillRaw[0].events).toEqual([]);
    });

    it('la migration est idempotente', async () => {
        const date = localDate(2026, 3, 16);
        await db.saveDayMeals(date, dayFixture());
        const raw = await db.getAllFromStore('dailyMeals');
        raw[0].events = [{ id: 'x1', type: 'allergie' }];
        await db.bulkPut('dailyMeals', raw);

        await db.migrateLegacyDayEvents();
        await db.migrateLegacyDayEvents();
        expect(await db.loadHealthEvents()).toHaveLength(1);
    });
});

describe('db — helpers de store', () => {
    it('getAllFromStore retourne un tableau vide pour un store vide', async () => {
        expect(await db.getAllFromStore('foods')).toEqual([]);
    });

    it('clearStore vide un store', async () => {
        await db.saveFood('a', { name: 'A' });
        await db.clearStore('foods');
        expect(await db.getAllFromStore('foods')).toEqual([]);
    });

    it('bulkPut insère plusieurs enregistrements', async () => {
        await db.bulkPut('foods', [
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
        ]);
        expect(await db.getAllFromStore('foods')).toHaveLength(2);
    });

    it('bulkPut avec un tableau vide ne fait rien et ne bloque pas', async () => {
        await expect(db.bulkPut('foods', [])).resolves.toBeUndefined();
        expect(await db.getAllFromStore('foods')).toEqual([]);
    });

    it('rejette pour un store inexistant', async () => {
        await expect(db.getAllFromStore('store-inexistant')).rejects.toBeTruthy();
    });
});

describe('db.replaceFoodId', () => {
    it('remplace l’id dans les aliments et dans les repas journaliers', async () => {
        const date = localDate(2026, 4, 1);
        await db.saveFood('ancien-id', { name: 'Poulet' });
        await db.saveDayMeals(date, { 'petit-dej': [], dejeuner: [{ id: 'ancien-id', weight: 100, uniqueId: 1 }], diner: [], snack: [] });

        await db.replaceFoodId('ancien-id', 'nouvel-id', { name: 'Poulet grille', calories: 200 });

        const foods = await db.loadFoods();
        expect(foods['ancien-id']).toBeUndefined();
        expect(foods['nouvel-id'].name).toBe('Poulet grille');

        const meals = await db.loadDayMeals(date);
        expect(meals.dejeuner[0].id).toBe('nouvel-id');
    });

    it('ne laisse pas un champ id du nouvel aliment écraser le nouvel id', async () => {
        await db.saveFood('ancien-id', { name: 'Poulet' });
        await db.replaceFoodId('ancien-id', 'nouvel-id', { id: 'valeur-piege', name: 'Poulet' });
        const foods = await db.loadFoods();
        expect(foods['nouvel-id']).toBeDefined();
        expect(foods['valeur-piege']).toBeUndefined();
    });

    it('fonctionne même si aucun repas journalier ne référence l’aliment', async () => {
        await db.saveFood('a', { name: 'A' });
        await expect(db.replaceFoodId('a', 'b', { name: 'B' })).resolves.toBeUndefined();
    });
});

describe('db — hydratation', () => {
    const date = localDate(2026, 5, 1);

    it('retourne une valeur par défaut pour un jour sans données', async () => {
        expect(await db.loadDayWater(date)).toEqual({ totalMl: 0, history: [] });
    });

    it('sauvegarde et recharge l’hydratation', async () => {
        await db.saveDayWater(date, { totalMl: 1500, history: [{ ml: 500 }, { ml: 1000 }] });
        const water = await db.loadDayWater(date);
        expect(water.totalMl).toBe(1500);
        expect(water.history).toHaveLength(2);
        expect(water.date).toBeUndefined();
    });

    it('loadPeriodWater retourne le nombre de jours demandé, dans l’ordre chronologique', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayWater(today, { totalMl: 2000, history: [] });
        const data = await db.loadPeriodWater(7);
        expect(data).toHaveLength(7);
        expect(data[6].totalMl).toBe(2000);
        expect(data[0].date < data[6].date).toBe(true);
    });
});

describe('db — pas', () => {
    const date = localDate(2026, 5, 2);

    it('retourne 0 pour un jour sans données', async () => {
        expect(await db.loadDaySteps(date)).toBe(0);
    });

    it('sauvegarde et recharge les pas', async () => {
        await db.saveDaySteps(date, 8500);
        expect(await db.loadDaySteps(date)).toBe(8500);
    });

    it('loadPeriodSteps retourne le nombre de jours demandé', async () => {
        const data = await db.loadPeriodSteps(5);
        expect(data).toHaveLength(5);
        expect(data.every((d) => d.steps === 0)).toBe(true);
    });
});

describe('db — activités', () => {
    const date = localDate(2026, 5, 3);

    it('retourne un tableau vide pour un jour sans activité', async () => {
        expect(await db.loadDayActivities(date)).toEqual([]);
    });

    it('sauvegarde et recharge les activités', async () => {
        await db.saveDayActivities(date, [{ type: 'Course', calories: 300, duration: 30 }]);
        const activities = await db.loadDayActivities(date);
        expect(activities).toHaveLength(1);
        expect(activities[0].calories).toBe(300);
    });

    it('gère les activités personnalisées avec auto-incrément', async () => {
        const id1 = await db.saveCustomActivity('Escalade');
        const id2 = await db.saveCustomActivity('Boxe');
        expect(id1).not.toBe(id2);

        const list = await db.loadCustomActivities();
        expect(list).toHaveLength(2);

        await db.deleteCustomActivity(id1);
        const after = await db.loadCustomActivities();
        expect(after).toHaveLength(1);
        expect(after[0].name).toBe('Boxe');
    });
});

describe('db.getStatsReferenceEndDate', () => {
    it('retourne aujourd’hui quand aucune donnée n’est enregistrée', async () => {
        const end = await db.getStatsReferenceEndDate();
        expect(formatDateKey(end)).toBe(formatDateKey(new Date()));
    });

    it('retourne la date la plus récente trouvée dans les stores', async () => {
        const future = new Date();
        future.setDate(future.getDate() + 10);
        await db.saveDayMeals(future, dayFixture());
        const end = await db.getStatsReferenceEndDate();
        expect(formatDateKey(end)).toBe(formatDateKey(future));
    });

    it('ignore les enregistrements sans date exploitable', async () => {
        await db.bulkPut('dailyWater', [{ date: '', totalMl: 500 }]);
        const end = await db.getStatsReferenceEndDate();
        expect(formatDateKey(end)).toBe(formatDateKey(new Date()));
    });
});

describe('db.loadPeriodMeals & loadMealsByDateRange', () => {
    it('loadPeriodMeals retourne le bon nombre de jours et les totaux nutritionnels', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayMeals(today, dayFixture(), 70);

        const foods = foodsFixture();
        const data = await db.loadPeriodMeals(7, foods);

        expect(data).toHaveLength(7);
        const last = data[6];
        expect(last.date).toBe(formatDateKey(today));
        expect(last.weight).toBe(70);
        expect(last.calories).toBeCloseTo(52 * 1.5 + 165 * 2 + 350, 4);
    });

    it('loadPeriodMeals calcule les calories brûlées et nettes', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayMeals(today, dayFixture());
        await db.saveDayActivities(today, [{ type: 'Course', calories: 300, duration: 30 }]);

        const foods = foodsFixture();
        const data = await db.loadPeriodMeals(3, foods);
        const last = data[2];
        expect(last.caloriesBurned).toBe(300);
        expect(last.activityCount).toBe(1);
        expect(last.activityDuration).toBe(30);
        expect(last.netCalories).toBeCloseTo(last.calories - 300, 4);
    });

    it('loadMealsByDateRange couvre la plage demandée, bornes incluses', async () => {
        const start = localDate(2026, 6, 1);
        const end = localDate(2026, 6, 4);
        const data = await db.loadMealsByDateRange(start, end, foodsFixture());
        expect(data).toHaveLength(4);
        expect(data[0].date).toBe('2026-06-01');
        expect(data[3].date).toBe('2026-06-04');
    });

    it('loadMealsByDateRange gère une plage d’un seul jour', async () => {
        const d = localDate(2026, 6, 10);
        const data = await db.loadMealsByDateRange(d, d, foodsFixture());
        expect(data).toHaveLength(1);
    });

    it('loadMealsByDateRange retourne un tableau vide si la fin précède le début', async () => {
        const data = await db.loadMealsByDateRange(localDate(2026, 6, 10), localDate(2026, 6, 1), foodsFixture());
        expect(data).toEqual([]);
    });
});

describe('db.loadAverages', () => {
    it('produit le nombre de périodes demandé en mode semaine', async () => {
        const avg = await db.loadAverages('week', 4, foodsFixture());
        expect(avg).toHaveLength(4);
        expect(avg[0].label).toMatch(/→/);
    });

    it('produit le nombre de périodes demandé en mode mois', async () => {
        const avg = await db.loadAverages('month', 3, foodsFixture());
        expect(avg).toHaveLength(3);
        expect(avg[2].label).toMatch(/\d{4}/);
    });

    it('calcule la moyenne des calories des jours de la période', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayMeals(today, dayFixture());

        const avg = await db.loadAverages('week', 1, foodsFixture());
        const caloriesJour = 52 * 1.5 + 165 * 2 + 350;
        // La semaine en cours inclut aujourd'hui : la moyenne ne peut pas dépasser
        // le total du jour, et doit être strictement positive.
        expect(avg[0].avgCalories).toBeGreaterThan(0);
        expect(avg[0].avgCalories).toBeLessThanOrEqual(caloriesJour);
    });

    it('exclut les journées filtrées par dayFilter', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayMeals(today, dayFixture());

        const sansFiltre = await db.loadAverages('week', 1, foodsFixture());
        const toutExclu = await db.loadAverages('week', 1, foodsFixture(), {}, () => false);

        expect(toutExclu[0].avgCalories).toBe(0);
        expect(sansFiltre[0].avgCalories).toBeGreaterThan(0);
    });

    it('retourne null pour le poids et le ventre quand aucune mesure n’existe', async () => {
        const avg = await db.loadAverages('week', 1, foodsFixture());
        expect(avg[0].avgWeight).toBeNull();
        expect(avg[0].avgBelly).toBeNull();
    });

    it('moyenne le poids et le ventre quand des mesures existent', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        await db.saveDayWeight(today, 70);
        await db.saveDayBelly(today, 80);

        const avg = await db.loadAverages('week', 1, foodsFixture());
        expect(avg[0].avgWeight).toBe(70);
        expect(avg[0].avgBelly).toBe(80);
    });

    it('les périodes mensuelles sont consécutives, sans mois manquant', async () => {
        const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        const now = new Date();
        const avg = await db.loadAverages('month', 6, foodsFixture());

        expect(avg).toHaveLength(6);
        for (let i = 0; i < 6; i++) {
            const p = 5 - i; // p mois en arrière
            const attendu = new Date(now.getFullYear(), now.getMonth() - p, 1);
            expect(avg[i].label, `période p=${p}`).toBe(`${MONTHS[attendu.getMonth()]} ${attendu.getFullYear()}`);
        }
    });
});

describe('db — préservation des champs inconnus et migration des lignes', () => {
    it('saveDayMeals préserve les champs qu’il ne connaît pas (ex. mealTimes)', async () => {
        const date = localDate(2026, 7, 1);
        // Écriture directe d'un enregistrement enrichi (comme le fait un import)
        await db.bulkPut('dailyMeals', [{
            date: '2026-07-01',
            meals: { 'petit-dej': [], dejeuner: [], diner: [], snack: [] },
            mealTimes: { 'petit-dej': '07:30', dejeuner: '12:00' },
            note: 'champ inconnu',
        }]);

        await db.saveDayMeals(date, dayFixture());

        const raw = (await db.getAllFromStore('dailyMeals')).find((d) => d.date === '2026-07-01');
        expect(raw.mealTimes).toEqual({ 'petit-dej': '07:30', dejeuner: '12:00' });
        expect(raw.note).toBe('champ inconnu');
    });

    it('saveDayMeals conserve un poids de 0 au lieu de l’effacer', async () => {
        const date = localDate(2026, 7, 2);
        await db.saveDayMeals(date, dayFixture(), 0);
        const raw = (await db.getAllFromStore('dailyMeals')).find((d) => d.date === '2026-07-02');
        expect(raw.weight).toBe(0);
    });

    it('loadDayMeals normalise les anciennes lignes foodId/uid', async () => {
        await db.bulkPut('dailyMeals', [{
            date: '2026-07-03',
            meals: {
                'petit-dej': [{ foodId: 'poulet', uid: 'abc-1', weight: 80 }],
                dejeuner: [], diner: [], snack: [],
            },
        }]);

        const meals = await db.loadDayMeals(localDate(2026, 7, 3));
        expect(meals['petit-dej'][0].id).toBe('poulet');
        expect(meals['petit-dej'][0].uniqueId).toBe('abc-1');
    });

    it('loadDayMeals retourne les repas par défaut si l’enregistrement n’a pas de champ meals', async () => {
        await db.bulkPut('dailyMeals', [{ date: '2026-07-04', weight: 70 }]);
        const meals = await db.loadDayMeals(localDate(2026, 7, 4));
        expect(meals).toEqual({ 'petit-dej': [], dejeuner: [], diner: [], snack: [] });
    });

    it('migrateLegacyMealItemIds convertit et persiste les anciennes lignes', async () => {
        await db.bulkPut('dailyMeals', [{
            date: '2026-07-05',
            meals: {
                'petit-dej': [{ foodId: 'poulet', uid: 'u-1', weight: 80 }],
                dejeuner: [{ id: 'riz', uniqueId: 'u-2', weight: 100 }],
                diner: [], snack: [],
            },
        }]);

        const migrated = await db.migrateLegacyMealItemIds();

        expect(migrated).toBe(1);
        const raw = (await db.getAllFromStore('dailyMeals')).find((d) => d.date === '2026-07-05');
        expect(raw.meals['petit-dej'][0].id).toBe('poulet');
        expect(raw.meals['petit-dej'][0].uniqueId).toBe('u-1');
        // La ligne déjà au bon format n'est pas altérée
        expect(raw.meals.dejeuner[0].id).toBe('riz');
    });

    it('migrateLegacyMealItemIds est idempotent', async () => {
        await db.bulkPut('dailyMeals', [{
            date: '2026-07-06',
            meals: { 'petit-dej': [{ foodId: 'poulet', uid: 'u-1', weight: 80 }], dejeuner: [], diner: [], snack: [] },
        }]);

        expect(await db.migrateLegacyMealItemIds()).toBe(1);
        expect(await db.migrateLegacyMealItemIds()).toBe(0);
    });
});
