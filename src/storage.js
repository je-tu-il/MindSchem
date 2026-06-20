// ========================================
// MindSchem - Local Storage Persistence
// ========================================

const STORAGE_KEY = 'mindschem_data';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export class Storage {
  constructor(bus, nodeManager) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.autoSaveTimer = null;
  }

  init() {
    // Auto-save on changes (debounced)
    let saveTimeout = null;
    this.bus.on('nodes:changed', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => this.save(), 2000);
    });

    // Periodic auto-save
    this.autoSaveTimer = setInterval(() => this.save(), AUTO_SAVE_INTERVAL);

    // Save before unload
    window.addEventListener('beforeunload', () => this.save());
  }

  /**
   * Save current state to localStorage
   */
  save() {
    try {
      const data = {
        version: '1.0',
        timestamp: Date.now(),
        hasPositions: true,
        nodes: Array.from(this.nodeManager.nodes.values())
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  /**
   * Load state from localStorage
   * @returns {boolean} true if data was loaded
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data.nodes || data.nodes.length === 0) return false;

      this.nodeManager.loadNodes(data.nodes);
      return true;
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
      return false;
    }
  }

  /**
   * Clear saved data
   */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
}
