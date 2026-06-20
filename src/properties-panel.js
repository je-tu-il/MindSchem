// ========================================
// MindSchem - Properties Panel Controller
// ========================================

export class PropertiesPanel {
  constructor(bus, nodeManager) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.panel = document.getElementById('properties-panel');
    this.currentNodeId = null;

    this.init();
  }

  init() {
    // Show/hide panel
    this.bus.on('panel:toggle', () => this.toggle());
    this.bus.on('node:selected', (node) => this.onNodeSelected(node));
    this.bus.on('node:deselected', () => this.hide());

    // Close button
    document.getElementById('btn-close-panel')?.addEventListener('click', () => this.hide());

    // Background color
    const bgColor = document.getElementById('prop-bg-color');
    const bgColorText = document.getElementById('prop-bg-color-text');
    bgColor?.addEventListener('input', (e) => {
      bgColorText.value = e.target.value;
      if (this.nodeManager?.selectedNodes) {
        this.nodeManager.selectedNodes.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.backgroundColor = e.target.value;
        });
      }
    });
    bgColor?.addEventListener('change', (e) => {
      this.applyProp('bgColor', e.target.value);
    });
    bgColorText?.addEventListener('change', (e) => {
      bgColor.value = e.target.value;
      this.applyProp('bgColor', e.target.value);
    });

    // Text color
    const textColor = document.getElementById('prop-text-color');
    const textColorText = document.getElementById('prop-text-color-text');
    textColor?.addEventListener('input', (e) => {
      textColorText.value = e.target.value;
      if (this.nodeManager?.selectedNodes) {
        this.nodeManager.selectedNodes.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.color = e.target.value;
        });
      }
    });
    textColor?.addEventListener('change', (e) => {
      this.applyProp('textColor', e.target.value);
    });
    textColorText?.addEventListener('change', (e) => {
      textColor.value = e.target.value;
      this.applyProp('textColor', e.target.value);
    });

    // Font family
    document.getElementById('prop-font')?.addEventListener('change', (e) => {
      this.applyProp('fontFamily', e.target.value);
    });

    // Opacity
    const opacity = document.getElementById('prop-opacity');
    const opacityValue = document.getElementById('prop-opacity-value');
    opacity?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      opacityValue.textContent = `${Math.round(val * 100)}%`;
      if (this.nodeManager?.selectedNodes) {
        this.nodeManager.selectedNodes.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.opacity = val;
        });
      }
    });
    opacity?.addEventListener('change', (e) => {
      this.applyProp('opacity', parseFloat(e.target.value));
    });

    // Width
    const widthSlider = document.getElementById('prop-width');
    const widthValue = document.getElementById('prop-width-value');
    const widthAuto = document.getElementById('prop-width-auto');
    
    widthSlider?.addEventListener('input', (e) => {
      if (widthAuto) widthAuto.checked = false;
      const val = parseInt(e.target.value);
      if (widthValue) widthValue.textContent = `${val}px`;
      if (this.nodeManager?.selectedNodes) {
        this.nodeManager.selectedNodes.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.width = `${val}px`;
        });
      }
    });
    widthSlider?.addEventListener('change', (e) => {
      this.applyProp('width', parseInt(e.target.value));
    });
    
    widthAuto?.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (widthValue) widthValue.textContent = 'Auto';
        this.applyProp('width', 'auto');
      } else {
        const val = parseInt(widthSlider.value);
        if (widthValue) widthValue.textContent = `${val}px`;
        this.applyProp('width', val);
      }
    });

    // Link properties
    document.getElementById('prop-link-color')?.addEventListener('change', (e) => {
      this.applyProp('linkColor', e.target.value);
    });
    document.getElementById('prop-link-style')?.addEventListener('change', (e) => {
      this.applyProp('linkStyle', e.target.value);
    });
    document.getElementById('prop-link-dir')?.addEventListener('change', (e) => {
      this.applyProp('linkDir', e.target.value);
    });

    // Cascade buttons
    document.querySelectorAll('.btn-cascade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const propName = e.currentTarget.getAttribute('data-cascade');
        this.triggerCascade(propName);
      });
    });

    // Isolation toggle
    document.getElementById('prop-isolated')?.addEventListener('change', (e) => {
      this.applyProp('isolated', e.target.checked);
    });
  }

  triggerCascade(propGroup) {
    if (!this.currentNodeId) return;
    const node = this.nodeManager.nodes.get(this.currentNodeId);
    if (!node) return;

    let propsToApply = {};
    if (propGroup === 'bgColor') propsToApply.bgColor = node.props.bgColor;
    if (propGroup === 'textColor') propsToApply.textColor = node.props.textColor;
    if (propGroup === 'fontFamily') propsToApply.fontFamily = node.props.fontFamily;
    if (propGroup === 'opacity') propsToApply.opacity = node.props.opacity;
    if (propGroup === 'width') propsToApply.width = node.props.width;
    if (propGroup === 'links') {
      propsToApply.linkColor = node.props.linkColor;
      propsToApply.linkStyle = node.props.linkStyle;
      propsToApply.linkDir = node.props.linkDir;
    }

    if (Object.keys(propsToApply).length > 0) {
      const nodeIds = Array.from(this.nodeManager.selectedNodes);
      if (nodeIds.length > 0) {
        this.nodeManager.updatePropsMultiple(nodeIds, propsToApply, true);
      }
    }
  }

  applyProp(propName, value) {
    if (!this.nodeManager?.selectedNodes || this.nodeManager.selectedNodes.size === 0) return;
    
    // Check auto-cascade toggle
    const autoCascadeCheckbox = document.getElementById('prop-auto-cascade');
    const cascade = autoCascadeCheckbox ? autoCascadeCheckbox.checked : false;

    const propsToUpdate = { [propName]: value };
    const nodeIds = Array.from(this.nodeManager.selectedNodes);

    // Auto-isolate child nodes if their property is explicitly modified
    if (propName !== 'isolated') {
      nodeIds.forEach(id => {
        const n = this.nodeManager.nodes.get(id);
        if (n && n.parentId) {
          propsToUpdate.isolated = true;
          // Update UI if the modified child is the currently selected node
          if (id === this.currentNodeId) {
            const isolated = document.getElementById('prop-isolated');
            if (isolated) isolated.checked = true;
          }
        }
      });
    }

    this.nodeManager.updatePropsMultiple(nodeIds, propsToUpdate, cascade);
  }

  onNodeSelected(node) {
    if (!node) return;
    this.currentNodeId = node.id;

    // Update panel values
    const bgColor = document.getElementById('prop-bg-color');
    const bgColorText = document.getElementById('prop-bg-color-text');
    const textColor = document.getElementById('prop-text-color');
    const textColorText = document.getElementById('prop-text-color-text');
    const font = document.getElementById('prop-font');
    const opacity = document.getElementById('prop-opacity');
    const opacityValue = document.getElementById('prop-opacity-value');
    const isolated = document.getElementById('prop-isolated');

    if (bgColor) bgColor.value = this.toValidHex(node.props.bgColor);
    if (bgColorText) bgColorText.value = node.props.bgColor;
    if (textColor) textColor.value = this.toValidHex(node.props.textColor);
    if (textColorText) textColorText.value = node.props.textColor;
    if (font) font.value = node.props.fontFamily;
    if (opacity) opacity.value = node.props.opacity;
    if (opacityValue) opacityValue.textContent = `${Math.round(node.props.opacity * 100)}%`;
    if (isolated) isolated.checked = !!node.props.isolated;

    const widthSlider = document.getElementById('prop-width');
    const widthValue = document.getElementById('prop-width-value');
    const widthAuto = document.getElementById('prop-width-auto');
    
    if (node.props.width === 'auto' || !node.props.width) {
      if (widthAuto) widthAuto.checked = true;
      if (widthValue) widthValue.textContent = 'Auto';
    } else {
      if (widthAuto) widthAuto.checked = false;
      if (widthSlider) widthSlider.value = node.props.width;
      if (widthValue) widthValue.textContent = `${node.props.width}px`;
    }

    const linkColor = document.getElementById('prop-link-color');
    const linkStyle = document.getElementById('prop-link-style');
    const linkDir = document.getElementById('prop-link-dir');
    
    if (linkColor) linkColor.value = this.toValidHex(node.props.linkColor || '#667eea');
    if (linkStyle) linkStyle.value = node.props.linkStyle || 'solid';
    if (linkDir) linkDir.value = node.props.linkDir || 'none';
  }

  applyProp(propName, value) {
    if (!this.currentNodeId) return;
    this.nodeManager.updateProps(this.currentNodeId, { [propName]: value }, false);
  }

  show() {
    this.panel?.classList.remove('hidden');
  }

  hide() {
    this.panel?.classList.add('hidden');
    this.currentNodeId = null;
  }

  toggle() {
    if (this.panel?.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  toValidHex(color) {
    if (!color) return '#000000';
    // Ensure it's a valid 7-char hex for input[type=color]
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
      const r = color[1], g = color[2], b = color[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return '#000000';
  }
}
