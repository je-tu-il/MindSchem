// ========================================
// MindSchem - Infinite Canvas (Zoom & Pan)
// ========================================

export class Canvas {
  constructor(bus) {
    this.bus = bus;
    this.container = document.getElementById('canvas-container');
    this.canvas = document.getElementById('canvas');

    // Transform state
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;

    // Panning state
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.lastTranslateX = 0;
    this.lastTranslateY = 0;
    this.spaceHeld = false;

    // Zoom limits
    this.minScale = 0.1;
    this.maxScale = 4;

    // Pinch state
    this.lastPinchDist = 0;
    this.pinchCenter = { x: 0, y: 0 };

    this.init();
  }

  init() {
    // Mouse wheel zoom
    this.container.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // Pan with middle mouse or space+left click
    this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.container.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.container.addEventListener('pointerup', (e) => this.onPointerUp(e));

    // Touch gestures
    this.container.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.container.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.container.addEventListener('touchend', (e) => this.onTouchEnd(e));

    // Space key for pan mode
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.target.isContentEditable) {
        e.preventDefault();
        this.spaceHeld = true;
        this.container.style.cursor = 'grab';
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceHeld = false;
        if (!this.isPanning) {
          this.container.style.cursor = '';
        }
      }
    });

    // Toolbar zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.zoomBy(0.2));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.zoomBy(-0.2));
    document.getElementById('btn-zoom-fit')?.addEventListener('click', () => this.zoomToFit());

    // Initial center
    this.centerView();
  }

  onWheel(e) {
    e.preventDefault();

    const delta = -e.deltaY * 0.001;
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * (1 + delta)));

    // Zoom toward cursor position
    const rect = this.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.zoomAt(newScale, mouseX, mouseY);
  }

  zoomAt(newScale, pivotX, pivotY) {
    const scaleRatio = newScale / this.scale;

    this.translateX = pivotX - scaleRatio * (pivotX - this.translateX);
    this.translateY = pivotY - scaleRatio * (pivotY - this.translateY);
    this.scale = newScale;

    this.applyTransform();
    this.bus.emit('canvas:zoom', { scale: this.scale });
  }

  zoomBy(delta) {
    const rect = this.container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta));
    this.zoomAt(newScale, centerX, centerY);
  }

  onPointerDown(e) {
    const isBackground = e.target.id === 'canvas-container' || e.target.id === 'canvas' || e.target.id === 'nodes-layer' || e.target.id === 'connections-layer';
    
    // Start pan with middle button, right-click on background, space+left, or left click on background
    if (e.button === 1 || (e.button === 2 && isBackground) || (e.button === 0 && (this.spaceHeld || isBackground))) {
      e.preventDefault();
      this.isPanning = true;
      this._panButton = e.button;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.lastTranslateX = this.translateX;
      this.lastTranslateY = this.translateY;
      this.container.classList.add('panning');
      this.container.setPointerCapture(e.pointerId);
    }
  }

  onPointerMove(e) {
    if (!this.isPanning) return;

    const dx = e.clientX - this.panStartX;
    const dy = e.clientY - this.panStartY;

    this.translateX = this.lastTranslateX + dx;
    this.translateY = this.lastTranslateY + dy;

    this.applyTransform();
  }

  onPointerUp(e) {
    if (this.isPanning) {
      // If we panned with right-click, suppress the context menu
      if (this._panButton === 2) {
        const dx = Math.abs(e.clientX - this.panStartX);
        const dy = Math.abs(e.clientY - this.panStartY);
        if (dx > 3 || dy > 3) {
          this._rightPanned = true;
          setTimeout(() => this._rightPanned = false, 100);
        }
      }
      this.isPanning = false;
      this._panButton = null;
      this.container.classList.remove('panning');
      this.container.releasePointerCapture(e.pointerId);
    }
  }

  // Touch gesture support
  onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      this.lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      
      const rect = this.container.getBoundingClientRect();
      this.pinchCenter = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top
      };
      this.lastTranslateX = this.translateX;
      this.lastTranslateY = this.translateY;
    }
  }

  onTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleDelta = dist / this.lastPinchDist;
      const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * scaleDelta));

      this.zoomAt(newScale, this.pinchCenter.x, this.pinchCenter.y);
      this.lastPinchDist = dist;
    }
  }

  onTouchEnd(e) {
    this.lastPinchDist = 0;
  }

  applyTransform() {
    this.canvas.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    this.updateZoomDisplay();
    this.bus.emit('canvas:transform', {
      scale: this.scale,
      translateX: this.translateX,
      translateY: this.translateY
    });
  }

  updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) {
      el.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  centerView() {
    const rect = this.container.getBoundingClientRect();
    this.translateX = rect.width / 2;
    this.translateY = rect.height / 3;
    this.scale = 1;
    this.applyTransform();
  }

  /**
   * Zoom to fit all nodes in view
   */
  zoomToFit() {
    const nodes = document.querySelectorAll('.mind-node');
    if (nodes.length === 0) {
      this.centerView();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      const x = parseFloat(node.style.left) || 0;
      const y = parseFloat(node.style.top) || 0;
      const w = node.offsetWidth;
      const h = node.offsetHeight;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    const padding = 80;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const rect = this.container.getBoundingClientRect();
    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    const scale = Math.max(this.minScale, Math.min(1.5, Math.min(scaleX, scaleY)));

    this.scale = scale;
    this.translateX = (rect.width - contentWidth * scale) / 2 - (minX - padding) * scale;
    this.translateY = (rect.height - contentHeight * scale) / 2 - (minY - padding) * scale;

    this.applyTransform();
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvas(screenX, screenY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (screenX - rect.left - this.translateX) / this.scale,
      y: (screenY - rect.top - this.translateY) / this.scale
    };
  }

  /**
   * Convert canvas coordinates to screen coordinates
   */
  canvasToScreen(canvasX, canvasY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: canvasX * this.scale + this.translateX + rect.left,
      y: canvasY * this.scale + this.translateY + rect.top
    };
  }

  getTransform() {
    return {
      scale: this.scale,
      translateX: this.translateX,
      translateY: this.translateY
    };
  }

  /**
   * Prevent default context menu on canvas
   */
  preventContextMenu() {
    // Store canvas reference on container so other modules can access _rightPanned
    this.container.__canvas = this;
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
}
