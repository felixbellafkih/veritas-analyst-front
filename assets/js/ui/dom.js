// Petits outils pour bâtir l'interface. Tout texte s'écrit comme du texte : jamais comme du balisage.
import { createStore } from '../lib/store.js';

function append(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(node, child);
    else node.append(child); // un texte devient un nœud de texte
  }
}

// el('button', {class: 'bouton', text: 'Envoyer', attrs: {type: 'button'}, on: {click: fn}}, enfant…)
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined && props.text !== null) node.textContent = String(props.text);
  for (const [name, value] of Object.entries(props.attrs || {})) {
    if (name === 'style') throw new Error('Pas d’attribut style : la politique de sécurité du site le refuse.');
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const [name, handler] of Object.entries(props.on || {})) node.addEventListener(name, handler);
  append(node, children);
  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

// Ajoute des enfants à un nœud. Comme el(), ignore les valeurs absentes (null, undefined, false) et
// déplie les listes : l'insertion native, elle, écrirait le mot « null » dans la page. Les modules
// d'interface n'insèrent rien autrement (règle vérifiée par _dev/tests/regles.test.js).
export function add(node, ...children) {
  append(node, children);
  return node;
}

// Remplace le contenu d'un nœud, avec les mêmes égards
export function fill(node, ...children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

// Stockage du navigateur. L'accès peut être refusé (navigation privée) : le store garde alors ses valeurs en mémoire.
export function browserStore() {
  const area = (name) => {
    try {
      return window[name];
    } catch {
      return undefined;
    }
  };
  return createStore({ local: area('localStorage'), session: area('sessionStorage') });
}
