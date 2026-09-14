# 🛠️ Guide de la Base de Données - Prix

## 📐 Formats de prix

L'application reconnaît **trois** formats. Le premier est le format actuel ;
les deux autres ne sont plus écrits mais restent lus pour les données historiques.

| Format | Structure | Prix pour 100 g |
|---|---|---|
| **Actuel (grammes)** | `{ price, priceQuantity: 1000, priceUnit: 'grams' }` | `price / priceQuantity × 100` |
| **Actuel (portions)** | `{ price, priceQuantity: 6, priceUnit: 'portions', portionWeight: 50 }` | `price / (priceQuantity × portionWeight) × 100` |
| **Ancien** | `{ price, priceGrams: 500 }` | `price / priceGrams × 100` |

**Cas particulier — repas composés ajustables** : `price` est le prix **total de
la recette**, et `priceQuantity` vaut `totalWeight`. Le coût affiché est alors
au prorata du poids consommé.

## 🔍 Problème

Si les champs `price` et `priceQuantity` sont absents de vos aliments dans la base de données, vous ne pourrez pas voir les coûts dans l'application.

## ✅ Solution en 3 Étapes

### **Étape 1 : Diagnostic** 📊

1. Ouvrez l'application dans votre navigateur
2. Appuyez sur **F12** pour ouvrir la console
3. Tapez dans la console :

```javascript
dbDiagnose()
```

Cela affichera l'état actuel de votre base de données.

---

### **Étape 2 : Réparer la Structure** 🔧

Pour ajouter automatiquement les champs `price` et `priceGrams` à **TOUS** vos aliments :

```javascript
dbFixStructure()
```

Cette commande :
- ✅ Parcourt tous vos aliments
- ✅ Ajoute les champs `price`, `priceQuantity` et `priceUnit` (`null` / `'grams'`)
- ✅ Ne modifie PAS les aliments qui ont déjà ces champs
- ✅ Affiche un rapport détaillé

> ⚠️ **Formats de prix** : le format actuel est
> `{ price, priceQuantity, priceUnit: 'grams' | 'portions', portionWeight? }`.
> L'ancien format `{ price, priceGrams }` reste **lu** pour les données
> historiques, mais n'est plus écrit. Voir la section « Formats de prix ».

**Résultat attendu :**
```
=== MISE À JOUR DE LA STRUCTURE DES ALIMENTS ===

📦 Traitement de 42 aliments...

✅ Mis à jour: Haricots Verts
✅ Mis à jour: Comté
✅ Mis à jour: Pain Complet
...

=== RÉSULTAT ===
✅ Aliments mis à jour: 42
ℹ️  Aliments déjà à jour: 0
📊 Total: 42
```

---

### **Étape 3 : Remplir les Prix** 💰

Vous avez 3 options :

#### **Option A : Mise à jour Manuelle (Interface)**

1. Allez dans l'onglet **"Aliments"**
2. Cliquez sur le bouton **"✏️ Modifier"** de chaque aliment
3. Remplissez les champs :
   - **Prix (€)** : Le prix en euros
   - **Poids (g)** : Le poids correspondant en grammes
4. Cliquez sur **"Sauvegarder"**

#### **Option B : Mise à jour par Console (Un par un)**

Dans la console, utilisez :

```javascript
dbAddPrice("id-aliment", PRIX, POIDS_EN_GRAMMES)
```

**Exemples :**
```javascript
dbAddPrice("banane", 1.79, 1000)          // 1.79€ le kilo
dbAddPrice("poulet-blanc", 12.90, 1000)   // 12.90€ le kilo
dbAddPrice("oeufs", 3.50, 600)            // 3.50€ pour 6 œufs
```

#### **Option C : Mise à jour en Lot (RAPIDE) ⚡**

Pour mettre à jour plusieurs aliments d'un coup :

1. **Créez un objet avec vos prix :**

```javascript
const mesPrix = {
    "banane": { price: 1.79, priceGrams: 1000 },
    "poulet-blanc": { price: 12.90, priceGrams: 1000 },
    "oeufs": { price: 3.50, priceGrams: 600 },
    "comté": { price: 18.90, priceGrams: 1000 },
    "riz-basmati": { price: 3.99, priceGrams: 1000 }
};
```

2. **Exécutez la mise à jour :**

```javascript
dbBulkPrices(mesPrix)
```

**📝 Un fichier d'exemple `exemple-prix.js` est fourni avec des prix pour tous les aliments par défaut !**

---

## 📋 Vérification Finale

Après avoir ajouté vos prix, vérifiez que tout fonctionne :

```javascript
dbDiagnose()
```

Vous devriez voir :
```
💰 Aliments avec prix: 42
❌ Aliments sans prix: 0
```

---

## 🔄 Utiliser le Fichier Exemple

Un fichier `exemple-prix.js` contient des prix d'exemple pour tous les aliments par défaut.

**Pour l'utiliser :**

1. Ouvrez le fichier `exemple-prix.js`
2. **Modifiez les prix selon vos besoins**
3. Copiez tout le contenu du fichier
4. Collez-le dans la console (F12)
5. Exécutez :

```javascript
dbBulkPrices(pricesData)
```

---

## 💾 Sauvegarde

Avant toute manipulation, exportez vos données :

```
Paramètres → Gestion des Données → 📤 Exporter tout
```

> ⚠️ **`dbExport()` n'est PAS une sauvegarde complète.** Cette commande de
> diagnostic n'exporte **que les aliments** (avec leur prix calculé au 100 g) :
> elle ne contient ni les repas composés, ni le journal, ni les objectifs, ni
> l'hydratation, ni les pas, ni les activités, ni les événements de santé.
> Pour sauvegarder réellement vos données, utilisez le bouton « Exporter tout ».

---

## ❓ Résolution de Problèmes

### **Erreur : "Aliment non trouvé"**

L'ID de l'aliment n'existe pas dans votre base. Pour voir tous les IDs :

```javascript
dbExport()
```

Ouvrez le fichier JSON téléchargé et cherchez l'ID exact.

### **Les prix ne s'affichent toujours pas**

1. Vérifiez que les champs existent : `dbDiagnose()`
2. Rafraîchissez la page (F5)
3. Allez dans l'onglet **Statistiques** → Section **Analyse des Coûts**

### **Je veux recommencer à zéro**

⚠️ **ATTENTION : Cette action supprime TOUTES vos données !**

1. Onglet **Paramètres**
2. Bouton **"Réinitialiser les Données"**
3. Confirmez

---

## 📞 Commandes Console Récapitulatives

| Commande | Description |
|----------|-------------|
| `dbDiagnose()` | Diagnostiquer la base de données |
| `dbCheck()` | Vérifier tous les stores |
| `dbExport()` | Exporter toutes les données en JSON |
| `dbFixStructure()` | 🔥 Ajouter price/priceGrams à tous les aliments |
| `dbAddPrice(id, price, grams)` | Ajouter un prix à un aliment |
| `dbBulkPrices(data)` | Mettre à jour plusieurs prix en lot |

---

## ✨ Exemple Complet

```javascript
// 1. Diagnostic initial
dbDiagnose()

// 2. Réparer la structure
dbFixStructure()

// 3. Ajouter des prix
const mesPrix = {
    "banane": { price: 1.79, priceGrams: 1000 },
    "poulet-blanc": { price: 12.90, priceGrams: 1000 },
    "oeufs": { price: 3.50, priceGrams: 600 }
};
dbBulkPrices(mesPrix)

// 4. Vérification finale
dbDiagnose()
```

---

**🎉 Vous êtes prêt ! Vos prix sont maintenant configurés dans la base de données.**
