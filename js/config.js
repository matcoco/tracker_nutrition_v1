// js/config.js
export const DB_NAME = 'NutritionTrackerDB';
export const DB_VERSION = 7; // v7: Ajout du champ 'category' aux aliments

export const defaultActivities = [
    '🚶 Marche',
    '🏃 Course à pied',
    '🚴 Vélo',
    '🏊 Natation',
    '💪 HIIT',
    '🏋️ Musculation',
    '🧘 Yoga',
    '⚽ Sport collectif'
];

// Catégories d'aliments
export const foodCategories = {
    proteins: { 
        name: 'Protéines', 
        icon: '🥩', 
        color: '#ef4444',
        examples: 'Viandes, poissons, œufs, tofu'
    },
    starches: { 
        name: 'Féculents', 
        icon: '🍚', 
        color: '#f59e0b',
        examples: 'Riz, pâtes, pain, quinoa'
    },
    vegetables: { 
        name: 'Légumes', 
        icon: '🥦', 
        color: '#10b981',
        examples: 'Tous les légumes'
    },
    fruits: { 
        name: 'Fruits', 
        icon: '🍎', 
        color: '#f97316',
        examples: 'Tous les fruits'
    },
    dairy: { 
        name: 'Produits laitiers', 
        icon: '🥛', 
        color: '#3b82f6',
        examples: 'Lait, yaourt, fromage'
    },
    fats: { 
        name: 'Matières grasses', 
        icon: '🥑', 
        color: '#059669',
        examples: 'Huiles, beurre, noix, avocat'
    },
    beverages: { 
        name: 'Boissons', 
        icon: '🥤', 
        color: '#0ea5e9',
        examples: 'Jus, sodas, boissons protéinées'
    },
    snacks: { 
        name: 'Snacks & Sucreries', 
        icon: '🍫', 
        color: '#a855f7',
        examples: 'Chocolat, gâteaux, barres'
    },
    other: { 
        name: 'Autre', 
        icon: '📦', 
        color: '#6b7280',
        examples: 'Non classé / divers'
    }
};

export const defaultFoods = {
};