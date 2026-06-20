// ========================================
// MindSchem - Main Entry Point
// ========================================

import './styles/index.css';
import './styles/toolbar.css';
import './styles/canvas.css';
import './styles/nodes.css';
import './styles/panels.css';

import { App } from './app.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  
  // Expose for debugging
  window.__mindschem = app;
});
