# MindSchem

Un outil moderne, fluide et réactif de création de cartes mentales et de schémas (Mind Mapping). Conçu avec Vanilla JS et propulsé par Vite, MindSchem permet de conceptualiser rapidement vos idées grâce à une interface épurée, un système de nœuds dynamique et une riche palette d'outils de personnalisation.

## ✨ Fonctionnalités clés

- **Canvas Infini & Zoom** : Naviguez dans vos idées sans limite de taille, zoomez avec la molette et déplacez-vous facilement.
- **Raccourcis productifs** : Créez des arbres de nœuds sans lever les mains du clavier (`Tab` pour un enfant, `Entrée` pour un frère, `Alt+Entrée` pour les propriétés, etc.).
- **Personnalisation complète** : Changez la couleur de fond, de texte, la police, l'opacité et les styles des lignes (continues, en pointillés, tiretées, directions de flèches).
- **Héritage intelligent (Cascade)** : Appliquez en un clic vos choix de couleurs ou de traits à toute la descendance d'un nœud.
- **Import/Export XML** : Sauvegardez et restaurez l'intégralité de votre travail avec positions, couleurs et liaisons manuelles sauvegardées.
- **Support des Lignes Personnalisées** : Reliez n'importe quel nœud à n'importe quel autre nœud d'un simple clic droit, idéal pour les schémas croisés.
- **Design Moderne & Accessible** : Mode clair/sombre, UI moderne avec dégradés, lissage des courbes.

## 🚀 Installation & Développement

### Prérequis
- [Node.js](https://nodejs.org/) (version 16+ recommandée)

### Lancer en local

1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/votre-nom/mindschem.git
   cd mindschem
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Démarrez le serveur de développement :
   ```bash
   npm run dev
   ```

4. Le projet sera disponible sur `http://localhost:5173/`.

### Build pour la production

```bash
npm run build
```

Le code minifié et optimisé se trouvera dans le dossier `dist/`. Vous pouvez le déployer sur GitHub Pages, Vercel, Netlify, ou n'importe quel serveur statique.

## ⌨️ Raccourcis Clavier

| Touche(s) | Action |
| --- | --- |
| `Tab` | Ajouter un enfant |
| `Entrée` | Ajouter un frère |
| `Alt+Entrée` | Ouvrir le panneau de propriétés |
| `Suppr` | Supprimer le nœud (et ses enfants) |
| `Alt+Suppr` | Supprimer uniquement les enfants |
| `F2` | Éditer le nœud sélectionné |
| `Ctrl+C` / `Ctrl+V` | Copier / Coller |
| `Ctrl+Alt+V` | Coller comme enfants multi-lignes |
| `Ctrl+Z` / `Ctrl+Y` | Annuler / Rétablir |
| `Maj+Clic` | Sélection multiple |
| `Clic Droit (glisser)` | Créer une liaison croisée personnalisée |

## 🛠️ Stack Technique

- **Vanilla JavaScript (ES6+)** : Logique métier et manipulation de l'arbre.
- **SVG / DOM** : Rendu des connexions optimisé en temps réel avec un système robuste pour prévenir les goulots d'étranglements via `requestAnimationFrame`.
- **Vite** : Outil de bundling super rapide pour le développement et la production.
- **CSS3 / Variables CSS** : Thématisation centralisée et transitions douces.

## 📝 Licence

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.
"# MindSchem" 
