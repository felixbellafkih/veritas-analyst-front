// Menu du modèle Gemini, d'après la réponse de GET /models : {default, models}.
// Le modèle par défaut est en tête ; c'est celui qui sert quand la demande ne nomme aucun modèle.

const NAME = /^\S{1,100}$/;
const valid = (name) => typeof name === 'string' && NAME.test(name);

// kept : le modèle gardé pour l'onglet. Rend {models, defaultModel, selected}, ou null quand la réponse
// ne permet pas de bâtir un menu (le modèle par défaut du moteur sert alors, sans menu).
export function modelMenu(data, kept) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.models)) return null;
  const names = [...new Set(data.models.filter(valid))];
  const defaultModel = valid(data.default) ? data.default : names[0];
  if (!defaultModel) return null;
  const models = [defaultModel, ...names.filter((name) => name !== defaultModel)];
  return { models, defaultModel, selected: models.includes(kept) ? kept : defaultModel };
}
