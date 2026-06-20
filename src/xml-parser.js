// ========================================
// MindSchem - GlooMaps XML Parser
// ========================================

import { createNodeData, generateNodeId, DEFAULT_PROPS } from './node-manager.js';

/**
 * Parse a GlooMaps XML string into node data
 * 
 * Expected structure:
 * <gloomaps scheme="1.0">
 *   <section>
 *     <box>
 *       <text>...</text>
 *       <propa>#color</propa>      (background color)
 *       <propb>#color</propb>      (text color)
 *       <propc>FontName</propc>    (typography)
 *       <propd>0.0-1.0</propd>     (opacity)
 *       <prope>auto/px</prope>     (width)
 *       <propf>true/false</propf>  (textExpanded)
 *       <linkto>nodeId</linkto>    (custom links)
 *       <member>
 *         <box>...</box>
 *       </member>
 *     </box>
 *   </section>
 * </gloomaps>
 */
export function parseGlooMapsXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Erreur de parsing XML: ' + parseError.textContent);
  }

  // Validate root element
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'gloomaps') {
    throw new Error('Élément racine invalide: attendu <gloomaps>, trouvé <' + root.tagName + '>');
  }

  const nodes = [];
  let startX = 0;
  let startY = 0;

  // Process each section
  const sections = root.querySelectorAll(':scope > section');
  
  if (sections.length === 0) {
    // Try alternative: boxes directly under gloomaps
    const directBoxes = root.querySelectorAll(':scope > box');
    for (const box of directBoxes) {
      parseBox(box, null, nodes, startX, startY, 0);
      startY += 200;
    }
  } else {
    for (const section of sections) {
      const boxes = section.querySelectorAll(':scope > box');
      for (const box of boxes) {
        parseBox(box, null, nodes, startX, startY, 0);
        startY += 200;
      }
    }
  }

  return nodes;
}

/**
 * Recursively parse a <box> element
 */
function parseBox(boxEl, parentId, nodesArray, baseX, baseY, depth) {
  // Extract ID or generate a new one if missing
  const idEl = boxEl.querySelector(':scope > id');
  const id = idEl ? idEl.textContent.trim() : generateNodeId();

  // Extract text
  const textEl = boxEl.querySelector(':scope > text');
  const text = textEl ? textEl.textContent.trim() : 'Sans titre';

  // Extract style properties
  const propaEl = boxEl.querySelector(':scope > propa');
  const propbEl = boxEl.querySelector(':scope > propb');
  const propcEl = boxEl.querySelector(':scope > propc');
  const propdEl = boxEl.querySelector(':scope > propd');
  const propeEl = boxEl.querySelector(':scope > prope');
  const propfEl = boxEl.querySelector(':scope > propf');

  const bgColor = propaEl ? propaEl.textContent.trim() : (depth === 0 ? '#667eea' : DEFAULT_PROPS.bgColor);
  const textColor = propbEl ? propbEl.textContent.trim() : DEFAULT_PROPS.textColor;
  const fontFamily = propcEl ? propcEl.textContent.trim() : DEFAULT_PROPS.fontFamily;
  const opacity = propdEl ? parseFloat(propdEl.textContent.trim()) : DEFAULT_PROPS.opacity;
  const width = propeEl ? propeEl.textContent.trim() : DEFAULT_PROPS.width;
  const textExpanded = propfEl ? propfEl.textContent.trim() === 'true' : false;
  
  // Link styles
  const linkColorEl = boxEl.querySelector(':scope > linkcolor');
  const linkStyleEl = boxEl.querySelector(':scope > linkstyle');
  const linkDirEl = boxEl.querySelector(':scope > linkdir');
  
  const linkColor = linkColorEl ? linkColorEl.textContent.trim() : undefined;
  const linkStyle = linkStyleEl ? linkStyleEl.textContent.trim() : undefined;
  const linkDir = linkDirEl ? linkDirEl.textContent.trim() : undefined;

  const linkEls = boxEl.querySelectorAll(':scope > linkto');
  const links = Array.from(linkEls).map(el => el.textContent.trim());

  // Position
  const posxEl = boxEl.querySelector(':scope > posx');
  const posyEl = boxEl.querySelector(':scope > posy');
  const parsedX = posxEl ? parseFloat(posxEl.textContent) : null;
  const parsedY = posyEl ? parseFloat(posyEl.textContent) : null;

  const x = parsedX !== null && !isNaN(parsedX) ? parsedX : baseX + depth * 280;
  const y = parsedY !== null && !isNaN(parsedY) ? parsedY : baseY;

  const isolatedEl = boxEl.querySelector(':scope > isolated');
  const isolated = isolatedEl ? isolatedEl.textContent.trim() === 'true' : false;

  const nodeData = createNodeData({
    id,
    text,
    parentId,
    x,
    y,
    bgColor: normalizeColor(bgColor),
    textColor: normalizeColor(textColor),
    fontFamily,
    opacity: isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity)),
    width: isNaN(parseInt(width)) && width !== 'auto' ? 'auto' : (width === 'auto' ? 'auto' : parseInt(width)),
    textExpanded,
    isolated,
    linkColor,
    linkStyle,
    linkDir,
    links
  });

  nodesArray.push(nodeData);

  // Parse children from <member>
  const memberEl = boxEl.querySelector(':scope > member');
  if (memberEl) {
    const childBoxes = memberEl.querySelectorAll(':scope > box');
    let childY = baseY;
    
    for (const childBox of childBoxes) {
      const childId = parseBox(childBox, id, nodesArray, baseX, childY, depth + 1);
      nodeData.children.push(childId);
      childY += 80;
    }
  }

  return id;
}

/**
 * Normalize a color value
 */
function normalizeColor(color) {
  if (!color) return DEFAULT_PROPS.bgColor;
  color = color.trim();
  
  // Already valid hex
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
    return color;
  }
  
  // Try named colors and rgb/rgba via temporary element
  try {
    const tempEl = document.createElement('div');
    tempEl.style.color = color;
    document.body.appendChild(tempEl);
    const computed = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);
    
    if (computed) {
      return rgbToHex(computed);
    }
  } catch (e) {
    // Fall through
  }
  
  return color;
}

/**
 * Convert rgb/rgba string to hex
 */
function rgbToHex(rgb) {
  const match = rgb.match(/(\d+)/g);
  if (!match || match.length < 3) return '#000000';
  
  const r = parseInt(match[0]).toString(16).padStart(2, '0');
  const g = parseInt(match[1]).toString(16).padStart(2, '0');
  const b = parseInt(match[2]).toString(16).padStart(2, '0');
  
  return `#${r}${g}${b}`;
}
