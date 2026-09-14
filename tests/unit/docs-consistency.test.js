// tests/unit/docs-consistency.test.js
// Tests de cohérence de la documentation.
//
// L'audit a montré que la documentation avait une version de retard, promettait
// des fichiers inexistants (`OBJECTIFS-GUIDE.md`, `docs/screenshots/`) et
// renvoyait vers des chemins erronés. Ces tests empêchent la réapparition.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');

// Documents décrivant l'état ACTUEL du projet.
const DOCS = ['README.md', 'AUDIT.md', 'divers/FONCTIONNALITES.md', 'divers/GUIDE-PRIX.md'];
// Documents historiques : ils décrivent une version passée et peuvent citer des
// fichiers qui existaient alors (le CHANGELOG ne se réécrit pas).
const HISTORICAL_DOCS = ['divers/CHANGELOG.md', 'divers/MISE-A-JOUR-DOCS.md'];

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
    return fs.existsSync(path.join(ROOT, relativePath));
}

describe('documentation — cohérence des versions', () => {
    const pkg = JSON.parse(read('package.json'));

    it('package.json déclare une version', () => {
        expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('le badge de version du README correspond à package.json', () => {
        const badge = /badge\/version-([\d.]+)-/.exec(read('README.md'));
        expect(badge, 'badge de version introuvable dans le README').not.toBeNull();
        expect(badge[1]).toBe(pkg.version);
    });

    it('la version exportée par l’application correspond à package.json', () => {
        const version = /version:\s*'([\d.]+)'/.exec(read('js/app.js'));
        expect(version, 'version d\'export introuvable dans js/app.js').not.toBeNull();
        expect(version[1]).toBe(pkg.version);
    });

    it('le CHANGELOG contient une entrée pour la version courante', () => {
        expect(read('divers/CHANGELOG.md')).toContain(`## [${pkg.version}]`);
    });
});

describe('documentation — liens et références', () => {
    it('tous les liens Markdown relatifs pointent vers un fichier existant', () => {
        const casses = [];
        for (const doc of DOCS) {
            if (!exists(doc)) continue;
            const contenu = read(doc);
            for (const [, cible] of contenu.matchAll(/\]\(([^)]+)\)/g)) {
                const lien = cible.split('#')[0].trim();
                if (!lien) continue;
                if (/^(https?:|mailto:|#)/.test(lien)) continue;
                if (lien.startsWith('../')) continue; // liens vers GitHub (issues…)
                const resolu = path.normalize(path.join(path.dirname(doc), lien));
                if (!exists(resolu)) casses.push(`${doc} → ${cible}`);
            }
        }
        expect(casses, `liens cassés :\n${casses.join('\n')}`).toEqual([]);
    });

    it('aucun document ne crée de lien vers le guide OBJECTIFS-GUIDE.md (fichier absent)', () => {
        // AUDIT.md peut légitimement citer ce nom pour décrire le problème :
        // on interdit le lien, pas la mention.
        for (const doc of DOCS) {
            if (!exists(doc)) continue;
            expect(read(doc), doc).not.toMatch(/\]\([^)]*OBJECTIFS-GUIDE\.md/);
        }
    });

    it('aucune image ne pointe vers le dossier docs/ (absent)', () => {
        for (const doc of DOCS) {
            if (!exists(doc)) continue;
            const images = [...read(doc).matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
            for (const src of images) {
                expect(src, `${doc} référence ${src}`).not.toMatch(/^docs\//);
            }
        }
    });

    it('le README ne promet plus de base d’aliments pré-remplie', () => {
        // `defaultFoods = {}` : la base démarre vide.
        const config = read('js/config.js');
        expect(config).toMatch(/defaultFoods\s*=\s*\{\s*\}/);
        expect(read('README.md')).not.toMatch(/100\+\s*aliments pré-enregistrés/);
    });

    it('le README référence la suite de tests', () => {
        expect(read('README.md')).toContain('tests/README.md');
    });

    it('les documents cités par le README existent', () => {
        for (const cible of ['AUDIT.md', 'tests/README.md', 'divers/FONCTIONNALITES.md', 'divers/CHANGELOG.md', 'divers/GUIDE-PRIX.md']) {
            expect(exists(cible), cible).toBe(true);
        }
    });
});

describe('confidentialité — aucun fichier de données personnelles suivi', () => {
    it('aucune sauvegarde personnelle n’est suivie par Git', () => {
        // Le dépôt est PUBLIC : un fichier de sauvegarde suivi par Git serait
        // publié, et le resterait dans l'historique même après suppression.
        const suivis = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
            .split('\n')
            .filter(Boolean);

        const interdits = suivis.filter((f) => /nutrition-tracker-backup-.*\.json$/.test(f)
            || /nutrition-data_.*\.json$/.test(f));

        expect(interdits, `fichiers de données suivi par Git : ${interdits.join(', ')}`).toEqual([]);
    });

    it('.gitignore exclut toutes les sauvegardes personnelles', () => {
        const ignore = read('.gitignore');
        expect(ignore).toContain('nutrition-tracker-backup-*.json');
        expect(ignore).toContain('nutrition-data_*.json');
    });

    it('aucun prénom ou e-mail personnel dans les fichiers du dépôt', () => {
        const fichiers = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
            .split('\n')
            .filter(Boolean);

        // Motifs volontairement génériques : noms propres apparus dans
        // l'historique, et adresses e-mail personnelles connues.
        const motifs = [/[nom-retire]/i, /[nom-retire]/i, /[email-retire]/i];
        const coupables = [];
        for (const fichier of fichiers) {
            let contenu;
            try {
                contenu = fs.readFileSync(path.join(ROOT, fichier), 'utf8');
            } catch (_) {
                continue;
            }
            // Exemptés : le rapport d'audit et ce fichier de test décrivent le
            // problème, ils citent donc forcément les motifs recherchés.
            if (fichier === 'AUDIT.md' || fichier === 'tests/unit/docs-consistency.test.js') continue;
            for (const motif of motifs) {
                if (motif.test(fichier) || motif.test(contenu)) {
                    coupables.push(`${fichier} (${motif})`);
                    break;
                }
            }
        }
        expect(coupables, `références personnelles : ${coupables.join(', ')}`).toEqual([]);
    });
});

describe('documentation — exactitude factuelle', () => {
    it('le nombre d’onglets annoncé correspond à index.html', () => {
        const html = read('index.html');
        const onglets = [...html.matchAll(/class="nav-tab[^"]*"\s+data-tab="([^"]+)"/g)].map((m) => m[1]);
        expect(onglets.length).toBeGreaterThanOrEqual(8);
        // Le guide fonctionnel ne doit plus annoncer 6 onglets.
        expect(read('divers/FONCTIONNALITES.md')).not.toMatch(/6 onglets/i);
    });

    it('les boutons d’hydratation documentés existent réellement', () => {
        const html = read('index.html');
        const montants = [...html.matchAll(/class="water-btn add-btn"[^>]*data-amount="(\d+)"/g)].map((m) => m[1]);
        expect(montants.length).toBeGreaterThan(0);
        // Le guide annonçait 250/750 ml : ces boutons n'existent pas.
        expect(montants).not.toContain('250');
        expect(montants).not.toContain('750');
    });

    it('le chargement progressif documenté correspond au code', () => {
        const state = read('js/core/state.js');
        const max = /maxFoodsPerLoad:\s*(\d+)/.exec(state);
        expect(max).not.toBeNull();
        expect(read('divers/FONCTIONNALITES.md')).toContain(`${max[1]} aliments à la fois`);
    });
});
