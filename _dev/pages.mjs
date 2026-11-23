// Les pages du nouveau site : un dossier par page, à la racine du dépôt, avec son index.html.
// Liste unique, lue par _dev/version.mjs (montée de version), _dev/textes.mjs (textes à traduire) et les
// tests de règles. Un test vérifie qu'aucune page n'y manque : toute page qui charge un module de
// assets/js/v<N>/ doit figurer ici.
// L'accueil est à la racine du dépôt (index.html) depuis l'étape 6 ; accueil/index.html n'est plus qu'un renvoi.
export const PAGES = ['bibliotheque', 'interpreteur', 'scanner', 'sequenceur', 'tarteel'];

// Les fichiers de ces pages, plus les pages faites d'un seul fichier à la racine (les mentions légales : leur
// adresse, /legal.html, sert l'app sur l'App Store et ne change pas). Chemins relatifs au dépôt.
export const PAGE_FILES = ['index.html', ...PAGES.map((name) => `${name}/index.html`), 'legal.html'];

// Pages sans module dont les adresses portent ?v= : la montée de version les suit aussi (l'app Streamlit,
// servie en plein écran à /classique/ depuis l'étape 6)
export const STATIC_FILES = ['classique/index.html'];
