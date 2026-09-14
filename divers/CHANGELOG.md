# 📋 Changelog - Nutrition Tracker

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

---

## [1.6.0] - 2026-09-14

### 🐛 Corrections de bugs (audit complet)

#### Données — intégrité et compatibilité
- Les lignes de repas à l'ancien format (`foodId`/`uid`) sont converties
  automatiquement : elles comptaient **0 kcal** et étaient non supprimables.
- Les objectifs enregistrés par les versions antérieures à novembre 2025
  (`deficitPercent`, sans `goalProfile`) sont migrés au démarrage.
- `saveDayMeals` ne supprime plus les champs qu'il ne connaît pas (`mealTimes`…).
- L'import ne vide plus les stores absents du fichier : restaurer une ancienne
  sauvegarde **effaçait tous les événements de santé**.
- Un échec d'écriture pendant un import restaure désormais les données précédentes.

#### Calculs
- Moyennes mensuelles : un mois sur deux était sauté et les libellés décalés.
- Comparaison d'aliments : les repas non ajustables étaient normalisés deux fois
  (jusqu'à un facteur 5 d'erreur).
- Les jours sans pesée ne sont plus comptés comme 0 kg dans les moyennes.
- Effacer la durée de sommeil enregistrait 0 h au lieu de vider le champ.
- Un profil incomplet n'enregistre plus d'objectifs `NaN`.

#### Interface et sécurité
- Rétablissement du bloc responsive tactile (`responsive.css`) : les cibles de
  44 px et la neutralisation du survol n'étaient plus appliquées.
- `.meal-item` et `.food-name` : les styles du suivi quotidien n'étaient plus
  écrasés par d'autres feuilles.
- Échappement HTML des noms d'aliments et de repas (XSS stocké).
- Le serveur local n'expose plus `.git/` ni les sauvegardes JSON.
- Le proxy Brave n'autorise plus toutes les origines (`*`).

### ✅ Tests
- Ajout d'une suite de **856 tests** (Vitest + jsdom + fake-indexeddb),
  dont 3 tests d'intégration (application complète, serveur local, proxy Brave).

---

## [1.5.1] - 2026-03-14

### 🐛 Corrections de bugs

#### Suivi quotidien - duplication et déplacement d'une carte
- Correction d'un bug où une carte dupliquée puis déplacée restait affichée dans son repas d'origine
- Refactorisation du drag & drop des cartes repas pour s'appuyer uniquement sur `sourceMeal` et `uniqueId`
- Fiabilisation du déplacement entre repas avec rechargement complet depuis IndexedDB après le drop

---

## [1.5.0] - 2025-11-01

### ✨ Nouvelles fonctionnalités

#### Prix personnalisé pour les repas ajustables
- Ajout d'une checkbox et d'un champ de saisie dans la modale d'ajustement des portions
- Possibilité de définir un prix personnalisé qui remplace le prix calculé
- Le prix personnalisé est sauvegardé et réutilisé lors de la réouverture de la modale
- Mise à jour en temps réel de l'aperçu du coût dans la modale

#### Intégration complète du prix personnalisé
- Prix personnalisé utilisé dans les en-têtes de repas (coût par type de repas)
- Prix personnalisé affiché sur les cartes d'aliments individuels
- Prix personnalisé intégré dans le résumé quotidien
- Prix personnalisé inclus dans les exports et copies de résumé
- Prix personnalisé pris en compte dans les calculs de coûts totaux et statistiques

#### Recherche dans l'onglet Repas
- Ajout d'un champ de recherche pour filtrer les repas par nom
- Filtrage en temps réel à chaque frappe
- Message explicite si aucun résultat trouvé

#### Système de profils multiples pour les objectifs
- **5 profils disponibles** : Sèche, Perte de poids, Prise de masse, Maintien, Recomposition
- Chaque profil avec ses propres ratios de macronutriments optimisés
- Sélecteur d'intensité adapté à chaque profil (déficit/surplus/ajustement)
- Calculs automatiques spécifiques selon le profil choisi
- Documentation complète avec exemples de calcul (OBJECTIFS-GUIDE.md)

#### Conseils personnalisés par profil
- Conseils dynamiques qui s'adaptent au profil sélectionné
- Informations spécifiques sur les objectifs de perte/gain hebdomadaire
- Recommandations sur l'entraînement et l'alimentation
- Conseils de suivi et d'ajustement personnalisés
- Mise à jour automatique lors du changement de profil

### 🔧 Améliorations

#### Résumé quotidien
- Les ingrédients à 0g dans les repas ajustables sont maintenant affichés
- Nom de l'ingrédient barré (strikethrough)
- Poids affiché à 0g
- Prix affiché à 0.00€

#### Comparaison d'aliments
- Amélioration du label de l'axe X : "Quantité de macronutriments (g)"
- Titre du graphique dynamique selon le mode de comparaison
- Ajout d'un texte explicatif sous le titre qui change selon le mode :
  - Mode 100g : "Comparaison des valeurs nutritionnelles pour 100g de chaque aliment."
  - Mode 200 kcal : "Comparaison des quantités nécessaires de chaque aliment pour atteindre 200 kcal."
  - Mode 2€ : "Comparaison des quantités que vous obtenez pour 2€ de chaque aliment."

### 🐛 Corrections de bugs

#### Normalisation des repas composés dans la comparaison
- Correction de la normalisation sur 100g pour TOUS les repas composés (pas seulement ceux avec `isPortionAdjustable`)
- Les repas composés sont maintenant correctement comparés sur une base 100g

---

## [1.4.0] - 2025-10-28

### ✨ Nouvelles fonctionnalités
- Système de repas composés avec gestion des ingrédients
- Repas ajustables avec portions personnalisables
- Export/import sélectif d'aliments et repas
- Gestion des dépendances automatiques lors de l'export

### 🔧 Améliorations
- Interface utilisateur améliorée pour la gestion des repas
- Calculs nutritionnels optimisés pour les repas composés

---

## [1.0.0] - 2025-10-XX

### 🎉 Version initiale
- Suivi quotidien des repas et aliments
- Gestion des objectifs nutritionnels
- Statistiques et graphiques
- Système d'hydratation et d'activités
- Base de données IndexedDB
- Export/import des données complètes
- Analyse des aliments
- Comparaison d'aliments

---

## Format

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

### Types de changements
- ✨ **Nouvelles fonctionnalités** : Ajout de nouvelles fonctionnalités
- 🔧 **Améliorations** : Améliorations de fonctionnalités existantes
- 🐛 **Corrections de bugs** : Corrections d'anomalies
- 🔒 **Sécurité** : Corrections de vulnérabilités
- ⚠️ **Dépréciations** : Fonctionnalités dépréciées
- 🗑️ **Suppressions** : Fonctionnalités supprimées
