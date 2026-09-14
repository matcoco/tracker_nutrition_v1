// Script de correction du format de sauvegarde.
//
// Convertit l'ancien format de prix `priceGrams` vers le format actuel
// `priceQuantity` + `priceUnit`, sur les aliments ET les repas composés.
//
// Ce script est un module ES (le package.json du projet déclare
// "type": "module") : l'ancienne version en `require()` ne démarrait pas.
//
// Utilisation :
//   node divers/fix-backup-format.js <sauvegarde.json> [sortie.json]
//
// Les fonctions pures sont exportées pour être testables unitairement.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asArray, foodsToArray } from '../js/data/backup-format.js';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * Convertit les champs de prix d'une entrée (aliment ou repas composé).
 *
 * Ne remplace JAMAIS un `priceQuantity` déjà renseigné : l'ancienne version
 * écrasait la valeur du format actuel par celle du format historique, ce qui
 * dégradait silencieusement les prix (tous les calculs préfèrent `priceQuantity`).
 *
 * @param {object} entry - L'entrée à convertir (modifiée sur place).
 * @returns {boolean} true si l'entrée a été modifiée.
 */
export function convertPriceFields(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (!hasOwn(entry, 'priceGrams')) return false;

    const legacyGrams = Number(entry.priceGrams);
    delete entry.priceGrams;

    const existingQuantity = Number(entry.priceQuantity);
    const hasCurrentQuantity = hasOwn(entry, 'priceQuantity')
        && Number.isFinite(existingQuantity)
        && existingQuantity > 0;

    if (hasCurrentQuantity) {
        // Le format actuel est déjà renseigné : on se contente de retirer le
        // champ obsolète.
        return true;
    }

    if (!Number.isFinite(legacyGrams) || legacyGrams <= 0) {
        // Valeur historique inexploitable : on la retire sans inventer de prix.
        return true;
    }

    entry.priceQuantity = legacyGrams;
    entry.priceUnit = entry.priceUnit === 'portions' ? 'portions' : 'grams';
    return true;
}

/**
 * Corrige une sauvegarde complète.
 *
 * @param {object} data - La sauvegarde analysée (modifiée sur place).
 * @returns {{foods: {total: number, converted: number, names: string[]},
 *            meals: {total: number, converted: number, names: string[]},
 *            skipped: string[]}}
 */
export function fixBackup(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Sauvegarde invalide : objet attendu.');
    }

    const foods = foodsToArray(data.foods);
    if (foods === null) {
        throw new Error('Champ "foods" introuvable ou invalide.');
    }
    // Un ancien export peut stocker les aliments en dictionnaire : on rétablit
    // le tableau (et l'identifiant depuis la clé) avant de réécrire.
    data.foods = foods;

    const report = {
        foods: { total: foods.length, converted: 0, names: [] },
        meals: { total: 0, converted: 0, names: [] },
        skipped: [],
    };

    for (const food of foods) {
        if (!food || typeof food !== 'object') {
            report.skipped.push('(aliment invalide)');
            continue;
        }
        if (convertPriceFields(food)) {
            report.foods.converted += 1;
            report.foods.names.push(food.name || food.id || '(sans nom)');
        }
    }

    // Les repas composés portent aussi un prix (`price`/`priceQuantity`/`priceUnit`).
    const meals = asArray(data.meals);
    if (meals !== null) {
        data.meals = meals;
        report.meals.total = meals.length;
        for (const meal of meals) {
            if (!meal || typeof meal !== 'object') {
                report.skipped.push('(repas invalide)');
                continue;
            }
            if (convertPriceFields(meal)) {
                report.meals.converted += 1;
                report.meals.names.push(meal.name || meal.id || '(sans nom)');
            }
        }
    }

    return report;
}

/**
 * Lit un fichier de sauvegarde, le corrige et écrit le résultat.
 * @param {string} inputPath
 * @param {string} outputPath
 * @returns {object} Le rapport de correction.
 */
export function fixBackupFile(inputPath, outputPath) {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const report = fixBackup(data);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    return report;
}

function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error('Usage : node divers/fix-backup-format.js <sauvegarde.json> [sortie.json]');
        console.error('\nConvertit les prix de l\'ancien format (priceGrams) vers le format actuel');
        console.error('(priceQuantity + priceUnit), dans les aliments et les repas composés.');
        process.exitCode = 1;
        return;
    }

    const resolvedInput = path.resolve(inputPath);
    const outputPath = process.argv[3]
        ? path.resolve(process.argv[3])
        : resolvedInput.replace(/\.json$/i, '') + '_CORRECTED.json';

    if (outputPath === resolvedInput) {
        console.error('❌ Le fichier de sortie doit être différent du fichier d\'entrée.');
        process.exitCode = 1;
        return;
    }

    console.log('🔧 Correction du fichier de sauvegarde...\n');
    try {
        const report = fixBackupFile(resolvedInput, outputPath);
        console.log(`📊 Aliments : ${report.foods.converted} corrigé(s) sur ${report.foods.total}`);
        report.foods.names.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));
        console.log(`📊 Repas composés : ${report.meals.converted} corrigé(s) sur ${report.meals.total}`);
        report.meals.names.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));
        if (report.skipped.length) {
            console.log(`⚠️  ${report.skipped.length} entrée(s) ignorée(s) car invalide(s).`);
        }
        console.log(`\n💾 Fichier écrit : ${outputPath}`);
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
    }
}

// N'exécute la CLI que si le fichier est lancé directement (et non importé par
// les tests).
const isDirectRun = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
