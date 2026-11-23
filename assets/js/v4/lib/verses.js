// Sourates et passages. Les noms et longueurs sont recopiés de api.py (SURA_NAMES, SURA_LIMITS) pour que
// le formulaire s'affiche sans attendre l'API ; _dev/verifier-sourates.mjs les compare à l'API.

const TABLE = [
  [1, 'Al-Fatihah', 7], [2, 'Al-Baqarah', 286], [3, 'Aal-E-Imran', 200], [4, 'An-Nisa', 176],
  [5, 'Al-Maidah', 120], [6, 'Al-Anam', 165], [7, 'Al-Araf', 206], [8, 'Al-Anfal', 75],
  [9, 'At-Tawbah', 129], [10, 'Yunus', 109], [11, 'Hud', 123], [12, 'Yusuf', 111],
  [13, 'Ar-Rad', 43], [14, 'Ibrahim', 52], [15, 'Al-Hijr', 99], [16, 'An-Nahl', 128],
  [17, 'Al-Isra', 111], [18, 'Al-Kahf', 110], [19, 'Maryam', 98], [20, 'Ta-Ha', 135],
  [21, 'Al-Anbiya', 112], [22, 'Al-Hajj', 78], [23, 'Al-Muminun', 118], [24, 'An-Nur', 64],
  [25, 'Al-Furqan', 77], [26, 'Ash-Shuara', 227], [27, 'An-Naml', 93], [28, 'Al-Qasas', 88],
  [29, 'Al-Ankabut', 69], [30, 'Ar-Rum', 60], [31, 'Luqman', 34], [32, 'As-Sajdah', 30],
  [33, 'Al-Ahzab', 73], [34, 'Saba', 54], [35, 'Fatir', 45], [36, 'Ya-Sin', 83],
  [37, 'As-Saffat', 182], [38, 'Sad', 88], [39, 'Az-Zumar', 75], [40, 'Ghafir', 85],
  [41, 'Fussilat', 54], [42, 'Ash-Shura', 53], [43, 'Az-Zukhruf', 89], [44, 'Ad-Dukhan', 59],
  [45, 'Al-Jathiyah', 37], [46, 'Al-Ahqaf', 35], [47, 'Muhammad', 38], [48, 'Al-Fath', 29],
  [49, 'Al-Hujurat', 18], [50, 'Qaf', 45], [51, 'Ad-Dhariyat', 60], [52, 'At-Tur', 49],
  [53, 'An-Najm', 62], [54, 'Al-Qamar', 55], [55, 'Ar-Rahman', 78], [56, 'Al-Waqiah', 96],
  [57, 'Al-Hadid', 29], [58, 'Al-Mujadila', 22], [59, 'Al-Hashr', 24], [60, 'Al-Mumtahanah', 13],
  [61, 'As-Saff', 14], [62, 'Al-Jumuah', 11], [63, 'Al-Munafiqun', 11], [64, 'At-Taghabun', 18],
  [65, 'At-Talaq', 12], [66, 'At-Tahrim', 12], [67, 'Al-Mulk', 30], [68, 'Al-Qalam', 52],
  [69, 'Al-Haqqah', 52], [70, 'Al-Maarij', 44], [71, 'Nuh', 28], [72, 'Al-Jinn', 28],
  [73, 'Al-Muzzammil', 20], [74, 'Al-Muddaththir', 56], [75, 'Al-Qiyamah', 40], [76, 'Al-Insan', 31],
  [77, 'Al-Mursalat', 50], [78, 'An-Naba', 40], [79, 'An-Naziat', 46], [80, 'Abasa', 42],
  [81, 'At-Takwir', 29], [82, 'Al-Infitar', 19], [83, 'Al-Mutaffifin', 36], [84, 'Al-Inshiqaq', 25],
  [85, 'Al-Buruj', 22], [86, 'At-Tariq', 17], [87, 'Al-Ala', 19], [88, 'Al-Ghashiyah', 26],
  [89, 'Al-Fajr', 30], [90, 'Al-Balad', 20], [91, 'Ash-Shams', 15], [92, 'Al-Lail', 21],
  [93, 'Ad-Duhaa', 11], [94, 'Ash-Sharh', 8], [95, 'At-Tin', 8], [96, 'Al-Alaq', 19],
  [97, 'Al-Qadr', 5], [98, 'Al-Bayyinah', 8], [99, 'Az-Zalzalah', 8], [100, 'Al-Adiyat', 11],
  [101, 'Al-Qariah', 11], [102, 'At-Takathur', 8], [103, 'Al-Asr', 3], [104, 'Al-Humazah', 9],
  [105, 'Al-Fil', 5], [106, 'Quraish', 4], [107, 'Al-Maun', 7], [108, 'Al-Kauthar', 3],
  [109, 'Al-Kafirun', 6], [110, 'An-Nasr', 3], [111, 'Al-Masad', 5], [112, 'Al-Ikhlas', 4],
  [113, 'Al-Falaq', 5], [114, 'An-Nas', 6],
];

export const SURAS = Object.freeze(TABLE.map(([n, name, verses]) => Object.freeze({ n, name, verses })));

export const MAX_VERSES = 10; // versets par analyse, comme l'app actuelle (fin ≤ début + 9)

const DIGITS = /^\d{1,3}$/;

function suraOf(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= SURAS.length ? SURAS[n - 1] : null;
}

// Ramène une plage dans la sourate, à 10 versets au plus. null si la sourate n'existe pas.
export function clampRange(sura, start, end) {
  const found = suraOf(sura);
  if (!found) return null;
  const from = Number.isFinite(Number(start)) ? Math.trunc(Number(start)) : 1;
  const first = Math.min(Math.max(from, 1), found.verses);
  const to = Number.isFinite(Number(end)) ? Math.trunc(Number(end)) : first;
  const last = Math.min(Math.max(to, first), found.verses, first + MAX_VERSES - 1);
  return { start: first, end: last };
}

// L'API place parfois le caractère invisible U+FEFF en tête d'un verset. On le retire, et rien d'autre :
// le moteur vérifie la référence sur le texte envoyé.
export const cleanVerseText = (text) => String(text ?? '').replace(/﻿/g, '');

// Le passage voyage dans l'adresse sous forme de nombres : ?s=2&de=255&a=255
export const passageQuery = ({ sura, start, end }) => `?s=${sura}&de=${start}&a=${end}`;

// L'adresse d'un passage dans un outil : les seuls endroits où elle s'écrit (un test de règles y veille)
export const interpreterHref = (passage) => `/interpreteur/${passageQuery(passage)}`;
export const sequencerHref = (passage) => `/sequenceur/${passageQuery(passage)}`;

export function parsePassageQuery(search) {
  const params = new URLSearchParams(String(search ?? ''));
  const sura = params.get('s');
  if (!sura || !DIGITS.test(sura)) return null;
  const number = (name) => (DIGITS.test(params.get(name) || '') ? Number(params.get(name)) : undefined);
  const range = clampRange(Number(sura), number('de'), number('a'));
  return range ? { sura: Number(sura), ...range } : null;
}

export const referenceLabel = ({ sura, start, end }) => (end > start ? `${sura}:${start}-${end}` : `${sura}:${start}`);

export function resultTitle(passage) {
  const found = suraOf(passage.sura);
  return `${found ? found.name : ''} ${referenceLabel(passage)}`.trim();
}
