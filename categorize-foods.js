// Script pour catégoriser automatiquement les aliments
const fs = require('fs');
const path = require('path');

// Lire le fichier JSON
const backupFile = path.join(__dirname, 'nutrition-tracker-backup-2025-11-01.json');
const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

// Règles de catégorisation intelligentes
function categorizeFood(food) {
    const name = food.name.toLowerCase();
    
    // === PROTÉINES (🥩) ===
    if (
        name.includes('poulet') || name.includes('blanc de poulet') || name.includes('grignotte') ||
        name.includes('boeuf') || name.includes('steack') || name.includes('steak') || name.includes('charal') ||
        name.includes('morue') || name.includes('accras') ||
        name.includes('thon') || name.includes('sardine') || name.includes('saumon') ||
        name.includes('oeuf') || name.includes('jaune d') ||
        name.includes('protéine') || name.includes('soja textur') ||
        name.includes('carpaccio')
    ) {
        return 'proteins';
    }
    
    // === FÉCULENTS (🍚) ===
    if (
        name.includes('riz') || name.includes('pâte') || name.includes('pasta') ||
        name.includes('pain') || name.includes('baguette') || name.includes('brioche') ||
        name.includes('pomme de terre') || name.includes('frite') || name.includes('potatoes') ||
        name.includes('farine') || name.includes('penne') || name.includes('fusilli') ||
        name.includes('nouille') || name.includes('udon') ||
        name.includes('lentille') || name.includes('haricot rouge') ||
        name.includes('châtaigne') || name.includes('chataigne')
    ) {
        return 'starches';
    }
    
    // === LÉGUMES (🥦) ===
    if (
        name.includes('brocoli') || name.includes('haricot vert') ||
        name.includes('champignon') || name.includes('poivron') ||
        name.includes('poireau') || name.includes('oignon') ||
        name.includes('petit pois') || name.includes('sucrine') ||
        name.includes('olive') || name.includes('légume') ||
        name.includes('poêlée') || name.includes('ail gingembre')
    ) {
        return 'vegetables';
    }
    
    // === FRUITS (🍎) ===
    if (
        name.includes('pomme') || name.includes('kiwi') ||
        name.includes('orange') || name.includes('raisin') ||
        name.includes('fruit') || name.includes('gala')
    ) {
        return 'fruits';
    }
    
    // === PRODUITS LAITIERS (🥛) ===
    if (
        name.includes('fromage') || name.includes('comté') ||
        name.includes('raclette') || name.includes('tomme') ||
        name.includes('saint nectaire') || name.includes('ricotta') ||
        name.includes('lait') || name.includes('skyr')
    ) {
        return 'dairy';
    }
    
    // === MATIÈRES GRASSES (🥑) ===
    if (
        name.includes('huile') || name.includes('beurre') ||
        name.includes('amande') || name.includes('noix') ||
        name.includes('crème de soja')
    ) {
        return 'fats';
    }
    
    // === BOISSONS (🥤) ===
    if (
        name.includes('coca') || name.includes('fanta') ||
        name.includes('jus') || name.includes('eau') ||
        name.includes('scheppes') || name.includes('tonic') ||
        name.includes('sake') || name.includes('rhum') ||
        name.includes('kieffer') || name.includes('mirin')
    ) {
        return 'beverages';
    }
    
    // === SNACKS & SUCRERIES (🍫) ===
    if (
        name.includes('burger') || name.includes('mcdo') || name.includes('mcdonald') ||
        name.includes('mcflurry') || name.includes('mcextreme') ||
        name.includes('pizza') || name.includes('sandwich') ||
        name.includes('biscuit') || name.includes('chocolat') ||
        name.includes('pain au chocolat') || name.includes('pâte à tartiner') ||
        name.includes('sucre') || name.includes('tablette') ||
        name.includes('petit beurre') || name.includes('gerblé')
    ) {
        return 'snacks';
    }
    
    // === CAS SPÉCIAUX (basés sur les macros) ===
    // Si très riche en protéines (>15g/100g) et pas de glucides
    if (food.proteins > 15 && food.carbs < 2) {
        return 'proteins';
    }
    
    // Si très riche en lipides (>80g/100g)
    if (food.fats > 80) {
        return 'fats';
    }
    
    // Si très riche en glucides (>60g/100g) et pas protéines
    if (food.carbs > 60 && food.proteins < 15) {
        return 'starches';
    }
    
    // === AUTRES (📦) ===
    // Condiments et ingrédients spéciaux
    if (
        name.includes('sauce') || name.includes('miso') ||
        name.includes('levure') || name.includes('sel') ||
        name.includes('son de blé') || name.includes('tarte')
    ) {
        return 'other';
    }
    
    // Par défaut : other
    return 'other';
}

// Catégoriser tous les aliments
let categorized = 0;
let alreadyCategorized = 0;

data.foods.forEach(food => {
    if (!food.category) {
        food.category = categorizeFood(food);
        categorized++;
    } else {
        alreadyCategorized++;
    }
});

// Statistiques par catégorie
const stats = {
    proteins: 0,
    starches: 0,
    vegetables: 0,
    fruits: 0,
    dairy: 0,
    fats: 0,
    beverages: 0,
    snacks: 0,
    other: 0
};

data.foods.forEach(food => {
    stats[food.category]++;
});

// Écrire le fichier mis à jour
const outputFile = path.join(__dirname, 'nutrition-tracker-backup-2025-11-01-categorized.json');
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');

// Afficher les résultats
console.log('✅ Catégorisation terminée !');
console.log(`\n📊 ${categorized} aliments catégorisés`);
console.log(`⏭️  ${alreadyCategorized} aliments déjà catégorisés`);
console.log(`\n🏷️  Répartition par catégorie :`);
console.log(`   🥩 Protéines: ${stats.proteins}`);
console.log(`   🍚 Féculents: ${stats.starches}`);
console.log(`   🥦 Légumes: ${stats.vegetables}`);
console.log(`   🍎 Fruits: ${stats.fruits}`);
console.log(`   🥛 Produits laitiers: ${stats.dairy}`);
console.log(`   🥑 Matières grasses: ${stats.fats}`);
console.log(`   🥤 Boissons: ${stats.beverages}`);
console.log(`   🍫 Snacks & Sucreries: ${stats.snacks}`);
console.log(`   📦 Autre: ${stats.other}`);
console.log(`\n📁 Fichier généré : ${outputFile}`);
console.log(`\n💡 Remplacez votre fichier de backup actuel par ce nouveau fichier pour l'importer dans l'application !`);
