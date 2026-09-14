# 🍽️ Tracker Nutritionnel
# matcoco
<div align="center">

![Version](https://img.shields.io/badge/version-1.6.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![JavaScript](https://img.shields.io/badge/javascript-100%25-yellow.svg)
![Responsive](https://img.shields.io/badge/responsive-mobile%20%7C%20tablet%20%7C%20desktop-purple.svg)

**Une application web moderne et intuitive pour suivre votre alimentation quotidienne**

[📖 Documentation](#-fonctionnalités) • [🐛 Signaler un Bug](../../issues) • [✨ Demander une Fonctionnalité](../../issues)

</div>

---

## 📸 Aperçu

> ℹ️ **Captures d'écran** : le dossier `docs/screenshots/` n'existe pas dans ce dépôt.
> Lancez l'application (`node tools/nutrition-app-server.js`) pour la voir.

Les captures d'écran ne sont pas versionnées.

---

## 🆕 Nouveautés Version 1.5.0

Cette version majeure apporte des fonctionnalités essentielles pour personnaliser vos objectifs :

### 🎯 **5 Profils d'Objectifs Nutritionnels**
- **🔥 Sèche** : Déficit 10-25%, protéines 2.2g/kg
- **📉 Perte de poids** : Déficit 10-20%, protéines 1.8g/kg
- **💪 Prise de masse** : Surplus 5-20%, protéines 2.0g/kg
- **⚖️ Maintien** : Ajustement -2% à +2%, protéines 1.6g/kg
- **🎯 Recomposition** : Déficit 5-10%, protéines 2.4g/kg

### 📝 **Améliorations Clés**
- 💡 **Conseils personnalisés** : Recommandations dynamiques selon votre profil
- 💰 **Prix personnalisé** : Définissez un prix custom pour vos repas ajustables
- 🔍 **Recherche de repas** : Filtrez vos repas composés en temps réel
- 📊 **Comparaison améliorée** : Labels dynamiques et textes explicatifs
- 📚 **Documentation complète** : voir [divers/FONCTIONNALITES.md](divers/FONCTIONNALITES.md)

**🔗 Documentation complète** : Consultez [divers/FONCTIONNALITES.md](divers/FONCTIONNALITES.md) pour tous les détails

---

## ✨ Fonctionnalités

### 📊 Suivi Nutritionnel Complet
- ✅ **Tracking en temps réel** : Calories, protéines, glucides, lipides, sucres, fibres
- ✅ **Barres de progression visuelles** : Visualisez vos objectifs en un coup d'œil
- ✅ **Système de repas** : Petit déjeuner, déjeuner, dîner, snacks
- ✅ **Suivi du poids** : Enregistrement quotidien et graphique d'évolution
- ✅ **Résumé journalier** : Format texte copiable avec tous les détails

### 🎯 Gestion Intelligente
- ✅ **Drag & Drop** : Déplacez vos aliments entre les repas
- ✅ **Ajout rapide** : Bouton + pour ajouter instantanément
- ✅ **Recherche instantanée** : Trouvez vos aliments en quelques secondes
- ✅ **Portions personnalisables** : Ajustez les quantités en grammes

### 📈 Statistiques & Analyses
- ✅ **Graphiques interactifs** : Chart.js pour des visualisations élégantes
- ✅ **Multi-périodes** : Analyses sur 7, 14 ou 30 jours
- ✅ **Graphique de poids** : Suivez votre évolution corporelle
- ✅ **Répartition macros** : Donut chart des macronutriments (incluant fibres et sucres)
- ✅ **Moyennes hebdomadaires/mensuelles** : Analyses sur 12 semaines ou 6 mois
- ✅ **Graphiques de sucres** : 3 seuils de recommandation (25g/50g/100g)
- ✅ **Graphiques de fibres** : Suivi vs objectif minimum

### 🎯 Calcul d'Objectifs Multi-Profils
- ✅ **5 profils disponibles** : Sèche, Perte de poids, Prise de masse, Maintien, Recomposition
- ✅ **Formule Mifflin-St Jeor** : Calcul du métabolisme de base (MB)
- ✅ **TDEE adaptatif** : Selon votre niveau d'activité
- ✅ **Macros optimisés** : Ratios spécifiques pour chaque profil
- ✅ **Conseils personnalisés** : Recommandations adaptées à votre objectif
- ✅ **Documentation complète** : voir [divers/FONCTIONNALITES.md](divers/FONCTIONNALITES.md)

### 🍽️ Repas Composés
- ✅ **Création de repas** : Combinez plusieurs aliments
- ✅ **Portions ajustables** : Personnalisez les quantités
- ✅ **Prix personnalisé** : Définissez un prix custom pour vos repas
- ✅ **Recherche instantanée** : Filtrez vos repas en temps réel
- ✅ **Calculs automatiques** : Nutrition et coûts mis à jour

### 🥗 Base de Données Aliments
- ✅ **Base d'aliments personnelle** : l'application démarre avec une base **vide**
  (`defaultFoods = {}`) ; vous créez vos propres aliments (manuelle, IA, import)
- ✅ **Ajout d'aliments personnalisés** : Créez votre propre bibliothèque
- ✅ **Modification facile** : Cliquez pour éditer
- ✅ **Gestion des prix** : Prix au 100g et par portion
- ✅ **Import/Export** : Sauvegardez vos données en JSON (format 1.6.0)

### 📱 Design Moderne
- ✅ **100% Responsive** : Mobile, tablette, desktop
- ✅ **Interface épurée** : Design Material-inspired
- ✅ **Dark mode ready** : Variables CSS pour thème sombre
- ✅ **Animations fluides** : Transitions CSS optimisées

### 💰 Gestion des Coûts
- ✅ **Suivi budgétaire** : Prix des aliments et calcul automatique
- ✅ **Coût par repas** : Affichage du coût de chaque repas
- ✅ **Coût journalier** : Total des dépenses alimentaires
- ✅ **Analyses des coûts** : Graphiques sur 7/14/30 jours
- ✅ **Top 5 aliments chers** : Identification des postes de dépense
- ✅ **Projection mensuelle** : Estimation du budget alimentaire

### 🥗 Analyse par Aliment
- ✅ **Consommation détaillée** : Poids et coût par aliment
- ✅ **Ratio qualité-prix** : Prix pour 100g de protéines
- ✅ **Tableau triable** : Tri par nom, poids, coût, macros
- ✅ **Export CSV** : Téléchargement des analyses
- ✅ **Top 10 graphiques** : Visualisation des aliments principaux

### 💧 Bien-être & Activité
- ✅ **Suivi hydratation** : Enregistrement quotidien (ml)
- ✅ **Nombre de pas** : Suivi de l'activité quotidienne
- ✅ **Activités physiques** : Enregistrement des sports (durée, calories)
- ✅ **Activités personnalisées** : Créez vos propres types d'activités
- ✅ **Graphiques wellness** : Hydratation et pas sur plusieurs périodes

### 🔒 Confidentialité
- ✅ **Données locales** : Stockage IndexedDB dans votre navigateur
- ✅ **Aucun serveur** : Vos données ne quittent jamais votre appareil
- ✅ **Offline-ready** : Fonctionne sans connexion internet

---

## 🛠️ Technologies

<div align="center">

| Technologie | Description |
|------------|-------------|
| ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white) | Structure sémantique |
| ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white) | Design moderne avec variables CSS |
| ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black) | Vanilla JS (ES6+) modules |
| ![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white) | Graphiques interactifs |
| ![IndexedDB](https://img.shields.io/badge/IndexedDB-00758F?style=flat&logo=database&logoColor=white) | Base de données locale |

</div>

**Architecture :**
- 🏗️ **Pattern MVC** : Séparation claire des responsabilités
- 📦 **ES6 Modules** : Code modulaire et maintenable
- 🎨 **CSS Variables** : Thème facilement personnalisable
- ⚡ **Performance optimisée** : Pas de framework lourd

---

## 🚀 Installation

### Prérequis
- Un navigateur moderne (Chrome, Firefox, Edge, Safari)
- Un serveur local pour le développement (Live Server, http-server, etc.)

### Méthode 1 : Cloner le repository

```bash
# Cloner le projet
git clone https://github.com/matcoco/tracker_nutrition_v1.git

# Aller dans le dossier
cd tracker_nutrition_v1

# Ouvrir avec un serveur local
# Option 1 : VS Code Live Server
# Option 2 : Python
python -m http.server 8000
# Option 3 : Node.js
npx http-server
```

### Méthode 2 : Téléchargement direct

1. Téléchargez le ZIP du projet
2. Extrayez l'archive
3. Ouvrez `index.html` avec un serveur local

> ⚠️ **Important** : Ne pas ouvrir directement `index.html` avec `file://` car les modules ES6 nécessitent un serveur HTTP.

---

## 📖 Utilisation

### Démarrage rapide

1. **Ouvrez l'application** dans votre navigateur
2. **Configurez vos objectifs** (onglet 🎯 Objectifs)
3. **Ajoutez vos aliments** pour la journée
4. **Suivez votre progression** avec les barres visuelles

### Fonctionnalités détaillées

#### 📅 Suivi Quotidien

**Ajouter un aliment :**
- **Méthode 1** : Glissez-déposez depuis la liste
- **Méthode 2** : Cliquez sur le bouton `+` (ajout rapide)
- **Méthode 3** : Recherchez puis drag & drop

**Gérer vos repas :**
- Modifiez les portions en grammes
- Déplacez entre repas (drag & drop)
- Supprimez avec le bouton `✕`

#### 📊 Statistiques

1. Sélectionnez la période (7, 14 ou 30 jours)
2. Consultez les graphiques :
   - **Calories** : Évolution sur la période
   - **Macros** : Répartition en donut chart
   - **Poids** : Suivi de votre courbe
   - **Nutriments** : Barres par jour

#### 🎯 Objectifs

1. Renseignez vos informations :
   - Sexe, âge, taille, poids
   - Niveau d'activité physique
   - Objectif (perte/maintien/prise)
2. Le calcul automatique vous propose :
   - Calories journalières
   - Répartition en protéines/glucides/lipides

#### 🥗 Aliments

- **Recherchez** dans la barre de recherche
- **Cliquez** sur un aliment pour le modifier
- **Ajoutez** de nouveaux aliments personnalisés

#### ⚙️ Paramètres

- **Exportez** vos données (backup JSON)
- **Importez** des données précédentes
- **Réinitialisez** (attention : action irréversible)

---

## 📁 Structure du Projet

```
nutrition-tracker/
├── 📄 index.html              # Point d'entrée
├── 📁 css/
│   └── style.css              # Styles (2000+ lignes)
├── 📁 js/
│   ├── app.js                 # Point d'entrée & orchestration
│   ├── config.js              # Configuration, version de schéma, données par défaut
│   ├── core/                  # db, utils, state, db-utils
│   ├── ui/                    # ui-core, ui-meals
│   ├── stats/                 # graphiques, coûts, activités, comparaison, analyse
│   ├── features/              # repas, journal, comparaison, santé, assistants IA
│   ├── handlers/              # gestionnaires d'événements par domaine
│   └── data/                  # import/export, validation de sauvegarde
├── 📁 tests/                  # Suite de tests (Vitest + jsdom)
├── 📁 divers/                 # Documentation et guides
├── 📄 README.md               # Documentation principale
└── 📄 AUDIT.md                # Rapport d'audit et couverture de tests
```

### Modules JavaScript

| Dossier | Modules | Responsabilité |
|---------|---------|----------------|
| *(racine)* | `app.js`, `config.js` | Initialisation, orchestration, configuration |
| `core/` | `db.js`, `utils.js`, `state.js`, `db-utils.js` | IndexedDB, calculs, état global, diagnostic |
| `ui/` | `ui-core.js`, `ui-meals.js` | Affichage, modales, notifications |
| `stats/` | `charts.js`, `charts-averages.js`, `costs.js`, `activities-charts.js`, `period-comparison.js`, `food-analysis.js` | Graphiques et analyses |
| `features/` | `meals.js`, `meal-history.js`, `food-comparison.js`, `health-events.js`, `ai-food-assistant.js`, `ai-meal-generator.js` | Fonctionnalités métier |
| `handlers/` | `daily-handlers.js`, `food-handlers.js`, `goals-handlers.js`, `activity-handlers.js`, `stats-handlers.js`, `ai-handlers.js` | Écouteurs d'événements |
| `data/` | `import-export.js`, `backup-format.js` | Import/export et validation |

> ℹ️ **Base d'aliments** : l'application démarre avec une base **vide**
> (`defaultFoods = {}` dans `js/config.js`). Les aliments sont créés par
> l'utilisateur (saisie manuelle, import JSON ou assistants IA).

---

## 🎨 Personnalisation

### Modifier les couleurs

Éditez les variables CSS dans `style.css` :

```css
:root {
    --color-primary-start: #667eea;  /* Violet */
    --color-primary-end: #764ba2;    /* Violet foncé */
    --color-success: #10b981;        /* Vert */
    --color-warning: #f59e0b;        /* Orange */
    --color-danger: #ef4444;         /* Rouge */
}
```

### Ajouter des aliments par défaut

Éditez `js/foods-data.js` :

```javascript
export const defaultFoods = {
    'mon-aliment': {
        name: 'Mon Aliment',
        calories: 100,
        proteins: 10,
        carbs: 20,
        fats: 5,
        sugars: 2
    }
};
```

---

## 🗺️ Roadmap

### Version 1.6 (À venir)
- [ ] 🌙 Mode sombre
- [ ] 📸 Scan de codes-barres (Open Food Facts API)
- [ ] 🗑️ Suppression d'aliments
- [ ] 📸 Photos des repas
- [ ] 🏷️ Catégories d'aliments
- [ ] ⭐ Aliments favoris
- [ ] 📊 Graphiques de tendance par profil

### Version 2.0 (Futur)
- [ ] 🍴 Recettes avec calcul automatique
- [ ] 📊 Export PDF des statistiques
- [ ] 🔥 Synchronisation Firebase (multi-appareils)
- [ ] 🔐 Authentification Google
- [ ] 👥 Partage de recettes entre utilisateurs
- [ ] 🤖 Suggestions IA basées sur l'historique
- [ ] 📱 Application mobile native (React Native)
- [ ] 🛒 Génération de liste de courses
- [ ] 📅 Planification de repas hebdomadaire
- [ ] 🔔 Rappels hydratation et repas

---

## 🤝 Contribution

Les contributions sont les bienvenues ! 

### Comment contribuer ?

1. **Forkez** le projet
2. **Créez** une branche (`git checkout -b feature/AmazingFeature`)
3. **Committez** vos changements (`git commit -m 'Add: Amazing Feature'`)
4. **Pushez** vers la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrez** une Pull Request

### Guidelines

- ✅ Code commenté et lisible
- ✅ Respect de l'architecture existante
- ✅ Tests sur mobile/tablette/desktop
- ✅ Commit messages clairs

---

## 🐛 Problèmes Connus

- ⚠️ IndexedDB peut être effacé par le navigateur en mode navigation privée
- ⚠️ Drag & drop nécessite un serveur HTTP (pas `file://`)
- ⚠️ Chart.js nécessite une connexion pour le CDN (ou téléchargement local)

---

## 📝 Licence

Ce projet est sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

```
MIT License

Copyright (c) 2025-2026 matcoco

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 👤 Auteur

**matcoco**

- GitHub: [@matcoco](https://github.com/matcoco)
- Dépôt : [tracker_nutrition_v1](https://github.com/matcoco/tracker_nutrition_v1)

---

## 🙏 Remerciements

- [Chart.js](https://www.chartjs.org/) - Bibliothèque de graphiques
- [Google Fonts](https://fonts.google.com/) - Police Inter
- [Lucide Icons](https://lucide.dev/) - Icônes (inspiration)
- Communauté Open Source 💜

---

## 📚 Ressources Supplémentaires

### Documentation du Projet
- [divers/FONCTIONNALITES.md](divers/FONCTIONNALITES.md) - Liste complète des fonctionnalités
- [divers/CHANGELOG.md](divers/CHANGELOG.md) - Historique des versions
- [divers/GUIDE-PRIX.md](divers/GUIDE-PRIX.md) - Gestion des prix
- [AUDIT.md](AUDIT.md) - Rapport d'audit et couverture de tests
- [tests/README.md](tests/README.md) - Suite de tests unitaires

### Références Externes
- [Documentation IndexedDB](https://developer.mozilla.org/fr/docs/Web/API/IndexedDB_API)
- [Guide Chart.js](https://www.chartjs.org/docs/latest/)
- [Formule Mifflin-St Jeor](https://en.wikipedia.org/wiki/Basal_metabolic_rate#Mifflin_St_Jeor_equation)
- [Guide nutrition](https://www.anses.fr/fr)

---

<div align="center">

**⭐ Si ce projet vous plaît, n'oubliez pas de lui donner une étoile sur GitHub ! ⭐**

Made with ❤️ and ☕

</div>
