// ========================================
// MindSchem - GlooMaps XML Serializer
// ========================================

/**
 * Serialize node data to GlooMaps XML format.
 * 
 * Output structure:
 * <gloomaps scheme="1.0">
 *   <section>
 *     <box>
 *       <text>...</text>
 *       <propa>#bg</propa>
 *       <propb>#text</propb>
 *       <propc>Font</propc>
 *       <propd>opacity</propd>
 *       <prope>width</prope>
 *       <propf>textExpanded</propf>
 *       <member>
 *         <box>...</box>
 *       </member>
 *     </box>
 *   </section>
 * </gloomaps>
 */
export function serializeToGlooMapsXML(nodeManager) {
  const roots = nodeManager.getRootNodes();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<gloomaps scheme="1.0">\n';

  for (const root of roots) {
    xml += '  <section>\n';
    xml += serializeBox(root, nodeManager, 2);
    xml += '  </section>\n';
  }

  xml += '</gloomaps>\n';

  return xml;
}

/**
 * Recursively serialize a node as a <box> element
 */
function serializeBox(node, nodeManager, indent) {
  const pad = '  '.repeat(indent);
  let xml = '';

  xml += `${pad}<box>\n`;
  xml += `${pad}  <id>${escapeXml(node.id)}</id>\n`;
  xml += `${pad}  <text>${escapeXml(node.text)}</text>\n`;
  xml += `${pad}  <propa>${escapeXml(node.props.bgColor)}</propa>\n`;
  xml += `${pad}  <propb>${escapeXml(node.props.textColor)}</propb>\n`;
  xml += `${pad}  <propc>${escapeXml(node.props.fontFamily)}</propc>\n`;
  xml += `${pad}  <propd>${node.props.opacity}</propd>\n`;
  xml += `${pad}  <prope>${escapeXml(node.props.width || 'auto')}</prope>\n`;
  xml += `${pad}  <propf>${node.textExpanded ? 'true' : 'false'}</propf>\n`;
  xml += `${pad}  <posx>${node.x}</posx>\n`;
  xml += `${pad}  <posy>${node.y}</posy>\n`;
  
  if (node.props.linkColor) xml += `${pad}  <linkcolor>${escapeXml(node.props.linkColor)}</linkcolor>\n`;
  if (node.props.linkStyle) xml += `${pad}  <linkstyle>${escapeXml(node.props.linkStyle)}</linkstyle>\n`;
  if (node.props.linkDir) xml += `${pad}  <linkdir>${escapeXml(node.props.linkDir)}</linkdir>\n`;
  if (node.props.isolated) xml += `${pad}  <isolated>true</isolated>\n`;
  
  if (node.links && node.links.length > 0) {
    for (const linkId of node.links) {
      xml += `${pad}  <linkto>${escapeXml(linkId)}</linkto>\n`;
    }
  }

  // Children
  if (node.children.length > 0) {
    xml += `${pad}  <member>\n`;
    for (const childId of node.children) {
      const child = nodeManager.nodes.get(childId);
      if (child) {
        xml += serializeBox(child, nodeManager, indent + 2);
      }
    }
    xml += `${pad}  </member>\n`;
  }

  xml += `${pad}</box>\n`;

  return xml;
}

/**
 * Escape special XML characters
 */
function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
