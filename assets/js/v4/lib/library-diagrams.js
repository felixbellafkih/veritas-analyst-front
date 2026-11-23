// Les deux schémas de la Bibliothèque, recopiés de l'app (app.py) : ce que ses deux graphes inscrivent, dans
// le même ordre. Sans interface. Les libellés sont ceux de l'app, tels quels : ils ne sont pas traduits, et
// ne passent donc pas par tx().
// - Une étape ou un élément : title (la première ligne du bloc dans l'app), text (la suite, quand il y en a).
// - tone : la teinte du bloc dans l'app (« entree » : le verset reçu ; « noyau » : le noyau Veritas ;
//   « alerte » : la rupture de consensus).

// Manifeste, « Architecture d'exécution » : six étapes, reliées par cinq flèches qui portent un libellé
export const EXECUTION_FLOW = {
  steps: [
    { title: 'INPUT', text: '(Verset Coranique)', tone: 'entree' },
    { title: 'ISOLATION', text: '(Neutralisation Affixes)', tone: '' },
    { title: 'NOYAU VERITAS', text: '(Lookup JSON)', tone: 'noyau' },
    { title: 'PHASE 1', text: 'Tableau Matrice', tone: '' },
    { title: 'PHASE 2 & 3', text: 'Analyse Logique & Littéraire', tone: '' },
    { title: 'PHASE 4', text: 'Rupture de Consensus', tone: 'alerte' },
  ],
  links: ['Signal Brut', 'Extraction Racines', 'Fetch Définitions', 'Séquençage', 'Confrontation'],
};

// Carte de gouvernance : le noyau, relié à quatre groupes. L'identifiant d'un groupe est celui de son volet
// (lib/library.js, GOVERNANCE_PANELS). Les trois unités d'analyse mènent à leur page du site.
export const GOVERNANCE_MAP = {
  kernel: { title: 'VERITAS-KERNEL', text: '[v26.03.12-Stable]' },
  groups: [
    {
      id: '1',
      label: '1. AXIOMES DE COHÉRENCE',
      items: [{ title: 'Justice Structurelle' }, { title: 'Référence Source' }, { title: 'Audit [DOXA]' }],
    },
    {
      id: '2',
      label: '2. STANDARD VTS-v2',
      items: [{ title: 'Emphatiques (Signal Isolator)', text: 'A. / H. / S. / D. / T. / Z.' }],
    },
    {
      id: '3',
      label: '3. ARCHITECTURE HARDWARE',
      items: [
        { title: 'CPU Logic Unit', text: '(Arbitrage)' },
        { title: 'RAM Storage Unit', text: '(Mémoire)' },
        { title: 'IO Sensors Unit', text: '(Capteurs)' },
        { title: 'Network Comm Unit', text: '(Transmission)' },
        { title: 'Security Firewall', text: '(Isolation)' },
      ],
    },
    {
      id: '4',
      label: "4. UNITÉS D'ANALYSE",
      items: [
        { title: 'Verse Interpreter', text: '(Décompilation IA)', href: '/interpreteur/' },
        { title: 'Logic Sequencer', text: '(Graphe Causal)', href: '/sequenceur/' },
        { title: 'Root Scanner', text: '(Inspection Matérielle)', href: '/scanner/' },
      ],
    },
  ],
};
