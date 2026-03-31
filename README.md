# WikiPerché

Bibliothèque de ressources sur la santé mentale, par [La Maison Perchée](https://lamaisonperchee.org).

234 ressources (podcasts, vidéos, articles, sites, conférences, applis…) sélectionnées par des personnes concernées, pour les personnes concernées et leurs proches.

## Démarrage

Aucun build nécessaire — ouvrir `index.html` dans un navigateur.

```bash
# ou avec un serveur local
python3 -m http.server 8000
```

## Structure du projet

```text
index.html                        # Structure HTML (header, filtres, grille, footer)
style.css                         # Styles (layout, cartes, dark mode, responsive, accessibilité)
app.js                            # Logique applicative (filtres, rendu, favoris, crise…)
wikiperche-data.json              # Données des ressources (234 ressources)
wikiperche-data.js                # Thin loader — charge le JSON via XHR (compatibilité file://)
schema.json                       # JSON Schema pour la validation des données
fonts/                            # Polices auto-hébergées (DM Sans, Fraunces — 6 fichiers woff2)
scripts/build.js                  # Validation JSON + minification CSS/JS → dist/
scripts/sync-from-notion.js       # Synchronise Notion → wikiperche-data.json
scripts/migrate-to-notion.js      # Migration one-shot JSON → Notion (initialisation)
```

### Sections

| Section                    | Ressources | Description                                          |
| -------------------------- | ---------- | ---------------------------------------------------- |
| 🌱 Vivre avec              | 49         | Ressources pour le quotidien et les proches aidants  |
| 🌿 Vers le rétablissement  | 155        | Comprendre et traiter les troubles                   |
| 🤝 Maladie psy et société  | 30         | Regard sociétal, stigmatisation, témoignages         |

## Fonctionnalités

- **Filtres combinés** : section, type de contenu, troubles (multi-sélection avec logique OR), recherche texte libre insensible aux accents
- **Troubles groupés** par catégorie (Troubles accompagnés, Comorbidités fréquentes, Neurodiversité, Thématiques transversales, Être accompagné)
- **Compteurs temps réel** sur chaque chip de filtre
- **Section éditoriale "Pour commencer"** : 5 ressources épinglées en carrousel
- **Parcours guidé** : questionnaire 2 étapes ("Comment ça va ?") pour orienter les nouveaux visiteurs
- **Favoris** : sauvegarde locale (localStorage), partage via URL (`?favoris=id1,id2`)
- **Vue grille / liste** : bascule persistée en localStorage
- **Pagination** : tranches de 24 avec barre de progression
- **Aperçu ressource** : modale interstitielle avant navigation externe, avec ressources similaires
- **Bandeau de crise contextuel** : détecte les mots-clés de crise dans la recherche, affiche les numéros d'urgence (3114, SOS Psychiatrie, SOS Amitié)
- **Synchronisation URL** : filtres actifs reflétés dans les paramètres de l'URL, navigation arrière/avant fonctionnelle
- **Recherches rapides** : suggestions au focus sur la barre de recherche (top 5 troubles)

## Accessibilité

- Taille de police ajustable (A−, A, A+) persistée en localStorage
- Mode espacement dyslexie (espacement lettre/mot/ligne)
- Thème sombre / clair avec détection système, sans flash au chargement
- Respect de `prefers-reduced-motion`
- Cibles tactiles ≥ 44px (WCAG 2.5.5)
- `aria-live`, `aria-pressed`, `aria-controls`, `aria-expanded` sur les éléments interactifs
- Skip link "Aller au contenu principal"
- Polices auto-hébergées — aucune dépendance CDN (adapté aux réseaux restrictifs des établissements de santé)

## Données

Chaque ressource suit ce format dans `wikiperche-data.json` :

```json
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

`link` est optionnel — les ressources sans lien affichent une pill "À venir".

## Build & validation

```bash
npm install

# Valider les données uniquement (avant un commit)
npm run validate

# Valider + minifier CSS/JS → dist/
npm run build
```

`npm run validate` vérifie `wikiperche-data.json` contre `schema.json` (AJV) et sort en erreur si le format est invalide.

`npm run build` produit un dossier `dist/` prêt à déployer (CSS −26 %, JS −34 %).

## Notion (CMS)

Les ressources sont gérées dans une base Notion. Les scripts lisent le `.env` automatiquement.

Copier `.env.example` en `.env` :

```bash
NOTION_TOKEN=ntn_xxx...
# NOTION_DB_ID est optionnel — les scripts le découvrent ou créent la base automatiquement
```

### Synchronisation Notion → JSON (usage courant)

```bash
npm run sync
```

Récupère toutes les pages avec "Publié" coché, regroupe par section et écrase `wikiperche-data.json`. Si `NOTION_DB_ID` est absent du `.env`, la base est découverte automatiquement sous la page parente.

Enchaîner sync + build en une commande :

```bash
npm run sync:build
```

### Migration JSON → Notion (one-shot)

Import initial de `wikiperche-data.json` vers Notion. À n'utiliser qu'une seule fois lors de la mise en place.

#### 1. Créer l'intégration Notion

1. Aller sur [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. **New integration** → donner un nom (ex: `WikiPerchee`) → **Submit**
3. Copier le **Internal Integration Secret** (`ntn_xxx…`) → le mettre dans `.env` comme `NOTION_TOKEN`

#### 2. Connecter l'intégration à la page parente

Dans Notion, ouvrir la page qui accueillera la base → menu `···` → **Connections** → ajouter l'intégration.

#### 3. Lancer la migration

```bash
npm run sync:up
```

Si `NOTION_DB_ID` est absent du `.env`, le script crée automatiquement la base avec toutes les colonnes nécessaires, affiche son ID, puis enchaîne l'import (~3 req/s, ~5 min pour 234 ressources).

> Pour utiliser une page parente différente, ajouter `NOTION_PARENT_PAGE_ID=<id>` dans le `.env`.

### Colonnes de la base Notion

| Nom           | Type         |
| ------------- | ------------ |
| `Titre`       | Title        |
| `Section`     | Select       |
| `Icône`       | Text         |
| `ID`          | Text         |
| `Publié`      | Checkbox     |
| `Description` | Text         |
| `Type`        | Select       |
| `Troubles`    | Multi-select |
| `Lien`        | URL          |

Pour modifier les données, éditer directement dans Notion puis lancer `npm run sync`. Les filtres se mettent à jour dynamiquement — seuls `ORDRE_TYPES` et `ORDRE_TROUBLES` dans `app.js` contrôlent l'ordre d'affichage des chips.
