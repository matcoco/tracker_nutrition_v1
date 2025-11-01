#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json

# Fonction de catégorisation intelligente
def categorize_food(food):
    name = food['name'].lower()
    
    # === PROTÉINES (🥩) ===
    if any(word in name for word in ['poulet', 'blanc de poulet', 'grignotte', 'boeuf', 'steack', 'steak', 'charal', 
                                       'morue', 'accras', 'thon', 'sardine', 'saumon', 'oeuf', 'jaune d', 
                                       'protéine', 'soja textur', 'carpaccio']):
        return 'proteins'
    
    # === FÉCULENTS (🍚) ===
    if any(word in name for word in ['riz', 'pâte', 'pasta', 'pain', 'baguette', 'brioche', 
                                       'pomme de terre', 'frite', 'potatoes', 'farine', 'penne', 'fusilli',
                                       'nouille', 'udon', 'lentille', 'haricot rouge', 'châtaigne', 'chataigne']):
        return 'starches'
    
    # === LÉGUMES (🥦) ===
    if any(word in name for word in ['brocoli', 'haricot vert', 'champignon', 'poivron', 'poireau', 'oignon',
                                       'petit pois', 'sucrine', 'olive', 'légume', 'poêlée', 'ail gingembre']):
        return 'vegetables'
    
    # === FRUITS (🍎) ===
    if any(word in name for word in ['pomme', 'kiwi', 'orange', 'raisin', 'fruit', 'gala']):
        return 'fruits'
    
    # === PRODUITS LAITIERS (🥛) ===
    if any(word in name for word in ['fromage', 'comté', 'raclette', 'tomme', 'saint nectaire', 'ricotta', 'lait', 'skyr']):
        return 'dairy'
    
    # === MATIÈRES GRASSES (🥑) ===
    if any(word in name for word in ['huile', 'beurre', 'amande', 'noix', 'crème de soja']):
        return 'fats'
    
    # === BOISSONS (🥤) ===
    if any(word in name for word in ['coca', 'fanta', 'jus', 'eau', 'scheppes', 'tonic', 'sake', 'rhum', 'kieffer', 'mirin']):
        return 'beverages'
    
    # === SNACKS & SUCRERIES (🍫) ===
    if any(word in name for word in ['burger', 'mcdo', 'mcdonald', 'mcflurry', 'mcextreme', 'pizza', 'sandwich',
                                       'biscuit', 'chocolat', 'pain au chocolat', 'pâte à tartiner', 'sucre', 'tablette',
                                       'petit beurre', 'gerblé']):
        return 'snacks'
    
    # === CAS SPÉCIAUX (basés sur les macros) ===
    # Si très riche en protéines (>15g/100g) et pas de glucides
    if food['proteins'] > 15 and food['carbs'] < 2:
        return 'proteins'
    
    # Si très riche en lipides (>80g/100g)
    if food['fats'] > 80:
        return 'fats'
    
    # Si très riche en glucides (>60g/100g) et pas protéines
    if food['carbs'] > 60 and food['proteins'] < 15:
        return 'starches'
    
    # === AUTRES (📦) ===
    # Condiments et ingrédients spéciaux
    if any(word in name for word in ['sauce', 'miso', 'levure', 'sel', 'son de blé', 'tarte']):
        return 'other'
    
    # Par défaut : other
    return 'other'

# Lire le fichier JSON
with open('nutrition-tracker-backup-2025-11-01.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Catégoriser tous les aliments
categorized = 0
already_categorized = 0

for food in data['foods']:
    if 'category' not in food or food.get('category') == '':
        food['category'] = categorize_food(food)
        categorized += 1
    else:
        already_categorized += 1

# Statistiques par catégorie
stats = {
    'proteins': 0,
    'starches': 0,
    'vegetables': 0,
    'fruits': 0,
    'dairy': 0,
    'fats': 0,
    'beverages': 0,
    'snacks': 0,
    'other': 0
}

for food in data['foods']:
    category = food.get('category', 'other')
    stats[category] = stats.get(category, 0) + 1

# Écrire le fichier mis à jour
with open('nutrition-tracker-backup-2025-11-01-categorized.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Afficher les résultats
print('✅ Catégorisation terminée !')
print(f'\n📊 {categorized} aliments catégorisés')
print(f'⏭️  {already_categorized} aliments déjà catégorisés')
print(f'\n🏷️  Répartition par catégorie :')
print(f'   🥩 Protéines: {stats["proteins"]}')
print(f'   🍚 Féculents: {stats["starches"]}')
print(f'   🥦 Légumes: {stats["vegetables"]}')
print(f'   🍎 Fruits: {stats["fruits"]}')
print(f'   🥛 Produits laitiers: {stats["dairy"]}')
print(f'   🥑 Matières grasses: {stats["fats"]}')
print(f'   🥤 Boissons: {stats["beverages"]}')
print(f'   🍫 Snacks & Sucreries: {stats["snacks"]}')
print(f'   📦 Autre: {stats["other"]}')
print(f'\n📁 Fichier généré : nutrition-tracker-backup-2025-11-01-categorized.json')
print(f'\n💡 Remplacez votre fichier de backup actuel par ce nouveau fichier pour l\'importer dans l\'application !')
