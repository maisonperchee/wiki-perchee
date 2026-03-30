# WikiPerché

Bibliothèque de ressources sur la santé mentale, par [La Maison Perchée](https://lamaisonperchee.org).

Plus de 800 ressources (podcasts, livres, vidéos, sites, conférences, applis…) sélectionnées par des personnes concernées, pour les personnes concernées et leurs proches.

## Démarrage

Aucun build nécessaire — ouvrir `index.html` dans un navigateur.

```bash
# ou avec un serveur local
python3 -m http.server 8000
```

## Notion (source de données)

Les ressources sont gérées dans une base Notion. Deux scripts permettent de synchroniser les données.

Copier `.env.example` en `.env` et renseigner les variables :

```bash
NOTION_TOKEN=ntn_xxx...
NOTION_DB_ID=
```

### Synchronisation Notion → JSON (usage courant)

```bash
node scripts/sync-from-notion.js
```

Récupère toutes les pages avec "Publié" coché, regroupe par section (`vivre` / `retablissement` / `societe`) et écrase `wikiperche-data.json`.

### Migration JSON → Notion (one-shot)

```bash
node scripts/migrate-to-notion.js
```

Import initial de `wikiperche-data.json` vers la base Notion. À n'utiliser qu'une seule fois lors de la mise en place.

## Build & validation

```bash
npm install

# Valider les données uniquement (utile avant un commit)
npm run validate

# Valider + minifier CSS/JS → dist/
npm run build
```

`npm run validate` vérifie `wikiperche-data.json` contre `schema.json` et sort en erreur si le format est invalide — pratique pour détecter une faute de frappe dans un nom de champ avant la mise en production.

`npm run build` produit un dossier `dist/` prêt à déployer (CSS −26 %, JS −34 %).

## Structure du projet

```text
index.html                        # Structure HTML (header, filtres, grille, footer)
style.css                         # Styles (layout, cartes, dark mode, responsive, accessibilité)
app.js                            # Logique applicative (filtres, rendu, favoris, crise)
wikiperche-data.json              # Base de données des ressources (845 ressources)
wikiperche-data.js                # Thin loader — charge le JSON via XHR (compatibilité file://)
schema.json                       # JSON Schema pour la validation des données
scripts/build.js                  # Validation JSON + minification CSS/JS → dist/
scripts/sync-from-notion.js       # Synchronise Notion → wikiperche-data.json
scripts/migrate-to-notion.js      # Migration one-shot JSON → Notion (initialisation)
```

### Sections

| Section                    | Description                                                     |
| -------------------------- | --------------------------------------------------------------- |
| 🌱 Vivre avec              | Ressources pour le quotidien, proches aidants (119 ressources)  |
| 🌿 Vers le rétablissement  | Comprendre et traiter les troubles (686 ressources)             |
| 🤝 Maladie psy et société  | Regard sociétal, stigmatisation, témoignages (40 ressources)    |

### Filtres

- **Troubles** (groupés par catégorie) :
  - *Troubles accompagnés* : Bipolarité, Schizophrénie, Trouble schizo-affectif, Borderline / TPL
  - *Comorbidités fréquentes* : Dépression, Anxiété/Angoisse, Addictions, Autres troubles
  - *Neurodiversité & autres troubles* : TCA, TDAH adulte, TSPT / PTSD, TSA / autisme
  - *Thématiques transversales* : Deuil et perte, Troubles du sommeil, Santé mentale & précarité, Fonctions cognitives
  - *Être accompagné* : Proches aidants
- **Types de contenu** : Vidéo / Film, Site internet / Blog, Article / Livre, Podcast, Conférence, Applis, Réseaux sociaux, Infographie
- **Recherche** texte libre (insensible aux accents)
- **Favoris** sauvegardés en `localStorage`, partageables via URL

## Fonctionnalités

- **Section éditoriale "Pour commencer"** : sélection de ressources recommandées en page d'accueil
- **Pagination** : chargement par tranches de 24 avec barre de progression
- **Vue grille / liste** : basculement entre les deux modes d'affichage
- **Partage de favoris** : génération d'un lien URL contenant les IDs des favoris
- **Bandeau onboarding** : message d'aide à la première visite
- **Recherches fréquentes** : suggestions rapides au focus sur la barre de recherche
- **Synchronisation URL** : les filtres actifs sont reflétés dans les paramètres de l'URL
- **Bouton retour en haut** : apparaît après un scroll de 400px

## Accessibilité

- Taille de police ajustable (A−, A, A+)
- Mode espacement dyslexie
- Thème sombre / clair (+ détection système, sans flash au chargement)
- Respect de `prefers-reduced-motion`
- Cibles tactiles ≥ 44px (WCAG 2.5.5)
- `aria-live`, `aria-pressed`, `aria-controls` sur les éléments interactifs
- Skip link "Aller au contenu principal"
- Bandeau de crise contextuel : détecte les mots-clés de crise dans la recherche (suicide, détresse, etc.) et affiche les numéros d'urgence (3114, SOS Psychiatrie, SOS Amitié) de façon proéminente
- Indicateurs de scroll (fade-out + flèche) sur les zones horizontales scrollables (chips, carrousel édito)
- Bandes latérales colorées par type de contenu sur les cartes

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

Pour modifier les données, éditer directement dans Notion puis lancer `node scripts/sync-from-notion.js`. Les filtres se mettent à jour dynamiquement — seuls `ORDRE_TYPES` et `ORDRE_TROUBLES` dans `app.js` contrôlent l'ordre d'affichage des chips.
