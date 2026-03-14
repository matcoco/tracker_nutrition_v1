# Tracker Nutritionnel

<div align="center">

![Version](https://img.shields.io/badge/version-1.6.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![JavaScript](https://img.shields.io/badge/javascript-100%25-yellow.svg)
![Responsive](https://img.shields.io/badge/responsive-mobile%20%7C%20tablet%20%7C%20desktop-purple.svg)

**Application web complète pour suivre alimentation, activite physique et bien-etre au quotidien.**

[Documentation](#fonctionnalites) | [Installation](#installation) | [Structure](#structure-du-projet) | [Changelog](CHANGELOG.md)

</div>

---

## Vue d'ensemble

Tracker Nutritionnel est une application front-end pure (HTML / CSS / Vanilla JS ES6 modules) qui stocke toutes les donnees localement dans IndexedDB. Aucun serveur, aucun compte, aucune donnee envoyee en ligne.

L'application s'organise en **7 onglets** :

| Onglet | Description |
|--------|-------------|
| **Suivi Quotidien** | Journal alimentaire du jour, hydratation, pas, activites, poids, tour de ventre |
| **Statistiques** | 6 sous-sections de graphiques et analyses (evolution, moyennes, couts, activites, aliments, journal) |
| **Objectifs** | Calculateur TDEE multi-profils avec conseils personnalises |
| **Aliments** | Base de 100+ aliments, ajout/edition/suppression, filtres par categorie, prix |
| **Repas** | Creation de repas composes avec ingredients et portions ajustables |
| **Comparaison** | Comparaison visuelle d'aliments/repas sur base 100 g, 200 kcal ou 2 EUR |
| **Parametres** | Import/export JSON, reinitialisation, outils de diagnostic |

---

## Fonctionnalites

### Suivi Quotidien

- **Navigation par date** : jour precedent/suivant, date picker, bouton Aujourd'hui
- **4 types de repas** : petit-dejeuner, dejeuner, diner, snacks
- **Drag & drop** : glisser un aliment depuis la liste vers un repas, deplacer entre repas
- **Ajout rapide** : bouton `+` sur chaque aliment
- **Recherche instantanee** : filtre par nom avec chargement progressif
- **Filtres par categorie** : fruits, legumes, viandes, feculents, etc.
- **Portions personnalisables** : poids en grammes, checkbox recette entiere pour les repas composes
- **Duplication** : dupliquer un aliment deja ajoute
- **Resume journalier** : barres de progression pour calories, proteines, glucides, lipides, sucres, fibres + copie texte
- **Suivi du poids** : enregistrement quotidien (kg)
- **Tour de ventre** : enregistrement quotidien (cm)
- **Hydratation** : ajout rapide par increments (100/250/500 ml), edition manuelle, historique du jour
- **Nombre de pas** : saisie quotidienne
- **Activites physiques** : ajout de seances (type, duree, calories brulees), activites personnalisees

### Statistiques (6 sous-sections)

Toutes les sections partagent le **selecteur de periode global** : 7 / 14 / 30 / 90 / 180 / 365 jours, Tout, ou plage de dates personnalisee. L'etat de la configuration (periodes, section active) est **persiste dans localStorage** et restaure au rechargement.

#### Evolution

11 graphiques interactifs (Chart.js) avec regroupement automatique (quotidien / hebdomadaire / mensuel selon la periode) :

- Calories (ligne + objectif)
- Repartition macronutriments (donut : proteines, glucides, lipides, sucres, fibres)
- Proteines, Glucides, Lipides (barres + objectif)
- Sucres (barres + 3 seuils : 25 g ideal, 50 g recommande, 100 g max)
- Fibres (barres + seuil min)
- Poids (ligne avec spanGaps)
- Tour de ventre (ligne)
- Hydratation (barres + objectif)
- Nombre de pas (barres + objectif)

#### Moyennes

9 graphiques de moyennes hebdomadaires (12 semaines) ou mensuelles (6 mois) : calories, proteines, glucides, lipides, fibres, poids, tour de ventre, hydratation, pas.

#### Couts

- **Cartes de synthese** : cout total, cout moyen/jour, projection mensuelle
- **4 graphiques** : evolution des couts quotidiens, repartition par repas, top 5 aliments les plus chers, comparaison hebdo/mensuelle
- Periode independante : 7 / 14 / 30 jours

#### Activites physiques

- **6 graphiques** : calories brulees/jour, temps d'activite total, repartition par type, top 5, calories par type, comparaison hebdo/mensuelle
- Periode independante : 7 / 14 / 30 jours

#### Analyse par aliment

- **Cartes de synthese** : nombre d'aliments differents, poids total, cout total
- **Tableau detaille triable** : par nom, poids, cout, proteines, glucides, lipides, fibres, sucres, prot/100 g, prix/100 g de proteines
- **Selecteur de colonnes** : afficher/masquer chaque colonne de macro
- **Export** : copie presse-papier + export CSV
- **2 graphiques** : top 10 poids consomme, top 10 cout total
- Periode independante : 7 / 30 / 365 jours

#### Journal des repas

- **Timeline chronologique** par jour (du plus recent au plus ancien)
- **Card par jour** depliable : date, badge Aujourd'hui, nombre d'aliments, macros resumes en badges colores
- **Barre de macros** coloree (proteines / glucides / lipides) avec pourcentages
- **Detail par type de repas** : petit-dejeuner, dejeuner, diner, snacks
- **Ligne par aliment** : nom, poids, calories, macros, badge REPAS pour les repas composes
- Synchronise avec la periode principale des stats

### Objectifs nutritionnels

- **5 profils** : Seche, Perte de poids, Prise de masse, Maintien, Recomposition
- **Formule Mifflin-St Jeor** pour le metabolisme de base
- **TDEE adaptatif** selon 5 niveaux d'activite (sedentaire a tres actif)
- **Curseur d'intensite** adapte a chaque profil (deficit/surplus/ajustement)
- **Macros optimises** : ratios proteines/glucides/lipides specifiques par profil
- **Conseils personnalises** : recommandations dynamiques sur l'entrainement, l'alimentation, le suivi
- **Objectifs hydratation et pas** personnalisables

### Base de donnees aliments

- **100+ aliments pre-enregistres** avec valeurs nutritionnelles et prix
- **Ajout / edition / suppression** d'aliments personnalises
- **Filtres par categorie** : tous, fruits, legumes, viandes, poissons, feculents, etc.
- **Gestion des prix** : prix d'achat et poids d'achat pour calcul automatique du cout/100 g
- **Recherche** avec chargement progressif (10 resultats a la fois)

### Repas composes

- **Creation de recettes** : combiner plusieurs aliments avec quantites
- **Recherche d'ingredients** : champ de recherche avec dropdown filtre dans le formulaire
- **Portions ajustables** : les repas marques ajustables permettent de modifier le poids consomme
- **Prix personnalise** : possibilite de definir un prix custom pour un repas
- **Recherche de repas** : filtre en temps reel dans la liste des repas
- **Calculs automatiques** : nutrition et couts mis a jour en temps reel

### Comparaison d'aliments

- **3 modes de comparaison** : pour 100 g, pour 200 kcal, pour 2 EUR
- **Selection multiple** : comparer jusqu'a N aliments/repas simultanement
- **Graphique barres groupees** : proteines, glucides, lipides cote a cote
- **Labels dynamiques** et texte explicatif adapte au mode choisi
- **Inclut les repas composes** normalises sur 100 g

### Import / Export / Parametres

- **Export complet** en JSON (aliments, repas, journal, objectifs, eau, pas, activites)
- **Import** avec remplacement complet ou fusion
- **Export/import selectif** d'aliments et repas avec gestion des dependances
- **Reinitialisation** de la base de donnees
- **Outils de diagnostic** accessibles en console : `dbDiagnose()`, `dbCheck()`, `dbExport()`, `dbFixStructure()`

### Bien-etre & Activite

- **Hydratation** : boutons rapides (100/250/500 ml), edition, reset, historique, objectif
- **Pas** : saisie quotidienne, objectif
- **Activites physiques** : selection parmi une liste d'activites (course, velo, natation, musculation...) + activites personnalisees
- **Graphiques dedies** dans les statistiques (evolution + moyennes)

### Technique & Confidentialite

- **100 % local** : IndexedDB, aucun serveur, aucune donnee envoyee
- **Offline-ready** : fonctionne sans connexion (sauf CDN Chart.js)
- **Responsive** : mobile, tablette, desktop
- **Persistance de l'etat stats** : la configuration des statistiques (periodes, section active) est sauvegardee dans localStorage

---

## Technologies

| Technologie | Usage |
|------------|-------|
| **HTML5** | Structure semantique |
| **CSS3** | Design moderne, variables CSS, responsive, animations |
| **JavaScript ES6+** | Vanilla JS, modules natifs, async/await |
| **Chart.js** | Graphiques interactifs (CDN) |
| **IndexedDB** | Base de donnees locale persistante |
| **localStorage** | Persistance de la configuration stats |

**Architecture** : pattern MVC avec 14 modules JS specialises, zero framework, zero build step.

---

## Installation

### Prerequis

- Navigateur moderne (Chrome, Firefox, Edge, Safari)
- Serveur HTTP local (les modules ES6 ne fonctionnent pas en `file://`)

### Demarrage

```bash
git clone https://github.com/matcoco/tracker_nutrition_v1.git
cd tracker_nutrition_v1

# Option 1 : VS Code Live Server (extension)
# Option 2 : Python
python -m http.server 8000
# Option 3 : Node.js
npx http-server
```

Ouvrez `http://localhost:8000` dans votre navigateur.

---

## Structure du projet

```
nutrition-tracker/
├── index.html                  # Point d'entree unique (SPA)
├── css/
│   └── style.css               # Styles (4600+ lignes)
├── js/
│   ├── app.js                  # Orchestration, state, event listeners
│   ├── db.js                   # CRUD IndexedDB (8 stores)
│   ├── ui.js                   # Manipulation DOM, modales, notifications
│   ├── utils.js                # Calculs nutritionnels, TDEE, couts
│   ├── charts.js               # Graphiques evolution (Chart.js)
│   ├── costs.js                # Graphiques analyse des couts
│   ├── activities-charts.js    # Graphiques activites physiques
│   ├── food-analysis.js        # Analyse detaillee par aliment
│   ├── food-comparison.js      # Comparaison d'aliments
│   ├── meals.js                # Gestion des repas composes
│   ├── meal-history.js         # Journal des repas (timeline)
│   ├── import-export.js        # Import/export JSON
│   ├── db-utils.js             # Diagnostic et reparation DB
│   └── config.js               # Configuration, aliments par defaut
├── CHANGELOG.md
├── FONCTIONNALITES.md
├── OBJECTIFS-GUIDE.md
├── GUIDE-PRIX.md
└── LICENSE
```

### Stores IndexedDB

| Store | Cle | Contenu |
|-------|-----|---------|
| `foods` | `id` | Aliments (nom, calories, macros, prix) |
| `meals` | `id` | Repas composes (ingredients, portions) |
| `dailyMeals` | `date` | Journal alimentaire + poids + tour de ventre |
| `goals` | `id` | Objectifs nutritionnels |
| `dailyWater` | `date` | Hydratation quotidienne |
| `dailySteps` | `date` | Nombre de pas quotidien |
| `dailyActivities` | `date` | Activites physiques quotidiennes |
| `customActivities` | `id` | Activites personnalisees |

---

## Personnalisation

### Couleurs

```css
:root {
    --color-primary-start: #667eea;
    --color-primary-end: #764ba2;
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-danger: #ef4444;
}
```

### Aliments par defaut

Editez `js/config.js` pour ajouter des aliments a la base initiale.

---

## Problemes connus

- IndexedDB est efface en navigation privee
- Les modules ES6 necessitent un serveur HTTP (pas `file://`)
- Chart.js est charge via CDN (connexion necessaire au premier chargement)

---

## Documentation

- [FONCTIONNALITES.md](FONCTIONNALITES.md) - Liste exhaustive des fonctionnalites
- [OBJECTIFS-GUIDE.md](OBJECTIFS-GUIDE.md) - Guide des calculs d'objectifs (5 profils, exemples)
- [CHANGELOG.md](CHANGELOG.md) - Historique des versions
- [GUIDE-PRIX.md](GUIDE-PRIX.md) - Guide de reparation base de donnees prix

---

## Licence

MIT - voir [LICENSE](LICENSE).

---

## Auteur

**matcoco** - [GitHub](https://github.com/matcoco)

---

<div align="center">

**Si ce projet vous plait, n'hesitez pas a lui donner une etoile sur GitHub.**

</div>
