// Icônes au trait, dessinées dans la page (elles suivent la couleur du texte, donc le thème). Tracés des maquettes.
const SVG = 'http://www.w3.org/2000/svg';

// Chaque forme : [balise, attributs, pleine ?]
const SHAPES = {
  globe: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18' }]],
  sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]],
  moon: [['path', { d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' }]],
  key: [['circle', { cx: 8, cy: 15, r: 4 }], ['path', { d: 'M11 12l9-9M17 6l3 3M14 9l2 2' }]],
  copy: [['rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }], ['path', { d: 'M5 15V6a2 2 0 0 1 2-2h9' }]],
  download: [['path', { d: 'M12 4v11M7 11l5 5 5-5M5 20h14' }]],
  printer: [['path', { d: 'M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2' }], ['rect', { x: 7, y: 14, width: 10, height: 6, rx: 1 }]],
  arrow: [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
  book: [['path', { d: 'M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13' }]],
  list: [['path', { d: 'M9 6h11M9 12h11M9 18h11' }], ['circle', { cx: 4.5, cy: 6, r: 1 }, true], ['circle', { cx: 4.5, cy: 12, r: 1 }, true], ['circle', { cx: 4.5, cy: 18, r: 1 }, true]],
  nodes: [['circle', { cx: 4.5, cy: 12, r: 2.5 }], ['circle', { cx: 12, cy: 12, r: 2.5 }], ['circle', { cx: 19.5, cy: 12, r: 2.5 }], ['path', { d: 'M7 12h2.5M14.5 12H17' }]],
  search: [['circle', { cx: 11, cy: 11, r: 6.5 }], ['path', { d: 'M20 20l-4.3-4.3' }]],
  more: [['circle', { cx: 5, cy: 12, r: 1.4 }, true], ['circle', { cx: 12, cy: 12, r: 1.4 }, true], ['circle', { cx: 19, cy: 12, r: 1.4 }, true]],
  shield: [['path', { d: 'M12 3l7 3v5.5c0 4.4-2.9 7.9-7 9.5-4.1-1.6-7-5.1-7-9.5V6l7-3z' }]],
  chevron: [['path', { d: 'M6 9l6 6 6-6' }]],
  close: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  layers: [['path', { d: 'M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4' }]],
  external: [['path', { d: 'M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5' }]],
};

function shape(tag, attributes, className) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

function frame(className, box, size) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', `0 0 ${box} ${box}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

export function icon(name, size = 18) {
  const svg = frame('icone', 24, size);
  for (const [tag, attributes, filled] of SHAPES[name] || []) svg.append(shape(tag, attributes, filled ? 'plein' : ''));
  return svg;
}

// Le logo : une loupe dont le verre porte un V de trois nœuds reliés (redessin vectoriel du logo actuel)
export function logo(size = 30) {
  const svg = frame('logo', 32, size);
  svg.append(
    shape('circle', { cx: 14, cy: 14, r: 10 }, 'logo__cercle'),
    shape('path', { d: 'M21.6 21.6L28 28' }, 'logo__manche'),
    shape('path', { d: 'M10 11.6l4 6 4-6' }, 'logo__v'),
    shape('circle', { cx: 10, cy: 11.6, r: 2.1 }, 'logo__noeud'),
    shape('circle', { cx: 18, cy: 11.6, r: 2.1 }, 'logo__noeud'),
    shape('circle', { cx: 14, cy: 17.6, r: 2.1 }, 'logo__noeud'),
  );
  return svg;
}
