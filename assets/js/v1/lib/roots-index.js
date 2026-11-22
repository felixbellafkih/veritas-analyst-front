// Liste des racines du Scanner, sans interface : lecture du fichier livré par le site
// (assets/data/racines.json, écrit par la publication du corpus) et recherche dans cette liste.
// La liste ne porte que le code, les lettres arabes et la fonction de chaque racine : la fiche complète
// vient de l'API, à la demande.

const QUERY_MAX = 100; // même plafond que les champs de racine de l'Interpréteur
const LOGIC_MIN = 2;   // la fonction n'est cherchée qu'à partir de deux caractères
const ARABIC = /[؀-ۿ]/;

// Le contenu du fichier : {roots: [[code, lettres arabes, fonction], …]}. Tolérant : une ligne d'une autre
// forme est ignorée, un fichier illisible donne une liste vide (le Scanner marche alors sans suggestions).
export function parseRootsIndex(data) {
  const rows = data && Array.isArray(data.roots) ? data.roots : [];
  const index = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 3 || !row.slice(0, 3).every((cell) => typeof cell === 'string')) continue;
    const code = row[0].trim();
    if (code) index.push({ code, arabic: row[1], logic: row[2] });
  }
  return index;
}

// Lettres arabes nues : sans signes de vocalisation, sans espaces ni tatweel, les alifs ramenés à un seul
export function foldArabic(text) {
  return String(text ?? '')
    .replace(/[ً-ٰٟۖ-ۭـ\s‌‍]/g, '')
    .replace(/[أإآٱ]/g, 'ا');
}

// Code latin réduit à ses lettres et chiffres : « smw » trouve « S-M-W »
const foldLatin = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Rang d'une entrée pour une saisie : 0 le meilleur ; null, pas de correspondance
function rank(entry, query) {
  if (ARABIC.test(query)) {
    const wanted = foldArabic(query);
    const letters = foldArabic(entry.arabic);
    if (!wanted) return null;
    if (letters === wanted) return 3;
    return letters.startsWith(wanted) ? 4 : null;
  }
  const raw = query.toUpperCase();
  const code = entry.code.toUpperCase();
  const folded = foldLatin(query);
  if (code === raw) return 0;
  if (folded && foldLatin(code) === folded) return 1;
  if (code.startsWith(raw) || (folded && foldLatin(code).startsWith(folded))) return 2;
  if (query.length >= LOGIC_MIN && entry.logic.toUpperCase().includes(raw)) return 5;
  return null;
}

const clean = (query) => String(query ?? '').trim().slice(0, QUERY_MAX);

// Suggestions pendant la frappe : les meilleures correspondances d'abord, puis l'ordre de la liste
export function searchRoots(index, query, limit = 8) {
  const wanted = clean(query);
  if (!wanted) return [];
  const found = [];
  (index || []).forEach((entry, position) => {
    const score = rank(entry, wanted);
    if (score !== null) found.push({ entry, score, position });
  });
  found.sort((a, b) => a.score - b.score || a.position - b.position);
  return found.slice(0, limit).map((item) => item.entry);
}

// Filtre de la liste « Toutes les racines » : même correspondance, sans limite, dans l'ordre de la liste
export function filterRoots(index, query) {
  const wanted = clean(query);
  if (!wanted) return [...(index || [])];
  return (index || []).filter((entry) => rank(entry, wanted) !== null);
}

// La saisie portée par l'adresse de la page (?q=…), et l'adresse qui ouvre une fiche
export function scannerQuery(search) {
  return clean(new URLSearchParams(String(search ?? '')).get('q'));
}

export const scannerHref = (query) => `/scanner/?q=${encodeURIComponent(clean(query))}`;
