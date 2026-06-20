// ========================================
// MindSchem - Minimap Component
// ========================================

export class Minimap {
  constructor(bus, nodeManager, canvas) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.canvas = canvas;
    
    this.container = document.getElementById('minimap');
    this.canvasEl = document.getElementById('minimap-canvas');
    this.viewport = document.getElementById('minimap-viewport');
    this.ctx = this.canvasEl.getContext('2d');

    this.width = 180;
    this.height = 120;
    this.padding = 10;

    this.init();
  }

  init() {
    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    this.canvasEl.width = this.width * dpr;
    this.canvasEl.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);

    // Re-render on node changes
    this.bus.on('nodes:changed', () => this.render());
    this.bus.on('canvas:transform', () => this.updateViewport());

    // Click on minimap to navigate
    this.container.addEventListener('click', (e) => {
      this.onMinimapClick(e);
    });

    // Initial render
    requestAnimationFrame(() => this.render());
  }

  render() {
    const ctx = this.ctx;
    const nodes = this.nodeManager.getAllNodes();

    // Clear
    ctx.clearRect(0, 0, this.width, this.height);

    if (nodes.length === 0) return;

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + 150);
      maxY = Math.max(maxY, node.y + 50);
    }

    const contentW = maxX - minX + this.padding * 2;
    const contentH = maxY - minY + this.padding * 2;

    const scale = Math.min(
      (this.width - this.padding * 2) / contentW,
      (this.height - this.padding * 2) / contentH
    );

    const offsetX = (this.width - contentW * scale) / 2;
    const offsetY = (this.height - contentH * scale) / 2;

    // Draw connections
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 1;
    for (const node of nodes) {
      for (const childId of node.children) {
        const child = this.nodeManager.nodes.get(childId);
        if (!child) continue;

        const x1 = (node.x - minX + this.padding) * scale + offsetX + 75 * scale;
        const y1 = (node.y - minY + this.padding) * scale + offsetY + 25 * scale;
        const x2 = (child.x - minX + this.padding) * scale + offsetX;
        const y2 = (child.y - minY + this.padding) * scale + offsetY + 25 * scale;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const x = (node.x - minX + this.padding) * scale + offsetX;
      const y = (node.y - minY + this.padding) * scale + offsetY;
      const w = 150 * scale;
      const h = 40 * scale;

      ctx.fillStyle = node.id === this.nodeManager.selectedNodeId
        ? 'rgba(102, 126, 234, 0.8)'
        : 'rgba(30, 38, 66, 0.8)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, 3 * scale);
      } else {
        // Fallback for older browsers
        const r = 3 * scale;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }

    this.updateViewport();
  }

  updateViewport() {
    const containerRect = this.canvas.container.getBoundingClientRect();
    const nodes = this.nodeManager.getAllNodes();
    if (nodes.length === 0) {
      this.viewport.style.display = 'none';
      return;
    }

    this.viewport.style.display = '';

    // Calculate same bounds as render
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + 150);
      maxY = Math.max(maxY, node.y + 50);
    }

    const contentW = maxX - minX + this.padding * 2;
    const contentH = maxY - minY + this.padding * 2;

    const mapScale = Math.min(
      (this.width - this.padding * 2) / contentW,
      (this.height - this.padding * 2) / contentH
    );

    const offsetX = (this.width - contentW * mapScale) / 2;
    const offsetY = (this.height - contentH * mapScale) / 2;

    const transform = this.canvas.getTransform();

    // Visible area in canvas coords
    const viewLeft = -transform.translateX / transform.scale;
    const viewTop = -transform.translateY / transform.scale;
    const viewWidth = containerRect.width / transform.scale;
    const viewHeight = containerRect.height / transform.scale;

    // Map to minimap coords
    const vpLeft = (viewLeft - minX + this.padding) * mapScale + offsetX;
    const vpTop = (viewTop - minY + this.padding) * mapScale + offsetY;
    const vpWidth = viewWidth * mapScale;
    const vpHeight = viewHeight * mapScale;

    this.viewport.style.left = `${Math.max(0, vpLeft)}px`;
    this.viewport.style.top = `${Math.max(0, vpTop)}px`;
    this.viewport.style.width = `${Math.min(this.width, vpWidth)}px`;
    this.viewport.style.height = `${Math.min(this.height, vpHeight)}px`;
  }

  onMinimapClick(e) {
    const rect = this.container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const nodes = this.nodeManager.getAllNodes();
    if (nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + 150);
      maxY = Math.max(maxY, node.y + 50);
    }

    const contentW = maxX - minX + this.padding * 2;
    const contentH = maxY - minY + this.padding * 2;

    const mapScale = Math.min(
      (this.width - this.padding * 2) / contentW,
      (this.height - this.padding * 2) / contentH
    );

    const offsetX = (this.width - contentW * mapScale) / 2;
    const offsetY = (this.height - contentH * mapScale) / 2;

    // Convert minimap coords to canvas coords
    const canvasX = (clickX - offsetX) / mapScale + minX - this.padding;
    const canvasY = (clickY - offsetY) / mapScale + minY - this.padding;

    // Center view on this point
    const containerRect = this.canvas.container.getBoundingClientRect();
    this.canvas.translateX = containerRect.width / 2 - canvasX * this.canvas.scale;
    this.canvas.translateY = containerRect.height / 2 - canvasY * this.canvas.scale;
    this.canvas.applyTransform();
  }
}
