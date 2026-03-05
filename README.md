# WikiPerché

Bibliothèque de ressources sur la santé mentale, par [La Maison Perchée](https://lamaisonperchee.org).

Plus de 800 ressources (podcasts, livres, vidéos, sites…) sélectionnées par des personnes concernées, pour les personnes concernées et leurs proches.

## Démarrage

Aucun build nécessaire — ouvrir `index.html` dans un navigateur.

```bash
# ou avec un serveur local
python3 -m http.server 8000
```

## Structure du projet

```
index.html              # Application complète (HTML + CSS + JS inline)
wikiperche-data.js      # Base de données des ressources
import-resources.py     # Script d'import de nouvelles ressources
enriched_resources.json # Données enrichies issues du collecteur (optionnel)
```

### Sections

| Section | Description |
|---------|-------------|
| 🌱 Vivre avec | Ressources pour le quotidien, proches aidants |
| 🌿 Vers le rétablissement | Comprendre et traiter les troubles |
| 🤝 Maladie psy et société | Regard sociétal, stigmatisation, témoignages |

### Filtres

- **Troubles** : Dépression, Bipolarité, Schizophrénie, TCA, TDAH, TSA, TSPT, Anxiété, Addictions, Borderline, Sommeil, Deuil…
- **Types de contenu** : Vidéo / Film, Podcast, Article / Livre, Site internet, Conférence…
- **Recherche** texte libre (insensible aux accents)
- **Favoris** sauvegardés en `localStorage`

## Importer de nouvelles ressources

Le script `import-resources.py` intègre des ressources depuis un fichier JSON enrichi (issu du [collecteur](../wiki-perchee-collector)).

```bash
# Prévisualiser sans modifier
python3 import-resources.py fichier.json --dry-run

# Stats uniquement
python3 import-resources.py fichier.json --stats

# Importer
python3 import-resources.py fichier.json
```

Le script gère automatiquement :
- Déduplication par URL et titre
- Filtrage des ressources marquées `REJETER`
- Mapping des types et troubles vers les conventions existantes
- Assignation de section selon les catégories
- Génération des IDs (slugs)

### Format attendu (enriched JSON)

```json
[
  {
    "id": "yt-xxxxx",
    "title": "Titre de la ressource",
    "type": "Vidéo/Film",
    "url": "https://...",
    "_categories": ["general", "depression"],
    "enrichment": {
      "description": "Description enrichie par IA",
      "tags_troubles": ["Dépression"],
      "tags_type": ["Vidéo/Film"],
      "flag_validation": "OK"
    }
  }
]
```

## Accessibilité

- Taille de police ajustable (A−, A, A+)
- Mode espacement dyslexie
- Thème sombre / clair (+ détection système)
- Respect de `prefers-reduced-motion`
- Cibles tactiles ≥ 44px (WCAG 2.5.5)
- `aria-live`, `aria-pressed`, `aria-controls` sur les éléments interactifs

## Données

Chaque ressource suit ce format dans `wikiperche-data.js` :

```js
{
  "id": "slug-du-titre",
  "icon": "🎬",
  "title": "Titre de la ressource",
  "desc": "Description courte",
  "type": "Vidéo / Film",
  "troubles": ["Dépression", "Anxiété/Angoisse"],
  "link": "https://..."
}
```

Pour modifier les données, éditer `wikiperche-data.js` directement ou utiliser le script d'import. Les filtres se mettent à jour dynamiquement — seuls `ORDRE_TYPES` et `ORDRE_TROUBLES` dans `index.html` contrôlent l'ordre d'affichage des chips.
