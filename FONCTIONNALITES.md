# 📋 Fonctionnalités de l'Application Nutrition Tracker

Application complète de suivi nutritionnel et de gestion des coûts alimentaires.

---

## 🎯 Vue d'Ensemble

**Nutrition Tracker** est une application web progressive (PWA) permettant de :
- 📊 Suivre votre alimentation quotidienne
- 🎯 Définir et atteindre vos objectifs nutritionnels
- 💰 Gérer votre budget alimentaire
- 📈 Analyser vos statistiques sur plusieurs périodes
- 💧 Suivre votre hydratation et activité physique

---

## 📱 Onglets Principaux

### 1️⃣ **Suivi Quotidien**

#### Gestion des Repas
- **4 catégories de repas** : Petit-déjeuner, Déjeuner, Dîner, Snack
- **Drag & Drop** : Glisser-déposer les aliments dans les repas
- **Ajout rapide** : Bouton `+` pour ajouter rapidement
- **Modification du grammage** : Champs numériques modifiables en temps réel
- **Déplacement inter-repas** : Déplacer un aliment d'un repas à un autre
- **Suppression facile** : Bouton `×` sur chaque aliment

#### Résumé de Chaque Repas
Pour chaque repas, affichage automatique de :
- 🔥 Calories totales
- 🥩 Protéines (g)
- 🍚 Glucides (g)
- 🥑 Lipides (g)
- 🍬 Sucres (g)
- 🌾 Fibres (g)
- 💰 **Coût total** (si prix renseignés)

#### Navigation Temporelle
- **Boutons de navigation** : Jour précédent / Jour suivant
- **Retour à aujourd'hui** : Bouton "Aujourd'hui"
- **Affichage de la date** : Date complète en français

#### Suivi du Poids
- **Enregistrement quotidien** du poids
- **Historique** : Conservation de toutes les pesées
- **Graphiques** : Évolution visible dans Statistiques

#### Hydratation
- **Ajout rapide** : Boutons 250ml, 500ml, 750ml, 1L
- **Ajout personnalisé** : Champ pour quantité libre
- **Historique** : Visualisation de tous les apports
- **Suppression** : Correction des erreurs
- **Objectif** : Suivi vs objectif quotidien

#### Nombre de Pas
- **Enregistrement quotidien** des pas
- **Mise à jour** : Modifier à tout moment
- **Objectif** : Suivi vs objectif quotidien

#### Résumé de la Journée
Affichage formaté incluant :
- 📅 Date
- **Liste détaillée** de chaque repas avec :
  - Aliments et grammages
  - Coût individuel (si disponible)
  - **➜ Total du repas** : Calories, macros, coût
- **Totaux de la journée** :
  - 🔥 Calories totales
  - 🥩 Protéines totales
  - 🍚 Glucides totaux
  - 🍬 Sucres totaux
  - 🌾 Fibres totales
  - 🥑 Lipides totaux
  - 💰 **Coût total de la journée**
- **Bouton Copier** : Copie le résumé dans le presse-papiers

#### Aliments Disponibles
- **Liste complète** des aliments
- **Recherche en temps réel** : Filtrage par nom
- **Affichage** : Calories, macros, fibres, **prix/100g**
- **Chargement progressif** : 20 aliments à la fois
- **Bouton "Voir plus"** : Charger plus d'aliments

---

### 2️⃣ **Aliments**

#### Ajout d'Aliments
Formulaire complet avec :
- 📝 **Nom** de l'aliment
- 🔥 **Calories** (kcal/100g)
- 🥩 **Protéines** (g/100g)
- 🍚 **Glucides** (g/100g)
- 🍬 **Sucres** (g/100g)
- 🌾 **Fibres** (g/100g)
- 🥑 **Lipides** (g/100g)
- 💰 **Prix** (€) - *Optionnel mais recommandé*
- 📦 **Grammage de référence** (g) - *Pour le prix*

#### Gestion des Aliments
- **Liste complète** : Tous vos aliments personnalisés
- **Recherche** : Filtrage instantané
- **Modification** : Clic sur un aliment pour éditer
- **Affichage du prix** : Prix/100g visible dans chaque vignette
- **Validation** : Impossible d'ajouter deux aliments avec le même nom

#### Modal de Modification
- **Pré-remplissage** automatique des champs
- **Renommage** : Possibilité de changer le nom
- **Mise à jour des repas** : Les changements se répercutent partout
- **Suppression** : (Fonctionnalité à venir)

---

### 3️⃣ **Statistiques**

#### Graphiques Nutritionnels
Visualisation sur **7, 14 ou 30 jours** :

1. **📊 Évolution des Calories**
   - Graphique en barres
   - Ligne d'objectif (si défini)

2. **🥧 Répartition des Macronutriments**
   - Graphique en camembert
   - Protéines, Glucides, Lipides

3. **📈 Évolution des Protéines**
   - Graphique en barres
   - Ligne d'objectif

4. **📈 Évolution des Glucides**
   - Graphique en barres
   - Ligne d'objectif

5. **📈 Évolution des Lipides**
   - Graphique en barres
   - Ligne d'objectif

6. **📈 Évolution des Sucres**
   - Graphique en barres
   - **3 seuils** :
     - ✅ Seuil Idéal (25g)
     - ⚠️ Seuil Recommandé (50g)
     - ❌ Seuil Max (100g)

7. **🌾 Évolution des Fibres**
   - Graphique en barres
   - Ligne d'objectif minimum

8. **⚖️ Évolution du Poids**
   - Graphique en ligne
   - Tendance visible

9. **💧 Hydratation Quotidienne**
   - Graphique en barres
   - Ligne d'objectif

10. **👟 Nombre de Pas**
    - Graphique en barres
    - Ligne d'objectif

#### Moyennes Hebdomadaires & Mensuelles
**Choix de période** : Par Semaine ou Par Mois

Graphiques disponibles :
- 📊 Moyenne des Calories
- 🥩 Moyenne des Protéines
- 🍚 Moyenne des Glucides
- 🥑 Moyenne des Lipides
- 🌾 Moyenne des Fibres
- ⚖️ Moyenne du Poids
- 💧 Moyenne Hydratation
- 👟 Moyenne des Pas

#### 💰 Analyse des Coûts
**Nouvelle section dédiée** avec périodes 7/14/30 jours

**Cartes de Synthèse** :
1. 💳 **Coût Total** de la période
2. 📊 **Coût Moyen par Jour**
3. 📅 **Coût Mensuel Estimé** (projection)

**Graphiques Détaillés** :
1. **💰 Évolution des Coûts Quotidiens**
   - Graphique en ligne
   - Visualisation des tendances

2. **🍽️ Répartition des Coûts par Repas**
   - Graphique en camembert
   - % par type de repas

3. **🏆 Top 5 Aliments les Plus Chers**
   - Graphique en barres horizontales
   - Identification des postes de dépense importants

4. **📈 Comparaison Hebdo/Mensuelle**
   - Barres comparatives
   - Moyenne 7 jours vs 30 jours

---

### 4️⃣ **Objectifs**

#### Calculateur de Sèche
Formulaire de calcul automatique :
- ⚧️ **Sexe** (Homme/Femme)
- 🎂 **Âge** (années)
- ⚖️ **Poids actuel** (kg)
- 📏 **Taille** (cm)
- 🏃 **Niveau d'activité** (Sédentaire à Très Actif)

**Calcul automatique** :
- 🔥 Métabolisme de base (MB)
- ⚡ Dépense énergétique totale (DET)
- 📉 Calories pour la sèche (-20%)

#### Objectifs Macronutriments
**Modification facile** :
- **Bouton Modifier** : Active le mode édition
- **Champs modifiables** :
  - 🥩 Protéines (g)
  - 🍚 Glucides (g)
  - 🥑 Lipides (g)
- **Recalcul automatique** des calories
- **Boutons** : Sauvegarder / Annuler

**Affichage** :
- Calories totales calculées
- Distribution en grammes

#### Objectifs Bien-être
**Modification facile** :
- **Bouton Modifier** : Active le mode édition
- **Champs modifiables** :
  - 💧 Hydratation (ml/jour)
  - 👟 Nombre de pas (pas/jour)
- **Boutons** : Sauvegarder / Annuler

**Valeurs par défaut** :
- Hydratation : 2000 ml
- Pas : 10000 pas

#### Recommandations Sèche
Conseils pratiques affichés :
- 🎯 Déficit calorique de 15-20%
- ⚖️ Perte de 0.5-1% du poids/semaine
- 📊 Ajustements si stagnation
- 🥩 Maintien des protéines élevé
- 💧 Hydratation abondante (3-4L)

---

### 5️⃣ **Paramètres**

#### Exportation des Données
- **Bouton "📥 Exporter les données"**
- **Format** : JSON
- **Contenu exporté** :
  - ✅ Tous les aliments personnalisés
  - ✅ Tous les repas enregistrés
  - ✅ Tous les objectifs
  - ✅ Toutes les données d'hydratation
  - ✅ Toutes les données de pas
  - ✅ Tous les poids enregistrés
  - ✅ **Tous les prix** (nouvelle fonctionnalité)
- **Nom du fichier** : `nutrition-tracker-backup-YYYY-MM-DD.json`
- **Version** : 1.2

#### Importation des Données
- **Bouton "📤 Importer des données"**
- **Format** : JSON
- **Comportement** :
  - ⚠️ Confirmation avant écrasement
  - 🗑️ Suppression des données actuelles
  - 📥 Import des nouvelles données
  - 🔄 Rechargement de l'application
- **Rétrocompatibilité** : Gère les anciennes versions

#### Réinitialisation Totale
- **Bouton "🔄 Réinitialiser"**
- **Confirmation** : Double vérification
- **Action** :
  - ❌ Suppression de TOUTES les données
  - 🔄 Rechargement complet de la page
  - ✨ Retour à l'état initial
- ⚠️ **IRRÉVERSIBLE**

---

## 💡 Fonctionnalités Transversales

### 💰 Gestion des Prix
**Système complet** de suivi des coûts :

#### Saisie des Prix
- **Optionnel** mais fortement recommandé
- **Deux champs** :
  - Prix en euros (€)
  - Grammage de référence (g)
- **Exemple** : 4.50€ pour 500g

#### Calculs Automatiques
- **Prix unitaire** : Prix/gramme
- **Prix au 100g** : Pour comparaison
- **Coût par portion** : Selon le grammage consommé
- **Totaux par repas** : Somme des aliments
- **Total journalier** : Somme de tous les repas

#### Affichages des Prix
1. **Vignettes Aliments Disponibles** : Prix/100g
2. **Liste Aliments (onglet)** : Prix/100g
3. **Vignettes dans Repas** : Coût de la portion
4. **Résumé Repas** : Total du repas
5. **Résumé Journée** : Coût par item + total
6. **Statistiques** : Analyses détaillées

### 💾 Stockage des Données
- **IndexedDB** : Stockage local persistant
- **Pas de serveur** : Données 100% locales
- **Stores séparés** :
  - `foods` : Aliments
  - `dailyMeals` : Repas quotidiens
  - `goals` : Objectifs
  - `dailyWater` : Hydratation
  - `dailySteps` : Nombre de pas
- **Performances** : Accès rapide aux données

### 🎨 Interface Utilisateur
- **Design moderne** : Interface épurée et intuitive
- **Dégradés colorés** : Visuellement attractif
- **Responsive** : Adapté mobile et desktop
- **Animations** : Transitions fluides
- **Notifications** : Feedback visuel des actions
- **Icônes** : Emojis pour meilleure lisibilité

### 🔄 Mises à Jour Temps Réel
- **Calculs instantanés** : Tous les totaux
- **Graphiques dynamiques** : Mise à jour automatique
- **Synchronisation** : Entre tous les affichages
- **Réactivité** : Changements visibles immédiatement

---

## 📊 Technologies Utilisées

### Frontend
- **HTML5** : Structure sémantique
- **CSS3** : Styles modernes avec variables CSS
- **JavaScript ES6+** : Modules, async/await, arrow functions

### Bibliothèques
- **Chart.js** : Graphiques interactifs
- **IndexedDB** : Base de données locale

### Architecture
- **Modules ES6** : Code organisé et maintenable
- **Séparation des responsabilités** :
  - `app.js` : Logique principale
  - `ui.js` : Interface utilisateur
  - `db.js` : Gestion des données
  - `charts.js` : Graphiques nutritionnels
  - `costs.js` : Graphiques des coûts
  - `utils.js` : Fonctions utilitaires
  - `config.js` : Configuration et données par défaut

---

## 🎯 Cas d'Usage

### Scénario 1 : Suivi Quotidien
1. Ouvrir l'application
2. Glisser-déposer les aliments dans les repas
3. Ajuster les grammages
4. Voir les totaux en temps réel
5. Copier le résumé pour partage

### Scénario 2 : Définir ses Objectifs
1. Aller dans "Objectifs"
2. Remplir le calculateur de sèche
3. Obtenir les calories recommandées
4. Personnaliser les macros si besoin
5. Définir hydratation et pas

### Scénario 3 : Analyse des Tendances
1. Aller dans "Statistiques"
2. Choisir la période (7/14/30 jours)
3. Consulter les graphiques
4. Identifier les écarts vs objectifs
5. Ajuster l'alimentation

### Scénario 4 : Gestion du Budget
1. Renseigner les prix dans "Aliments"
2. Composer ses repas
3. Voir le coût en temps réel
4. Consulter "Analyse des Coûts"
5. Identifier les postes chers
6. Optimiser les achats

### Scénario 5 : Sauvegarde et Portabilité
1. Exporter les données régulièrement
2. Conserver le fichier JSON
3. Importer sur un autre appareil
4. Retrouver tout son historique

---

## 🚀 Points Forts

### ✅ Avantages
- 🆓 **Gratuit** et sans publicité
- 🔒 **Privé** : Données locales uniquement
- 📴 **Hors ligne** : Fonctionne sans internet
- 💰 **Suivi des coûts** : Unique dans sa catégorie
- 📊 **Analyses poussées** : Multiples graphiques
- 🎨 **Interface moderne** : Agréable à utiliser
- ⚡ **Rapide** : Pas de chargement serveur
- 🔄 **Exportable** : Vos données vous appartiennent
- 📱 **Responsive** : Sur tous les appareils
- 🌍 **Français** : Interface 100% en français

### 💡 Innovations
- **Drag & Drop** entre repas
- **Calcul automatique** des prix
- **Top 5 aliments chers** : Analyse unique
- **Totaux par repas** dans le résumé
- **3 seuils pour les sucres** : Aide à la décision
- **Projection mensuelle** des coûts
- **Résumé copiable** : Partage facile

---

## 📈 Évolutions Futures (Suggestions)

### Court Terme
- 🗑️ Suppression d'aliments
- 📸 Photos des repas
- 🏷️ Catégories d'aliments
- ⭐ Aliments favoris

### Moyen Terme
- 📱 PWA améliorée (installation)
- 🔔 Rappels hydratation
- 📅 Planification des repas
- 🛒 Liste de courses

### Long Terme
- 📊 Rapports mensuels PDF
- 🤝 Partage avec coach
- 🍽️ Recettes personnalisées
- 🎯 Objectifs avancés (prise de masse, etc.)

---

## 📞 Support

Pour toute question ou suggestion, consultez le fichier `README.md` du projet.

---

**Version** : 1.2  
**Date** : Octobre 2025  
**Auteur** : Nutrition Tracker Team

---

**Bon suivi nutritionnel et budgétaire ! 💪💰✨**
