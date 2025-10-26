// Script de correction automatique du format de sauvegarde
// Convertit l'ancien format priceGrams vers priceQuantity + priceUnit

const fs = require('fs');
const path = require('path');

// Chemin du fichier à corriger
const inputFile = path.join(__dirname, 'nutrition-data_[nom-retire]_sauvegarde_totale.json');
const outputFile = path.join(__dirname, 'nutrition-data_[nom-retire]_sauvegarde_totale_CORRECTED.json');

console.log('🔧 Démarrage de la correction du fichier de sauvegarde...\n');

// Lire le fichier
let data;
try {
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    data = JSON.parse(fileContent);
    console.log('✅ Fichier chargé avec succès');
} catch (error) {
    console.error('❌ Erreur lors de la lecture du fichier:', error.message);
    process.exit(1);
}

// Compteurs
let totalFoods = 0;
let fixedFoods = 0;
const fixedList = [];

// Parcourir et corriger les aliments
if (data.foods && Array.isArray(data.foods)) {
    totalFoods = data.foods.length;
    console.log(`📊 ${totalFoods} aliments trouvés\n`);
    
    data.foods.forEach((food, index) => {
        let wasFixed = false;
        
        // Vérifier si l'aliment a l'ancien format priceGrams
        if (food.hasOwnProperty('priceGrams')) {
            console.log(`🔄 Correction de : ${food.name}`);
            console.log(`   Ancien: priceGrams = ${food.priceGrams}`);
            
            // Convertir vers le nouveau format
            food.priceQuantity = food.priceGrams;
            food.priceUnit = 'grams';
            
            // Supprimer l'ancienne propriété
            delete food.priceGrams;
            
            console.log(`   Nouveau: priceQuantity = ${food.priceQuantity}, priceUnit = ${food.priceUnit}`);
            
            wasFixed = true;
            fixedList.push(food.name);
        }
        
        // Ajouter les propriétés manquantes isPortionBased et portionWeight si absentes
        if (!food.hasOwnProperty('isPortionBased')) {
            food.isPortionBased = false;
            wasFixed = true;
        }
        
        if (!food.hasOwnProperty('portionWeight')) {
            food.portionWeight = null;
            wasFixed = true;
        }
        
        if (wasFixed) {
            fixedFoods++;
            console.log(`   ✅ Aliment corrigé\n`);
        }
    });
} else {
    console.error('❌ Format de fichier invalide : "foods" introuvable ou invalide');
    process.exit(1);
}

// Sauvegarder le fichier corrigé
try {
    const correctedContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(outputFile, correctedContent, 'utf8');
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Correction terminée avec succès !');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`\n📊 Statistiques :`);
    console.log(`   • Total d'aliments : ${totalFoods}`);
    console.log(`   • Aliments corrigés : ${fixedFoods}`);
    console.log(`   • Aliments déjà conformes : ${totalFoods - fixedFoods}`);
    console.log(`\n💾 Fichier sauvegardé : ${path.basename(outputFile)}`);
    console.log(`\n📋 Liste des aliments corrigés :`);
    fixedList.forEach((name, i) => {
        console.log(`   ${i + 1}. ${name}`);
    });
    console.log('\n🎉 Vous pouvez maintenant utiliser le fichier corrigé pour l\'import !');
} catch (error) {
    console.error('\n❌ Erreur lors de la sauvegarde du fichier:', error.message);
    process.exit(1);
}
