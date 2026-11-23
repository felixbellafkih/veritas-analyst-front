// Compare la table des sourates du site (assets/js/lib/verses.js) à celle de l'API (GET /verse/metadata).
// Usage : node _dev/verifier-sourates.mjs
import { SURAS } from '../assets/js/v5/lib/verses.js';

const response = await fetch('https://api.veritas-analyst.org/verse/metadata');
if (!response.ok) {
  console.error(`L'API a répondu ${response.status}.`);
  process.exit(1);
}
const { sura_limits: limits, sura_names: names } = await response.json();
const differences = [];
for (const sura of SURAS) {
  if (limits[sura.n] !== sura.verses) differences.push(`sourate ${sura.n} : ${sura.verses} versets ici, ${limits[sura.n]} dans l'API`);
  if (names[sura.n] !== sura.name) differences.push(`sourate ${sura.n} : « ${sura.name} » ici, « ${names[sura.n]} » dans l'API`);
}
if (Object.keys(limits).length !== SURAS.length) differences.push(`${SURAS.length} sourates ici, ${Object.keys(limits).length} dans l'API`);
if (differences.length) {
  console.error(differences.join('\n'));
  process.exit(1);
}
console.log(`identique : ${SURAS.length} sourates`);
