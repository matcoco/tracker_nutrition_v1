// exemple-prix.js
// Exemple de fichier pour mettre à jour les prix en lot
// Copiez cet objet dans la console et exécutez : dbBulkPrices(pricesData)

const pricesData = {
    // Format: "id-aliment": { price: PRIX_EN_EUROS, priceGrams: POIDS_EN_GRAMMES }
    
    // Exemples avec les aliments par défaut de l'app:
    "haricots-verts": { price: 2.99, priceGrams: 1000 },
    "comté": { price: 18.90, priceGrams: 1000 },
    "pain-complet": { price: 2.50, priceGrams: 500 },
    "riz-basmati": { price: 3.99, priceGrams: 1000 },
    "poulet-blanc": { price: 12.90, priceGrams: 1000 },
    "saumon-frais": { price: 24.90, priceGrams: 1000 },
    "oeufs": { price: 3.50, priceGrams: 600 },  // Prix pour 6 œufs (100g/œuf)
    "avocat": { price: 1.99, priceGrams: 200 },  // Prix par avocat moyen
    "banane": { price: 1.79, priceGrams: 1000 },
    "pomme": { price: 2.49, priceGrams: 1000 },
    "tomate": { price: 3.49, priceGrams: 1000 },
    "lait-demi-écremé": { price: 1.19, priceGrams: 1000 },
    "yaourt-nature": { price: 0.50, priceGrams: 125 },
    "flocons-avoine": { price: 2.99, priceGrams: 1000 },
    "pâtes-complètes": { price: 1.99, priceGrams: 500 },
    "huile-olive": { price: 8.99, priceGrams: 750 },
    "brocoli": { price: 2.99, priceGrams: 500 },
    "épinards": { price: 2.49, priceGrams: 500 },
    "lentilles-corail": { price: 2.99, priceGrams: 500 },
    "pois-chiches": { price: 1.99, priceGrams: 500 },
    "amandes": { price: 9.99, priceGrams: 500 },
    "noix": { price: 8.99, priceGrams: 400 },
    "chocolat-noir": { price: 2.99, priceGrams: 100 },
    "miel": { price: 6.99, priceGrams: 500 },
    "beurre": { price: 3.49, priceGrams: 250 },
    "fromage-blanc": { price: 1.99, priceGrams: 500 },
    "thon-boite": { price: 2.49, priceGrams: 160 },
    "sardines": { price: 1.99, priceGrams: 120 },
    "patate-douce": { price: 2.99, priceGrams: 1000 },
    "quinoa": { price: 4.99, priceGrams: 500 },
    "courgette": { price: 1.99, priceGrams: 1000 },
    "poivron-rouge": { price: 1.49, priceGrams: 200 },
    "concombre": { price: 0.99, priceGrams: 400 },
    "salade-verte": { price: 1.29, priceGrams: 200 },
    "carotte": { price: 1.49, priceGrams: 1000 },
    "orange": { price: 2.99, priceGrams: 1000 },
    "kiwi": { price: 3.99, priceGrams: 1000 },
    "fraise": { price: 4.99, priceGrams: 500 },
    "raisin-noir": { price: 4.99, priceGrams: 500 },
    "raisin-vert": { price: 4.99, priceGrams: 500 }
};

console.log('📋 Exemple de données de prix chargé !');
console.log('📝 Pour mettre à jour la base de données, exécutez:');
console.log('   dbBulkPrices(pricesData)');
console.log('\n💡 Vous pouvez modifier les prix ci-dessus selon vos besoins.');
