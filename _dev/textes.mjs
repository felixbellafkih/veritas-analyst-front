// Collecte les textes français de l'interface du nouveau site, et écrit leur liste dans _dev/textes.json.
// Cette liste est celle que l'auteur valide, puis que le Kernel traduit (build_site_translations.py).
// Usage : node _dev/textes.mjs
//
// Sources :
// - dans assets/js : le premier argument, écrit en toutes lettres, des appels t(…), tm(…) et tx(…) ;
// - dans les pages : les attributs data-i18n-placeholder, data-i18n-aria-label, data-i18n-title, et le
//   texte des éléments marqués data-i18n ou data-i18n-md.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PAGES = ['accueil', 'interpreteur'];
const REASON = 'le texte doit être écrit en toutes lettres';
// Un appel, et non une définition (function t(…)) ni la méthode d'un objet (x.t(…))
const CALL = /(?<![\w$.])(?<!function\s+)(t|tm|tx)\(\s*/g;
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function scripts(dir) {
  if (!(await exists(dir))) return [];
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await scripts(path));
    else if (entry.name.endsWith('.js')) found.push(path);
  }
  return found.sort();
}

// Les commentaires parlent des fonctions de traduction sans les appeler : on écarte les lignes de commentaire
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
}

// Lit une chaîne écrite en toutes lettres à partir de son guillemet ouvrant ; null si ce n'en est pas une
function readLiteral(source, start) {
  const quote = source[start];
  let value = '';
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      const next = source[index + 1];
      if (next === 'u') {
        const braced = /^\{([0-9A-Fa-f]+)\}/.exec(source.slice(index + 2));
        const hex = braced ? braced[1] : source.slice(index + 2, index + 6);
        value += String.fromCodePoint(parseInt(hex, 16));
        index += braced ? braced[0].length + 2 : 6;
      } else {
        value += { n: '\n', t: '\t' }[next] ?? next;
        index += 2;
      }
    } else if (char === quote) {
      return { value, end: index + 1 };
    } else if (quote === '`' && char === '$' && source[index + 1] === '{') {
      return null; // un texte composé avec une variable n'est pas un texte fixe
    } else {
      value += char;
      index += 1;
    }
  }
  return null;
}

function scriptTexts(source, name, texts, errors) {
  const code = withoutComments(source);
  for (const match of code.matchAll(CALL)) {
    const start = match.index + match[0].length;
    const literal = "'\"`".includes(code[start]) ? readLiteral(code, start) : null;
    const after = literal ? code.slice(literal.end).trimStart()[0] : '';
    if (literal && (after === ',' || after === ')')) {
      texts.push(literal.value);
    } else {
      const close = code.indexOf(')', match.index);
      const call = code.slice(match.index, close < 0 ? match.index + 40 : close + 1).split('\n')[0];
      errors.push(`${name} : ${call} — ${REASON}`);
    }
  }
}

const decode = (text) => text.replace(/&(#x[0-9A-Fa-f]+|#\d+|[a-z]+);/g, (whole, code) => {
  if (code.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16));
  if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
  return Object.hasOwn(ENTITIES, code) ? ENTITIES[code] : whole;
});
const collapse = (text) => text.replace(/\s+/g, ' ').trim();

function pageTexts(source, name, texts, errors) {
  for (const match of source.matchAll(/\sdata-i18n-(?:placeholder|aria-label|title)="([^"]*)"/g)) texts.push(decode(match[1]));
  for (const match of source.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*?\sdata-i18n(?:-md)?(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/g)) {
    if (match[2].includes('<')) errors.push(`${name} : un élément data-i18n ne contient que du texte (${collapse(match[2]).slice(0, 40)})`);
    else texts.push(collapse(decode(match[2])));
  }
}

export async function collectTexts(rootDir) {
  const texts = [];
  const errors = [];
  const name = (path) => relative(rootDir, path).replace(/\\/g, '/');
  for (const path of await scripts(join(rootDir, 'assets', 'js'))) scriptTexts(await readFile(path, 'utf8'), name(path), texts, errors);
  for (const page of PAGES) {
    const path = join(rootDir, page, 'index.html');
    if (await exists(path)) pageTexts(await readFile(path, 'utf8'), name(path), texts, errors);
  }
  return { texts: [...new Set(texts.filter((text) => text))].sort(), errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const { texts, errors } = await collectTexts(root);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  await writeFile(join(root, '_dev', 'textes.json'), JSON.stringify({ texts }, null, 1) + '\n', 'utf8');
  console.log(`${texts.length} textes écrits dans _dev/textes.json`);
}
