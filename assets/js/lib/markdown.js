// Mise en forme du Markdown des analyses, sans jamais produire de HTML : le texte devient un arbre de
// nœuds simples, que l'interface transforme en éléments avec createElement et createTextNode.
// Aucun contenu venu du modèle ne peut donc s'exécuter, et aucun caractère du texte n'est perdu :
// une construction non reconnue reste du texte.
//
// Formes des nœuds (il n'y en a pas d'autre) :
//   Block  : {type:'heading', level, id?, inline} | {type:'paragraph', inline} | {type:'note', inline}
//          | {type:'divider', label} | {type:'list', ordered, start?, items: Block[][]}
//          | {type:'table', header: Inline[][], rows: Inline[][][]} | {type:'quote', blocks} | {type:'code', text}
//   Inline : {type:'text', text} | {type:'strong', inline} | {type:'em', inline} | {type:'code', text}
//          | {type:'link', href, inline} | {type:'break'}
//
// Choix propres aux analyses Veritas (relevés sur le corpus publié) :
// - un retour à la ligne dans un paragraphe est gardé (les compilations écrivent un verset par ligne) ;
// - une ligne non indentée qui suit une liste ouvre un nouveau paragraphe ;
// - une ligne indentée n'est jamais un bloc de code (seules les clôtures ``` le sont) ;
// - le paragraphe qui s'ouvre sur le bouclier 🛡️ est une note ; « --- TEXTE --- » est un séparateur à libellé.

const SHIELD = '\u{1F6E1}';

const RE_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const RE_HEADING = /^ {0,3}(#{1,6})[ \t]+(.*)$/;
const RE_RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const RE_LABEL = /^ {0,3}-{2,}[ \t]*(\S.*?)[ \t]*-{2,}[ \t]*$/;
const RE_QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const RE_BULLET = /^([ \t]*)([-*+])([ \t]+)(.*)$/;
const RE_ORDERED = /^([ \t]*)(\d{1,9})([.)])([ \t]+)(.*)$/;
const RE_DELIMITER = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

const PUNCTUATION = /[\p{P}\p{S}]/u;
const WHITESPACE = /\s/u;
const ESCAPABLE = /[!-/:-@[-`{-~]/;

// ---------------------------------------------------------------- texte en ligne

function charAt(text, index) {
  if (index < 0 || index >= text.length) return '';
  return String.fromCodePoint(text.codePointAt(index));
}

function charBefore(text, index) {
  if (index <= 0) return '';
  const low = text.charCodeAt(index - 1);
  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) {
    const high = text.charCodeAt(index - 2);
    if (high >= 0xd800 && high <= 0xdbff) return text.slice(index - 2, index);
  }
  return text[index - 1];
}

const isSpace = (char) => char === '' || WHITESPACE.test(char);
const isPunctuation = (char) => char !== '' && PUNCTUATION.test(char);

function runLength(text, index, char) {
  let end = index;
  while (text[end] === char) end += 1;
  return end - index;
}

function closingBackticks(text, from, length) {
  let index = from;
  while (index < text.length) {
    if (text[index] === '`') {
      const run = runLength(text, index, '`');
      if (run === length) return index;
      index += run;
    } else {
      index += 1;
    }
  }
  return -1;
}

// Adresse d'un lien : http et https seulement. Tout le reste (javascript:, data:, adresse relative) est refusé.
export function safeHref(href) {
  if (typeof href !== 'string') return null;
  const value = href.trim();
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

// [libellé](adresse "titre") à partir de l'index du crochet ouvrant ; null si ce n'est pas un lien sûr
function readLink(text, start) {
  let depth = 0;
  let index = start;
  for (; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') {
      index += 1;
    } else if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (index >= text.length || text[index + 1] !== '(') return null;
  const label = text.slice(start + 1, index);
  let cursor = index + 2;
  while (text[cursor] === ' ') cursor += 1;
  let destination;
  if (text[cursor] === '<') {
    const end = text.indexOf('>', cursor);
    if (end < 0) return null;
    destination = text.slice(cursor + 1, end);
    cursor = end + 1;
  } else {
    const from = cursor;
    let parens = 0;
    for (; cursor < text.length; cursor += 1) {
      const char = text[cursor];
      if (char === '\\') {
        cursor += 1;
      } else if (char === '(') {
        parens += 1;
      } else if (char === ')') {
        if (parens === 0) break;
        parens -= 1;
      } else if (char === ' ' || char === '\n') {
        break;
      }
    }
    destination = text.slice(from, cursor);
  }
  while (text[cursor] === ' ') cursor += 1;
  if (text[cursor] === '"' || text[cursor] === "'") {
    const end = text.indexOf(text[cursor], cursor + 1);
    if (end < 0) return null;
    cursor = end + 1;
    while (text[cursor] === ' ') cursor += 1;
  }
  if (text[cursor] !== ')') return null;
  const href = safeHref(destination);
  return href ? { label, href, end: cursor + 1 } : null;
}

function mergeText(nodes) {
  const merged = [];
  for (const node of nodes) {
    const last = merged[merged.length - 1];
    if (node.type === 'text') {
      if (!node.text) continue;
      if (last && last.type === 'text') last.text += node.text;
      else merged.push({ type: 'text', text: node.text });
    } else {
      merged.push(node);
    }
  }
  return merged;
}

const delimiterAsText = (node) => (node.type === 'delim' ? { type: 'text', text: node.char.repeat(node.count) } : node);

// Associe les marques * et _ ouvrantes et fermantes (règles de CommonMark) ; les marques sans partenaire
// redeviennent du texte.
function resolveEmphasis(nodes) {
  let index = 0;
  while (index < nodes.length) {
    const closer = nodes[index];
    if (closer.type !== 'delim' || !closer.canClose) {
      index += 1;
      continue;
    }
    let found = -1;
    for (let back = index - 1; back >= 0; back -= 1) {
      const opener = nodes[back];
      if (opener.type !== 'delim' || !opener.canOpen || opener.char !== closer.char) continue;
      const mismatch = (opener.canClose || closer.canOpen) && (opener.size + closer.size) % 3 === 0
        && !(opener.size % 3 === 0 && closer.size % 3 === 0);
      if (!mismatch) {
        found = back;
        break;
      }
    }
    if (found < 0) {
      index += 1;
      continue;
    }
    const opener = nodes[found];
    const used = opener.count >= 2 && closer.count >= 2 ? 2 : 1;
    const inner = mergeText(nodes.slice(found + 1, index).map(delimiterAsText));
    opener.count -= used;
    closer.count -= used;
    nodes.splice(found + 1, index - found - 1, { type: used === 2 ? 'strong' : 'em', inline: inner });
    let at = found + 2; // nouvelle place de la marque fermante
    if (opener.count === 0) {
      nodes.splice(found, 1);
      at -= 1;
    }
    if (closer.count === 0) nodes.splice(at, 1);
    index = at;
  }
  return mergeText(nodes.map(delimiterAsText));
}

export function parseInline(source) {
  const text = String(source ?? '');
  const nodes = [];
  let buffer = '';
  const flush = () => {
    if (buffer) nodes.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '\\') {
      const next = text[index + 1];
      if (next === '\n') {
        index += 1; // barre finale : simple marque de retour à la ligne
      } else if (next !== undefined && ESCAPABLE.test(next)) {
        buffer += next;
        index += 2;
      } else {
        buffer += char;
        index += 1;
      }
    } else if (char === '`') {
      const length = runLength(text, index, '`');
      const close = closingBackticks(text, index + length, length);
      if (close < 0) {
        buffer += text.slice(index, index + length);
        index += length;
      } else {
        let content = text.slice(index + length, close).replace(/\n/g, ' ');
        if (content.length > 2 && content.startsWith(' ') && content.endsWith(' ') && content.trim()) content = content.slice(1, -1);
        flush();
        nodes.push({ type: 'code', text: content });
        index = close + length;
      }
    } else if (char === '[') {
      const link = readLink(text, index);
      if (link) {
        flush();
        nodes.push({ type: 'link', href: link.href, inline: parseInline(link.label) });
        index = link.end;
      } else {
        buffer += char; // pas un lien sûr : le texte source reste tel quel
        index += 1;
      }
    } else if (char === '*' || char === '_') {
      const length = runLength(text, index, char);
      const before = charBefore(text, index);
      const after = charAt(text, index + length);
      const left = !isSpace(after) && (!isPunctuation(after) || isSpace(before) || isPunctuation(before));
      const right = !isSpace(before) && (!isPunctuation(before) || isSpace(after) || isPunctuation(after));
      // Le tiret bas ne vaut pas à l'intérieur d'un mot : GLOBAL_ADDRESS_SPACE reste du texte
      const canOpen = char === '*' ? left : left && (!right || isPunctuation(before));
      const canClose = char === '*' ? right : right && (!left || isPunctuation(after));
      flush();
      nodes.push({ type: 'delim', char, count: length, size: length, canOpen, canClose });
      index += length;
    } else if (char === '\n') {
      buffer = buffer.replace(/[ \t]+$/, '');
      flush();
      nodes.push({ type: 'break' });
      index += 1;
      while (text[index] === ' ' || text[index] === '\t') index += 1;
    } else {
      buffer += char;
      index += 1;
    }
  }
  flush();
  return resolveEmphasis(nodes);
}

function inlineText(nodes) {
  let text = '';
  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'code') text += node.text;
    else if (node.type === 'break') text += '\n';
    else text += inlineText(node.inline);
  }
  return text;
}

// ---------------------------------------------------------------- blocs

function indentWidth(line) {
  let width = 0;
  for (const char of line) {
    if (char === ' ') width += 1;
    else if (char === '\t') width += 4;
    else break;
  }
  return width;
}

function dedent(line, amount) {
  let removed = 0;
  let index = 0;
  while (index < line.length && removed < amount && (line[index] === ' ' || line[index] === '\t')) {
    removed += line[index] === '\t' ? 4 : 1;
    index += 1;
  }
  return line.slice(index);
}

const isBlank = (line) => line.trim() === '';
const isRule = (line) => RE_RULE.test(line);

function dividerLabel(line) {
  const match = RE_LABEL.exec(line);
  return match && /[^-\s]/.test(match[1]) ? match[1].trim() : null;
}

function listMarker(line) {
  if (isRule(line)) return null;
  let match = RE_BULLET.exec(line);
  if (match) {
    const indent = indentWidth(match[1]);
    return { indent, ordered: false, start: 1, content: match[4], contentIndent: indent + 1 + Math.min(indentWidth(match[3]), 4) };
  }
  match = RE_ORDERED.exec(line);
  if (match) {
    const indent = indentWidth(match[1]);
    return { indent, ordered: true, start: Number(match[2]), content: match[5], contentIndent: indent + match[2].length + 1 + Math.min(indentWidth(match[4]), 4) };
  }
  return null;
}

function isTableStart(lines, index) {
  const next = lines[index + 1];
  return lines[index].includes('|') && next !== undefined && next.includes('|') && next.includes('-') && RE_DELIMITER.test(next);
}

function startsBlock(lines, index) {
  const line = lines[index];
  return RE_FENCE.test(line) || RE_HEADING.test(line) || isRule(line) || dividerLabel(line) !== null
    || RE_QUOTE.test(line) || listMarker(line) !== null || isTableStart(lines, index);
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells = [];
  let cell = '';
  for (let index = 0; index < row.length; index += 1) {
    if (row[index] === '\\' && row[index + 1] === '|') {
      cell += '\\|'; // barre échappée : elle reste dans la cellule
      index += 1;
    } else if (row[index] === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += row[index];
    }
  }
  cells.push(cell.trim());
  return cells;
}

function tableCells(line, width) {
  let cells = splitRow(line);
  // Ligne trop longue : le surplus rejoint la dernière cellule, aucun texte n'est perdu
  if (cells.length > width) cells = [...cells.slice(0, width - 1), cells.slice(width - 1).join(' | ')];
  while (cells.length < width) cells.push('');
  return cells.map((cell) => parseInline(cell));
}

function parseList(lines, from) {
  const first = listMarker(lines[from]);
  const base = first.indent;
  const sibling = (marker) => marker !== null && marker.ordered === first.ordered && marker.indent >= base && marker.indent <= base + 1;
  const items = [];
  let index = from;
  while (index < lines.length) {
    const marker = listMarker(lines[index]);
    if (!sibling(marker)) break;
    const content = [marker.content];
    index += 1;
    while (index < lines.length) {
      const line = lines[index];
      if (isBlank(line)) {
        // Ligne vide : l'élément ne continue que si la suite est indentée
        let next = index;
        while (next < lines.length && isBlank(lines[next])) next += 1;
        if (next >= lines.length || indentWidth(lines[next]) < base + 2) break;
        for (; index < next; index += 1) content.push('');
      } else if (indentWidth(line) >= base + 2) {
        content.push(dedent(line, Math.min(indentWidth(line), marker.contentIndent)));
        index += 1;
      } else {
        break; // nouvel élément, ou ligne non indentée : la liste s'arrête
      }
    }
    items.push(parseBlocks(content));
    let next = index;
    while (next < lines.length && isBlank(lines[next])) next += 1;
    if (next > index) {
      if (next < lines.length && sibling(listMarker(lines[next]))) index = next;
      else break;
    }
  }
  const block = first.ordered ? { type: 'list', ordered: true, start: first.start, items } : { type: 'list', ordered: false, items };
  return { block, next: index };
}

function parseBlocks(lines) {
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (isBlank(line)) {
      index += 1;
      continue;
    }

    const fence = RE_FENCE.exec(line);
    if (fence) {
      const [char, length] = [fence[1][0], fence[1].length];
      const closing = new RegExp(`^ {0,3}\\${char}{${length},}[ \\t]*$`);
      const content = [];
      index += 1;
      while (index < lines.length && !closing.test(lines[index])) {
        content.push(lines[index]);
        index += 1;
      }
      index += 1; // la clôture, si elle existe
      blocks.push({ type: 'code', text: content.join('\n') });
      continue;
    }

    const heading = RE_HEADING.exec(line);
    if (heading) {
      const title = heading[2].replace(/[ \t]+#+[ \t]*$/, '').trim();
      blocks.push({ type: 'heading', level: heading[1].length, inline: parseInline(title) });
      index += 1;
      continue;
    }

    if (isRule(line)) {
      blocks.push({ type: 'divider', label: null });
      index += 1;
      continue;
    }
    const label = dividerLabel(line);
    if (label !== null) {
      blocks.push({ type: 'divider', label });
      index += 1;
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const content = [];
      while (index < lines.length && RE_QUOTE.test(lines[index])) {
        content.push(RE_QUOTE.exec(lines[index])[1]);
        index += 1;
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(content) });
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = splitRow(line).map((cell) => parseInline(cell));
      const rows = [];
      index += 2;
      while (index < lines.length && !isBlank(lines[index]) && lines[index].includes('|')) {
        rows.push(tableCells(lines[index], header.length));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (listMarker(line) !== null) {
      const { block, next } = parseList(lines, index);
      blocks.push(block);
      index = next;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !isBlank(lines[index]) && !startsBlock(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    const inline = parseInline(paragraph.join('\n'));
    blocks.push({ type: inlineText(inline).trimStart().startsWith(SHIELD) ? 'note' : 'paragraph', inline });
  }
  return blocks;
}

export function parseMarkdown(source) {
  const text = String(source ?? '').replace(/\r\n?/g, '\n');
  const blocks = parseBlocks(text.split('\n'));
  let section = 0;
  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 3) {
      section += 1;
      block.id = `section-${section}`;
    }
  }
  return blocks;
}

// Sommaire : les titres de niveau 3 (les sections numérotées d'une analyse), dans l'ordre
export function outline(blocks) {
  return blocks.filter((block) => block.type === 'heading' && block.id).map((block) => ({ id: block.id, title: inlineText(block.inline) }));
}

// Titre d'une section : sa parenthèse finale, comme « (MÉCANIQUE PHYSIQUE ET BIOLOGIQUE) », se détache
// pour s'afficher plus discrètement. Aucun caractère ne change : main + ' ' + tail redonne le titre.
export function splitTitle(text) {
  const title = String(text ?? '');
  const match = /^(.*\S) (\([^()]*\))$/.exec(title);
  return match ? { main: match[1], tail: match[2] } : { main: title, tail: '' };
}

// Codes de racines (R-H.-M, GH-D.-B, A.-B-D, H.-S.-H.-S.) : trois ou quatre segments d'une ou deux
// majuscules, avec ou sans point, reliés par des tirets. Les repérer permet de ne pas les couper en fin
// de ligne. Rend les morceaux du texte, dans l'ordre : [{text, root}], sans changer un caractère.
const ROOT_CODE = /[A-Z]{1,2}\.?(?:-[A-Z]{1,2}\.?){2,3}(?![A-Za-z0-9_-])/g;
const ROOT_NEIGHBOUR = /[A-Za-z0-9_.-]/;

export function splitRoots(text) {
  const source = String(text ?? '');
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(ROOT_CODE)) {
    // Un code de racine ne prolonge pas un mot (CODE-SOURCE, Pay-As-You-Go ne sont pas des racines)
    if (match.index > 0 && ROOT_NEIGHBOUR.test(source[match.index - 1])) continue;
    if (match.index < last) continue;
    if (match.index > last) parts.push({ text: source.slice(last, match.index), root: false });
    parts.push({ text: match[0], root: true });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last), root: false });
  return parts;
}

// Tout le texte de l'arbre, dans l'ordre du document (sert aux tests : rien ne doit se perdre)
export function plainText(blocks) {
  const parts = [];
  for (const block of blocks) {
    if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'note') {
      parts.push(inlineText(block.inline));
    } else if (block.type === 'divider') {
      if (block.label) parts.push(block.label);
    } else if (block.type === 'code') {
      parts.push(block.text);
    } else if (block.type === 'quote') {
      parts.push(plainText(block.blocks));
    } else if (block.type === 'list') {
      block.items.forEach((item, position) => parts.push((block.ordered ? `${block.start + position}. ` : '') + plainText(item)));
    } else if (block.type === 'table') {
      parts.push(block.header.map(inlineText).join(' | '));
      for (const row of block.rows) parts.push(row.map(inlineText).join(' | '));
    }
  }
  return parts.join('\n');
}
