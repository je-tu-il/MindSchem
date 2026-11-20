// ========================================
// MindSchem - Markdown & Outline Converter (v2 Pro)
// ========================================

import { createNodeData, DEFAULT_PROPS, ROOT_PROPS } from './node-manager.js';

/**
 * Convertit un texte Markdown indenté (#, ##, -, *) en structure de nœuds MindSchem
 */
export function parseMarkdownToMindMap(markdownText) {
  const lines = markdownText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const nodes = [];
  const stack = []; // [depth, nodeId]
  const childrenMap = new Map();

  const palette = [
    { bg: '#667eea', text: '#ffffff' }, // Root
    { bg: '#10b981', text: '#ffffff' }, // Branch 1
    { bg: '#3b82f6', text: '#ffffff' }, // Branch 2
    { bg: '#8b5cf6', text: '#ffffff' }, // Branch 3
    { bg: '#f59e0b', text: '#ffffff' }, // Branch 4
    { bg: '#ec4899', text: '#ffffff' }  // Branch 5
  ];

  let idCounter = 1;

  lines.forEach((line) => {
    let depth = 0;
    let label = line.trim();

    // Détection titres #
    if (line.startsWith('#')) {
      const match = line.match(/^(#+)\s*(.*)$/);
      if (match) {
        depth = match[1].length - 1;
        label = match[2];
      }
    } else {
      // Détection puces indentées
      const indentMatch = line.match(/^(\s*)(?:[-*+]|\d+\.)?\s*(.*)$/);
      if (indentMatch) {
        const spaces = indentMatch[1].replace(/\t/g, '  ').length;
        depth = Math.floor(spaces / 2) + 1;
        label = indentMatch[2];
      }
    }

    const id = `node-${idCounter++}`;
    childrenMap.set(id, []);

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    const parentId = parent ? parent.id : null;

    if (parentId && childrenMap.has(parentId)) {
      childrenMap.get(parentId).push(id);
    }

    const colorScheme = depth === 0 ? palette[0] : palette[((depth - 1) % (palette.length - 1)) + 1];

    const node = createNodeData({
      id,
      text: label,
      parentId,
      children: [],
      x: 0,
      y: 0,
      bgColor: colorScheme.bg,
      textColor: colorScheme.text
    });

    nodes.push(node);
    stack.push({ depth, id });
  });

  // Associer les listes d'enfants
  nodes.forEach(n => {
    n.children = childrenMap.get(n.id) || [];
  });

  return nodes;
}

/**
 * Exporte l'arbre MindSchem en Markdown indenté compatible Obsidian et Notion
 */
export function exportNodesToMarkdown(nodeManager) {
  if (!nodeManager || !nodeManager.nodes || nodeManager.nodes.size === 0) return '';

  const nodes = Array.from(nodeManager.nodes.values());
  const rootNodes = nodes.filter(n => !n.parentId);

  let md = '';

  function traverse(node, depth) {
    if (!node) return;
    const indent = '  '.repeat(depth);

    if (depth === 0) {
      md += `# ${node.text || 'Sans titre'}\n\n`;
    } else if (depth === 1) {
      md += `## ${node.text || 'Sans titre'}\n\n`;
    } else {
      md += `${indent}- ${node.text || 'Sans titre'}\n`;
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach(childId => {
        const child = nodeManager.nodes.get(childId);
        if (child) traverse(child, depth + 1);
      });
    }
  }

  rootNodes.forEach(root => traverse(root, 0));
  return md;
}
