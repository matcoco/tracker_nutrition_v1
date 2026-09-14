// tests/unit/css-structure.test.js
// Tests structurels des feuilles de style.
//
// Le CSS n'est pas « exécutable » au sens unitaire, mais un grand nombre de
// bugs d'intégration sont détectables mécaniquement : commentaire non fermé qui
// avale une règle, variable CSS inexistante, sélecteur dupliqué, classe utilisée
// dans le HTML ou le JS mais jamais définie, import manquant.
//
// Ces tests couvrent précisément les défauts trouvés lors de l'audit CSS :
// ils empêchent leur réapparition.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const CSS_DIR = path.join(ROOT, 'css');

const CSS_FILES = fs.readdirSync(CSS_DIR).filter((name) => name.endsWith('.css')).sort();

function readCss(name) {
    return fs.readFileSync(path.join(CSS_DIR, name), 'utf8');
}

/**
 * Retire les commentaires et signale un commentaire non fermé.
 * @param {string} css
 * @returns {{text: string, unclosedComment: boolean}}
 */
function stripComments(css) {
    let out = '';
    let inComment = false;
    for (let i = 0; i < css.length; i += 1) {
        const two = css.slice(i, i + 2);
        if (!inComment && two === '/*') { inComment = true; i += 1; continue; }
        if (inComment && two === '*/') { inComment = false; i += 1; continue; }
        if (!inComment) out += css[i];
    }
    return { text: out, unclosedComment: inComment };
}

/**
 * Analyse structurelle minimale : équilibre des blocs et détection de texte
 * parasite au niveau racine.
 *
 * Un texte hors commentaire avant une règle `@` est exactement le défaut qui
 * rendait inopérant tout le bloc responsive : le parseur consomme l'`@media`
 * comme préambule de la règle invalide précédente.
 *
 * @param {string} css
 * @returns {{errors: string[], mediaQueries: string[], keyframes: string[], selectors: string}}
 */
function analyze(css) {
    const { text, unclosedComment } = stripComments(css);
    const errors = [];
    if (unclosedComment) errors.push('commentaire non fermé');

    let depth = 0;
    let prelude = '';
    const mediaQueries = [];
    const keyframes = [];
    let selectors = '';

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];

        if (char === '{') {
            const block = prelude.trim();
            if (depth === 0) {
                if (block.startsWith('@media')) mediaQueries.push(block);
                else if (block.startsWith('@keyframes')) keyframes.push(block.split(/\s+/)[1]);
                else selectors += ` ${block}`;
            }
            prelude = '';
            depth += 1;
            continue;
        }

        if (char === ';' && depth === 0) {
            // At-rule sans bloc (@import, @charset) : instruction complète.
            if (prelude.trim().startsWith('@')) prelude = '';
            continue;
        }

        if (char === '}') {
            depth -= 1;
            if (depth < 0) { errors.push('accolade fermante orpheline'); depth = 0; }
            prelude = '';
            continue;
        }

        if (depth === 0) {
            if (char === '@' && prelude.trim() !== '') {
                errors.push(`texte parasite avant une règle @ : « ${prelude.trim().slice(0, 60)} »`);
                prelude = '';
            }
            prelude += char;
        }
    }

    if (depth !== 0) errors.push(`accolades déséquilibrées (profondeur finale ${depth})`);
    if (prelude.trim() !== '') errors.push(`texte parasite en fin de fichier : « ${prelude.trim().slice(0, 60)} »`);

    return { errors, mediaQueries, keyframes, selectors };
}

/** Variables CSS définies. */
function definedVariables(allCss) {
    return new Set([...allCss.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
}

/** Variables CSS utilisées via var(). */
function usedVariables(allCss) {
    return new Set([...allCss.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]));
}

/** Classes définies dans les sélecteurs CSS. */
function definedClasses(allCss) {
    const { text } = stripComments(allCss);
    return new Set([...text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
}

/** Classes utilisées dans index.html. */
function classesFromHtml() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const found = new Set();
    for (const [, value] of html.matchAll(/class="([^"]*)"/g)) {
        value.replace(/\$\{[^}]*\}/g, ' ')
                    .split(/\s+/)
                    .filter((c) => c && !c.endsWith('-'))
                    .forEach((c) => found.add(c));
    }
    return found;
}

/** Classes utilisées dans le HTML généré par le JavaScript. */
function classesFromJs() {
    const found = new Set();
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.js')) files.push(full);
        }
    };
    walk(path.join(ROOT, 'js'));

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        const patterns = [
            /class="([^"]*)"/g,
            /class=\\?"([^"]*)\\?"/g,
            /classList\.(?:add|remove|toggle)\(\s*'([^']+)'/g,
            /className\s*=\s*'([^']+)'/g,
            /className\s*=\s*`([^`]*)`/g,
        ];
        for (const pattern of patterns) {
            for (const [, value] of source.matchAll(pattern)) {
                value.replace(/\$\{[^}]*\}/g, ' ')
                    .split(/\s+/)
                    .filter((c) => c && !c.endsWith('-'))
                    .forEach((c) => found.add(c));
            }
        }
    }
    return found;
}

const ALL_CSS = CSS_FILES.map(readCss).join('\n');

/** Classes volontairement sans style : simples crochets de requêtage JS. */
const STYLE_FREE_HOOKS = new Set([
    'active', 'show', 'hidden', 'dragging', 'drag-over', 'collapsed', 'expanded',
    'copied', 'primary', 'success', 'warning', 'danger', 'secondary', 'neutral',
    'visible', 'open', 'selected', 'disabled', 'loading', 'completed',
    // Crochets de requêtage JS : stylés par un sélecteur de conteneur ou pilotés
    // par `style.display` / styles en ligne. Vérifiés lors de l'audit CSS.
    'update-btn', 'copy-text', 'meal-items', 'health-event-comment-field',
    'column-toggle', 'macro-column', 'macro-display', 'wellness-display',
    'wellness-input', 'search-bar', 'journal-meal-section', 'jmt-label',
    'portion-input',
    // Champs des lignes d'exercices : couverts par `.strength-exercise-row input`.
    'strength-exercise-name', 'strength-exercise-muscle', 'strength-exercise-sets',
    'strength-exercise-reps', 'strength-exercise-dumbbell', 'strength-exercise-vest',
]);

describe('CSS — intégrité structurelle', () => {
    it('chaque feuille se termine par des commentaires et des blocs équilibrés', () => {
        for (const name of CSS_FILES) {
            const { errors } = analyze(readCss(name));
            expect(errors, `${name} : ${errors.join(' | ')}`).toEqual([]);
        }
    });

    it('aucun texte parasite ne peut avaler une règle @ (cause du bloc tactile perdu)', () => {
        for (const name of CSS_FILES) {
            const { errors } = analyze(readCss(name));
            expect(errors.filter((e) => e.includes('texte parasite')), name).toEqual([]);
        }
    });

    it('le bloc tactile responsive est bien présent et analysable', () => {
        const { mediaQueries, errors } = analyze(readCss('responsive.css'));
        expect(errors).toEqual([]);
        expect(mediaQueries.some((q) => q.includes('hover: none'))).toBe(true);
        expect(mediaQueries.some((q) => q.includes('pointer: coarse'))).toBe(true);

        // Les cibles tactiles de 44 px doivent réellement être déclarées.
        const css = readCss('responsive.css');
        const touchBlock = css.slice(css.indexOf('@media (hover: none)'));
        expect(touchBlock).toContain('min-height: 44px');
        expect(touchBlock).toContain('transform: none');
    });

    it('style.css importe chaque feuille exactement une fois', () => {
        const style = readCss('style.css');
        const imports = [...style.matchAll(/@import\s+url\(['"]?([^'")]+)['"]?\)/g)].map((m) => path.basename(m[1]));
        const attendus = CSS_FILES.filter((f) => f !== 'style.css');

        for (const feuille of attendus) {
            expect(imports.filter((i) => i === feuille), `${feuille} importée`).toHaveLength(1);
        }
        expect(imports).toHaveLength(attendus.length);
    });

    it('aucune règle @keyframes n’est définie deux fois', () => {
        const { keyframes } = analyze(ALL_CSS);
        const doublons = keyframes.filter((name, i) => keyframes.indexOf(name) !== i);
        expect(doublons, `animations dupliquées : ${doublons.join(', ')}`).toEqual([]);
    });
});

describe('CSS — variables', () => {
    it('toutes les variables utilisées sont définies', () => {
        const utilisees = usedVariables(ALL_CSS);
        const definies = definedVariables(ALL_CSS);
        const manquantes = [...utilisees].filter((v) => !definies.has(v));
        expect(manquantes, `variables non définies : ${manquantes.join(', ')}`).toEqual([]);
    });

    it('les alias de compatibilité sont disponibles', () => {
        const definies = definedVariables(ALL_CSS);
        for (const alias of ['--color-primary', '--color-text', '--color-text-medium']) {
            expect(definies.has(alias), alias).toBe(true);
        }
    });
});

describe('CSS — classes réellement stylées', () => {
    it('les classes du HTML et du JS sont définies (hors crochets de requêtage)', () => {
        const definies = definedClasses(ALL_CSS);
        const utilisees = new Set([...classesFromHtml(), ...classesFromJs()]);
        const manquantes = [...utilisees].filter((c) => !definies.has(c) && !STYLE_FREE_HOOKS.has(c));

        expect(manquantes, `classes sans règle CSS : ${manquantes.join(', ')}`).toEqual([]);
    });

    it('les classes corrigées lors de l’audit sont bien stylées', () => {
        const definies = definedClasses(ALL_CSS);
        for (const classe of ['cost-label', 'cost-icon', 'cost-period', 'cost-content', 'journal-empty']) {
            expect(definies.has(classe), classe).toBe(true);
        }
    });

    it('la classe fautive journal-empty-day n’est plus utilisée', () => {
        const jsSource = fs.readFileSync(path.join(ROOT, 'js/features/meal-history.js'), 'utf8');
        expect(jsSource).not.toContain('journal-empty-day');
    });
});

describe('CSS — accessibilité clavier', () => {
    it('un indicateur de focus clavier est rétabli globalement', () => {
        const css = readCss('responsive.css');
        expect(css).toMatch(/:focus-visible/);
        expect(css).toMatch(/outline:\s*3px solid var\(--color-secondary-start\)/);
    });

    it('les radios de sexe exposent un focus visible', () => {
        expect(readCss('goals.css')).toContain('input[type="radio"]:focus-visible + .gender-label');
    });
});

describe('CSS — pièges de cascade déjà rencontrés', () => {
    it('.meal-item n’est plus redéfini globalement dans features.css', () => {
        const css = readCss('features.css');
        expect(css).toMatch(/\.meals-list \.meal-item\s*\{/);
        // Une règle globale `.meal-item {` écraserait le style du suivi quotidien.
        expect(/^\.meal-item\s*\{/m.test(css)).toBe(false);
    });

    it('.food-name n’est plus redéfini dans forms.css', () => {
        expect(/^\.food-name\s*\{/m.test(readCss('forms.css'))).toBe(false);
    });

    it('.cancel-btn:hover n’utilise plus !important sur une règle globale', () => {
        const css = readCss('wellness.css');
        expect(/^\.cancel-btn:hover\s*\{[^}]*!important/m.test(css)).toBe(false);
    });

    it('le menu de sélection de repas reste sous les modales', () => {
        const css = readCss('daily-tracker.css');
        const bloc = css.slice(css.indexOf('.meal-selector-menu {'));
        const zIndex = Number(/z-index:\s*(\d+)/.exec(bloc)?.[1]);
        expect(Number.isFinite(zIndex)).toBe(true);
        expect(zIndex).toBeLessThan(2000);
    });
});
