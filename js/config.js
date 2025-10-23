// js/config.js
export const DB_NAME = 'NutritionTrackerDB';
export const DB_VERSION = 5;

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

export const defaultFoods = {
    'haricots-verts': { name: 'Haricots Verts', calories: 36, proteins: 1.7, carbs: 3.3, sugars: 1.1, fibers: 2.7, fats: 0.5 },
    'comté': { name: 'Comté', calories: 410, proteins: 26, carbs: 0.5, sugars: 0.5, fibers: 0, fats: 34 },
    // ... collez le reste de vos aliments par défaut ici ...
    'raisin-vert': { name: 'Raisin vert', calories: 69, proteins: 0.7, carbs: 18.1, sugars: 16.3, fibers: 0.9, fats: 0.2 }
};