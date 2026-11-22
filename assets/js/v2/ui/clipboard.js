// Copie d'un texte dans le presse-papiers ; si le navigateur refuse l'accès direct, par une zone de texte
// invisible. Rend vrai quand la copie s'est faite.
import { add, el } from './dom.js';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el('textarea', { class: 'sr', attrs: { readonly: true, 'aria-hidden': 'true', tabindex: -1 } });
    area.value = text;
    add(document.body, area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    area.remove();
    return copied;
  }
}
