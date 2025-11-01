# 🎯 Guide Complet - Calculateur d'Objectifs Nutritionnels

## 📋 Table des matières
1. [Vue d'ensemble](#vue-densemble)
2. [Formules de calcul de base](#formules-de-calcul-de-base)
3. [Les 5 profils disponibles](#les-5-profils-disponibles)
4. [Calcul des macronutriments](#calcul-des-macronutriments)
5. [Exemples de calcul détaillés](#exemples-de-calcul-détaillés)
6. [Conseils personnalisés](#conseils-personnalisés)
7. [FAQ](#faq)

---

## Vue d'ensemble

Le calculateur d'objectifs nutritionnels vous permet de définir un plan alimentaire personnalisé selon **5 profils** différents, chacun adapté à un objectif spécifique :

- 🔥 **Sèche** : Perdre du gras en préservant le muscle
- 📉 **Perte de poids** : Perte saine et durable
- 💪 **Prise de masse** : Construire du muscle
- ⚖️ **Maintien** : Stabiliser son poids
- 🎯 **Recomposition** : Perdre du gras ET gagner du muscle

---

## Formules de calcul de base

### 1️⃣ Métabolisme de Base (MB)

**Formule de Mifflin-St Jeor** (la plus précise actuellement) :

#### Pour les hommes :
```
MB = (10 × poids en kg) + (6.25 × taille en cm) - (5 × âge) + 5
```

#### Pour les femmes :
```
MB = (10 × poids en kg) + (6.25 × taille en cm) - (5 × âge) - 161
```

**Exemple :**
- Homme, 80kg, 175cm, 30 ans
- MB = (10 × 80) + (6.25 × 175) - (5 × 30) + 5
- MB = 800 + 1093.75 - 150 + 5
- MB = **1748.75 kcal**

---

### 2️⃣ Dépense Énergétique Totale (DET)

La DET intègre votre niveau d'activité physique quotidienne.

```
DET = MB × Coefficient d'activité
```

#### Coefficients d'activité :
| Niveau | Coefficient | Description |
|--------|------------|-------------|
| **Sédentaire** | 1.2 | Peu ou pas d'exercice |
| **Légèrement actif** | 1.375 | Exercice 1-3 jours/semaine |
| **Modérément actif** | 1.55 | Exercice 3-5 jours/semaine |
| **Très actif** | 1.725 | Exercice 6-7 jours/semaine |
| **Extrêmement actif** | 1.9 | Entraînement 2x/jour + travail physique |

**Exemple (suite) :**
- MB = 1748.75 kcal
- Activité = Modérément actif (1.55)
- DET = 1748.75 × 1.55
- DET = **2710.56 kcal** (arrondi à 2711 kcal)

---

### 3️⃣ Calories cibles selon l'objectif

```
Calories cibles = DET × (1 - Pourcentage d'ajustement)
```

**Note importante :** 
- Déficit = pourcentage **positif** (ex: 0.20 pour -20%)
- Surplus = pourcentage **négatif** (ex: -0.10 pour +10%)
- Maintenance = 0

---

## Les 5 profils disponibles

### 🔥 Profil 1 : SÈCHE

#### 🎯 Objectif
Réduire le taux de masse grasse pour une définition musculaire optimale tout en préservant au maximum la masse musculaire.

#### 👥 Public cible
- Personnes ayant déjà une bonne masse musculaire
- Pratiquants de musculation expérimentés
- Préparation à une compétition ou objectif esthétique

#### 📊 Intensité disponible
| Intensité | Déficit | Perte hebdomadaire visée |
|-----------|---------|--------------------------|
| Léger | -10% | 0.3-0.5% du poids |
| Modéré | -15% | 0.5-0.7% du poids |
| **Standard** (recommandé) | **-20%** | **0.5-1% du poids** |
| Agressif | -25% | 0.8-1.2% du poids |

#### 🥩 Ratios macronutriments
```javascript
Protéines = 2.2 g/kg de poids corporel
Lipides = 1.0 g/kg de poids corporel
Glucides = (Calories restantes) / 4
```

**Justification :**
- **Protéines élevées (2.2g/kg)** : Préserve la masse musculaire en déficit calorique
- **Lipides modérés (1.0g/kg)** : Maintient la production hormonale
- **Glucides variables** : Ajustés selon les calories disponibles

---

### 📉 Profil 2 : PERTE DE POIDS

#### 🎯 Objectif
Perdre du poids de façon saine, durable et équilibrée sans stress excessif.

#### 👥 Public cible
- Personnes en surpoids souhaitant améliorer leur santé
- Débutants en nutrition/sport
- Recherche d'un équilibre vie personnelle/objectifs

#### 📊 Intensité disponible
| Intensité | Déficit | Perte hebdomadaire visée |
|-----------|---------|--------------------------|
| **Léger** (recommandé) | **-10%** | **0.3-0.5 kg** |
| Modéré | -15% | 0.5-0.7 kg |
| Important | -20% | 0.7-1 kg |

#### 🥩 Ratios macronutriments
```javascript
Protéines = 1.8 g/kg de poids corporel
Lipides = 0.9 g/kg de poids corporel
Glucides = (Calories restantes) / 4
```

**Justification :**
- **Protéines modérées-élevées (1.8g/kg)** : Satiété + préservation musculaire
- **Lipides légèrement réduits (0.9g/kg)** : Permet plus de glucides pour l'énergie
- **Approche équilibrée** : Durable sur le long terme

---

### 💪 Profil 3 : PRISE DE MASSE

#### 🎯 Objectif
Construire de la masse musculaire en optimisant l'anabolisme (croissance musculaire).

#### 👥 Public cible
- Pratiquants de musculation visant l'hypertrophie
- Personnes ayant du mal à prendre du poids
- Athlètes en phase de développement

#### 📊 Intensité disponible
| Intensité | Surplus | Prise hebdomadaire visée |
|-----------|---------|--------------------------|
| **Minimal** (recommandé) | **+5%** | **0.2-0.3 kg** |
| Modéré | +10% | 0.3-0.5 kg |
| Important | +15% | 0.5-0.7 kg |
| Agressif | +20% | 0.7-1 kg |

**⚠️ Attention :** Plus le surplus est élevé, plus le risque de prise de gras est important !

#### 🥩 Ratios macronutriments
```javascript
Protéines = 2.0 g/kg de poids corporel
Lipides = 1.1 g/kg de poids corporel
Glucides = (Calories restantes) / 4
```

**Justification :**
- **Protéines élevées (2.0g/kg)** : Matériaux de construction musculaire
- **Lipides légèrement augmentés (1.1g/kg)** : Soutient production hormonale
- **Glucides élevés** : Énergie pour entraînements intenses + anabolisme

---

### ⚖️ Profil 4 : MAINTIEN

#### 🎯 Objectif
Maintenir son poids actuel et stabiliser sa composition corporelle.

#### 👥 Public cible
- Personnes ayant atteint leur objectif
- Transition entre phases de perte/prise
- Approche intuitive après une période stricte

#### 📊 Ajustement disponible
| Ajustement | Variation | Objectif |
|------------|-----------|----------|
| **Maintenance exacte** (recommandé) | **0%** | **Poids stable** |
| Léger surplus | +2% | Micro-prise de masse |
| Léger déficit | -2% | Micro-sèche |

#### 🥩 Ratios macronutriments
```javascript
Protéines = 1.6 g/kg de poids corporel
Lipides = 1.0 g/kg de poids corporel
Glucides = (Calories restantes) / 4
```

**Justification :**
- **Protéines modérées (1.6g/kg)** : Maintien de la masse musculaire
- **Lipides standards (1.0g/kg)** : Équilibre hormonal
- **Répartition équilibrée** : Facilite le maintien à long terme

---

### 🎯 Profil 5 : RECOMPOSITION

#### 🎯 Objectif
Perdre du gras TOUT EN gagnant du muscle simultanément (objectif avancé).

#### 👥 Public cible
- **Débutants en musculation** (meilleure fenêtre pour la recomp)
- Personnes reprenant l'entraînement après arrêt
- Athlètes expérimentés avec protocole très rigoureux

#### 📊 Intensité disponible
| Intensité | Déficit | Approche |
|-----------|---------|----------|
| **Très léger** (recommandé) | **-5%** | **Recomp optimale** |
| Léger | -10% | Recomp accélérée |

**⚠️ Important :** La recomposition nécessite :
- Entraînement intensif régulier
- Apport protéique très élevé
- Patience (résultats sur 3-6 mois minimum)

#### 🥩 Ratios macronutriments
```javascript
Protéines = 2.4 g/kg de poids corporel
Lipides = 0.9 g/kg de poids corporel
Glucides = (Calories restantes) / 4
```

**Justification :**
- **Protéines TRÈS élevées (2.4g/kg)** : Soutient à la fois la perte de gras ET la construction musculaire
- **Lipides légèrement réduits (0.9g/kg)** : Optimise l'utilisation des graisses corporelles
- **Déficit minime** : Permet l'anabolisme malgré le déficit

---

## Calcul des macronutriments

### Étape par étape

#### 1. Calcul des protéines
```
Protéines (g) = Poids (kg) × Ratio protéines du profil
Calories des protéines = Protéines (g) × 4 kcal/g
```

#### 2. Calcul des lipides
```
Lipides (g) = Poids (kg) × Ratio lipides du profil
Calories des lipides = Lipides (g) × 9 kcal/g
```

#### 3. Calcul des glucides
```
Calories restantes = Calories cibles - Calories protéines - Calories lipides
Glucides (g) = Calories restantes / 4 kcal/g
```

**Note :** Si le calcul des glucides donne un résultat négatif ou très faible, le système applique un minimum de 0g.

---

## Exemples de calcul détaillés

### 📊 Exemple 1 : Homme en SÈCHE

**Profil utilisateur :**
- Sexe : Homme
- Âge : 30 ans
- Poids : 80 kg
- Taille : 175 cm
- Activité : Modérément actif (1.55)
- Intensité choisie : Standard (-20%)

**Calculs :**

1️⃣ **Métabolisme de Base (MB)**
```
MB = (10 × 80) + (6.25 × 175) - (5 × 30) + 5
MB = 800 + 1093.75 - 150 + 5
MB = 1749 kcal
```

2️⃣ **Dépense Énergétique Totale (DET)**
```
DET = 1749 × 1.55
DET = 2711 kcal
```

3️⃣ **Calories cibles (déficit 20%)**
```
Calories = 2711 × (1 - 0.20)
Calories = 2711 × 0.80
Calories = 2169 kcal
```

4️⃣ **Protéines (2.2 g/kg)**
```
Protéines = 80 × 2.2 = 176 g
Calories protéines = 176 × 4 = 704 kcal
```

5️⃣ **Lipides (1.0 g/kg)**
```
Lipides = 80 × 1.0 = 80 g
Calories lipides = 80 × 9 = 720 kcal
```

6️⃣ **Glucides (calories restantes)**
```
Calories restantes = 2169 - 704 - 720 = 745 kcal
Glucides = 745 / 4 = 186 g
```

**📋 Résumé des objectifs :**
- 🎯 **Calories** : 2169 kcal
- 🥩 **Protéines** : 176 g (32%)
- 🍞 **Glucides** : 186 g (34%)
- 🥑 **Lipides** : 80 g (33%)

---

### 📊 Exemple 2 : Femme en PERTE DE POIDS

**Profil utilisateur :**
- Sexe : Femme
- Âge : 28 ans
- Poids : 65 kg
- Taille : 165 cm
- Activité : Légèrement active (1.375)
- Intensité choisie : Léger (-10%)

**Calculs :**

1️⃣ **Métabolisme de Base (MB)**
```
MB = (10 × 65) + (6.25 × 165) - (5 × 28) - 161
MB = 650 + 1031.25 - 140 - 161
MB = 1380 kcal
```

2️⃣ **Dépense Énergétique Totale (DET)**
```
DET = 1380 × 1.375
DET = 1898 kcal
```

3️⃣ **Calories cibles (déficit 10%)**
```
Calories = 1898 × (1 - 0.10)
Calories = 1898 × 0.90
Calories = 1708 kcal
```

4️⃣ **Protéines (1.8 g/kg)**
```
Protéines = 65 × 1.8 = 117 g
Calories protéines = 117 × 4 = 468 kcal
```

5️⃣ **Lipides (0.9 g/kg)**
```
Lipides = 65 × 0.9 = 59 g (arrondi)
Calories lipides = 59 × 9 = 531 kcal
```

6️⃣ **Glucides (calories restantes)**
```
Calories restantes = 1708 - 468 - 531 = 709 kcal
Glucides = 709 / 4 = 177 g
```

**📋 Résumé des objectifs :**
- 🎯 **Calories** : 1708 kcal
- 🥩 **Protéines** : 117 g (27%)
- 🍞 **Glucides** : 177 g (42%)
- 🥑 **Lipides** : 59 g (31%)

---

### 📊 Exemple 3 : Homme en PRISE DE MASSE

**Profil utilisateur :**
- Sexe : Homme
- Âge : 25 ans
- Poids : 70 kg
- Taille : 180 cm
- Activité : Très actif (1.725)
- Intensité choisie : Minimal (+5%)

**Calculs :**

1️⃣ **Métabolisme de Base (MB)**
```
MB = (10 × 70) + (6.25 × 180) - (5 × 25) + 5
MB = 700 + 1125 - 125 + 5
MB = 1705 kcal
```

2️⃣ **Dépense Énergétique Totale (DET)**
```
DET = 1705 × 1.725
DET = 2941 kcal
```

3️⃣ **Calories cibles (surplus 5%)**
```
Calories = 2941 × (1 - (-0.05))
Calories = 2941 × 1.05
Calories = 3088 kcal
```

4️⃣ **Protéines (2.0 g/kg)**
```
Protéines = 70 × 2.0 = 140 g
Calories protéines = 140 × 4 = 560 kcal
```

5️⃣ **Lipides (1.1 g/kg)**
```
Lipides = 70 × 1.1 = 77 g
Calories lipides = 77 × 9 = 693 kcal
```

6️⃣ **Glucides (calories restantes)**
```
Calories restantes = 3088 - 560 - 693 = 1835 kcal
Glucides = 1835 / 4 = 459 g
```

**📋 Résumé des objectifs :**
- 🎯 **Calories** : 3088 kcal
- 🥩 **Protéines** : 140 g (18%)
- 🍞 **Glucides** : 459 g (59%)
- 🥑 **Lipides** : 77 g (23%)

---

## Conseils personnalisés

### 🔥 Conseils SÈCHE
- Pesez-vous 1x/semaine dans les mêmes conditions (matin à jeun)
- Visez une perte de 0.5-1% de votre poids par semaine
- Maintenez un apport élevé en protéines (2.2g/kg) pour préserver la masse musculaire
- Privilégiez la musculation pour conserver le muscle pendant le déficit
- Hydratez-vous abondamment (3-4L d'eau par jour)
- Si la perte stagne 2 semaines : réduisez les glucides de 50g ou augmentez le cardio

### 📉 Conseils PERTE DE POIDS
- Adoptez une approche progressive : 0.5-0.8kg par semaine max
- Privilégiez les aliments rassasiants : protéines, légumes, fibres
- Mangez lentement et à heures régulières pour réguler la faim
- Intégrez une activité physique régulière (3-4x/semaine minimum)
- Autorisez-vous un repas plaisir par semaine pour la durabilité
- Dormez suffisamment (7-9h) : le sommeil régule les hormones de la faim

### 💪 Conseils PRISE DE MASSE
- Visez une prise de 0.25-0.5kg par semaine (évitez le gras excessif)
- Répartissez vos calories sur 4-5 repas pour mieux absorber les nutriments
- Priorisez la musculation intensive (poids lourds, progression constante)
- Consommez des protéines toutes les 3-4h (2g/kg minimum)
- Favorisez les glucides autour de l'entraînement pour l'énergie
- Patience : la vraie masse musculaire se construit sur plusieurs mois

### ⚖️ Conseils MAINTIEN
- Pesez-vous régulièrement pour détecter les variations (+/- 1kg acceptable)
- Maintenez une routine d'exercice cohérente (force + cardio)
- Appliquez la règle 80/20 : 80% aliments sains, 20% flexibilité
- Écoutez vos signaux de faim et de satiété naturels
- Continuez à suivre vos macros de temps en temps pour rester conscient
- Ajustez légèrement si votre poids dérive (+200kcal ou -200kcal)

### 🎯 Conseils RECOMPOSITION
- Objectif avancé : nécessite patience et rigueur (résultats sur 3-6 mois)
- Protéines TRÈS élevées (2.4g/kg) pour soutenir muscle ET récupération
- Musculation intensive 4-5x/semaine avec progression sur les charges
- Privilégiez les mouvements composés : squat, deadlift, bench press
- Mesurez vos progrès par photos et mensurations (pas seulement la balance)
- Soyez patient : perte de gras + gain de muscle = balance stable mais corps transformé

---

## FAQ

### ❓ Pourquoi utiliser la formule de Mifflin-St Jeor ?
C'est actuellement la formule la plus précise pour estimer le métabolisme de base selon les études scientifiques récentes. Elle est plus fiable que les anciennes formules Harris-Benedict.

### ❓ Puis-je modifier manuellement les macronutriments ?
Oui ! Après le calcul initial, vous pouvez cliquer sur "✏️ Modifier" pour ajuster manuellement les protéines, glucides et lipides selon vos préférences.

### ❓ Que faire si mes glucides sont très bas ?
Si les glucides calculés sont inférieurs à 100g, vous avez plusieurs options :
1. Augmenter légèrement vos calories cibles (réduire le déficit)
2. Réduire légèrement les lipides (minimum 0.7g/kg)
3. Accepter un apport faible en glucides (approche low-carb)

### ❓ La recomposition fonctionne-t-elle vraiment ?
Oui, mais principalement pour :
- Les **débutants** en musculation (gains "newbie")
- Les personnes reprenant après un **arrêt prolongé**
- Les **athlètes avancés** avec un protocole très strict

Pour les pratiquants intermédiaires, il est souvent plus efficace d'alterner phases de prise de masse et de sèche.

### ❓ Comment savoir si je progresse ?
**Mesures recommandées :**
- **Poids** : 1x/semaine, mêmes conditions
- **Photos** : Face/profil/dos toutes les 2 semaines
- **Mensurations** : Tour de taille, bras, cuisses (mensuel)
- **Performance** : Charges soulevées à la salle
- **Miroir** : La définition visuelle (le plus important !)

### ❓ Dois-je suivre mes macros précisément ?
**Tolérance acceptable :**
- Calories : ± 50-100 kcal
- Protéines : ± 10g
- Lipides : ± 5-10g
- Glucides : ± 20g

L'important est la **cohérence sur la semaine**, pas la perfection quotidienne.

### ❓ Combien de temps suivre le même plan ?
**Recommandations :**
- **Sèche** : 8-16 semaines maximum, puis pause métabolique
- **Perte de poids** : Jusqu'à objectif atteint (avec pauses si besoin)
- **Prise de masse** : 12-24 semaines, puis mini-cut si nécessaire
- **Maintien** : Indéfiniment
- **Recomposition** : 12-24 semaines minimum pour voir des résultats

### ❓ Que faire en cas de stagnation ?
**Checklist :**
1. ✅ Tracker précisément pendant 1 semaine complète
2. ✅ Vérifier la qualité du sommeil (7-9h)
3. ✅ Évaluer le niveau de stress
4. ✅ Ajuster les calories de 10% dans la direction souhaitée
5. ✅ Varier l'entraînement (volume, intensité)
6. ✅ Faire une pause métabolique si en déficit depuis >12 semaines

---

## 📚 Ressources supplémentaires

### Sources scientifiques
- Formule Mifflin-St Jeor : *Mifflin et al. (1990), American Journal of Clinical Nutrition*
- Besoins protéiques : *Phillips & Van Loon (2011), Journal of Sports Sciences*
- Recomposition corporelle : *Barakat et al. (2020), Sports Medicine*

### Outils complémentaires dans l'application
- 📅 **Suivi Quotidien** : Tracker vos repas et comparer aux objectifs
- 📊 **Statistiques** : Visualiser votre progression dans le temps
- 🥗 **Aliments** : Gérer votre base de données personnelle
- ⚖️ **Comparaison** : Comparer les aliments pour optimiser vos choix

---

**Version du document :** 1.5.0  
**Dernière mise à jour :** 1 novembre 2025  
**Application :** Nutrition Tracker
