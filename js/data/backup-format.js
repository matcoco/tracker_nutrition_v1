// js/data/backup-format.js
// Validation et normalisation d'une sauvegarde complète avant import.
//
// Cette validation est extraite du gestionnaire d'import pour être testable
// seule : elle s'exécute AVANT tout effacement de la base, afin qu'un fichier
// non conforme ne puisse jamais détruire les données existantes.

/** Clés racine attendues dans une sauvegarde complète. */
export const REQUIRED_BACKUP_KEYS = ['foods', 'dailyMeals'];

/**
 * Convertit une valeur en tableau.
 * Accepte les tableaux et les dictionnaires (anciens exports).
 * @param {*} value
 * @returns {Array|null} null si la valeur n'est pas exploitable.
 */
export function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return null;
}

/**
 * Convertit la collection d'aliments en tableau.
 *
 * Certains anciens exports stockaient les aliments sous forme de
 * dictionnaire `{ "poulet": { name, calories… } }` : la clé EST
 * l'identifiant. `Object.values()` seul le perdait, et l'import refusait
 * alors le fichier pour « aliments sans identifiant ».
 *
 * @param {*} value
 * @returns {Array|null}
 */
export function foodsToArray(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return null;
    return Object.entries(value).map(([id, food]) => {
        if (!food || typeof food !== 'object') return food;
        return food.id === undefined ? { ...food, id } : food;
    });
}

/**
 * Convertit la collection de journées en tableau, en rétablissant la date
 * depuis la clé du dictionnaire le cas échéant.
 * @param {*} value
 * @returns {Array|null}
 */
export function dailyMealsToArray(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return null;
    return Object.entries(value).map(([date, day]) => {
        if (!day || typeof day !== 'object') return day;
        return day.date === undefined ? { ...day, date } : day;
    });
}

/**
 * Valide la structure d'une sauvegarde complète.
 *
 * @param {*} data - Le contenu JSON analysé.
 * @returns {{ok: true, foods: Array, dailyMeals: Array}|{ok: false, error: string}}
 */
export function validateBackupPayload(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { ok: false, error: 'Le fichier ne contient pas un objet de sauvegarde.' };
    }

    // Un partage d'aliments/repas n'est pas une sauvegarde complète.
    if (data.data && data.data.foods && data.appName === 'Nutrition Tracker') {
        return { ok: false, error: 'Ce fichier est un partage d\'aliments/repas, pas une sauvegarde complète.' };
    }

    const foods = foodsToArray(data.foods);
    const dailyMeals = dailyMealsToArray(data.dailyMeals);
    if (!foods || !dailyMeals) {
        return {
            ok: false,
            error: 'Format de fichier invalide.\n\nAssurez-vous d\'importer une sauvegarde complète exportée depuis cette application.',
        };
    }

    if (dailyMeals.some(day => !day || typeof day !== 'object' || typeof day.date !== 'string' || !day.date)) {
        return { ok: false, error: 'Sauvegarde invalide : certaines journées n\'ont pas de date exploitable.' };
    }

    if (foods.some(food => !food || typeof food !== 'object' || !food.id)) {
        return { ok: false, error: 'Sauvegarde invalide : certains aliments n\'ont pas d\'identifiant.' };
    }

    return { ok: true, foods, dailyMeals };
}

/** Stores optionnels d'une sauvegarde, associés à leur clé racine. */
export const OPTIONAL_BACKUP_STORES = {
    meals: 'meals',
    goals: 'goals',
    dailyWater: 'dailyWater',
    dailySteps: 'dailySteps',
    dailyActivities: 'dailyActivities',
    customActivities: 'customActivities',
    healthEvents: 'healthEvents',
};

/**
 * Prépare un import : valide la sauvegarde et détermine quels stores doivent
 * être remplacés.
 *
 * Règle importante : un store optionnel ABSENT du fichier n'est pas vidé.
 * Les sauvegardes antérieures à la v1.6 ne contiennent pas `healthEvents` :
 * les effacer faisait perdre définitivement l'historique de santé de
 * l'utilisateur, sans le moindre avertissement.
 *
 * @param {*} data - Le contenu JSON analysé.
 * @returns {{ok: false, error: string}|{
 *   ok: true, foods: Array, dailyMeals: Array,
 *   optional: Object<string, Array>, storesToReplace: string[], preservedStores: string[]
 * }}
 */
export function planBackupImport(data) {
    const validation = validateBackupPayload(data);
    if (!validation.ok) return validation;

    const optional = {};
    const storesToReplace = [];
    const preservedStores = [];

    for (const [key, storeName] of Object.entries(OPTIONAL_BACKUP_STORES)) {
        const value = asArray(data[key]);
        optional[key] = value;
        if (value === null) preservedStores.push(storeName);
        else storesToReplace.push(storeName);
    }

    return {
        ok: true,
        foods: validation.foods,
        dailyMeals: validation.dailyMeals,
        optional,
        storesToReplace: ['foods', 'dailyMeals', ...storesToReplace],
        preservedStores,
    };
}
