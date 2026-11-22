// Réponse du moteur : une ligne d'en-tête technique, puis le texte de l'analyse.
// En-tête écrit par engine/ai_bridge.py :
//   **[TARGET: modèle]** | 📊 **Tokens:** Input=… | Output=… | Thinking=… | Total=… | Cost=$… | 📚 **Références :** a, b
// Une réponse sans cet en-tête est une erreur du moteur (quota, réseau, clé refusée).

// Même expression que engine/corpus_store.py (_HEADER_RE)
const HEADER = /^\s*\*\*\[TARGET:\s*([^\]]+)\]\*\*[^\n]*\n+/;
const MODEL = /^\s*\*\*\[TARGET:\s*([^\]]+)\]\*\*/;
const USAGE = /📊 \*\*Tokens:\*\* (.*?)(?: \| 📚 |$)/;
const REFERENCES = /📚 \*\*Références :\*\* (.*)$/;
const VERSE_REFERENCE = /^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?/;

const normalize = (text) => String(text ?? '').replace(/\r\n/g, '\n').replace(/^\s+|\s+$/g, '');

// Comme split_output du Kernel, avec la ligne d'en-tête en plus
export function splitOutput(result) {
  const raw = String(result ?? '');
  const match = HEADER.exec(raw);
  if (!match) return { model: '', headerLine: '', text: normalize(raw) };
  return { model: match[1].trim(), headerLine: match[0].trim(), text: normalize(raw.slice(match[0].length)) };
}

export const succeeded = (result) => Boolean(splitOutput(result).model);

// Les références sont séparées par des virgules, mais un libellé en contient aussi entre parenthèses
// (« 18:96-97 (racines : S-D-D, R-D-M) ») : seules les virgules hors parenthèses séparent.
function splitReferences(text) {
  const labels = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      labels.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  labels.push(current);
  return labels.map((label) => label.trim()).filter(Boolean);
}

// Découpe la ligne d'en-tête. Si la forme n'est pas reconnue, rien n'est inventé : usage vaut null,
// et l'interface montre alors la ligne telle quelle.
export function parseHeader(headerLine) {
  const line = String(headerLine ?? '').trim();
  const model = MODEL.exec(line);
  const usage = USAGE.exec(line);
  const references = REFERENCES.exec(line);
  return {
    model: model ? model[1].trim() : '',
    usage: usage ? usage[1].trim() : null,
    references: references ? splitReferences(references[1]) : [],
  };
}

// Page du corpus d'une référence citée dans l'en-tête (« 1:1-7 », « 18:96 (verset) »), ou null.
// Toujours la page française : elle mène à la version anglaise quand celle-ci existe.
export function referenceHref(label) {
  const match = VERSE_REFERENCE.exec(String(label ?? '').trim());
  if (!match) return null;
  const [sura, start, end] = [Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : null];
  if (sura < 1 || sura > 114 || start < 1) return null;
  return `/corpus/${sura}/${start}${end ? `-${end}` : ''}/`;
}

// Lien d'une référence, seulement si une page est publiée à cette adresse. published : les adresses de la
// liste publiée du corpus (lib/corpus-list.js) ; tant qu'elle n'est pas connue, aucun lien. Une analyse
// rangée ailleurs (/corpus/autres/…) est citée par ses versets : son libellé reste alors un simple texte.
export function publishedHref(label, published) {
  const href = referenceHref(label);
  return href && published && typeof published.has === 'function' && published.has(href) ? href : null;
}
