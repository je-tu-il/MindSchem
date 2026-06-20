// ========================================
// MindSchem - Keyboard Shortcuts
// ========================================

import { showToast } from './toast.js';

export class Shortcuts {
  constructor(bus, nodeManager, history, canvas) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.history = history;
    this.canvas = canvas;

    // Internal clipboard (avoids browser permission popup)
    this._clipboardText = '';

    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('paste', (e) => this.handlePaste(e));

    // Shortcuts help toggle
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.toggleShortcutsHelp();
    });

    document.getElementById('btn-close-shortcuts')?.addEventListener('click', () => {
      this.hideShortcutsHelp();
    });

    // Close shortcuts overlay on Escape
    document.getElementById('shortcuts-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideShortcutsHelp();
      }
    });
  }

  handleKeyDown(e) {
    // Don't handle shortcuts when editing text
    if (e.target.isContentEditable) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Tab - Add child
    if (e.key === 'Tab' && !ctrl) {
      e.preventDefault();
      this.nodeManager.addChildToSelected();
      return;
    }

    // Enter - Add sibling
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !ctrl) {
      e.preventDefault();
      this.nodeManager.addSiblingToSelected();
      return;
    }

    // Alt+Enter - Focus properties panel
    if (e.altKey && e.key === 'Enter') {
      e.preventDefault();
      const panel = document.getElementById('properties-panel');
      if (panel) {
        panel.classList.remove('hidden');
        const colorInput = document.getElementById('prop-bg-color');
        if (colorInput) colorInput.focus();
      }
      return;
    }

    // F2 - Edit node
    if (e.key === 'F2') {
      e.preventDefault();
      if (this.nodeManager.selectedNodeId) {
        this.nodeManager.startEditing(this.nodeManager.selectedNodeId);
      }
      return;
    }

    // Delete/Backspace - Delete node
    if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl && !e.altKey) {
      e.preventDefault();
      this.nodeManager.deleteSelected();
      return;
    }

    // Alt+Delete/Alt+Backspace - Delete children only
    if (e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      if (this.nodeManager.selectedNodeId) {
        this.nodeManager.deleteChildren(this.nodeManager.selectedNodeId);
      }
      return;
    }

    // Ctrl+C - Copy text (also store internally)
    if (ctrl && e.key === 'c') {
      const selected = Array.from(this.nodeManager.selectedNodes || []);
      if (selected.length > 0) {
        e.preventDefault();
        const texts = selected.map(id => {
          const node = this.nodeManager.nodes.get(id);
          return node ? node.text : '';
        }).filter(t => t);
        
        const clipboardText = texts.join('\n');
        this._clipboardText = clipboardText;
        navigator.clipboard.writeText(clipboardText).then(() => {
           showToast(`${selected.length} bloc(s) copié(s)`, 'success');
        });
      }
      return;
    }

    // Ctrl+Alt+V - Paste as CHILDREN (uses internal clipboard)
    if (ctrl && e.altKey && e.key.toLowerCase() === 'v') {
      const selected = Array.from(this.nodeManager.selectedNodes || []);
      if (selected.length > 0) {
        e.preventDefault();
        const doPaste = (text) => {
          if (!text) return;
          const lines = text.split('\n').map(l => l.trim()).filter(l => l);
          selected.forEach(parentId => {
            lines.forEach(line => {
              this.nodeManager.addChild(parentId, line);
            });
            this.nodeManager.bus.emit('nodes:changed');
          });
          showToast(`${lines.length} enfant(s) créé(s)`, 'success');
        };

        if (this._clipboardText) {
          doPaste(this._clipboardText);
        } else {
          navigator.clipboard.readText()
            .then(text => doPaste(text))
            .catch(() => {
              showToast('Impossible de lire le presse-papier', 'error');
            });
        }
      }
      return;
    }

    // Ctrl+Z - Undo
    if (ctrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (this.history.undo()) {
        this.nodeManager.refreshAll();
      }
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z - Redo
    if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      if (this.history.redo()) {
        this.nodeManager.refreshAll();
      }
      return;
    }

    // Ctrl+S - Save
    if (ctrl && e.key === 's') {
      e.preventDefault();
      this.bus.emit('save');
      return;
    }

    // Ctrl+A - Select all
    if (ctrl && e.key === 'a') {
      e.preventDefault();
      return;
    }

    // Escape - Deselect
    if (e.key === 'Escape') {
      e.preventDefault();
      this.nodeManager.deselectAll();
      this.hideShortcutsHelp();
      return;
    }

    // Arrow keys - Navigate between nodes
    if (e.key.startsWith('Arrow') && this.nodeManager.selectedNodeId) {
      e.preventDefault();
      this.navigateNodes(e.key);
      return;
    }

    // ? - Show shortcuts
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault();
      this.toggleShortcutsHelp();
      return;
    }

    // + or = - Zoom in
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.canvas.zoomBy(0.1);
      return;
    }

    // - - Zoom out
    if (e.key === '-') {
      e.preventDefault();
      this.canvas.zoomBy(-0.1);
      return;
    }

    // 0 - Reset zoom
    if (e.key === '0' && ctrl) {
      e.preventDefault();
      this.canvas.centerView();
      return;
    }
  }

  /**
   * Handle paste event — Ctrl+V = sibling (same level), multi-line = multi-blocs
   */
  handlePaste(e) {
    if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.altKey) return;

    const selected = Array.from(this.nodeManager.selectedNodes || []);
    if (selected.length === 0) return;

    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;

    e.preventDefault();
    this._clipboardText = text;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    let totalCreated = 0;
    const parentsToLayout = new Set();

    selected.forEach(nodeId => {
      const node = this.nodeManager.nodes.get(nodeId);
      if (!node) return;

      if (node.parentId) {
        // Add as siblings (children of same parent)
        lines.forEach(line => {
          this.nodeManager.addSibling(nodeId, line);
          totalCreated++;
        });
        parentsToLayout.add(node.parentId);
      } else {
        // Add as children of root
        lines.forEach(line => {
          this.nodeManager.addChild(nodeId, line);
          totalCreated++;
        });
        parentsToLayout.add(nodeId);
      }
    });

    // Just emit change for connections to re-render without auto-layout
    this.nodeManager.bus.emit('nodes:changed');
    showToast(`${totalCreated} bloc(s) créé(s)`, 'success');
  }

  /**
   * Navigate between nodes using arrow keys
   */
  navigateNodes(arrowKey) {
    const current = this.nodeManager.nodes.get(this.nodeManager.selectedNodeId);
    if (!current) return;

    let targetId = null;

    switch (arrowKey) {
      case 'ArrowRight': {
        if (current.children.length > 0 && !current.collapsed) {
          targetId = current.children[0];
        }
        break;
      }
      case 'ArrowLeft': {
        if (current.parentId) {
          targetId = current.parentId;
        }
        break;
      }
      case 'ArrowDown': {
        if (current.parentId) {
          const parent = this.nodeManager.nodes.get(current.parentId);
          if (parent) {
            const idx = parent.children.indexOf(current.id);
            if (idx < parent.children.length - 1) {
              targetId = parent.children[idx + 1];
            }
          }
        }
        break;
      }
      case 'ArrowUp': {
        if (current.parentId) {
          const parent = this.nodeManager.nodes.get(current.parentId);
          if (parent) {
            const idx = parent.children.indexOf(current.id);
            if (idx > 0) {
              targetId = parent.children[idx - 1];
            }
          }
        }
        break;
      }
    }

    if (targetId) {
      this.nodeManager.selectNode(targetId);
    }
  }

  toggleShortcutsHelp() {
    const overlay = document.getElementById('shortcuts-overlay');
    if (overlay) overlay.classList.toggle('hidden');
  }

  hideShortcutsHelp() {
    const overlay = document.getElementById('shortcuts-overlay');
    if (overlay) overlay.classList.add('hidden');
  }
}