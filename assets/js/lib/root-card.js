// Carte « Exemple de racine » de l'accueil : ce qui se déduit des données de l'API (GET /analyze/root/…).
// Rien n'est recopié du LEXICON dans le site : une équation corrigée se corrige d'elle-même sur l'accueil.

// Un terme de l'équation : un code de lettre, puis sa charge entre parenthèses — « S (Signal/Flux) »
const TERM = /^(\S{1,6})\s*\((.*\S.*)\)$/;

// arabic : les lettres de la racine, séparées par des espaces (« س م و ») ;
// equation : « S (Signal/Flux) + M (Matrice) + W (Extension/Lien) = … », dans la langue affichée.
// Rend une tuile par lettre, [{letter, code, charge}], ou null quand l'équation n'a pas cette forme :
// la carte montre alors les lettres et l'équation, sans tuiles.
export function rootTiles(arabic, equation) {
  const letters = String(arabic ?? '').trim().split(/\s+/).filter(Boolean);
  const text = typeof equation === 'string' ? equation : '';
  const cut = text.indexOf(' = ');
  if (cut < 0 || letters.length < 2) return null;
  const terms = text.slice(0, cut).split(' + ').map((term) => TERM.exec(term.trim()));
  if (terms.length !== letters.length || terms.some((term) => !term)) return null;
  return terms.map((term, index) => ({ letter: letters[index], code: term[1], charge: term[2].trim() }));
}
