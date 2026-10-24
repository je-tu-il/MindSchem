# 🧠 MindSchem — Outil Moderne de Cartes Mentales & Schémas

[![Live Demo](https://img.shields.io/badge/Demo%20en%20Ligne-Essayer%20sans%20installation-success?style=for-the-badge&logo=github)](https://je-tu-il.github.io/MindSchem/)
[![GitHub Pages](https://img.shields.io/badge/Hébergement-GitHub%20Pages-blue.svg?logo=githubpages)](https://je-tu-il.github.io/MindSchem/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Un outil moderne, fluide et réactif de création de cartes mentales et de schémas (Mind Mapping).  
> Conçu en Vanilla JS et propulsé par Vite, MindSchem permet de conceptualiser rapidement vos idées grâce à une interface épurée, un système de nœuds dynamique, un positionnement anti-chevauchement et une riche palette d'outils de personnalisation.

---

## ⚡ Utilisation Immédiate (Sans Installation)

Pas besoin d'installer Node.js ni de ligne de commande :

👉 **[Accéder directement à MindSchem dans votre navigateur](https://je-tu-il.github.io/MindSchem/)**

Fonctionne immédiatement sur n'importe quel navigateur (Chrome, Firefox, Safari, Edge) sur ordinateur, tablette et mobile.

---

## ✨ Fonctionnalités clés

- 🌐 **Canvas Infini & Zoom fluide** : Naviguez dans vos idées sans limite de taille, zoomez à la molette et déplacez-vous facilement.
- ⚡ **Productivité Clavier Maximale** : Créez des arbres complets sans lâcher le clavier (`Tab` pour un enfant, `Entrée` pour un frère, `Alt+Entrée` pour les propriétés).
- 📐 **Organisation Automatique Intelligente** : Réorganise les branches en tenant compte de la taille personnalisée de chaque nœud pour éliminer les chevauchements.
- 🎨 **Personnalisation Complète & Directe** :
  - Couleur de fond, couleur de texte, police, opacité, largeur automatique ou manuelle.
  - Aperçu en direct du choix de couleur des lignes sans masque de sélection gênant.
- 🧬 **Héritage Dynamique de Style** : Les nouveaux nœuds enfants héritent automatiquement de la palette de leur parent (sauf isolation volontaire).
- 🔗 **Liaisons Croisées Libres** : Reliez n'importe quel nœud à un autre par simple glisser-déposer au clic droit (idéal pour les diagrammes relationnels).
- 💾 **Sauvegarde & Restauration XML** : Exportez et importez vos schémas complets en 1 clic.
- 🌙 **Thème Sombre & Épuré** : Interface soignée pensée pour le confort visuel lors des longues sessions de réflexion.

---

## ⌨️ Raccourcis Clavier

| Raccourci | Action |
| :--- | :--- |
| **`Tab`** | Ajouter un nœud enfant |
| **`Entrée`** | Ajouter un nœud frère |
| **`Alt + Entrée`** | Ouvrir / Fermer le panneau de propriétés |
| **`Suppr`** | Supprimer le nœud sélectionné (et sa branche) |
| **`Alt + Suppr`** | Supprimer uniquement les nœuds enfants |
| **`F2`** | Éditer le texte du nœud |
| **`Ctrl + C` / `Ctrl + V`** | Copier / Coller |
| **`Ctrl + Alt + V`** | Coller une liste multi-lignes en enfants séparés |
| **`Ctrl + Z` / `Ctrl + Y`** | Annuler / Rétablir |
| **`Maj + Clic`** | Sélection multiple |
| **`Clic Droit (glisser)`** | Créer une liaison croisée personnalisée |

---

## 🛠️ Lancement pour Développeurs (Code Source)

### Prérequis
- [Node.js](https://nodejs.org/) (version 18+ recommandée)

### Installation & Lancement local
```bash
git clone https://github.com/je-tu-il/MindSchem.git
cd MindSchem
npm install
npm run dev
```
Ouvrez `http://localhost:5173/` dans votre navigateur.

### Compilation Production
```bash
npm run build
```
Les fichiers statiques optimisés sont générés dans `dist/`.

---

## 📄 Licence

Distribué sous la licence MIT. Libre d'utilisation et de modification.
