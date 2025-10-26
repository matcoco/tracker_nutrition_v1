# 🔧 Comment corriger une sauvegarde avec l'ancien format

## 🎯 Problème

Certains fichiers de sauvegarde contiennent des aliments avec l'ancien format de prix :
- ❌ `priceGrams` (ancien)
- ✅ `priceQuantity` + `priceUnit` (nouveau)

## 📋 Étapes pour corriger

### Option 1 : Utiliser le script automatique (RECOMMANDÉ)

#### 1. Ouvrir un terminal dans le dossier du projet

```bash
cd C:\Users\DELL\Downloads\nutrition-tracker
```

#### 2. Exécuter le script de correction

```bash
node fix-backup-format.js
```

#### 3. Résultat

Le script va :
- ✅ Lire votre fichier de sauvegarde
- ✅ Corriger tous les aliments avec l'ancien format
- ✅ Ajouter les propriétés manquantes (`isPortionBased`, `portionWeight`)
- ✅ Créer un nouveau fichier : `nutrition-data_priscilla_sauvegarde_totale_CORRECTED.json`

#### 4. Importer le fichier corrigé

- Ouvrir l'application
- Aller dans **Paramètres** → **Gestion des Données**
- Cliquer sur **📂 Restaurer une sauvegarde**
- Sélectionner le fichier `..._CORRECTED.json`

---

### Option 2 : Correction manuelle (si Node.js n'est pas installé)

Vous pouvez utiliser un éditeur de texte avec fonction rechercher/remplacer :

1. Ouvrir le fichier JSON dans un éditeur (VSCode, Notepad++, etc.)
2. Rechercher : `"priceGrams": `
3. Remplacer par : `"priceQuantity": `
4. Ajouter après chaque remplacement : `"priceUnit": "grams",`
5. Ajouter `"isPortionBased": false,` et `"portionWeight": null,` si manquants

⚠️ **Attention** : Cette méthode est plus risquée et peut introduire des erreurs de syntaxe JSON.

---

## 📊 Exemple de correction

### Avant (ancien format) ❌
```json
{
  "id": "beurre-paysan-de-breton-doux-82mg",
  "name": "Beurre paysan de breton doux 82%MG",
  "calories": 743,
  "proteins": 0.7,
  "carbs": 0,
  "sugars": 0.6,
  "fibers": 0,
  "fats": 82,
  "price": 2.44,
  "priceGrams": 250
}
```

### Après (nouveau format) ✅
```json
{
  "id": "beurre-paysan-de-breton-doux-82mg",
  "name": "Beurre paysan de breton doux 82%MG",
  "calories": 743,
  "proteins": 0.7,
  "carbs": 0,
  "sugars": 0.6,
  "fibers": 0,
  "fats": 82,
  "isPortionBased": false,
  "portionWeight": null,
  "price": 2.44,
  "priceQuantity": 250,
  "priceUnit": "grams"
}
```

---

## ❓ FAQ

### Le script ne fonctionne pas ?

**Erreur : "node n'est pas reconnu..."**
- Solution : Installez Node.js depuis https://nodejs.org/
- Ou utilisez l'Option 2 (correction manuelle)

### Puis-je utiliser l'ancien fichier ?

- Oui, mais vous aurez des bugs dans les calculs de prix
- Fortement déconseillé

### Le fichier original sera-t-il modifié ?

- Non ! Le script crée un nouveau fichier avec le suffixe `_CORRECTED`
- Votre fichier original reste intact

---

## 🎉 Support

Si vous rencontrez des problèmes, vérifiez :
1. Que Node.js est bien installé (`node --version`)
2. Que le chemin du fichier est correct dans le script
3. Que le fichier JSON est valide (pas de virgules manquantes, etc.)
