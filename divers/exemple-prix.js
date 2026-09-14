// exemple-prix.js
// Modèle pour mettre à jour les prix en lot.
//
// ⚠️ Les identifiants ci-dessous sont des EXEMPLES : ils ne correspondent pas
// forcément aux aliments de votre base (l'application démarre avec une base
// vide, `defaultFoods = {}` dans js/config.js). Remplacez-les par les vôtres :
// ouvrez la console du navigateur et exécutez `dbExport()` pour obtenir la
// liste de vos identifiants, ou inspectez un aliment dans l'onglet Aliments.
//
// Format actuel d'un prix :
//   { price, priceQuantity, priceUnit: 'grams' | 'portions', portionWeight? }
//   → « price € pour priceQuantity grammes » (ou pour priceQuantity portions
//     de portionWeight grammes).
//
// Ensuite, dans la console du navigateur :
//   dbBulkPrices(pricesData)
//
// Ce fichier est un module ES : il peut être importé par les tests.

export const pricesData = {
    // Idem « 2,99 € les 1000 g »
    'haricots-verts': { price: 2.99, priceQuantity: 1000, priceUnit: 'grams' },
    'pain-complet': { price: 2.50, priceQuantity: 500, priceUnit: 'grams' },
    'riz-basmati': { price: 3.99, priceQuantity: 1000, priceUnit: 'grams' },
    'poulet-blanc': { price: 12.90, priceQuantity: 1000, priceUnit: 'grams' },
    'saumon-frais': { price: 24.90, priceQuantity: 1000, priceUnit: 'grams' },
    'banane': { price: 1.79, priceQuantity: 1000, priceUnit: 'grams' },
    'pomme': { price: 2.49, priceQuantity: 1000, priceUnit: 'grams' },
    'tomate': { price: 3.49, priceQuantity: 1000, priceUnit: 'grams' },
    'courgette': { price: 1.99, priceQuantity: 1000, priceUnit: 'grams' },
    'patate-douce': { price: 2.29, priceQuantity: 1000, priceUnit: 'grams' },

    // Format « portions » : 3,50 € les 6 œufs de 50 g (revient à 0,058 €/100 g).
    // `portionWeight` est le poids d'UNE portion, en grammes.
    'oeufs': { price: 3.50, priceQuantity: 6, priceUnit: 'portions', portionWeight: 50 },

    // 1,99 € l'avocat de 150 g de chair.
    'avocat': { price: 1.99, priceQuantity: 1, priceUnit: 'portions', portionWeight: 150 },
};

if (typeof console !== 'undefined') {
    console.log('💡 Modèle de mise à jour des prix chargé.');
    console.log(`   ${Object.keys(pricesData).length} entrée(s) d'exemple.`);
    console.log('   Vérifiez que les identifiants existent dans VOTRE base avant d\'exécuter dbBulkPrices(pricesData).');
    console.log('   Liste de vos identifiants : exécutez dbExport() dans la console.');
}

export default pricesData;
