// js/db-utils.js - Utilitaires pour diagnostiquer et réparer la base de données

import * as db from './db.js';

/**
 * Diagnostique la base de données et affiche les informations
 */
export async function diagnoseBD() {
    console.log('=== DIAGNOSTIC DE LA BASE DE DONNÉES ===\n');
    
    try {
        const foods = await db.loadFoods();
        const foodsArray = Object.entries(foods);
        
        console.log(`📦 Nombre total d'aliments: ${foodsArray.length}\n`);
        
        // Vérifier combien d'aliments ont un prix
        const foodsWithPrice = foodsArray.filter(([id, food]) => food.price && food.priceGrams);
        const foodsWithoutPrice = foodsArray.filter(([id, food]) => !food.price || !food.priceGrams);
        
        console.log(`💰 Aliments avec prix: ${foodsWithPrice.length}`);
        console.log(`❌ Aliments sans prix: ${foodsWithoutPrice.length}\n`);
        
        if (foodsWithPrice.length > 0) {
            console.log('✅ Exemples d\'aliments avec prix:');
            foodsWithPrice.slice(0, 3).forEach(([id, food]) => {
                console.log(`  - ${food.name}: ${food.price}€ pour ${food.priceGrams}g`);
            });
        }
        
        console.log('\n=== STRUCTURE DES DONNÉES ===');
        if (foodsArray.length > 0) {
            console.log('Exemple de structure d\'un aliment:');
            console.log(foodsArray[0][1]);
        }
        
        return {
            total: foodsArray.length,
            withPrice: foodsWithPrice.length,
            withoutPrice: foodsWithoutPrice.length,
            foods: foods
        };
    } catch (error) {
        console.error('❌ Erreur lors du diagnostic:', error);
        return null;
    }
}

/**
 * Ajoute le prix manquant à un aliment spécifique
 */
export async function ajouterPrix(foodId, price, priceGrams) {
    try {
        const foods = await db.loadFoods();
        const food = foods[foodId];
        
        if (!food) {
            console.error(`❌ Aliment "${foodId}" non trouvé`);
            return false;
        }
        
        food.price = parseFloat(price);
        food.priceGrams = parseInt(priceGrams);
        
        await db.saveFood(foodId, food);
        console.log(`✅ Prix ajouté à "${food.name}": ${price}€ pour ${priceGrams}g`);
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de l\'ajout du prix:', error);
        return false;
    }
}

/**
 * Exporte tous les aliments dans un format lisible
 */
export async function exporterAliments() {
    try {
        const foods = await db.loadFoods();
        const foodsArray = Object.entries(foods).map(([id, food]) => ({
            id,
            name: food.name,
            calories: food.calories,
            proteins: food.proteins,
            carbs: food.carbs,
            fats: food.fats,
            fibers: food.fibers || 0,
            sugars: food.sugars || 0,
            price: food.price || null,
            priceGrams: food.priceGrams || null
        }));
        
        console.log('📊 Export des aliments:');
        console.table(foodsArray);
        
        // Créer un fichier JSON
        const dataStr = JSON.stringify(foodsArray, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aliments-diagnostic-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('✅ Fichier d\'export téléchargé');
        return foodsArray;
    } catch (error) {
        console.error('❌ Erreur lors de l\'export:', error);
        return null;
    }
}

/**
 * Vérifie l'intégrité de tous les stores
 */
export async function verifierIntegrite() {
    console.log('=== VÉRIFICATION D\'INTÉGRITÉ ===\n');
    
    const stores = [
        'foods',
        'dailyMeals', 
        'goals',
        'dailyWater',
        'dailySteps',
        'dailyActivities',
        'customActivities'
    ];
    
    for (const storeName of stores) {
        try {
            const data = await db.getAllFromStore(storeName);
            console.log(`✅ ${storeName}: ${data.length} entrées`);
        } catch (error) {
            console.log(`❌ ${storeName}: ERREUR - ${error.message}`);
        }
    }
}

/**
 * Met à jour la structure de tous les aliments pour ajouter price et priceGrams
 * Si ces champs existent déjà, ils ne sont pas modifiés
 */
export async function ajouterChampsPrix() {
    console.log('=== MISE À JOUR DE LA STRUCTURE DES ALIMENTS ===\n');
    
    try {
        const foods = await db.loadFoods();
        const foodsArray = Object.entries(foods);
        let updated = 0;
        let alreadyHad = 0;
        
        console.log(`📦 Traitement de ${foodsArray.length} aliments...\n`);
        
        for (const [id, food] of foodsArray) {
            let needsUpdate = false;
            
            // Ajouter le champ price s'il n'existe pas
            if (!food.hasOwnProperty('price')) {
                food.price = null;
                needsUpdate = true;
            }
            
            // Ajouter le champ priceGrams s'il n'existe pas
            if (!food.hasOwnProperty('priceGrams')) {
                food.priceGrams = null;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await db.saveFood(id, food);
                updated++;
                console.log(`✅ Mis à jour: ${food.name}`);
            } else {
                alreadyHad++;
            }
        }
        
        console.log('\n=== RÉSULTAT ===');
        console.log(`✅ Aliments mis à jour: ${updated}`);
        console.log(`ℹ️  Aliments déjà à jour: ${alreadyHad}`);
        console.log(`📊 Total: ${foodsArray.length}\n`);
        
        // Re-diagnostiquer
        console.log('📊 Nouveau diagnostic:');
        await diagnoseBD();
        
        return { updated, alreadyHad, total: foodsArray.length };
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour:', error);
        return null;
    }
}

/**
 * Met à jour les prix par lots à partir d'un objet
 * @param {Object} pricesData - Objet avec structure { "food-id": { price: 2.5, priceGrams: 1000 } }
 */
export async function mettreAJourPrixEnLot(pricesData) {
    console.log('=== MISE À JOUR DES PRIX EN LOT ===\n');
    
    try {
        const foods = await db.loadFoods();
        let updated = 0;
        let notFound = 0;
        
        for (const [foodId, priceInfo] of Object.entries(pricesData)) {
            if (foods[foodId]) {
                foods[foodId].price = parseFloat(priceInfo.price);
                foods[foodId].priceGrams = parseInt(priceInfo.priceGrams);
                await db.saveFood(foodId, foods[foodId]);
                console.log(`✅ ${foods[foodId].name}: ${priceInfo.price}€ / ${priceInfo.priceGrams}g`);
                updated++;
            } else {
                console.log(`❌ Aliment non trouvé: ${foodId}`);
                notFound++;
            }
        }
        
        console.log('\n=== RÉSULTAT ===');
        console.log(`✅ Prix mis à jour: ${updated}`);
        console.log(`❌ Aliments non trouvés: ${notFound}\n`);
        
        return { updated, notFound };
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour en lot:', error);
        return null;
    }
}

// Exposer les fonctions globalement pour un accès facile depuis la console
if (typeof window !== 'undefined') {
    window.dbDiagnose = diagnoseBD;
    window.dbAddPrice = ajouterPrix;
    window.dbExport = exporterAliments;
    window.dbCheck = verifierIntegrite;
    window.dbFixStructure = ajouterChampsPrix;
    window.dbBulkPrices = mettreAJourPrixEnLot;
}
