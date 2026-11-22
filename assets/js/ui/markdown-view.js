// Affiche l'arbre produit par lib/markdown.js. Uniquement des éléments créés un à un et des nœuds de
// texte : rien de ce qui vient du modèle n'est lu comme du balisage.
import { safeHref } from '../lib/markdown.js';
import { el } from './dom.js';

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-zÀ-ɏ]/;

// Dans un tableau, un nom comme GLOBAL_ADDRESS_SPACE // STACK_LAYER ne doit se couper qu'après « _ » ou « // »
function textNodes(text, breakable) {
  if (!breakable) return [document.createTextNode(text)];
  const nodes = [];
  for (const part of text.split(/(_|\/\/)/)) {
    if (!part) continue;
    nodes.push(document.createTextNode(part));
    if (part === '_' || part === '//') nodes.push(document.createElement('wbr'));
  }
  return nodes;
}

export function renderInline(inline, { breakable = false } = {}) {
  const fragment = document.createDocumentFragment();
  for (const node of inline) {
    if (node.type === 'text') {
      fragment.append(...textNodes(node.text, breakable));
    } else if (node.type === 'strong') {
      fragment.append(el('strong', {}, renderInline(node.inline, { breakable })));
    } else if (node.type === 'em') {
      fragment.append(el('em', {}, renderInline(node.inline, { breakable })));
    } else if (node.type === 'code') {
      fragment.append(el('code', {}, textNodes(node.text, breakable)));
    } else if (node.type === 'link') {
      const href = safeHref(node.href); // vérifiée une seconde fois, au moment d'écrire le lien
      const content = renderInline(node.inline, { breakable });
      fragment.append(href ? el('a', { attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }, content) : content);
    } else if (node.type === 'break') {
      fragment.append(document.createElement('br'));
    }
  }
  return fragment;
}

function renderCell(tag, cell, attrs = {}) {
  const content = renderInline(cell, { breakable: true });
  const text = content.textContent;
  // Cellule tout en arabe : écrite de droite à gauche, dans la police arabe
  const direction = ARABIC.test(text) && !LATIN.test(text) ? { lang: 'ar', dir: 'rtl' } : { dir: 'auto' };
  return el(tag, { attrs: { ...attrs, ...direction } }, content);
}

function renderItem(item, options) {
  const node = el('li', { attrs: { dir: 'auto' } });
  item.forEach((block, position) => {
    // Le premier paragraphe d'un élément s'écrit directement dans l'élément
    if (position === 0 && block.type === 'paragraph') node.append(renderInline(block.inline));
    else node.append(renderBlock(block, options));
  });
  return node;
}

function renderBlock(block, options) {
  if (block.type === 'heading') {
    const level = Math.min(Math.max(block.level, 3), 6); // les titres d'une analyse se rangent sous le titre de la page
    return el(`h${level}`, { attrs: { id: block.id, dir: 'auto' } }, renderInline(block.inline));
  }
  if (block.type === 'paragraph') return el('p', { attrs: { dir: 'auto' } }, renderInline(block.inline));
  if (block.type === 'note') return el('p', { class: 'note', attrs: { dir: 'auto' } }, renderInline(block.inline));
  if (block.type === 'divider') {
    return block.label ? el('p', { class: 'separateur', attrs: { dir: 'auto' } }, el('span', { text: block.label })) : el('hr');
  }
  if (block.type === 'list') {
    const list = el(block.ordered ? 'ol' : 'ul', { attrs: { start: block.ordered && block.start !== 1 ? block.start : null } });
    for (const item of block.items) list.append(renderItem(item, options));
    return list;
  }
  if (block.type === 'table') {
    const head = el('tr');
    for (const cell of block.header) head.append(renderCell('th', cell, { scope: 'col' }));
    const body = el('tbody');
    for (const row of block.rows) {
      const line = el('tr');
      for (const cell of row) line.append(renderCell('td', cell));
      body.append(line);
    }
    // Le tableau défile dans son cadre, au clavier aussi : la page, elle, ne défile jamais de côté
    return el('div', { class: 'defile', attrs: { tabindex: 0, role: 'group', 'aria-label': options.tableLabel || null } },
      el('table', {}, el('thead', {}, head), body));
  }
  if (block.type === 'quote') return el('blockquote', { attrs: { dir: 'auto' } }, renderBlocks(block.blocks, options));
  if (block.type === 'code') return el('pre', { attrs: { dir: 'ltr' } }, el('code', { text: block.text }));
  return document.createDocumentFragment();
}

export function renderBlocks(blocks, options = {}) {
  const fragment = document.createDocumentFragment();
  for (const block of blocks) fragment.append(renderBlock(block, options));
  return fragment;
}
