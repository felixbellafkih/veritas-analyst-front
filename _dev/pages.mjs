// Les pages du nouveau site : un dossier par page, à la racine du dépôt, avec son index.html.
// Liste unique, lue par _dev/version.mjs (montée de version), _dev/textes.mjs (textes à traduire) et les
// tests de règles. Un test vérifie qu'aucune page n'y manque : toute page qui charge un module de
// assets/js/v<N>/ doit figurer ici.
export const PAGES = ['accueil', 'interpreteur', 'scanner', 'sequenceur', 'tarteel'];
