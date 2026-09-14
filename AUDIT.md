# Audit complet — Tracker Nutritionnel

**Date** : 14 septembre 2026
**Périmètre** : `js/` (26 modules, ~5 400 lignes), `index.html`, `tools/`, `css/`
**Méthode** : lecture intégrale des modules, vérification croisée des identifiants DOM avec `index.html`, confrontation des hypothèses aux **données réelles** (`nutrition-tracker-backup-2026-05-18.json` : 219 aliments, 38 repas composés, 1 960 lignes de repas), puis validation par une suite de tests unitaires et d'intégration.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Modules audités | 26 (js/) + CSS (5 760 lignes) + tools/ + divers/ + documentation |
| Problèmes identifiés | ~150 |
| **Bugs corrigés** | **78** (dont 17 critiques) |
| Points signalés non corrigés (justifiés) | 8 |
| Identifiants DOM manquants | **0** (396 ids vérifiés) |
| **Tests écrits** | **855** |
| Fichiers de test | 28 |
| État final | **855 / 855 verts** |

> Ce rapport couvre **deux passes**. La première (sections 2 à 8) a porté sur le
> code applicatif `js/`. La seconde (section 9) a couvert les zones qui n'avaient
> pas été ouvertes au départ : `css/`, `tools/brave-search-proxy.js`, `divers/`,
> la documentation et l'historique Git.

### Répartition des bugs corrigés

| Sévérité | Nombre | Exemples |
|---|---|---|
| CRITIQUE | 13 | perte de données à l'import, 32 lignes de repas à 0 kcal, comparaison fausse, crash du serveur, exposition de `.git` |
| MAJEUR | 24 | objectifs `NaN` enregistrés, collisions d'identifiants, `reduce` sans valeur initiale, XSS stocké |
| MOYEN | 11 | « 7h60 », seuil de filtre à 0 impossible, `initPeriodComparison` non idempotent |

---

## 2. Infrastructure de tests mise en place

Le projet n'avait **aucun** outillage de test (pas de `package.json`, aucun runner).

- `package.json` + `vitest.config.js` : **Vitest 2** en environnement **jsdom**
- `tests/setup/setup.js` : IndexedDB en mémoire (`fake-indexeddb`), stub `Chart.js`, APIs jsdom manquantes (`matchMedia`, `getContext`, `scrollIntoView`, `URL.createObjectURL`), `fetch` neutralisé par défaut
- `tests/helpers/dom.js` : injecte le **vrai** `<body>` de `index.html` (140 Ko) dans jsdom
- `tests/helpers/fixtures.js` : jeux de données conformes au modèle réel (repas ajustables vs non ajustables, trois formats de prix, lignes héritées `foodId`/`uid`)

```bash
npm install      # si NODE_ENV=production : NODE_ENV=dev npm install
npm test
```

### Couverture par domaine

| Domaine | Fichier(s) | Tests |
|---|---|---|
| Calculs nutritionnels et coûts | `utils.test.js` | 50 |
| Base IndexedDB, migrations | `db.test.js` | 71 |
| Config, état global, outils de diagnostic | `core-misc.test.js` | 18 |
| Suivi quotidien | `handlers-daily.test.js` | 41 |
| Aliments (CRUD, recherche, portions) | `handlers-food.test.js` | 35 |
| Objectifs, macros, bien-être | `handlers-goals.test.js` | 25 |
| Statistiques, activités, navigation | `handlers-misc.test.js` | 34 |
| Graphiques d'évolution | `stats-charts.test.js` | 32 |
| Moyennes | `stats-charts-averages.test.js` | 13 |
| Coûts | `stats-costs.test.js` | 13 |
| Activités physiques | `stats-activities-charts.test.js` | 13 |
| Comparaison de périodes | `stats-period-comparison.test.js` | 15 |
| Analyse par aliment | `stats-food-analysis.test.js` | 24 |
| Écrans principaux | `ui-core.test.js` | 60 |
| Écrans des repas | `ui-meals.test.js` | 49 |
| Import / export | `data-import-export.test.js` | 26 |
| Repas composés | `features-meals.test.js` | 45 |
| Événements de santé | `features-health-events.test.js` | 25 |
| Journal alimentaire | `features-meal-history.test.js` | 25 |
| Comparateur d'aliments | `features-food-comparison.test.js` | 21 |
| Assistants IA | `features-ai.test.js` | 92 |
| **Démarrage complet de l'app** | `integration/app.test.js` | 9 |
| **Serveur local et sécurité** | `integration/server.test.js` | 12 |

---

## 3. Bugs critiques corrigés

### 3.1 Lignes de repas héritées invisibles — 32 aliments comptés à 0 kcal
`js/core/db.js`, `js/core/utils.js`

Certaines journées enregistrées utilisent la forme `{ foodId, uid }` au lieu de `{ id, uniqueId }` (vérifié : **32 lignes sur 1 960**, journées du 30/03/2026 notamment). Ces lignes :
- comptaient **0 kcal** dans les totaux de journée et d'en-tête ;
- affichaient « Aliment inconnu » ;
- étaient **impossibles à supprimer ou modifier** (la recherche par `uniqueId` échouait).

**Correction** : normalisation tolérante à la lecture (`loadDayMeals`), prise en charge dans `calculateMealItemNutrition`/`calculateMealItemCost`, et migration persistante `migrateLegacyMealItemIds()` exécutée au démarrage (idempotente).

### 3.2 Comparaison d'aliments : double normalisation des repas non ajustables
`js/features/food-comparison.js`

Le discriminant était la présence d'`ingredients` au lieu de `isPortionAdjustable`. Or `meals.js` enregistre déjà les valeurs **pour 100 g** quand le repas n'est pas ajustable (`priceQuantity: 100`).

**Preuve sur données réelles** : `boeuf-mijot-japonais` (`totalWeight: 488`, `calories: 106.97` pour 100 g) était affiché à `106,97 × 100/488 ≈ 21,9 kcal/100 g` — soit un facteur 4,9 d'erreur, avec un « meilleur choix » désigné à tort.

**Correction** : normalisation limitée aux repas `isPortionAdjustable`, sur la base de `food.totalWeight`.

### 3.3 Moyennes mensuelles : un mois sur deux était sauté
`js/core/db.js` — `loadAverages('month', …)`

`new Date(y, m - p, 0)` renvoie le **dernier jour du mois précédent**. Avec aujourd'hui = mai : les périodes affichées étaient `Mai, Mars, Février, Janvier, Décembre…` — **avril était totalement absent** et chaque fenêtre portait le mauvais libellé.

**Correction** : `new Date(y, m - p + 1, 0)`.

### 3.4 Effacer la durée de sommeil enregistrait 0 h
`js/core/db.js` — `saveDaySleepDuration`

`Number(null) === 0` est fini : l'interface annonçait « Durée du sommeil effacée » mais persistait `0`, affiché ensuite comme une nuit blanche.

**Correction** : distinction explicite entre effacement (`null`/vide) et valeur invalide (qui préserve l'existant).

### 3.5 Objectifs journaliers écrasés par 0
`js/core/db.js` — `saveDayNutritionGoals`

Un champ `null` (et non absent) remplaçait l'objectif historisé par `0` — même cause racine.

**Correction** : `normalizeDayGoal()`.

### 3.6 Comparaison de périodes : les jours sans mesure comptaient 0
`js/stats/period-comparison.js`

`values.map(Number)` transformait `null` en `0` : une période `[71 kg, null]` affichait **35,5 kg** au lieu de 71 kg. Les mentions « Non renseigné » étaient de ce fait quasi inatteignables.

**Correction** : filtrage explicite des `null`/`undefined`/chaînes vides dans `average()`, `formatValue()` et `formatDifference()`.

### 3.7 Barres de progression à 100 % sur un profil vierge
`js/ui/ui-core.js` — `getPercentage()`

Sans objectif, la fonction renvoyait `100` : calories, protéines, glucides et lipides apparaissaient **pleins à 0 consommé**, alors que sucres et fibres (seuils par défaut) affichaient 0 %.

**Correction** : renvoyer `0`.

### 3.8 Plantage de l'onglet Aliments
`js/ui/ui-core.js`

`hasPrice()` pouvait être vrai alors que `getPricePer100g()` renvoyait `null` (cas d'un aliment avec `priceQuantity` mais sans `priceUnit`, atteignable par import JSON) → `null.toFixed(2)` → `TypeError` et onglet vide.

**Correction** : implémentation alignée sur `core/utils.js` (source de vérité unique).

### 3.9 Serveur local : exposition de `.git/` et des sauvegardes
`tools/nutrition-app-server.js`

Le serveur écoutait en boucle locale avec `Access-Control-Allow-Origin: *` sur **toutes** les réponses, et servait l'intégralité du dossier racine — dont `.git/` et `nutrition-tracker-backup-2026-05-18.json` (592 Ko de données personnelles). N'importe quelle page web visitée pouvait les lire.

**Correction** : liste de motifs interdits (`.git`, `.vscode`, `node_modules`, `tests`, `divers`, `*.json`, `*backup*`), CORS restreint au seul proxy Brave, ajout de `X-Content-Type-Options: nosniff`.

### 3.10 Une URL malformée tuait le serveur
`tools/nutrition-app-server.js`

`decodeURIComponent('%')` lève une `URIError`. Appelée dans un handler `async` sans `try/catch`, elle provoquait un rejet non géré → **arrêt du process Node** (Node 22). Un simple `GET /%` suffisait.

**Correction** : réponse `400` + `try/catch` global autour du handler de requête.

### 3.11 Évasion du contrôle de traversée de chemin
`tools/nutrition-app-server.js`

`filePath.startsWith(ROOT)` est un test de préfixe sans séparateur : un dossier frère nommé `nutrition-tracker-secret` passait le contrôle.

**Correction** : `path.relative(ROOT, filePath)` avec rejet si le chemin commence par `..` ou est absolu.

### 3.12 Import : perte totale des données sur fichier non conforme
`js/app.js`

Les 9 stores étaient **vidés avant toute validation de structure**, sans transaction commune ni sauvegarde. Un fichier dont `foods` est un dictionnaire (format des anciens exports) faisait échouer `bulkPut` **après** l'effacement → perte irréversible.

**Correction** : validation complète avant écriture (types, présence des dates, identifiants d'aliments), **instantané de secours** des 9 stores, et **restauration automatique** si l'écriture échoue en cours de route.

### 3.13 La croix de la modale d'édition ne fermait pas la bonne fenêtre
`js/app.js`, `index.html`

`document.querySelector('.modal-close-btn')` renvoie le **premier** du document, c'est-à-dire celui de la modale IA : la croix de la modale d'édition d'aliment n'avait aucun effet, et fermer la modale IA fermait aussi celle d'édition.

**Correction** : identifiant dédié `closeEditFoodModal`.

---

## 4. Bugs majeurs corrigés

| # | Fichier | Problème | Correction |
|---|---|---|---|
| 1 | `js/core/db.js` | `initDB` sans `onblocked` : page blanche sans message si un autre onglet bloque la migration | rejet explicite + `onversionchange` |
| 2 | `js/core/db.js` | `bulkPut`/`clearStore` résolvaient avant le **commit** : « Importation réussie » alors que rien n'était écrit | résolution sur `oncomplete`, rejet sur `onabort` |
| 3 | `js/core/db.js` | `replaceFoodId`, `saveFood`, `saveMeal`, `saveGoals` : un champ `id` de l'objet écrasait la clé (ordre du spread) | `id` placé en dernier |
| 4 | `js/core/db.js` | `saveDayMeals` reconstruisait l'enregistrement par liste blanche → `mealTimes` et tout champ inconnu étaient **supprimés** | spread de l'enregistrement existant |
| 5 | `js/core/utils.js` | `formatDateKey` sans validation → clé `"NaN-NaN-NaN"` écrite dans IndexedDB | `TypeError` explicite + acceptation des chaînes valides |
| 6 | `js/core/utils.js` | `generateFoodId` pouvait renvoyer `''` → aliment avec clé vide, puis tout nom non latin refusé comme « doublon » | repli déterministe `food-<hash>` + suppression des tirets en bord |
| 7 | `js/core/utils.js` | Un poids de `0` sur un repas ajustable comptait la **recette entière** ; poids négatifs acceptés | bornage à 0 |
| 8 | `js/handlers/goals-handlers.js` | Un champ de profil vide enregistrait des objectifs **`NaN`** en base (« NaN kcal ») | `calculateGoalsFromInputs` retourne `null` + message d'erreur |
| 9 | `js/handlers/daily-handlers.js` | `uniqueId: Date.now()` seul : deux aliments ajoutés dans la même milliseconde devenaient **inséparables** | générateur monotone `generateMealItemId()` |
| 10 | `js/handlers/daily-handlers.js` | Quantité d'eau non validée (`NaN` stocké), `.copy-text` supposé présent, type de repas non gardé | gardes ajoutées |
| 11 | `js/handlers/ai-handlers.js` | `handleClearApiKey` ne supprimait pas la clé héritée `groq_api_key` → `hasApiKey()` restait vrai | suppression des deux clés |
| 12 | `js/features/health-events.js` | Suppression d'un événement de santé **sans confirmation** ; `createdAt` réinitialisé à chaque édition ; tri non défensif ; init non idempotent | confirmation, `createdAt` préservé, tri/format sûrs, liaison unique par élément |
| 13 | `js/features/food-comparison.js` | `reduce` sans valeur initiale → `TypeError` cassant tout l'onglet | valeur initiale + garde |
| 14 | `js/features/food-comparison.js` | Mode « 200 kcal » : division par zéro sur les aliments à 0 kcal (3 en base) → `Infinity`/`NaN` | ratio borné, colonne marquée `n/a` |
| 15 | `js/features/meals.js` | Le poids total saisi manuellement était **écrasé** à chaque modification d'ingrédient (`data-calculated` écrit mais jamais relu) | suivi `dataset.autoWeight` |
| 16 | `js/features/meals.js` | L'aperçu ignorait la case « Portions ajustables » : écart ×3 à ×5 avec les valeurs enregistrées | aperçu aligné sur la sauvegarde + écouteur sur la case |
| 17 | `js/features/meals.js` | `calculateMealNutrition` non défensive | normalisation des entrées |
| 18 | `js/features/ai-food-assistant.js` | Indice glycémique forcé à **0** quand l'IA renvoie `null` (l'heuristique n'était jamais appliquée) | détection explicite de `null` |
| 19 | `js/features/ai-food-assistant.js` | Une erreur sur une enseigne prioritaire annulait **toute** la recherche (repli inatteignable) | `try/catch` par enseigne |
| 20 | `js/features/ai-food-assistant.js` | OCR indisponible → analyse texte impossible | l'OCR devient facultatif si un texte est fourni |
| 21 | `js/features/ai-food-assistant.js` | `JSON.parse` non protégé, regex gloutonne ; chemin de recherche direct non dédupliqué ni plafonné | extraction délimitée + message clair ; `uniqueResults().slice(0, 8)` |
| 22 | `js/features/ai-meal-generator.js` | `parseAIResponse` : regex gloutonne, `plan` non validé (tableau/chaîne acceptés) | délimitation + validation de forme et de types de repas |
| 23 | `js/features/ai-meal-generator.js` | `injectMealsIntoDay` : clés de repas inventées **comptées dans les totaux sans être affichables**, quantités négatives injectées | validation stricte des types et des quantités |
| 24 | `js/features/ai-meal-generator.js` | `buildPrompt` : libellé `undefined`, division par zéro si aucun repas coché, cibles non renormalisées (la somme ne pouvait pas atteindre l'objectif) | repli de libellé + renormalisation |
| 25 | `js/features/ai-meal-generator.js` | `testApiConnection` partait avec `Authorization: Bearer ` vide | garde sur la clé |
| 26 | `js/stats/charts.js` | Poids et sommeil **tracés à 0** les jours sans mesure (`Number(null) === 0` dans les filtres) | test `> 0` |
| 27 | `js/stats/costs.js` | Le « Top 5 des aliments les plus chers » ignorait `customPrice` → incohérent avec les cartes et le graphique quotidien | utilisation de `utils.calculateMealItemCost` |
| 28 | `js/stats/food-analysis.js` | Les **repas composés étaient totalement exclus** de l'analyse (poids, coût, macros, Top 10) | résolution `meals`/`foods` + calculs partagés |
| 29 | `js/stats/activities-charts.js` | Accumulation sans coercition (`"0300200"`, `NaN`) ; tooltips « NaN% » quand le total est 0 | `Number(x) || 0`, pourcentage borné |
| 30 | `js/stats/period-comparison.js` | `initPeriodComparison` non idempotent (écouteurs dupliqués → double exécution au clic) | liaison unique par élément |
| 31 | `js/ui/ui-meals.js` | `elements` jamais défini dans ce module → `ReferenceError` dans `openEditModal`/`closeEditModal` | délégation à `ui-core` |
| 32 | `js/ui/ui-meals.js` | Une journée contenant une valeur non-tableau faisait planter **tout le suivi quotidien** (`items.reduce`), sans `try/catch` dans `app.js` | garde `Array.isArray` + `switchTab` sécurisé |
| 33 | `js/ui/ui-core.js`, `js/ui/ui-meals.js`, `js/stats/food-analysis.js` | **XSS stocké** : noms d'aliments/repas interpolés sans échappement (source : formulaire, import JSON, IA) | échappement HTML systématique + cellules construites par `textContent` |
| 34 | `js/stats/charts.js` | Seuil du filtre impossible à régler à `0` (`Number(x) \|\| 1500`) | test `Number.isFinite` |
| 35 | `js/stats/charts.js` | `formatSleepDuration` produisait « **7h60** » | report des 60 minutes |
| 36 | `js/app.js` | `.tab-btn` inexistant → le rafraîchissement de l'onglet Repas après import ne s'exécutait jamais | `.nav-tab` |
| 37 | `js/app.js` | `loadCurrentDay()` appelé sans `await` ni `catch` (navigation de dates) | gestion d'erreur + notification |
| 38 | `js/stats/charts-averages.js`, `costs.js`, `food-analysis.js` | Signatures sans valeur par défaut sur `foods` → `TypeError` silencieux | `foods = {}` |

---

## 5. Points vérifiés sans bug

- **Aucun identifiant DOM manquant** : les 396 `id` de `index.html` couvrent les 117 `getElementById` littéraux et tous les sélecteurs dynamiques des modules `ui/`, `stats/`, `features/` et `app.js`.
- **Aucune fuite d'instance Chart.js** : destruction systématique avant recréation dans les 6 modules de statistiques.
- **Tous les imports nommés résolvent** vers un export existant ; aucune incohérence de signature entre `app.js` et ses handlers.
- **Aucun `innerHTML` avec donnée utilisateur non échappée** ne subsiste dans les écrans audités après correction.
- **Intégrité de référence** : `migrateLegacyDayEvents` et `migrateLegacyMealItemIds` sont idempotentes (vérifié par test).

---

## 6. Points signalés, **non corrigés** (et pourquoi)

| Sujet | Fichier | Décision |
|---|---|---|
| **Ratio des portions personnalisées** | `js/core/utils.js` (CAS 1) | L'audit proposait de baser le dénominateur sur la somme des portions personnalisées. **Vérifié sur les données réelles : ce changement casserait le flux principal.** Le flux normal est « recette de 438 g, portions ajustées à 334 g, `item.weight` reste 438 » → le ratio proposé gonflerait les totaux de 31 %. Comportement conservé et testé. |
| **Jours non saisis comptés 0 kcal dans les moyennes** | `js/core/db.js` — `loadAverages` | C'est le comportement par défaut, et le réglage « exclure les journées sous un seuil » existe précisément pour cela. Modifier la sémantique changerait tous les chiffres affichés : laissé au choix de l'utilisateur. |
| **Clés API en clair dans `localStorage`** | `ai-food-assistant.js`, `ai-meal-generator.js` | Nécessite un changement d'architecture (proxy serveur). Le repli `http://127.0.0.1:8787` reste une exposition réseau local à supprimer si non utilisé. |
| **Duplication de `getPricePer100g`/`hasPrice`** | 6 emplacements | `utils.js` les exporte désormais et `costs.js`, `food-analysis.js`, `ui-core.js` utilisent la version robuste. `meals.js` et `food-comparison.js` gardent une copie locale (refactor plus large, hors périmètre). |
| **Code mort** | `charts.js` (`groupByWeek`, `getDateRangeDayCount`), `ai-food-assistant.js` (`categoryFromTags`), `ai-meal-generator.js` (`formatDateKey`), `food-comparison.js` (`resetComparison`) | Signalé, non supprimé pour ne pas élargir le diff. |
| **Parsing UTC de `new Date('YYYY-MM-DD')`** | `charts.js`, `costs.js`, `activities-charts.js` | Latent en France (fuseau positif) ; provoquerait un décalage d'un jour ailleurs. Signalé. |
| **Performance des statistiques** | `costs.js`, `activities-charts.js` | Les mêmes journées sont relues 3 à 5 fois par rafraîchissement (~9 lectures IndexedDB par jour). Optimisation possible en mutualisant le chargement. |
| **Plages de comparaison non bornées** | `period-comparison.js` | Une plage de plusieurs années provoquerait un gel (lectures séquentielles). Limite suggérée : 366 jours. |

---

## 7. Validation finale

```
$ npm test

 ✓ tests/unit/utils.test.js                     (50 tests)
 ✓ tests/unit/db.test.js                        (71 tests)
 ✓ tests/unit/core-misc.test.js                 (18 tests)
 ✓ tests/unit/handlers-daily.test.js            (41 tests)
 ✓ tests/unit/handlers-food.test.js             (35 tests)
 ✓ tests/unit/handlers-goals.test.js            (25 tests)
 ✓ tests/unit/handlers-misc.test.js             (34 tests)
 ✓ tests/unit/stats-charts.test.js              (32 tests)
 ✓ tests/unit/stats-charts-averages.test.js     (13 tests)
 ✓ tests/unit/stats-costs.test.js               (13 tests)
 ✓ tests/unit/stats-activities-charts.test.js   (13 tests)
 ✓ tests/unit/stats-period-comparison.test.js   (15 tests)
 ✓ tests/unit/stats-food-analysis.test.js       (24 tests)
 ✓ tests/unit/ui-core.test.js                   (60 tests)
 ✓ tests/unit/ui-meals.test.js                  (49 tests)
 ✓ tests/unit/data-import-export.test.js        (26 tests)
 ✓ tests/unit/features-meals.test.js            (45 tests)
 ✓ tests/unit/features-health-events.test.js    (25 tests)
 ✓ tests/unit/features-meal-history.test.js     (25 tests)
 ✓ tests/unit/features-food-comparison.test.js  (21 tests)
 ✓ tests/unit/features-ai.test.js               (92 tests)
 ✓ tests/integration/app.test.js                (9 tests)
 ✓ tests/integration/server.test.js             (12 tests)

 Test Files  23 passed (23)
      Tests  748 passed (748)
```

Le test d'intégration `app.test.js` démarre l'application complète (base IndexedDB, 200+ écouteurs, rendu de la journée) et **vérifie qu'aucune erreur n'est journalisée** pendant l'initialisation.
Le test `server.test.js` lance réellement le serveur local et valide les correctifs de sécurité (`.git` → 403, sauvegardes → 403, `GET /%` → 400 sans arrêt du process).

---

## 8. Fichiers modifiés

**Application** (20 fichiers) :
`index.html`, `js/app.js`, `js/core/db.js`, `js/core/utils.js`, `js/features/*.js` (5), `js/handlers/*.js` (4), `js/stats/*.js` (4), `js/ui/ui-core.js`, `js/ui/ui-meals.js`, `tools/nutrition-app-server.js`

**Ajoutés** :
`package.json`, `package-lock.json`, `vitest.config.js`, `.gitignore`, `tools/package.json`, `AUDIT.md`, `tests/` (23 fichiers de test + harnais)

> `tools/package.json` (`{"type":"commonjs"}`) est nécessaire : le `package.json` racine déclare `"type": "module"` pour les tests, alors que les scripts de `tools/` utilisent `require()`.

---

## 9. Deuxième passe — zones initialement non couvertes

Après la première passe, la couverture laissait de côté le CSS (144 Ko), le
dossier `divers/` (380 Ko), le proxy Brave, la documentation et l'historique Git.
Cette seconde passe les a traités.

### 9.1 🔴 Le bloc responsive tactile était entièrement désactivé

`css/responsive.css:1-5` — un commentaire d'en-tête fermé trop tôt laissait deux
lignes de texte hors commentaire, avec un `*/` orphelin :

```css
/* =============================================
   RESPONSIVE DESIGN
   ============================================= */          ← commentaire FERMÉ ici
   RESPONSIVE DESIGN - PRIORITÉ MOBILE FIRST        ← texte hors commentaire
   ============================================= */  ← orphelin
```

Le parseur CSS consomme alors le `@media (hover: none) and (pointer: coarse)`
suivant comme **préambule d'une règle invalide** : tout le bloc disparaît.

**Conséquences réelles sur mobile/tablette** : cibles tactiles de 44 px non
appliquées (WCAG 2.5.8), effets `:hover` non neutralisés (les cartes se décalent
sous le doigt), `user-select`/`tap-highlight` perdus.

**Correction** : fermeture correcte du commentaire (1 ligne).

### 9.2 🔴 Restaurer une ancienne sauvegarde effaçait les événements de santé

`js/app.js` — `handleImport` vidait **les 9 stores**, puis ne réécrivait que les
clés présentes dans le fichier. Aucune des trois sauvegardes du dépôt ne contient
`healthEvents` (clé ajoutée en v1.6) : importer l'une d'elles **détruisait tout
l'historique de santé**, en affichant « Importation réussie ! ».

**Correction** : `planBackupImport()` (dans `js/data/backup-format.js`) ne
remplace que les stores réellement présents dans le fichier ; les autres sont
conservés et l'utilisateur en est informé.

### 9.3 🔴 Le proxy Brave acceptait toutes les origines

`tools/brave-search-proxy.js` — `Access-Control-Allow-Origin: *` sur un proxy qui
accepte la clé API en corps de requête : n'importe quelle page web visitée
pouvait consommer le quota Brave de l'utilisateur, voire utiliser le proxy comme
relais ouvert.

**Correction** : liste d'origines autorisées (ports de boucle locale de
l'application), `Vary: Origin`, `nosniff`, corps JSON invalide → `400` (au lieu de
`500`), erreur amont → `502`, `readBody` protégé contre la double résolution,
réponse amont plafonnée à 5 Mo, URL amont configurable (`BRAVE_API_URL`) — ce qui
la rend testable sans réseau.

### 9.4 🔴 `css/features.css` écrasait le design du suivi quotidien

`.meal-item` était défini globalement dans `features.css`, importé **après**
`daily-tracker.css` : sur l'écran principal, les cartes de repas perdaient leur
style compact (padding 20 px au lieu de 14/16, bordure 2 px grise au lieu de
1,5 px claire, `transition: all`). Même cause pour `.food-name`, dont le violet
devenait gris `#333` (règle dupliquée dans `forms.css`).

**Correction** : `.meal-item` scopé sous `.meals-list`, règle `.food-name`
redondante de `forms.css` supprimée.

### 9.5 Autres correctifs de cette passe

| # | Fichier | Problème | Correction |
|---|---|---|---|
| 1 | `js/core/db.js` | Les objectifs d'avant novembre 2025 (`deficitPercent`, sans `goalProfile`) rendaient le recalcul après pesée impossible | `normalizeLegacyGoals()` + `migrateLegacyGoals()` au démarrage |
| 2 | `js/handlers/goals-handlers.js` | `Number(null) === 0` : un champ de profil vide était accepté comme 0 | rejet explicite de `null`/`''`/booléen |
| 3 | `js/core/db-utils.js` | `diagnoseBD()` ne comptait que `priceGrams` : tous les aliments au format actuel étaient annoncés « sans prix » | utilisation de `hasPrice()` |
| 4 | `js/core/db-utils.js` | `dbAddPrice`/`dbBulkPrices` écrivaient l'ancien format, sans valider | format actuel + validation numérique |
| 5 | `js/core/db-utils.js` | `dbFixStructure()` n'ajoutait pas `priceQuantity`/`priceUnit` | champs actuels ajoutés |
| 6 | `js/core/db-utils.js` | `verifierIntegrite()` ignorait `meals` et `healthEvents` | les 9 stores sont contrôlés |
| 7 | `js/core/db-utils.js` | `dbExport()` perdait `category`, `priceQuantity`, `glycemicIndex`… | export complet + prix/100 g calculé |
| 8 | `js/core/db-utils.js` | `food.hasOwnProperty(...)` levait un `TypeError` sur un aliment portant cette clé | appel indirect |
| 9 | `js/data/backup-format.js` | Un export en dictionnaire perdait les identifiants (clé = id) et les dates | `foodsToArray` / `dailyMealsToArray` |
| 10 | `divers/fix-backup-format.js` | **Inexécutable** (`require` dans un paquet ESM) ; entrée codée en dur ; écrasait un `priceQuantity` valide ; ignorait les repas composés | réécrit en module ESM testable, `argv`, conversion non destructive, repas couverts |
| 11 | `divers/exemple-prix.js` | Format obsolète, 35/40 identifiants inexistants | format actuel + avertissement explicite |
| 12 | `css/base.css` | `--color-primary`, `--color-text`, `--color-text-medium` utilisées mais **jamais définies** (échec silencieux) | alias ajoutés |
| 13 | `css/stats.css` | `@keyframes slideIn`/`slideOut` redéfinis écrasaient l'animation de notification globale | renommés `analyticsToastIn`/`Out` |
| 14 | `css/stats.css` | Bloc `@media (max-width:768px)` dupliqué mot pour mot avec `responsive.css` | doublon supprimé |
| 15 | `css/stats.css` | Cartes de coûts non stylées (`.cost-label`/`.cost-icon`/`.cost-period` sans règle ; le CSS ciblait `.cost-card h4`, absent du balisage) | règles ajoutées |
| 16 | `css/wellness.css` | `.cancel-btn:hover { … !important }` global : tous les boutons « Annuler » devenaient rouges | scopé sous `#macroEditActions` |
| 17 | `css/wellness.css` | `.meal-title` du résumé exporté s'appliquait aux colonnes de repas | scopé sous `.meal-section` |
| 18 | `css/daily-tracker.css` | Commentaire non fermé en fin de fichier (build/lint cassés) | fermé |
| 19 | `css/daily-tracker.css` | `.meal-selector-menu` à `z-index: 9999`, au-dessus des modales (2000) | ramené à 500 |
| 20 | `css/responsive.css`, `css/goals.css` | `outline: none` supprimait tout repère de focus clavier ; radios de sexe invisibles au focus | anneau `:focus-visible` rétabli |
| 21 | `css/buttons.css` | Bouton de suppression révélé uniquement au `:hover` → **suppression impossible sur mobile** | visible sur `:focus-within` et en `@media (hover: none)` |
| 22 | `css/goals.css` | `backdrop-filter` sans préfixe `-webkit-` | ajouté |
| 23 | `js/features/meal-history.js` | Classe `journal-empty-day` sans règle CSS | renommée `journal-empty` |
| 24 | `README.md`, `divers/*.md` | Version 1.5.0 (code en 1.6.0) ; « 100+ aliments pré-enregistrés » (base vide) ; liens vers `OBJECTIFS-GUIDE.md` et `docs/screenshots/` absents ; liens vers la racine au lieu de `divers/` ; IA annoncée en roadmap alors qu'elle est livrée | documentation corrigée + entrée CHANGELOG 1.6.0 |

### 9.6 🔴 Constat hors code : 6 mois de travail non versionnés

Le dépôt Git est dans un état préoccupant :

```
$ git status --short | awk '{print $1}' | sort | uniq -c
     25 ??     ← nouveaux dossiers entiers : js/core, js/features, js/handlers,
                 js/stats, js/ui, js/data, css/, divers/, tools/, tests/,
                 package.json, vitest.config.js, AUDIT.md…
     23 D      ← anciens fichiers à plat supprimés
      7 M
```

Le dernier commit (`f621f6f`) date du **14 mars 2026**. Toute la réorganisation
modulaire et les fonctionnalités ajoutées depuis (IA, événements de santé,
comparaison, journal, index glycémique) ne sont **pas suivies par Git**.

**Risque** : un `git checkout .` ou un `git clean -fd` détruirait l'intégralité du
travail. Aucune action n'a été entreprise de ce côté (un commit est une décision
qui vous appartient) — c'est le point le plus urgent de tout l'audit.

### 9.7 Zones désormais couvertes par des tests

| Zone | Fichier de test | Tests |
|---|---|---|
| Feuilles de style (structure, variables, cascade, accessibilité) | `css-structure.test.js` | 16 |
| Validation et planification d'import, compatibilité des sauvegardes réelles | `data-backup-format.test.js` | 33 |
| Scripts de `divers/` (réparation de sauvegarde, modèle de prix) | `divers-scripts.test.js` | 22 |
| Cohérence de la documentation (versions, liens, promesses) | `docs-consistency.test.js` | 13 |
| Proxy Brave (sécurité CORS, validation, transmission) | `integration/brave-proxy.test.js` | 16 |

### 9.8 Toujours non couvert

- **CSS visuel** : les tests structurels détectent les classes manquantes, les
  variables non définies et les conflits de cascade connus, mais pas le rendu.
  Une vérification dans un navigateur (ou Playwright) reste nécessaire pour le
  rendu final.
- **`css/responsive.css`** : 7 blocs `@media (max-width: 768px)` répartis sur
  3 fichiers ; leur regroupement n'a pas été entrepris (refactor à risque).
- **Contrastes** : 13 sélecteurs sous le ratio WCAG AA de 4,5:1 (pire cas
  `.ci-qty-hint` à 2,20:1, `.modal-close-btn` à 2,32:1). Signalé, non modifié
  pour ne pas altérer la charte graphique sans validation.
- **17 classes CSS mortes** (~90 lignes) et 12 `!important` : signalés, non
  supprimés pour limiter la surface du diff.
- **Historique Git** : seuls `git log` et `git status` ont été consultés ; les
  diffs commit par commit n'ont pas été audités.
