// js/db-utils.js - Utilitaires pour diagnostiquer et réparer la base de données

import * as db from './db.js';
import { hasPrice, getPricePer100g, formatDateKey } from './utils.js';

/**
 * Diagnostique la base de données et affiche les informations
 */
export async function diagnoseBD() {
    console.log('=== DIAGNOSTIC DE LA BASE DE DONNÉES ===\n');
    
    try {
        const foods = await db.loadFoods();
        const foodsArray = Object.entries(foods);
        
        console.log(`📦 Nombre total d'aliments: ${foodsArray.length}\n`);
        
        // Un aliment a un prix exploitable s'il a priceQuantity+priceUnit (format
        // actuel) OU priceGrams (ancien format). Se fier au seul priceGrams
        // classait « sans prix » tous les aliments saisis via l'interface.
        const foodsWithPrice = foodsArray.filter(([, food]) => hasPrice(food));
        const foodsWithoutPrice = foodsArray.filter(([, food]) => !hasPrice(food));

        console.log(`💰 Aliments avec prix: ${foodsWithPrice.length}`);
        console.log(`❌ Aliments sans prix: ${foodsWithoutPrice.length}\n`);

        if (foodsWithPrice.length > 0) {
            console.log('✅ Exemples d\'aliments avec prix:');
            foodsWithPrice.slice(0, 3).forEach(([, food]) => {
                const base = food.priceQuantity
                    ? `${food.priceQuantity} ${food.priceUnit === 'portions' ? 'portion(s)' : 'g'}`
                    : `${food.priceGrams} g (ancien format)`;
                console.log(`  - ${food.name}: ${food.price}€ pour ${base} (${getPricePer100g(food).toFixed(2)}€/100g)`);
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
        
        const prix = Number.parseFloat(price);
        const quantite = Number.parseInt(priceGrams, 10);
        if (!Number.isFinite(prix) || prix <= 0 || !Number.isFinite(quantite) || quantite <= 0) {
            console.error('❌ Prix invalide : nombre positif attendu pour le prix et la quantité.');
            return false;
        }

        // Format actuel : priceQuantity + priceUnit. `priceGrams` n'est plus écrit
        // (il reste lu en secours pour les données historiques).
        food.price = prix;
        food.priceQuantity = quantite;
        food.priceUnit = 'grams';
        delete food.priceGrams;

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
        // On exporte l'aliment COMPLET : la liste blanche précédente perdait
        // category, priceQuantity/priceUnit/portionWeight, glycemicIndex, etc.
        // Cet export ne remplace pas la sauvegarde complète (Paramètres →
        // « Exporter tout ») : il ne contient que les aliments.
        const foodsArray = Object.entries(foods).map(([id, food]) => ({
            id,
            ...food,
            fibers: food.fibers || 0,
            sugars: food.sugars || 0,
            price: food.price ?? null,
            pricePer100g: hasPrice(food) ? Number(getPricePer100g(food).toFixed(4)) : null
        }));
        
        console.log('📊 Export des aliments:');
        console.table(foodsArray);
        
        // Créer un fichier JSON
        const dataStr = JSON.stringify(foodsArray, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aliments-diagnostic-${formatDateKey(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
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
    
    // Les 9 stores du schéma : `meals` et `healthEvents` étaient oubliés,
    // l'outil annonçait donc « tout est sain » sans les avoir testés.
    const stores = [
        'foods',
        'meals',
        'dailyMeals',
        'goals',
        'dailyWater',
        'dailySteps',
        'dailyActivities',
        'customActivities',
        'healthEvents'
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
 * Met à jour la structure de tous les aliments pour ajouter les champs de prix
 * du format actuel (`price`, `priceQuantity`, `priceUnit`).
 * Les champs déjà présents ne sont jamais modifiés.
 */
export async function ajouterChampsPrix() {
    console.log('=== MISE À JOUR DE LA STRUCTURE DES ALIMENTS ===\n');

    try {
        const foods = await db.loadFoods();
        const foodsArray = Object.entries(foods);
        let updated = 0;
        let alreadyHad = 0;

        console.log(`📦 Traitement de ${foodsArray.length} aliments...\n`);

        // Appel indirect : un aliment peut légitimement porter une clé
        // `hasOwnProperty` (nom importé), ce qui ferait lever l'appel direct.
        const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

        for (const [id, food] of foodsArray) {
            let needsUpdate = false;

            if (!hasOwn(food, 'price')) {
                food.price = null;
                needsUpdate = true;
            }

            // Format actuel : la quantité et l'unité accompagnent le prix.
            // `priceGrams` (ancien format) n'est ni ajouté ni supprimé : il reste
            // lu en secours pour les données historiques.
            if (!hasOwn(food, 'priceQuantity')) {
                food.priceQuantity = null;
                needsUpdate = true;
            }

            if (!hasOwn(food, 'priceUnit')) {
                food.priceUnit = 'grams';
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
                const prix = Number.parseFloat(priceInfo.price);
                const quantite = Number.parseInt(priceInfo.priceGrams, 10);
                if (!Number.isFinite(prix) || prix <= 0 || !Number.isFinite(quantite) || quantite <= 0) {
                    console.log(`❌ Prix invalide pour: ${foodId}`);
                    notFound++;
                    continue;
                }
                foods[foodId].price = prix;
                foods[foodId].priceQuantity = quantite;
                foods[foodId].priceUnit = 'grams';
                delete foods[foodId].priceGrams;
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
