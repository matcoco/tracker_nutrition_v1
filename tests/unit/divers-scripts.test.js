// tests/unit/divers-scripts.test.js
// Tests des scripts utilitaires du dossier divers/ (désormais importables).

import { describe, it, expect } from 'vitest';
import { convertPriceFields, fixBackup } from '../../divers/fix-backup-format.js';
import { pricesData } from '../../divers/exemple-prix.js';

describe('fix-backup-format.convertPriceFields', () => {
    it('convertit l’ancien format vers le format actuel', () => {
        const aliment = { id: 'riz', name: 'Riz', price: 3, priceGrams: 1000 };
        expect(convertPriceFields(aliment)).toBe(true);
        expect(aliment.priceQuantity).toBe(1000);
        expect(aliment.priceUnit).toBe('grams');
        expect(aliment).not.toHaveProperty('priceGrams');
    });

    it('ne remplace JAMAIS un priceQuantity déjà renseigné', () => {
        // C'est le bug historique : l'ancienne version écrasait la valeur du
        // format actuel par celle du format obsolète.
        const aliment = { id: 'orange', name: 'Orange', price: 2.89, priceQuantity: 1500, priceUnit: 'grams', priceGrams: 1000 };
        expect(convertPriceFields(aliment)).toBe(true);
        expect(aliment.priceQuantity).toBe(1500);
        expect(aliment).not.toHaveProperty('priceGrams');
    });

    it('utilise la valeur historique quand le priceQuantity présent est inexploitable', () => {
        // priceQuantity = 0 n'est pas un prix valide : la quantité historique
        // exploitable prend le relais, sans fabriquer de prix.
        const aliment = { priceQuantity: 0, priceGrams: 500 };
        convertPriceFields(aliment);
        expect(aliment.priceQuantity).toBe(500);
        expect(aliment).not.toHaveProperty('priceGrams');
    });

    it('retire une valeur historique inexploitable sans créer de prix', () => {
        const aliment = { name: 'X', priceGrams: 'beaucoup' };
        expect(convertPriceFields(aliment)).toBe(true);
        expect(aliment).not.toHaveProperty('priceGrams');
        expect(aliment.priceQuantity).toBeUndefined();
    });

    it('convertit une chaîne numérique en nombre', () => {
        const aliment = { name: 'Y', priceGrams: '250' };
        convertPriceFields(aliment);
        expect(aliment.priceQuantity).toBe(250);
        expect(typeof aliment.priceQuantity).toBe('number');
    });

    it('préserve l’unité « portions »', () => {
        const aliment = { name: 'Œufs', priceGrams: 300, priceUnit: 'portions', portionWeight: 50 };
        convertPriceFields(aliment);
        expect(aliment.priceUnit).toBe('portions');
    });

    it('ne modifie rien quand il n’y a pas de champ historique', () => {
        const aliment = { id: 'poulet', price: 10, priceQuantity: 1000, priceUnit: 'grams' };
        expect(convertPriceFields(aliment)).toBe(false);
        expect(aliment).toEqual({ id: 'poulet', price: 10, priceQuantity: 1000, priceUnit: 'grams' });
    });

    it('ne lève pas sur une entrée invalide', () => {
        expect(convertPriceFields(null)).toBe(false);
        expect(convertPriceFields(undefined)).toBe(false);
        expect(convertPriceFields('texte')).toBe(false);
    });

    it('n’invente pas isPortionBased ni portionWeight', () => {
        const aliment = { id: 'riz', price: 3, priceGrams: 1000 };
        convertPriceFields(aliment);
        expect(aliment).not.toHaveProperty('isPortionBased');
        expect(aliment).not.toHaveProperty('portionWeight');
    });
});

describe('fix-backup-format.fixBackup', () => {
    const sauvegarde = () => ({
        version: '1.4.0',
        foods: [
            { id: 'riz', name: 'Riz', calories: 350, price: 3, priceGrams: 1000 },
            { id: 'orange', name: 'Orange', calories: 47, price: 2.89, priceQuantity: 1500, priceUnit: 'grams', priceGrams: 1000 },
            { id: 'poulet', name: 'Poulet', calories: 165 },
        ],
        meals: [
            { id: 'poulet-riz', name: 'Poulet riz', price: 5, priceGrams: 400, totalWeight: 400 },
            { id: 'salade', name: 'Salade', price: 1.2, priceQuantity: 100, priceUnit: 'grams' },
        ],
        dailyMeals: [{ date: '2025-10-01', meals: { 'petit-dej': [], dejeuner: [], diner: [], snack: [] } }],
    });

    it('corrige les aliments ET les repas composés', () => {
        const data = sauvegarde();
        const report = fixBackup(data);

        expect(report.foods.total).toBe(3);
        expect(report.foods.converted).toBe(2); // riz + orange (retrait du champ obsolète)
        expect(report.meals.total).toBe(2);
        expect(report.meals.converted).toBe(1); // poulet-riz

        expect(data.foods[0].priceQuantity).toBe(1000);
        expect(data.meals[0].priceQuantity).toBe(400);
        expect(data.meals[0].priceUnit).toBe('grams');
    });

    it('ne touche ni aux valeurs nutritionnelles ni aux journées', () => {
        const data = sauvegarde();
        const avant = JSON.parse(JSON.stringify(data.dailyMeals));
        fixBackup(data);
        expect(data.foods[0].calories).toBe(350);
        expect(data.foods[0].name).toBe('Riz');
        expect(data.dailyMeals).toEqual(avant);
    });

    it('ne laisse aucun champ priceGrams après passage', () => {
        const data = sauvegarde();
        fixBackup(data);
        const restants = JSON.stringify(data).match(/priceGrams/g);
        expect(restants).toBeNull();
    });

    it('est idempotent', () => {
        const data = sauvegarde();
        fixBackup(data);
        const apresUnePasse = JSON.parse(JSON.stringify(data));
        const secondRapport = fixBackup(data);
        expect(secondRapport.foods.converted).toBe(0);
        expect(secondRapport.meals.converted).toBe(0);
        expect(data).toEqual(apresUnePasse);
    });

    it('accepte les aliments sous forme de dictionnaire', () => {
        const data = { foods: { riz: { name: 'Riz', priceGrams: 1000 } }, dailyMeals: [] };
        const report = fixBackup(data);
        expect(report.foods.total).toBe(1);
        expect(Array.isArray(data.foods)).toBe(true);
        expect(data.foods[0].id).toBe('riz');
        expect(data.foods[0].priceQuantity).toBe(1000);
    });

    it('ignore les entrées invalides sans planter', () => {
        const data = { foods: [null, { id: 'ok', name: 'OK', priceGrams: 500 }, 'texte'], dailyMeals: [] };
        const report = fixBackup(data);
        expect(report.skipped.length).toBe(2);
        expect(data.foods[1].priceQuantity).toBe(500);
    });

    it('lève sur une sauvegarde sans champ foods exploitable', () => {
        expect(() => fixBackup(null)).toThrow(/Sauvegarde invalide/);
        expect(() => fixBackup({ dailyMeals: [] })).toThrow(/foods/);
    });

    it('fonctionne si les repas composés sont absents', () => {
        const data = { foods: [{ id: 'a', priceGrams: 100 }], dailyMeals: [] };
        const report = fixBackup(data);
        expect(report.meals.total).toBe(0);
        expect(report.foods.converted).toBe(1);
    });
});

describe('divers/exemple-prix.js', () => {
    it('est importable et expose un objet de prix', () => {
        expect(pricesData).toBeTypeOf('object');
        expect(Object.keys(pricesData).length).toBeGreaterThan(0);
    });

    it('utilise le format de prix actuel (priceQuantity + priceUnit)', () => {
        for (const [id, info] of Object.entries(pricesData)) {
            expect(info.price, id).toBeGreaterThan(0);
            expect(Number.isFinite(info.priceQuantity), id).toBe(true);
            expect(info.priceQuantity, id).toBeGreaterThan(0);
            expect(['grams', 'portions'], id).toContain(info.priceUnit);
            expect(info, id).not.toHaveProperty('priceGrams');
        }
    });

    it('fournit un poids de portion pour chaque prix exprimé en portions', () => {
        for (const [id, info] of Object.entries(pricesData)) {
            if (info.priceUnit !== 'portions') continue;
            expect(Number.isFinite(info.portionWeight), id).toBe(true);
            expect(info.portionWeight, id).toBeGreaterThan(0);
        }
    });

    it('utilise des identifiants ASCII (compatibles avec generateFoodId)', () => {
        for (const id of Object.keys(pricesData)) {
            expect(id, id).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it('donne des prix au 100 g plausibles (0,05 € à 15 €)', () => {
        for (const [id, info] of Object.entries(pricesData)) {
            const grams = info.priceUnit === 'portions'
                ? info.priceQuantity * info.portionWeight
                : info.priceQuantity;
            const prixPour100g = (info.price / grams) * 100;
            expect(prixPour100g, id).toBeGreaterThan(0.05);
            expect(prixPour100g, id).toBeLessThan(15);
        }
    });
});
