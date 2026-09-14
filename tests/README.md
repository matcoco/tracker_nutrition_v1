# Tests unitaires — Tracker Nutritionnel

Suite de tests unitaires et d'intégration (Vitest + jsdom + fake-indexeddb).

## Installation

```bash
npm install
```

## Lancer les tests

```bash
npm test                 # exécution unique de toute la suite
npm run test:watch       # mode surveillance
npm run test:coverage    # rapport de couverture (dossier coverage/)
```

> Si votre environnement définit `NODE_ENV=production`, précédez la commande par
> `NODE_ENV=test` : npm ignore sinon les dépendances de développement.

## Organisation

```
tests/
├── setup/setup.js              # environnement global (IndexedDB en mémoire, stub Chart.js, APIs jsdom)
├── helpers/
│   ├── dom.js                  # injecte le vrai <body> de index.html dans jsdom
│   └── fixtures.js             # jeux de données de référence (aliments, repas, journées)
├── unit/                       # un fichier par module applicatif
└── integration/
    ├── app.test.js             # démarrage complet de l'application
    └── server.test.js          # serveur local (statique, sécurité, robustesse)
```

## Couverture fonctionnelle

| Domaine | Fichiers de test | Tests |
|---|---|---|
| Calculs nutritionnels et coûts | `utils.test.js` | 50 |
| Base IndexedDB (9 stores, migrations) | `db.test.js` | 71 |
| Suivi quotidien (repas, poids, eau, pas, sommeil) | `handlers-daily.test.js` | 41 |
| Aliments (CRUD, recherche, portions) | `handlers-food.test.js` | 35 |
| Objectifs et macros | `handlers-goals.test.js` | 27 |
| Statistiques, activités, navigation | `handlers-misc.test.js` | 34 |
| Graphiques et analyses | `stats-*.test.js` (6 fichiers) | 110 |
| Rendu des écrans | `ui-core.test.js`, `ui-meals.test.js` | 109 |
| Repas composés, journal, comparaison, santé, IA | `features-*.test.js` (5 fichiers) | 208 |
| Import / export | `data-import-export.test.js` | 26 |
| Validation et planification d'import | `data-backup-format.test.js` | 34 |
| Configuration, état, diagnostic de la base | `core-misc.test.js` | 23 |
| **Feuilles de style** (structure, variables, cascade, focus) | `css-structure.test.js` | 16 |
| **Scripts de `divers/`** (réparation, modèle de prix) | `divers-scripts.test.js` | 22 |
| **Cohérence de la documentation** | `docs-consistency.test.js` | 13 |
| Démarrage complet de l'application | `integration/app.test.js` | 9 |
| Serveur local (statique, sécurité) | `integration/server.test.js` | 12 |
| **Proxy Brave** (CORS, validation, transmission) | `integration/brave-proxy.test.js` | 16 |
| **Total** | **28 fichiers** | **856** |

## Notes de conception

- `js/ui/ui-core.js` met les éléments du DOM en cache **au moment de l'import** :
  le DOM doit être chargé avant (`loadAppDom()`), et n'être reconstruit que si le
  module est réimporté (`vi.resetModules()`).
- Le stub `Chart` est exposé par `tests/setup/setup.js` (`ChartStub.instances`)
  pour vérifier la création et la destruction des graphiques.
- Aucun appel réseau réel : `fetch` est systématiquement simulé. Les tests du
  serveur local et du proxy Brave passent par `node:http` et un serveur amont
  factice.
- `css-structure.test.js` n'évalue pas le rendu : il vérifie l'intégrité
  structurelle (commentaires et blocs équilibrés, at-rules non « avalées »),
  les variables CSS définies, les classes réellement stylées et l'absence de
  conflits de cascade déjà rencontrés.
- `docs-consistency.test.js` compare la version du README, de `package.json` et
  de l'export applicatif, et vérifie que les liens relatifs de la documentation
  pointent vers des fichiers existants.
- Les tests sont exécutés avec `NODE_ENV=test` car cet environnement définit
  `NODE_ENV=production` par défaut (npm ignorerait les dépendances de
  développement à l'installation).
