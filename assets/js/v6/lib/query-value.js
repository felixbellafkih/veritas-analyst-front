// Valeur d'un paramètre d'adresse, sans interface.
// Un point final est encodé (%2E) : collée dans une messagerie, une adresse qui finit par un point perd
// souvent ce point quand elle devient un lien, et « A-R-D. » n'est pas la racine « A-R-D ». Un point au
// milieu d'un code (D.-R-B) reste tel quel, lisible. À la lecture, URLSearchParams rend le point.
export const queryValue = (value) => encodeURIComponent(String(value ?? '')).replace(/\.$/, '%2E');
