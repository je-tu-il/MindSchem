// ========================================
// MindSchem - SVG Connections Renderer
// ========================================

export class ConnectionsRenderer {
  constructor(bus, nodeManager) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.svg = document.getElementById('connections-layer');
    this.clickedConnection = null; // {parentId, childId} of clicked connection
    this._renderScheduled = false;

    // Re-render connections when nodes change
    this.bus.on('nodes:changed', () => {
      this.scheduleRender();
    });

    // Clear highlight when clicking empty canvas
    this.bus.on('connections:clear-highlight', () => {
      this.clickedConnection = null;
      this.scheduleRender();
    });

    // Initial render — use double rAF to ensure DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.render());
    });
  }

  /**
   * Schedule a render on the next animation frame.
   * Deduplicates multiple calls in the same frame.
   */
  scheduleRender() {
    if (this._renderScheduled) return;
    this._renderScheduled = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._renderScheduled = false;
        this.render();
      });
    });
  }

  render() {
    // Clear existing paths
    this.svg.innerHTML = '';

    // Add gradient definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'connection-gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('style', 'stop-color:rgba(102,126,234,0.6)');
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('style', 'stop-color:rgba(148,163,184,0.3)');
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);

    // Function to create markers dynamically
    this.createMarker = (id, color, orient, pathD, refX = 9) => {
      if (defs.querySelector('#' + CSS.escape(id))) return;
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', String(refX));
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', orient);
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('fill', color === 'default' ? '#667eea' : color);
      marker.appendChild(path);
      defs.appendChild(marker);
    };

    this.svg.appendChild(defs);

    // Compute ancestor path for highlights
    this.ancestorLinks = new Set();
    const findIncoming = (targetId, currentPath) => {
      if (currentPath.has(targetId)) return;
      currentPath.add(targetId);
      for (const [id, n] of this.nodeManager.nodes.entries()) {
        if (n.children.includes(targetId) || (n.links && n.links.includes(targetId))) {
          this.ancestorLinks.add(`${id}->${targetId}`);
          findIncoming(id, new Set(currentPath));
        }
      }
    };
    
    if (this.nodeManager.selectedNodes) {
      for (const selectedId of this.nodeManager.selectedNodes) {
         findIncoming(selectedId, new Set());
      }
    }

    // Compute clicked connection highlights (path to root + direct children)
    this.clickedLinks = new Set();
    this.clickedChildLinks = new Set();
    if (this.clickedConnection) {
      const { childId } = this.clickedConnection;
      // Highlight path up to root
      let current = childId;
      while (current) {
        const node = this.nodeManager.nodes.get(current);
        if (!node || !node.parentId) break;
        this.clickedLinks.add(`${node.parentId}->${current}`);
        current = node.parentId;
      }
      // Highlight direct children of the child node
      const childNode = this.nodeManager.nodes.get(childId);
      if (childNode) {
        for (const grandChildId of childNode.children) {
          this.clickedChildLinks.add(`${childId}->${grandChildId}`);
        }
      }
    }

    // Draw connections for all nodes
    for (const node of this.nodeManager.nodes.values()) {
      if (!node.collapsed) {
        for (const childId of node.children) {
          const child = this.nodeManager.nodes.get(childId);
          if (!child) continue;

          const parentEl = document.getElementById(node.id);
          const childEl = document.getElementById(childId);
          if (!parentEl || !childEl) continue;

          this.drawConnection(node, child, parentEl, childEl, false);
        }
      }
      
      // Draw arbitrary links
      if (node.links && node.links.length > 0) {
        for (const targetId of node.links) {
          const target = this.nodeManager.nodes.get(targetId);
          if (!target) continue;
          
          const sourceEl = document.getElementById(node.id);
          const targetEl = document.getElementById(targetId);
          if (!sourceEl || !targetEl) continue;
          
          this.drawConnection(node, target, sourceEl, targetEl, true);
        }
      }
    }

    // Re-append active drag line if right-click linking is in progress
    if (this.nodeManager._activeDragLine) {
      this.svg.appendChild(this.nodeManager._activeDragLine);
    }
  }

  /**
   * Determine best anchor points based on relative positions of two nodes.
   * When blocks are stacked vertically, use top/bottom anchors instead of left/right.
   */
  getAnchorPoints(pRect, cRect) {
    const pCenterX = pRect.x + pRect.w / 2;
    const pCenterY = pRect.y + pRect.h / 2;
    const cCenterX = cRect.x + cRect.w / 2;
    const cCenterY = cRect.y + cRect.h / 2;

    // Check horizontal overlap (blocks are roughly aligned vertically)
    const pLeft = pRect.x;
    const pRight = pRect.x + pRect.w;
    const cLeft = cRect.x;
    const cRight = cRect.x + cRect.w;
    const horizOverlap = pLeft < cRight && cLeft < pRight;

    // If horizontally overlapping, use vertical anchors
    if (horizOverlap && Math.abs(cCenterY - pCenterY) > Math.abs(cCenterX - pCenterX)) {
      if (cCenterY > pCenterY) {
        // Child is below parent
        return {
          startX: pCenterX, startY: pRect.y + pRect.h,
          endX: cCenterX, endY: cRect.y,
          vertical: true
        };
      } else {
        // Child is above parent
        return {
          startX: pCenterX, startY: pRect.y,
          endX: cCenterX, endY: cRect.y + cRect.h,
          vertical: true
        };
      }
    }

    // Default: right side of parent → left side of child
    if (cCenterX >= pCenterX) {
      return {
        startX: pRect.x + pRect.w, startY: pCenterY,
        endX: cRect.x, endY: cCenterY,
        vertical: false
      };
    } else {
      // Child is to the left of parent
      return {
        startX: pRect.x, startY: pCenterY,
        endX: cRect.x + cRect.w, endY: cCenterY,
        vertical: false
      };
    }
  }

  drawConnection(parent, child, parentEl, childEl, isLink) {
    const pRect = {
      x: parent.x,
      y: parent.y,
      w: parentEl.offsetWidth || 200,
      h: parentEl.offsetHeight || 60
    };

    const cRect = {
      x: child.x,
      y: child.y,
      w: childEl.offsetWidth || 200,
      h: childEl.offsetHeight || 60
    };

    const anchor = this.getAnchorPoints(pRect, cRect);
    const { startX, startY, endX, endY, vertical } = anchor;

    // Create smooth cubic bezier curve
    let cp1x, cp1y, cp2x, cp2y;
    if (vertical) {
      const dy = endY - startY;
      const controlOffset = Math.min(Math.abs(dy) * 0.5, 120);
      cp1x = startX;
      cp1y = startY + (dy > 0 ? controlOffset : -controlOffset);
      cp2x = endX;
      cp2y = endY + (dy > 0 ? -controlOffset : controlOffset);
    } else {
      const dx = endX - startX;
      const controlOffset = Math.min(Math.abs(dx) * 0.5, 120);
      cp1x = startX + (dx >= 0 ? controlOffset : -controlOffset);
      cp1y = startY;
      cp2x = endX + (dx >= 0 ? -controlOffset : controlOffset);
      cp2y = endY;
    }

    const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    
    // Determine properties
    let color = parent.props.linkColor || '#667eea';
    let style = parent.props.linkStyle || 'solid';
    const dir = parent.props.linkDir || 'none';

    // Manual links defaults
    if (isLink) {
      if (!parent.props.linkColor || parent.props.linkColor === '#667eea') color = '#a855f7';
      if (!parent.props.linkStyle) style = 'dotted';
    }

    path.setAttribute('class', isLink ? 'connection-path link-path' : 'connection-path');
    path.setAttribute('stroke', color);

    if (style === 'dashed') path.setAttribute('stroke-dasharray', '8,8');
    else if (style === 'dotted') path.setAttribute('stroke-dasharray', '4,4');

    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '2');

    // Arrows — fix #2: use refX=1 for backward markers so arrow sits at start of path
    if (dir !== 'none') {
      const colorId = color.replace('#', '');
      
      if (dir === 'forward' || dir === 'both') {
        const endId = `arrow-end-${colorId}`;
        this.createMarker(endId, color, 'auto', 'M 0 0 L 10 5 L 0 10 z', 9);
        path.setAttribute('marker-end', `url(#${endId})`);
      }
      
      if (dir === 'backward' || dir === 'both') {
        const startId = `arrow-start-${colorId}`;
        this.createMarker(startId, color, 'auto-start-reverse', 'M 0 0 L 10 5 L 0 10 z', 1);
        path.setAttribute('marker-start', `url(#${startId})`);
      }
    }
    
    path.setAttribute('data-parent', parent.id);
    path.setAttribute('data-child', child.id);

    // Highlight logic
    const linkId = `${parent.id}->${child.id}`;

    // Priority: clicked connection > selected node highlights
    if (this.clickedConnection) {
      if (this.clickedLinks.has(linkId)) {
        path.classList.add('highlighted-clicked-path');
      } else if (this.clickedChildLinks.has(linkId)) {
        path.classList.add('highlighted-clicked-children');
      }
    } else {
      if (this.nodeManager.selectedNodes?.has(parent.id)) {
        path.classList.add('highlighted-child');
      } else if (this.ancestorLinks.has(linkId)) {
        path.classList.add('highlighted-ancestor');
      } else if (this.nodeManager.selectedNodes?.has(child.id)) {
        path.classList.add('highlighted-ancestor');
      }
    }

    this.svg.appendChild(path);

    // Add invisible wider hit-test path for click detection (#4)
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', d);
    hitPath.setAttribute('fill', 'none');
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '16');
    hitPath.setAttribute('class', 'connection-hitbox');
    hitPath.setAttribute('data-parent', parent.id);
    hitPath.setAttribute('data-child', child.id);

    hitPath.addEventListener('click', (e) => {
      e.stopPropagation();
      // Deselect nodes
      this.nodeManager.deselectAll();
      // Set clicked connection
      this.clickedConnection = { parentId: parent.id, childId: child.id };
      requestAnimationFrame(() => this.render());
    });

    this.svg.appendChild(hitPath);
  }
}
