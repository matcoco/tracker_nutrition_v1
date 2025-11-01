# 📋 Changelog - Nutrition Tracker

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

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
