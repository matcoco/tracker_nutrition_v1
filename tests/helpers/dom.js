// tests/helpers/dom.js
// Charge le DOM réel de l'application (index.html) dans jsdom.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(here, '../..');

let cachedBody = null;

function readBodyHtml() {
    if (cachedBody !== null) return cachedBody;
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    cachedBody = match ? match[1] : html;
    return cachedBody;
}

/**
 * Injecte le contenu réel de index.html dans document.body.
 * Les <script> ne sont pas exécutés par innerHTML (comportement standard),
 * ce qui est exactement ce qu'on veut : les modules sont importés explicitement.
 */
export function loadAppDom({ keepScripts = false } = {}) {
    document.body.innerHTML = readBodyHtml();
    if (!keepScripts) {
        document.querySelectorAll('script').forEach((s) => s.remove());
    }
    return document;
}

/** Réinitialise le body entre deux tests. */
export function clearAppDom() {
    document.body.innerHTML = '';
}

/** Récupère un élément en échouant clairement s'il est absent. */
export function el(id) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Élément #${id} introuvable dans le DOM chargé`);
    return node;
}

/** Liste des ids présents dans le HTML de l'application. */
export function allIds() {
    return new Set([...document.querySelectorAll('[id]')].map((n) => n.id));
}
