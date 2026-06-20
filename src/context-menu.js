// ========================================
// MindSchem - Context Menu
// ========================================

import { showToast } from './toast.js';

export class ContextMenu {
  constructor(bus, nodeManager) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.menu = null;

    this.bus.on('contextmenu:show', (data) => this.show(data));

    // Close on click outside
    document.addEventListener('pointerdown', (e) => {
      if (this.menu && !this.menu.contains(e.target)) {
        this.hide();
      }
    });

    // Close on scroll/zoom
    document.addEventListener('wheel', () => this.hide());
    
    // Canvas context menu listener
    document.getElementById('canvas-container')?.addEventListener('contextmenu', (e) => {
      // If clicking on a node, the node's contextmenu event will catch it and stop propagation
      if (e.target.closest('.mind-node')) return;
      
      // If user was panning with right-click, don't show menu
      const canvasObj = document.getElementById('canvas-container').__canvas;
      if (canvasObj && canvasObj._rightPanned) return;
      
      e.preventDefault();
      this.showCanvasMenu({ x: e.clientX, y: e.clientY });
    });
  }

  show({ x, y, nodeId }) {
    this.hide();

    const node = this.nodeManager.nodes.get(nodeId);
    if (!node) return;

    this.menu = document.createElement('div');
    this.menu.className = 'context-menu';
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;

    const items = [
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        label: 'Éditer',
        shortcut: 'F2',
        action: () => this.nodeManager.startEditing(nodeId)
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
        label: 'Ajouter enfant',
        shortcut: 'Tab',
        action: () => {
          const child = this.nodeManager.addChild(nodeId);
          if (child) {
            this.nodeManager.selectNode(child.id);
            this.nodeManager.startEditing(child.id);
          }
        }
      },
      ...(node.parentId ? [{
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/><circle cx="18" cy="6" r="2"/></svg>',
        label: 'Ajouter frère',
        shortcut: 'Entrée',
        action: () => {
          const sibling = this.nodeManager.addSibling(nodeId);
          if (sibling) {
            this.nodeManager.selectNode(sibling.id);
            this.nodeManager.startEditing(sibling.id);
          }
        }
      }] : []),
      ...(node.children.length > 0 ? [{
        icon: node.collapsed 
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>',
        label: node.collapsed ? 'Déplier' : 'Replier',
        action: () => this.nodeManager.toggleCollapse(nodeId)
      }] : []),
      'separator',
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
        label: 'Copier le texte',
        action: () => {
          navigator.clipboard.writeText(node.text).then(() => {
            showToast('Texte copié !', 'success');
          }).catch(() => {
            showToast('Erreur de copie', 'error');
          });
        }
      },
      ...(node.parentId ? [{
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
        label: 'Dupliquer la case',
        action: () => this.nodeManager.duplicateNode(nodeId)
      }] : []),
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>',
        label: 'Ajouter une liaison',
        action: () => this.nodeManager.startLinking(nodeId)
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6M4 18h9M4 10h16M4 6h16"/></svg>',
        label: 'Texte entier (Activer/Désactiver)',
        action: () => {
           const node = this.nodeManager.nodes.get(nodeId);
           if(node) {
              node.textExpanded = !node.textExpanded;
              const el = document.getElementById(nodeId);
              if(el) {
                 el.classList.toggle('text-expanded', node.textExpanded);
                 this.nodeManager.bus.emit('nodes:changed');
              }
           }
        }
      },
      'separator',
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
        label: 'Propriétés',
        action: () => this.bus.emit('panel:toggle', nodeId),
        className: 'action-color'
      },
      'separator',
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
        label: 'Supprimer',
        shortcut: 'Suppr',
        action: () => this.nodeManager.deleteNode(nodeId),
        className: 'danger'
      }
    ];

    for (const item of items) {
      if (item === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        this.menu.appendChild(sep);
        continue;
      }

      const btn = document.createElement('button');
      btn.className = `context-menu-item ${item.className || ''}`;
      btn.innerHTML = `
        ${item.icon}
        <span>${item.label}</span>
        ${item.shortcut ? `<span class="shortcut-hint">${item.shortcut}</span>` : ''}
      `;
      btn.addEventListener('click', () => {
        item.action();
        this.hide();
      });
      this.menu.appendChild(btn);
    }

    document.body.appendChild(this.menu);

    // Adjust position if overflowing
    requestAnimationFrame(() => {
      if (!this.menu) return;
      const rect = this.menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.menu.style.left = `${window.innerWidth - rect.width - 8}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.menu.style.top = `${window.innerHeight - rect.height - 8}px`;
      }
    });
  }

  hide() {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }

  showCanvasMenu({ x, y }) {
    this.hide();

    this.menu = document.createElement('div');
    this.menu.className = 'context-menu';
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;

    const isDarkMode = document.body.classList.contains('dark-mode') || !document.body.classList.contains('light-mode');

    const items = [
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
        label: 'Nouveau bloc racine',
        action: () => {
          // Convert screen coords to canvas coords
          const canvasObj = document.getElementById('canvas-container').__canvas;
          if (canvasObj) {
            const pos = canvasObj.screenToCanvas(x, y);
            this.nodeManager.createRootNode('Nouveau bloc', pos.x, pos.y);
          }
        }
      },
      'separator',
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
        label: isDarkMode ? 'Mode Clair' : 'Mode Sombre',
        action: () => {
          if (isDarkMode) {
            document.body.classList.add('light-mode');
            document.body.classList.remove('dark-mode');
          } else {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
          }
        }
      },
      'separator',
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
        label: 'Réinitialiser la vue',
        action: () => {
          const btn = document.getElementById('btn-zoom-fit');
          if (btn) btn.click();
        }
      }
    ];

    for (const item of items) {
      if (item === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        this.menu.appendChild(sep);
        continue;
      }

      const btn = document.createElement('button');
      btn.className = `context-menu-item ${item.className || ''}`;
      btn.innerHTML = `
        ${item.icon}
        <span>${item.label}</span>
      `;
      btn.addEventListener('click', () => {
        item.action();
        this.hide();
      });
      this.menu.appendChild(btn);
    }

    document.body.appendChild(this.menu);
  }
}
