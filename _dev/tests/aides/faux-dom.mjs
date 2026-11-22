// Faux DOM minimal pour tester les modules d'interface sans navigateur : des nœuds, des attributs, des
// événements qui remontent. Ni mise en page ni rendu. Il n'offre que ce que ui/dom.js, ui/icons.js et les
// modules testés utilisent ; un module qui demande autre chose échoue, et c'est voulu.
let focused = null;

export class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.dataset = {};
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.tabIndex = 0;
    this.parent = null;
  }

  get classList() {
    const names = this.className.split(/\s+/).filter(Boolean);
    return { contains: (name) => names.includes(name) };
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name === 'hidden') this.hidden = true;
    if (name === 'tabindex') this.tabIndex = Number(value);
    if (name === 'class') this.className = String(value);
  }

  getAttribute(name) {
    return name in this.attrs ? this.attrs[name] : null;
  }

  hasAttribute(name) {
    return name in this.attrs;
  }

  removeAttribute(name) {
    delete this.attrs[name];
    if (name === 'hidden') this.hidden = false;
  }

  addEventListener(type, handler) {
    (this.listeners[type] ||= []).push(handler);
  }

  append(...items) {
    for (const item of items) {
      if (typeof item === 'string') {
        this.textContent += item;
        continue;
      }
      item.parent = this;
      this.children.push(item);
    }
  }

  replaceChildren(...items) {
    this.children = [];
    this.append(...items);
  }

  // Envoie un événement, qui remonte jusqu'à la racine. Rend l'événement : prevented dit si son effet par
  // défaut a été neutralisé.
  dispatch(type, init = {}) {
    const event = { type, ...init, target: this, prevented: false, preventDefault() { event.prevented = true; } };
    for (let node = this; node; node = node.parent) {
      for (const handler of node.listeners[type] || []) handler(event);
    }
    return event;
  }

  click() {
    if (this.disabled) return;
    if (this.attrs.type === 'checkbox') {
      this.checked = !this.checked;
      this.dispatch('change');
    }
    this.dispatch('click');
  }

  focus() {
    focused = this;
    this.dispatch('focusin');
  }

  scrollIntoView() {}

  find(match, found = []) {
    for (const child of this.children) {
      if (match(child)) found.push(child);
      child.find(match, found);
    }
    return found;
  }

  byClass(name) {
    return this.find((node) => node.classList.contains(name));
  }
}

// Pose le faux document. À appeler avant d'importer un module d'interface.
export function installFakeDom() {
  focused = null;
  globalThis.document = {
    createElement: (tag) => new FakeNode(tag),
    createElementNS: (_, tag) => new FakeNode(tag),
    documentElement: new FakeNode('html'),
  };
  return { node: (tag = 'div') => new FakeNode(tag), focused: () => focused };
}
