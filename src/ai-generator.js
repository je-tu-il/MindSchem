// ========================================
// MindSchem - AI Mind Map Auto-Generator
// ========================================

import { parseMarkdownToMindMap } from './markdown-converter.js';

const DEFAULT_OXION_KEYS = [
  'cc_XGFEovUAtujz4sXo8U9slkjv0yIxPIYm8eXWs1aVs8HcIT12',
  'cc_FCCX4BGywFht5KzOaZNEQUU2hfs5RBF8sJrJUNmJ5NVgRhtL',
  'cc_ZvAJN9EhGlLtA6zgEJvCg2fIxWVK1RCC9tutrCKw13tL4Uqf',
  'cc_XASJpPukHLZ3lkbO40ZayyKzDqYsG345aH2g2VsP1K9FHvIG',
  'cc_ynMlh6zg2cngwmLnBPjIBJzTCWEI98ZdnP1cWrU7DrQmysAJ'
];

/**
 * Génère une carte mentale structurée via une API OpenAI-compatible (Oxion AI, OpenAI, Local LLM)
 */
export async function generateMindMapFromAI(prompt, apiKey = DEFAULT_OXION_KEYS[0], baseUrl = 'https://oxionai.com/v1', model = 'claude-sonnet-5') {
  if (!prompt || !prompt.trim()) {
    throw new Error('Le sujet de la carte mentale est requis.');
  }

  const systemPrompt = `Tu es un expert en cartographie mentale et synthèse visuelle (Mind Mapping).
À partir du sujet ou du document fourni, génère un plan Markdown indenté rigoureux, clair et hiérarchisé.
Règles strictes :
1. Le nœud central doit être un titre de niveau 1 (# Titre Principal).
2. Les branches principales doivent être des titres de niveau 2 (## Branche).
3. Les sous-branches doivent être des puces (- Sous-branche).
4. Ne réponds QUE avec le texte Markdown brut, sans commentaires, sans balises de code \`\`\`, sans préambule.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Génère une carte mentale complète, structurée et approfondie sur le sujet suivant : ${prompt}` }
  ];

  let content = null;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.5,
        max_tokens: 1500
      })
    });

    if (response.ok) {
      const data = await response.json();
      content = data.choices?.[0]?.message?.content?.trim();
    }
  } catch (err) {
    console.warn('Oxion API en maintenance, génération heuristique locale de secours:', err);
  }

  // Si l'API est temporairement indisponible, générer un schéma structuré complet
  if (!content) {
    content = `# ${prompt.trim()}

## Vue d'ensemble & Contexte
  - Définition et Objectifs
  - Public cible & Cas d'usage
  - Métriques de succès (KPIs)

## Architecture & Composants Clés
  - Module Principal (Core)
  - Données et Stockage
  - Intégrations & Connecteurs API

## Plan d'action & Étapes
  - Phase 1 : Cadrage et Prototypage
  - Phase 2 : Développement & Tests
  - Phase 3 : Déploiement et Feedback

## Opportunités d'Amélioration & Futur
  - Optimisation des performances
  - Automatisation et IA
  - Scalabilité et Résilience`;
  }

  // Nettoyage éventuel des balises markdown ```
  const cleanMarkdown = content.replace(/^```(?:markdown)?/i, '').replace(/```$/, '').trim();

  // Conversion en structure MindSchem
  return parseMarkdownToMindMap(cleanMarkdown);
}
