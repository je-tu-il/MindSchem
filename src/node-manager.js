// ========================================
// MindSchem - Node Manager
// ========================================

import { showToast } from './toast.js';

let nodeIdCounter = 0;

/**
 * Generate a unique node ID
 */
export function generateNodeId() {
  return `node-${++nodeIdCounter}`;
}

/**
 * Reset the ID counter (for imports)
 */
export function resetNodeIdCounter(val = 0) {
  nodeIdCounter = val;
}

/**
 * Default node properties
 */
export const DEFAULT_PROPS = {
  bgColor: '#1e2642',
  textColor: '#f1f5f9',
  fontFamily: 'Inter',
  opacity: 1,
  width: 'auto',
  linkColor: '#667eea',
  linkStyle: 'solid',
  linkDir: 'none'
};

/**
 * Root node default properties (gradient-ish)
 */
export const ROOT_PROPS = {
  bgColor: '#667eea',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  opacity: 1,
  width: 'auto',
  linkColor: '#667eea',
  linkStyle: 'solid',
  linkDir: 'none'
};

/**
 * Create a node data object
 */
export function createNodeData(options = {}) {
  const id = options.id || generateNodeId();
  return {
    id,
    text: options.text || 'Nouveau nœud',
    parentId: options.parentId || null,
    children: options.children || [],
    x: options.x || 0,
    y: options.y || 0,
    collapsed: options.collapsed || false,
    props: {
      bgColor: options.bgColor || DEFAULT_PROPS.bgColor,
      textColor: options.textColor || DEFAULT_PROPS.textColor,
      fontFamily: options.fontFamily || DEFAULT_PROPS.fontFamily,
      opacity: options.opacity != null ? options.opacity : DEFAULT_PROPS.opacity,
      width: options.width || DEFAULT_PROPS.width,
      linkColor: options.linkColor || DEFAULT_PROPS.linkColor,
      linkStyle: options.linkStyle || DEFAULT_PROPS.linkStyle,
      linkDir: options.linkDir || DEFAULT_PROPS.linkDir,
      isolated: options.isolated || false
    },
    textExpanded: options.textExpanded || false,
    links: options.links || []
  };
}

export class NodeManager {
  constructor(bus, history) {
    this.bus = bus;
    this.history = history;
    this.nodes = new Map(); // id -> nodeData
    this.selectedNodeId = null;
    this.selectedNodes = new Set();
    this.nodesLayer = document.getElementById('nodes-layer');
    this.editingNodeId = null;

    // Drag state
    this.dragState = null;
    this.linkingFromId = null;
    this.wasRightDragging = false;

    // Layout request dedup
    this._pendingLayoutId = null;
    this._layoutRAF = null;

    // Resize observer to auto-update connections when nodes change size (e.g., initially rendered or text edited)
    this.resizeObserver = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        if (entry.contentRect.width > 0 || entry.contentRect.height > 0) {
          changed = true;
          break;
        }
      }
      if (changed) {
        this.bus.emit('nodes:changed');
      }
    });

    this.init();
  }

  init() {
    // Listen for click on canvas background to deselect
    document.getElementById('canvas-container').addEventListener('pointerdown', (e) => {
      if (this.linkingFromId) {
        this.linkingFromId = null;
        document.getElementById('canvas-container').classList.remove('linking-mode');
        showToast('Liaison annulée', 'info');
        return;
      }
      
      if (e.target === e.currentTarget || e.target.id === 'canvas' || e.target.id === 'nodes-layer') {
        if (!e.target.closest('.mind-node') && e.button === 0 && !document.getElementById('canvas-container').__canvas?.spaceHeld) {
          this.deselectAll();
        }
      }
    });

    // Double click to add a new root node
    document.getElementById('canvas-container').addEventListener('dblclick', (e) => {
      if (e.target === e.currentTarget || e.target.id === 'canvas' || e.target.id === 'nodes-layer') {
        if (!e.target.closest('.mind-node')) {
          const canvasEl = document.getElementById('canvas');
          const transform = canvasEl.style.transform;
          const scaleMatch = transform.match(/scale\(([^)]+)\)/);
          const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
          const canvasRect = canvasEl.getBoundingClientRect();
          const mouseX = (e.clientX - canvasRect.left) / scale;
          const mouseY = (e.clientY - canvasRect.top) / scale;
          
          const newNode = this.addRoot(mouseX, mouseY);
          this.selectNode(newNode.id);
          this.startEditing(newNode.id);
        }
      }
    });

    // Toolbar buttons
    document.getElementById('btn-add-child')?.addEventListener('click', () => this.addChildToSelected());
    document.getElementById('btn-add-sibling')?.addEventListener('click', () => this.addSiblingToSelected());
    document.getElementById('btn-delete')?.addEventListener('click', () => this.deleteSelected());
    document.getElementById('btn-undo')?.addEventListener('click', () => this.history.undo() && this.refreshAll());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.history.redo() && this.refreshAll());
  }

  /**
   * Utilité pour demander un relayout asynchrone sécurisé.
   * Utilise requestAnimationFrame pour garantir que le DOM est peint
   * avant de mesurer offsetWidth/offsetHeight.
   * Déduplique les appels multiples dans le même frame.
   */
  requestLayout(rootId) {
    // Store the most specific rootId requested
    if (rootId && !this._pendingLayoutId) {
      this._pendingLayoutId = rootId;
    } else if (!rootId) {
      this._pendingLayoutId = null; // null = full layout
    }

    if (this._layoutRAF) return; // Already scheduled

    this._layoutRAF = requestAnimationFrame(() => {
      // Double rAF to ensure DOM has painted
      requestAnimationFrame(() => {
        const layoutRoot = this._pendingLayoutId;
        this._pendingLayoutId = null;
        this._layoutRAF = null;

        if (layoutRoot) {
          this.layoutSubtree(layoutRoot);
        } else {
          this.autoLayout();
        }
        this.refreshAll();
      });
    });
  }

  /**
   * Create a root node
   */
  createRootNode(text = 'Carte Mentale', x = 0, y = 0) {
    const data = createNodeData({
      text,
      x: x - 80,
      y: y - 20,
      bgColor: ROOT_PROPS.bgColor,
      textColor: ROOT_PROPS.textColor,
      fontFamily: ROOT_PROPS.fontFamily,
      opacity: ROOT_PROPS.opacity
    });
    
    this.nodes.set(data.id, data);
    this.renderNode(data);
    this.selectNode(data.id);
    this.bus.emit('nodes:changed');
    return data;
  }

  addRoot(x = 0, y = 0, text = 'Nouveau nœud') {
    const data = createNodeData({
      text,
      x,
      y,
      bgColor: ROOT_PROPS.bgColor,
      textColor: ROOT_PROPS.textColor,
      fontFamily: ROOT_PROPS.fontFamily,
      opacity: ROOT_PROPS.opacity
    });
    
    this.nodes.set(data.id, data);
    this.renderNode(data);
    this.selectNode(data.id);
    
    this.history.push({
      type: 'addNode',
      description: 'Ajouter bloc principal',
      undo: () => {
        this.removeNodeInternal(data.id);
        this.bus.emit('nodes:changed');
      },
      redo: () => {
        this.nodes.set(data.id, data);
        this.bus.emit('nodes:changed');
      }
    });

    this.bus.emit('nodes:changed');
    return data;
  }

  /**
   * Add a child node to the given parent
   */
addChild(parentId, text = 'Nouveau nœud', props = null) {
    const parent = this.nodes.get(parentId);
    if (!parent) return null;

    const parentEl = document.getElementById(parentId);
    const parentWidth = parentEl ? parentEl.offsetWidth : 200;
    const offsetX = parentWidth + 120; 

    let targetX = parent.x + offsetX;
    let targetY = parent.y;

    // Better size estimation constants
    const EST_WIDTH = 280;
    const EST_HEIGHT = 80;
    const GAP = 50; // Minimum gap between nodes

    if (parent.children.length > 0) {
      // Find the lowest child bottom edge to start below it
      let maxBottom = -Infinity;
      for (const childId of parent.children) {
        const child = this.nodes.get(childId);
        if (!child) continue;
        const childEl = document.getElementById(childId);
        const childH = childEl ? Math.max(childEl.offsetHeight, EST_HEIGHT) : EST_HEIGHT;
        const bottom = child.y + childH;
        if (bottom > maxBottom) maxBottom = bottom;
      }
      targetY = maxBottom + GAP;
    }

    // Ensure no overlap with ANY existing node
    const isOverlapping = (x, y) => {
      const w = EST_WIDTH;
      const h = EST_HEIGHT;
      for (const node of this.nodes.values()) {
        const el = document.getElementById(node.id);
        const nw = el ? Math.max(el.offsetWidth, 120) : w;
        const nh = el ? Math.max(el.offsetHeight, 40) : h;
        
        // Use GAP as padding between nodes
        if (x < node.x + nw + GAP &&
            x + w > node.x - GAP &&
            y < node.y + nh + GAP &&
            y + h > node.y - GAP) {
          return true;
        }
      }
      return false;
    };

    // Shift down by actual estimated node height + gap (not a fixed 80)
    while (isOverlapping(targetX, targetY)) {
      targetY += EST_HEIGHT + GAP;
    }

    const data = createNodeData({
      text,
      parentId,
      x: targetX,
      y: targetY,
      bgColor: props?.bgColor || DEFAULT_PROPS.bgColor,
      textColor: props?.textColor || DEFAULT_PROPS.textColor,
      fontFamily: props?.fontFamily || DEFAULT_PROPS.fontFamily,
      opacity: props?.opacity != null ? props.opacity : DEFAULT_PROPS.opacity
    });

    parent.children.push(data.id);
    this.nodes.set(data.id, data);

    this.renderNode(data);

    this.history.push({
      type: 'addNode',
      description: `Ajout nœud enfant`,
      undo: () => {
        this.removeNodeInternal(data.id);
        this.refreshAll();
      },
      redo: () => {
        parent.children.push(data.id);
        this.nodes.set(data.id, data);
        this.refreshAll();
      }
    });

    if (parent.collapsed) {
      parent.collapsed = false;
      this.updateToggleButton(parent);
      this.refreshAll();
    }

    this.bus.emit('nodes:changed');
    return data;
  }

  /**
   * Add a sibling node (child of the same parent)
   */
  addSibling(nodeId, text = 'Nouveau nœud') {
    const node = this.nodes.get(nodeId);
    if (!node || !node.parentId) return null;
    return this.addChild(node.parentId, text);
  }

  addChildToSelected() {
    if (this.selectedNodeId) {
      const child = this.addChild(this.selectedNodeId);
      if (child) {
        this.selectNode(child.id);
        this.startEditing(child.id);
      }
    }
  }

  addSiblingToSelected() {
    if (this.selectedNodeId) {
      const node = this.nodes.get(this.selectedNodeId);
      if (node && node.parentId) {
        const sibling = this.addSibling(this.selectedNodeId);
        if (sibling) {
          this.selectNode(sibling.id);
          this.startEditing(sibling.id);
        }
      }
    }
  }

  /**
   * Duplicate a node
   */
  duplicateNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || !node.parentId) return null; // Only duplicate children

    const sibling = this.addChild(node.parentId, node.text, node.props);
    if (sibling) {
      this.selectNode(sibling.id);
    }
    return sibling;
  }

  /**
   * Delete a node and all its descendants
   */
  deleteNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const parentId = node.parentId;
    const snapshot = this.getSubtreeSnapshot(nodeId);

    this.removeNodeInternal(nodeId);

    this.history.push({
      type: 'deleteNode',
      description: `Suppression nœud "${node.text}"`,
      undo: () => {
        this.restoreSubtreeSnapshot(snapshot);
        this.bus.emit('nodes:changed');
      },
      redo: () => {
        this.removeNodeInternal(nodeId);
        this.bus.emit('nodes:changed');
      }
    });

    this.deselectAll();
    this.bus.emit('nodes:changed');
  }

  deleteSelected() {
    if (this.selectedNodeId) {
      this.deleteNode(this.selectedNodeId);
    }
  }

  /**
   * Delete only the children of a node
   */
  deleteChildren(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || node.children.length === 0) return;

    const snapshots = node.children.map(childId => this.getSubtreeSnapshot(childId));
    const oldChildren = [...node.children];

    for (const childId of oldChildren) {
      this.removeNodeInternal(childId);
    }

    this.history.push({
      type: 'deleteChildren',
      description: `Suppression enfants de "${node.text}"`,
      undo: () => {
        for (const snap of snapshots) {
          this.restoreSubtreeSnapshot(snap);
        }
        this.bus.emit('nodes:changed');
      },
      redo: () => {
        for (const childId of oldChildren) {
          this.removeNodeInternal(childId);
        }
        this.bus.emit('nodes:changed');
      }
    });

    this.bus.emit('nodes:changed');
  }

  /**
   * Internal removal without history
   */
  removeNodeInternal(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== nodeId);
      }
    }

    for (const otherNode of this.nodes.values()) {
      if (otherNode.links) {
        otherNode.links = otherNode.links.filter(id => id !== nodeId);
      }
    }

    const removeDescendants = (id) => {
      const n = this.nodes.get(id);
      if (!n) return;
      for (const childId of [...n.children]) {
        removeDescendants(childId);
      }
      this.nodes.delete(id);
      const el = document.getElementById(id);
      if (el) el.remove();
    };

    removeDescendants(nodeId);
  }

  /**
   * Get a snapshot of a subtree for undo
   */
  getSubtreeSnapshot(nodeId) {
    const result = [];
    const collect = (id) => {
      const node = this.nodes.get(id);
      if (!node) return;
      result.push(JSON.parse(JSON.stringify(node)));
      for (const childId of node.children) {
        collect(childId);
      }
    };
    collect(nodeId);
    return result;
  }

  /**
   * Restore a subtree from snapshot
   */
  restoreSubtreeSnapshot(snapshot) {
    for (const nodeData of snapshot) {
      this.nodes.set(nodeData.id, nodeData);
    }
    if (snapshot[0] && snapshot[0].parentId) {
      const parent = this.nodes.get(snapshot[0].parentId);
      if (parent && !parent.children.includes(snapshot[0].id)) {
        parent.children.push(snapshot[0].id);
      }
    }
  }

  /**
   * Update node text
   */
  updateText(nodeId, newText) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const oldText = node.text;
    node.text = newText;

    this.history.push({
      type: 'updateText',
      description: `Modifier texte`,
      undo: () => {
        node.text = oldText;
        this.refreshNodeElement(nodeId);
        this.requestLayout(node.parentId || nodeId);
      },
      redo: () => {
        node.text = newText;
        this.refreshNodeElement(nodeId);
        this.requestLayout(node.parentId || nodeId);
      }
    });

    this.refreshNodeElement(nodeId);
    this.requestLayout(node.parentId || nodeId);
    this.bus.emit('nodes:changed');
  }

  /**
   * Update node visual properties
   */
  updateProps(nodeId, newProps, cascade = false) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const oldProps = { ...node.props };
    Object.assign(node.props, newProps);

    const linkKeys = ['linkColor', 'linkStyle', 'linkDir'];
    const colorKeys = ['bgColor', 'textColor', 'fontFamily', 'opacity', 'width'];
    const hasLinkProp = Object.keys(newProps).some(k => linkKeys.includes(k));
    const hasColorProp = Object.keys(newProps).some(k => colorKeys.includes(k));

    const oldSubtreeProps = new Map();
    
    if (cascade && (hasLinkProp || hasColorProp)) {
      const applyCascade = (nId) => {
        const n = this.nodes.get(nId);
        if (!n) return;
        for (const childId of n.children) {
          const childNode = this.nodes.get(childId);
          if (childNode && !childNode.props.isolated) {
             oldSubtreeProps.set(childId, { ...childNode.props });
             
             if (hasLinkProp) {
               linkKeys.forEach(k => {
                 if (newProps[k] !== undefined) childNode.props[k] = newProps[k];
               });
             }
             if (hasColorProp) {
               colorKeys.forEach(k => {
                 if (newProps[k] !== undefined) childNode.props[k] = newProps[k];
               });
             }
             this.applyNodeStyles(childId);
             applyCascade(childId);
          }
        }
      };
      applyCascade(nodeId);
    }

    this.history.push({
      type: 'updateProps',
      description: 'Modifier propriétés',
      undo: () => {
        node.props = { ...oldProps };
        for (const [cId, cProps] of oldSubtreeProps.entries()) {
          const childNode = this.nodes.get(cId);
          if (childNode) {
            childNode.props = cProps;
            this.applyNodeStyles(cId);
          }
        }
        this.applyNodeStyles(nodeId);
        this.bus.emit('node:selected', node);
        this.bus.emit('nodes:changed');
      },
      redo: () => {
        Object.assign(node.props, newProps);
        if (hasLinkProp) {
          const cascade = (nId) => {
            const n = this.nodes.get(nId);
            if (!n) return;
            for (const childId of n.children) {
              const childNode = this.nodes.get(childId);
              if (childNode && !childNode.props.isolated) {
                 linkKeys.forEach(k => {
                   if (newProps[k] !== undefined) childNode.props[k] = newProps[k];
                 });
                 colorKeys.forEach(k => {
                   if (newProps[k] !== undefined) childNode.props[k] = newProps[k];
                 });
                 this.applyNodeStyles(childId);
                 cascade(childId);
              }
            }
          };
          cascade(nodeId);
        }
        this.applyNodeStyles(nodeId);
        this.bus.emit('node:selected', node);
        this.bus.emit('nodes:changed');
      }
    });

    this.applyNodeStyles(nodeId);
    this.bus.emit('nodes:changed');
  }

  updatePropsMultiple(nodeIds, newProps, cascade = false) {
    if (!nodeIds || nodeIds.length === 0) return;

    const oldPropsMap = new Map();
    const oldSubtreeProps = new Map();
    
    const linkKeys = ['linkColor', 'linkStyle', 'linkDir'];
    const colorKeys = ['bgColor', 'textColor', 'fontFamily', 'opacity', 'width'];
    const hasLinkProp = Object.keys(newProps).some(k => linkKeys.includes(k));
    const hasColorProp = Object.keys(newProps).some(k => colorKeys.includes(k));

    for (const nodeId of nodeIds) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;
      oldPropsMap.set(nodeId, { ...node.props });
      Object.assign(node.props, newProps);

      if (cascade && (hasLinkProp || hasColorProp)) {
        const applyCascade = (nId) => {
          const n = this.nodes.get(nId);
          if (!n) return;
          for (const childId of n.children) {
            const childNode = this.nodes.get(childId);
            if (childNode && !childNode.props.isolated) {
               if (!oldSubtreeProps.has(childId)) {
                 oldSubtreeProps.set(childId, { ...childNode.props });
               }
               if (hasLinkProp) {
                 linkKeys.forEach(k => {
                   if (newProps[k] !== undefined) childNode.props[k] = newProps[k];
                 });
               }
               if (hasColorProp) {
                 colorKeys.forEach(k => {
                   if (newProps[k] !== undefined) childNode.props[k] = newProps[k];
                 });
               }
               this.applyNodeStyles(childId);
               applyCascade(childId);
            }
          }
        };
        applyCascade(nodeId);
      }
    }

    this.history.push({
      type: 'updatePropsMultiple',
      description: 'Modifier propriétés multiples',
      undo: () => {
        for (const [nId, oProps] of oldPropsMap.entries()) {
          const node = this.nodes.get(nId);
          if (node) {
            node.props = { ...oProps };
            this.applyNodeStyles(nId);
          }
        }
        for (const [cId, cProps] of oldSubtreeProps.entries()) {
          const childNode = this.nodes.get(cId);
          if (childNode) {
            childNode.props = cProps;
            this.applyNodeStyles(cId);
          }
        }
        if (nodeIds.length === 1) {
           this.bus.emit('node:selected', this.nodes.get(nodeIds[0]));
        }
        this.bus.emit('nodes:changed');
      },
      redo: () => {
        for (const nodeId of nodeIds) {
          const node = this.nodes.get(nodeId);
          if (!node) continue;
          Object.assign(node.props, newProps);

          if (hasLinkProp || hasColorProp) {
            const cascadeFn = (nId) => {
              const n = this.nodes.get(nId);
              if (!n) return;
              for (const childId of n.children) {
                const childNode = this.nodes.get(childId);
                if (childNode && !childNode.props.isolated) {
                   linkKeys.forEach(k => {
                     if (newProps[k] !== undefined) childNode.props[k] = newProps[k];
                   });
                   colorKeys.forEach(k => {
                     if (newProps[k] !== undefined) childNode.props[k] = newProps[k];
                   });
                   this.applyNodeStyles(childId);
                   cascadeFn(childId);
                }
              }
            };
            cascadeFn(nodeId);
          }
          this.applyNodeStyles(nodeId);
        }
        if (nodeIds.length === 1) {
           this.bus.emit('node:selected', this.nodes.get(nodeIds[0]));
        }
        this.bus.emit('nodes:changed');
      }
    });

    for (const nodeId of nodeIds) {
      this.applyNodeStyles(nodeId);
    }
    this.bus.emit('nodes:changed');
  }

  /**
   * Move node to new position
   */
  moveNode(nodeId, x, y) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.x = x;
    node.y = y;
    const el = document.getElementById(nodeId);
    if (el) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    this.bus.emit('nodes:changed');
  }

  /**
   * Reparent a node (drag-and-drop restructuring)
   */
  reparentNode(nodeId, newParentId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    if (nodeId === newParentId) return;
    if (this.isDescendantOf(newParentId, nodeId)) return;

    const oldParentId = node.parentId;
    const oldParent = this.nodes.get(oldParentId);
    const newParent = this.nodes.get(newParentId);
    if (!newParent) return;

    if (oldParent) {
      oldParent.children = oldParent.children.filter(id => id !== nodeId);
    }
    newParent.children.push(nodeId);
    node.parentId = newParentId;

    this.requestLayout(newParentId);
    if (oldParentId) this.requestLayout(oldParentId);

    this.history.push({
      type: 'reparent',
      description: 'Restructurer nœud',
      undo: () => {
        newParent.children = newParent.children.filter(id => id !== nodeId);
        if (oldParent) oldParent.children.push(nodeId);
        node.parentId = oldParentId;
        this.requestLayout(oldParentId || newParentId);
      },
      redo: () => {
        if (oldParent) oldParent.children = oldParent.children.filter(id => id !== nodeId);
        newParent.children.push(nodeId);
        node.parentId = newParentId;
        this.requestLayout(newParentId);
      }
    });
  }

  isDescendantOf(nodeId, ancestorId) {
    let current = this.nodes.get(nodeId);
    while (current) {
      if (current.id === ancestorId) return true;
      current = this.nodes.get(current.parentId);
    }
    return false;
  }

  toggleCollapse(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || node.children.length === 0) return;
    node.collapsed = !node.collapsed;
    this.updateToggleButton(node);
    this.refreshAll();
    this.bus.emit('nodes:changed');
  }

  selectNode(nodeId, multi = false) {
    
    if (!multi) {
      this.deselectAll();
      this.selectedNodeId = nodeId;
      this.selectedNodes.add(nodeId);
      const el = document.getElementById(nodeId);
      if (el) el.classList.add('selected');
    } else {
      if (this.selectedNodes.has(nodeId)) {
        this.selectedNodes.delete(nodeId);
        const el = document.getElementById(nodeId);
        if (el) el.classList.remove('selected');
        if (this.selectedNodeId === nodeId) {
          this.selectedNodeId = Array.from(this.selectedNodes).pop() || null;
        }
      } else {
        this.selectedNodes.add(nodeId);
        this.selectedNodeId = nodeId;
        const el = document.getElementById(nodeId);
        if (el) el.classList.add('selected');
      }
    }

    const node = this.nodes.get(this.selectedNodeId);
    this.bus.emit('node:selected', node);
  }

  deselectAll() {
    for (const id of this.selectedNodes) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('selected');
    }
    this.selectedNodes.clear();
    if (this.selectedNodeId) {
      const el = document.getElementById(this.selectedNodeId);
      if (el) el.classList.remove('selected');
      this.selectedNodeId = null;
    }
    
    // Clear any text selection
    window.getSelection().removeAllRanges();
    if (document.activeElement && document.activeElement.classList.contains('node-content')) {
      document.activeElement.blur();
    }
    
    this.bus.emit('node:deselected');
    this.bus.emit('connections:clear-highlight');
  }

  startLinking(sourceNodeId) {
    this.linkingFromId = sourceNodeId;
    document.getElementById('canvas-container').classList.add('linking-mode');
    showToast('Cliquez sur le nœud de destination pour créer la liaison', 'info');
  }

  addLink(sourceId, targetId) {
    const source = this.nodes.get(sourceId);
    if (!source) return;
    if (!source.links) source.links = [];
    if (!source.links.includes(targetId)) {
      source.links.push(targetId);
      
      this.history.push({
        type: 'addLink',
        description: 'Ajouter liaison',
        undo: () => {
          source.links = source.links.filter(id => id !== targetId);
          this.bus.emit('nodes:changed');
        },
        redo: () => {
          source.links.push(targetId);
          this.bus.emit('nodes:changed');
        }
      });
      
      this.bus.emit('nodes:changed');
    }
  }

  startEditing(nodeId) {
    const el = document.getElementById(nodeId);
    if (!el) return;

    const content = el.querySelector('.node-content');
    if (!content) return;

    this.editingNodeId = nodeId;
    content.setAttribute('contenteditable', 'true');
    content.focus();

    const range = document.createRange();
    range.selectNodeContents(content);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const onBlur = () => {
      content.removeAttribute('contenteditable');
      const newText = content.innerText.trim() || 'Nouveau nœud';
      const node = this.nodes.get(nodeId);
      if (node && node.text !== newText) {
        this.updateText(nodeId, newText);
      }
      this.editingNodeId = null;
      content.removeEventListener('blur', onBlur);
    };

    content.addEventListener('blur', onBlur);

    content.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        content.blur();
      }
      if (e.key === 'Escape') {
        const node = this.nodes.get(nodeId);
        if (node) content.textContent = node.text;
        content.blur();
      }
      e.stopPropagation();
    });
  }

  renderNode(data) {
    const el = document.createElement('div');
    el.id = data.id;
    el.className = `mind-node${!data.parentId ? ' root-node' : ''}`;
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;

    el.innerHTML = `
      <div class="node-header">
        <span class="node-drag-handle">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
        </span>
        <div class="node-info-icon" title="Ce nœud est isolé de l'héritage">🔒</div>
        <div class="node-content">${this.escapeHtml(data.text)}</div>
      </div>
      <button class="node-add-child" title="Ajouter enfant">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <button class="node-toggle" title="Replier/Déplier" style="display:none;">−</button>
      <div class="node-resizer"></div>
    `;

    this.applyStylesToElement(el, data.props);
    if (data.textExpanded) el.classList.add('text-expanded');

    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.node-add-child') || e.target.closest('.node-toggle') || e.target.closest('.node-resizer')) return;
      if (e.button === 2) {
        if (!this.selectedNodes?.has(data.id)) {
           this.selectNode(data.id, e.shiftKey || e.ctrlKey || e.metaKey);
        }
        this.startRightClickDrag(data.id, e);
        return;
      }
      if (e.button !== 0) return;
      e.stopPropagation();

      if (this.linkingFromId) {
        if (this.linkingFromId !== data.id) {
          this.addLink(this.linkingFromId, data.id);
        }
        this.linkingFromId = null;
        document.getElementById('canvas-container').classList.remove('linking-mode');
        showToast('Liaison ajoutée', 'success');
        return;
      }

      this.selectNode(data.id, e.shiftKey || e.ctrlKey || e.metaKey);

      const isEditable = el.querySelector('.node-content[contenteditable="true"]');
      if (!isEditable) {
        this.startDrag(data.id, e);
      }
    });

    const resizer = el.querySelector('.node-resizer');
    if (resizer) {
      resizer.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.startResize(data.id, e);
      });
    }

    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.selectNode(data.id);
      this.startEditing(data.id);
    });

    el.querySelector('.node-add-child').addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(data.id);
      const child = this.addChild(data.id);
      if (child) {
        this.selectNode(child.id);
        this.startEditing(child.id);
      }
    });

    el.querySelector('.node-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse(data.id);
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (this.wasRightDragging) {
        this.wasRightDragging = false;
        return;
      }

      if (this.linkingFromId) {
        if (this.linkingFromId !== data.id) {
          this.addLink(this.linkingFromId, data.id);
        }
        this.linkingFromId = null;
        document.getElementById('canvas-container').classList.remove('linking-mode');
        showToast('Liaison ajoutée', 'success');
        return;
      }

      this.selectNode(data.id, e.shiftKey || e.ctrlKey || e.metaKey);
      this.bus.emit('contextmenu:show', { x: e.clientX, y: e.clientY, nodeId: data.id });
    });

    this.nodesLayer.appendChild(el);
    this.updateToggleButton(data);
    this.resizeObserver.observe(el);
  }

  startDrag(nodeId, startEvent) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    if (this.editingNodeId === nodeId) return;

    const el = document.getElementById(nodeId);
    if (!el) return;

    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const origX = node.x;
    const origY = node.y;
    let moved = false;
    let dropTarget = null;

    const container = document.getElementById('canvas-container');
    const canvasEl = document.getElementById('canvas');
    const transform = canvasEl.style.transform;
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

    const onMove = (e) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        el.classList.add('dragging');
        container.classList.add('dragging-node');
      }

      if (moved) {
        node.x = origX + dx;
        node.y = origY + dy;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;

        const newTarget = this.findDropTarget(nodeId, e.clientX, e.clientY);
        if (dropTarget && dropTarget !== newTarget) {
          const dtEl = document.getElementById(dropTarget);
          if (dtEl) dtEl.classList.remove('drop-target');
        }
        if (newTarget) {
          const dtEl = document.getElementById(newTarget);
          if (dtEl) dtEl.classList.add('drop-target');
        }
        dropTarget = newTarget;

        this.bus.emit('nodes:changed');
      }
    };

    const onUp = (e) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      el.classList.remove('dragging');
      container.classList.remove('dragging-node');

      if (dropTarget) {
        const dtEl = document.getElementById(dropTarget);
        if (dtEl) dtEl.classList.remove('drop-target');
        this.reparentNode(nodeId, dropTarget);
      } else if (moved) {
        const finalX = node.x;
        const finalY = node.y;
        this.history.push({
          type: 'moveNode',
          description: 'Déplacer nœud',
          undo: () => {
            this.moveNode(nodeId, origX, origY);
            this.bus.emit('nodes:changed');
          },
          redo: () => {
            this.moveNode(nodeId, finalX, finalY);
            this.bus.emit('nodes:changed');
          }
        });
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  startRightClickDrag(sourceId, startEvent) {
    const el = document.getElementById(sourceId);
    if (!el) return;

    let dropTarget = null;
    const dragLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    dragLine.setAttribute('class', 'connection-path link-path drag-line-temp');
    dragLine.setAttribute('stroke', '#a855f7');
    dragLine.setAttribute('stroke-dasharray', '5,5');
    dragLine.setAttribute('fill', 'none');
    dragLine.setAttribute('stroke-width', '2');
    dragLine.style.pointerEvents = 'none';
    document.getElementById('connections-layer').appendChild(dragLine);
    this._activeDragLine = dragLine;

    const canvasEl = document.getElementById('canvas');
    const scale = parseFloat(canvasEl.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1);
    const sourceNode = this.nodes.get(sourceId);
    const startX = sourceNode.x + el.offsetWidth / 2;
    const startY = sourceNode.y + el.offsetHeight / 2;

    let moved = false;

    const onMove = (e) => {
      const dx = Math.abs(e.clientX - startEvent.clientX);
      const dy = Math.abs(e.clientY - startEvent.clientY);
      if (dx > 5 || dy > 5) moved = true;
      if (!moved) return;

      const canvasRect = canvasEl.getBoundingClientRect();
      const mouseX = (e.clientX - canvasRect.left) / scale;
      const mouseY = (e.clientY - canvasRect.top) / scale;
      
      const d = `M ${startX} ${startY} L ${mouseX} ${mouseY}`;
      dragLine.setAttribute('d', d);

      const newTarget = this.findDropTarget(sourceId, e.clientX, e.clientY, true);
      if (dropTarget && dropTarget !== newTarget) {
        const dtEl = document.getElementById(dropTarget);
        if (dtEl) dtEl.classList.remove('drop-target');
      }
      if (newTarget) {
        const dtEl = document.getElementById(newTarget);
        if (dtEl) dtEl.classList.add('drop-target');
      }
      dropTarget = newTarget;
    };

    const onUp = (e) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      dragLine.remove();
      this._activeDragLine = null;
      
      if (moved) {
        this.wasRightDragging = true;
        setTimeout(() => this.wasRightDragging = false, 100);
      }
      
      if (dropTarget) {
        const dtEl = document.getElementById(dropTarget);
        if (dtEl) dtEl.classList.remove('drop-target');
        this.addLink(sourceId, dropTarget);
        showToast('Liaison ajoutée', 'success');
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  startResize(nodeId, startEvent) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    const el = document.getElementById(nodeId);
    if (!el) return;

    const startX = startEvent.clientX;
    const startWidth = el.offsetWidth;
    const scale = parseFloat(document.getElementById('canvas').style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1);

    const onMove = (e) => {
      const dx = (e.clientX - startX) / scale;
      const newWidth = Math.max(120, startWidth + dx);
      el.style.width = `${newWidth}px`;
      el.style.maxWidth = 'none';
      node.props.width = newWidth;
      this.bus.emit('nodes:changed');
    };

    const onUp = (e) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      
      this.history.push({
        type: 'resizeNode',
        description: 'Redimensionner nœud',
        undo: () => {
          node.props.width = startWidth;
          this.applyNodeStyles(nodeId);
          this.bus.emit('nodes:changed');
        },
        redo: () => {
          node.props.width = el.offsetWidth;
          this.applyNodeStyles(nodeId);
          this.bus.emit('nodes:changed');
        }
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  findDropTarget(dragNodeId, screenX, screenY, isLinking = false) {
    const allNodes = document.querySelectorAll('.mind-node');
    for (const el of allNodes) {
      if (el.id === dragNodeId) continue;
      if (!isLinking && this.isDescendantOf(el.id, dragNodeId)) continue;

      const rect = el.getBoundingClientRect();
      if (screenX >= rect.left && screenX <= rect.right &&
          screenY >= rect.top && screenY <= rect.bottom) {
        return el.id;
      }
    }
    return null;
  }

  applyStylesToElement(el, props) {
    el.style.backgroundColor = props.bgColor;
    el.style.color = props.textColor;
    el.style.fontFamily = `'${props.fontFamily}', sans-serif`;
    el.style.opacity = props.opacity;
    
    if (props.width === 'auto' || !props.width) {
      el.style.width = 'max-content';
      el.style.maxWidth = '400px';
    } else {
      el.style.width = `${props.width}px`;
      el.style.maxWidth = 'none';
    }
    
    if (props.isolated) {
      el.classList.add('isolated');
    } else {
      el.classList.remove('isolated');
    }
  }

  applyNodeStyles(nodeId) {
    const node = this.nodes.get(nodeId);
    const el = document.getElementById(nodeId);
    if (!node || !el) return;
    this.applyStylesToElement(el, node.props);
  }

  refreshNodeElement(nodeId) {
    const node = this.nodes.get(nodeId);
    const el = document.getElementById(nodeId);
    if (!node || !el) return;

    const content = el.querySelector('.node-content');
    if (content) content.textContent = node.text;
    this.applyStylesToElement(el, node.props);
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
  }

  updateToggleButton(data) {
    const el = document.getElementById(data.id);
    if (!el) return;
    const toggle = el.querySelector('.node-toggle');
    if (!toggle) return;

    if (data.children.length > 0) {
      toggle.style.display = '';
      toggle.textContent = data.collapsed ? '+' : '−';
      el.classList.toggle('collapsed', data.collapsed);
    } else {
      toggle.style.display = 'none';
      el.classList.remove('collapsed');
    }
  }

  refreshAll() {
    this.resizeObserver.disconnect();
    this.nodesLayer.innerHTML = '';

    const renderTree = (nodeId) => {
      const node = this.nodes.get(nodeId);
      if (!node) return;
      this.renderNode(node);

      if (!node.collapsed) {
        for (const childId of node.children) {
          renderTree(childId);
        }
      }
    };

    for (const node of this.nodes.values()) {
      if (!node.parentId) {
        renderTree(node.id);
      }
    }

    // Sync DOM positions from data model (in case layout changed them)
    for (const node of this.nodes.values()) {
      const el = document.getElementById(node.id);
      if (el) {
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
      }
    }

    // Re-apply selection
    for (const id of this.selectedNodes) {
      const el = document.getElementById(id);
      if (el) el.classList.add('selected');
    }

    this.bus.emit('nodes:changed');
  }

  layoutSubtree(rootId) {
    const root = this.nodes.get(rootId);
    if (!root) return;

    const measureSubtreeHeight = (nodeId) => {
      const node = this.nodes.get(nodeId);
      let nodeHeight = 100;
      const el = document.getElementById(nodeId);
      if (el) {
        nodeHeight = Math.max(100, el.offsetHeight + 40);
      }
      if (!node || node.collapsed || node.children.length === 0) return nodeHeight;
      let total = 0;
      for (const childId of node.children) {
        total += measureSubtreeHeight(childId);
      }
      return Math.max(nodeHeight, total);
    };

    const layoutNode = (nodeId, x, y) => {
      const node = this.nodes.get(nodeId);
      if (!node) return;

      node.x = x;
      node.y = y;

      if (node.collapsed || node.children.length === 0) return;

      const totalHeight = measureSubtreeHeight(nodeId);
      let currentY = y - totalHeight / 2;
      const childX = x + 280;

      for (const childId of node.children) {
        const childHeight = measureSubtreeHeight(childId);
        const childY = currentY + childHeight / 2;
        layoutNode(childId, childX, childY);
        currentY += childHeight;
      }
    };

    if (root.children.length === 0) return;

    const totalHeight = measureSubtreeHeight(rootId);
    let currentY = root.y - totalHeight / 2;
    const childX = root.x + 280;

    for (const childId of root.children) {
      const childHeight = measureSubtreeHeight(childId);
      const childY = currentY + childHeight / 2;
      layoutNode(childId, childX, childY);
      currentY += childHeight;
    }
  }

  autoLayout() {
    const roots = this.getRootNodes();

    const measureSubtreeHeight = (nodeId) => {
      const node = this.nodes.get(nodeId);
      let nodeHeight = 100;
      const el = document.getElementById(nodeId);
      if (el) {
        nodeHeight = Math.max(100, el.offsetHeight + 40);
      }
      if (!node || node.collapsed || node.children.length === 0) return nodeHeight;
      let total = 0;
      for (const childId of node.children) {
        total += measureSubtreeHeight(childId);
      }
      return Math.max(nodeHeight, total);
    };

    const layoutNode = (nodeId, x, y, level) => {
      const node = this.nodes.get(nodeId);
      if (!node) return;

      node.x = x;
      node.y = y;

      if (node.collapsed || node.children.length === 0) return;

      const totalHeight = measureSubtreeHeight(nodeId);
      let currentY = y - totalHeight / 2;
      const childX = x + 280;

      for (const childId of node.children) {
        const childHeight = measureSubtreeHeight(childId);
        const childY = currentY + childHeight / 2;
        layoutNode(childId, childX, childY, level + 1);
        currentY += childHeight;
      }
    };

    let startY = 0;
    for (const root of roots) {
      const height = measureSubtreeHeight(root.id);
      layoutNode(root.id, 0, startY + height / 2, 0);
      startY += height + 60;
    }
  }

  getRootNodes() {
    const roots = [];
    for (const node of this.nodes.values()) {
      if (!node.parentId) roots.push(node);
    }
    return roots;
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  clearAll() {
    this.nodesLayer.innerHTML = '';
    this.nodes.clear();
    this.selectedNodeId = null;
    this.editingNodeId = null;
    resetNodeIdCounter(0);
    this.bus.emit('nodes:changed');
    this.bus.emit('node:deselected');
  }

  loadNodes(nodesData) {
    this.clearAll();
    let maxId = 0;

    for (const data of nodesData) {
      this.nodes.set(data.id, data);
      const numMatch = data.id.match(/\d+/);
      if (numMatch) {
        maxId = Math.max(maxId, parseInt(numMatch[0]));
      }
    }

    resetNodeIdCounter(maxId);
    this.refreshAll();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}