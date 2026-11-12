// ========================================
// MindSchem - Application Core
// ========================================

import { EventBus } from './event-bus.js';
import { History } from './history.js';
import { Canvas } from './canvas.js';
import { NodeManager } from './node-manager.js';
import { ConnectionsRenderer } from './connections.js';
import { Minimap } from './minimap.js';
import { Shortcuts } from './shortcuts.js';
import { Storage } from './storage.js';
import { ContextMenu } from './context-menu.js';
import { PropertiesPanel } from './properties-panel.js';
import { parseGlooMapsXML } from './xml-parser.js';
import { serializeToGlooMapsXML } from './xml-serializer.js';
import { showToast } from './toast.js';
import { parseMarkdownToMindMap, exportNodesToMarkdown } from './markdown-converter.js';
import { generateMindMapFromAI } from './ai-generator.js';


export class App {
  constructor() {
    this.bus = new EventBus();
    this.history = new History();
  }

  init() {
    // Initialize modules
    this.canvas = new Canvas(this.bus);
    this.canvas.preventContextMenu();
    this.nodeManager = new NodeManager(this.bus, this.history);
    this.connections = new ConnectionsRenderer(this.bus, this.nodeManager);
    this.minimap = new Minimap(this.bus, this.nodeManager, this.canvas);
    this.shortcuts = new Shortcuts(this.bus, this.nodeManager, this.history, this.canvas);
    this.storage = new Storage(this.bus, this.nodeManager);
    this.contextMenu = new ContextMenu(this.bus, this.nodeManager);
    this.propertiesPanel = new PropertiesPanel(this.bus, this.nodeManager);

    // Initialize storage
    this.storage.init();

    // Load saved data or create default
    const loaded = this.storage.load();
    if (!loaded) {
      this.createDefaultMap();
    }

    // Layout only if fresh (not loaded from save) and fit to view.
    // If loaded from save, positions are already correct — just fit the view.
    // Use double rAF to ensure all DOM elements are painted and measurable.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!loaded) {
          this.nodeManager.autoLayout();
        }
        this.canvas.zoomToFit();
        // Force connections re-render after everything is positioned
        this.bus.emit('nodes:changed');
      });
    });

    // Wire up import/export buttons
    this.setupImportExport();

    // Auto-layout button
    document.getElementById('btn-auto-layout')?.addEventListener('click', () => {
      this.nodeManager.autoLayout();
      this.nodeManager.refreshAll();
      this.canvas.zoomToFit();
    });

    // Listen for save event
    this.bus.on('save', () => {
      this.storage.save();
      showToast('Carte sauvegardée !', 'success');
    });

    // Update undo/redo button states
    this.bus.on('nodes:changed', () => {
      this.updateUndoRedoButtons();
    });

    showToast('Bienvenue sur MindSchem !', 'info', 2000);
  }

  /**
   * Create a default mind map with sample nodes
   */
  createDefaultMap() {
    const root = this.nodeManager.createRootNode('Carte Mentale', 0, 0);
    
    const idea1 = this.nodeManager.addChild(root.id, 'Idée principale', {
      bgColor: '#2d3748',
      textColor: '#e2e8f0'
    });
    
    const idea2 = this.nodeManager.addChild(root.id, 'Concept clé', {
      bgColor: '#2d3748',
      textColor: '#e2e8f0'
    });
    
    const idea3 = this.nodeManager.addChild(root.id, 'Ressources', {
      bgColor: '#2d3748',
      textColor: '#e2e8f0'
    });

    if (idea1) {
      this.nodeManager.addChild(idea1.id, 'Sous-idée A');
      this.nodeManager.addChild(idea1.id, 'Sous-idée B');
    }

    if (idea2) {
      this.nodeManager.addChild(idea2.id, 'Détail 1');
      this.nodeManager.addChild(idea2.id, 'Détail 2');
      this.nodeManager.addChild(idea2.id, 'Détail 3');
    }

    if (idea3) {
      this.nodeManager.addChild(idea3.id, 'Document');
      this.nodeManager.addChild(idea3.id, 'Lien web');
    }

    // Clear history since these are initial setup actions
    this.history.clear();
  }

  /**
   * Setup import/export functionality
   */
  /**
   * Setup import/export and AI functionality
   */
  setupImportExport() {
    // GlooMaps XML Export / Import
    document.getElementById('btn-export')?.addEventListener('click', () => {
      this.exportXML();
    });

    document.getElementById('btn-import')?.addEventListener('click', () => {
      this.importXML();
    });

    // Markdown Export
    document.getElementById('btn-export-md')?.addEventListener('click', () => {
      this.exportMarkdown();
    });

    // Markdown Import
    document.getElementById('btn-import-md')?.addEventListener('click', () => {
      this.importMarkdown();
    });

    // AI Mind Map Generator (Oxion AI)
    document.getElementById('btn-ai-mindmap')?.addEventListener('click', () => {
      this.promptAIGeneration();
    });

    document.getElementById('btn-show-info')?.addEventListener('click', (e) => {
      document.body.classList.toggle('show-node-info');
      e.currentTarget.classList.toggle('active');
    });
  }

  /**
   * Prompt AI for automatic mind map generation
   */
  async promptAIGeneration() {
    const topic = window.prompt("Quel est le sujet ou l'objectif de la carte mentale à générer (Oxion AI) ?\nEx: Stratégie Marketing SaaS, Architecture Microservices, Cours d'histoire...");
    if (!topic || !topic.trim()) return;

    showToast("Génération de l'arborescence en cours...", "info");
    try {
      const nodes = await generateMindMapFromAI(topic.trim());
      if (!nodes || nodes.length === 0) {
        showToast("Aucun nœud n'a pu être généré.", "warning");
        return;
      }
      this.nodeManager.loadNodes(nodes);
      this.nodeManager.autoLayout();
      this.canvas.zoomToFit();
      this.history.clear();
      showToast(`Arborescence "${topic.trim()}" générée avec succès (${nodes.length} nœuds) !`, "success");
    } catch (err) {
      console.error("AI Generation error:", err);
      showToast("Erreur de génération : " + err.message, "error", 5000);
    }
  }

  /**
   * Import Markdown indented outline
   */
  importMarkdown() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,text/markdown,text/plain';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const mdText = ev.target.result;
          const nodes = parseMarkdownToMindMap(mdText);

          if (!nodes || nodes.length === 0) {
            showToast('Aucun nœud Markdown trouvé dans le fichier.', 'warning');
            return;
          }

          this.nodeManager.loadNodes(nodes);
          this.nodeManager.autoLayout();
          this.canvas.zoomToFit();
          this.history.clear();

          showToast(`${nodes.length} nœuds importés depuis Markdown !`, 'success');
        } catch (err) {
          console.error('Import Markdown error:', err);
          showToast('Erreur d\'import Markdown : ' + err.message, 'error', 5000);
        }
      };
      reader.readAsText(file);
    });

    input.click();
  }

  /**
   * Export to Markdown indented outline (Obsidian / Notion ready)
   */
  exportMarkdown() {
    try {
      const md = exportNodesToMarkdown(this.nodeManager);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `mindschem-export-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Export Markdown Obsidian réussi !', 'success');
    } catch (err) {
      console.error('Export Markdown error:', err);
      showToast('Erreur d\'export Markdown : ' + err.message, 'error');
    }
  }

    importXML() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,text/xml,application/xml';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const xmlString = ev.target.result;
          const nodesData = parseGlooMapsXML(xmlString);

          if (nodesData.length === 0) {
            showToast('Aucun nœud trouvé dans le fichier XML.', 'warning');
            return;
          }

          this.nodeManager.loadNodes(nodesData);
          this.canvas.zoomToFit();
          this.history.clear();

          showToast(`${nodesData.length} nœuds importés avec succès !`, 'success');
        } catch (err) {
          console.error('Import error:', err);
          showToast('Erreur d\'import : ' + err.message, 'error', 5000);
        }
      };
      reader.readAsText(file);
    });

    input.click();
  }

  /**
   * Export to GlooMaps XML file
   */
  exportXML() {
    try {
      const xml = serializeToGlooMapsXML(this.nodeManager);

      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `mindschem-export-${new Date().toISOString().slice(0, 10)}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Export XML réussi !', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Erreur d\'export : ' + err.message, 'error');
    }
  }

  /**
   * Update undo/redo button states
   */
  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !this.history.canUndo();
    if (redoBtn) redoBtn.disabled = !this.history.canRedo();
  }
}
