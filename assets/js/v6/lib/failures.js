// Échecs d'un appel à l'API, et le message à montrer au visiteur pour chacun.
import { tx } from './i18n.js';

// kind : 'network' (pas de réponse), 'http' (code d'erreur), 'stream' (ligne error du flux),
// 'engine' (réponse du moteur sans en-tête [TARGET]), 'cut' (flux coupé), 'timeout' (délai dépassé),
// 'credential' (clé ou mot de passe que le navigateur ne peut pas transmettre).
export class ApiFailure extends Error {
  constructor(kind, { status = 0, detail = '' } = {}) {
    super(status ? `${kind} ${status}` : String(kind));
    this.name = 'ApiFailure';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

const GENERAL = { text: tx('L’analyse n’a pas pu aboutir.'), retry: true, askKey: false };

const BY_KIND = {
  network: { text: tx('Connexion impossible. Vérifiez votre réseau, puis réessayez.'), retry: true, askKey: false },
  stream: { text: tx('L’analyse a échoué en cours de route.'), retry: true, askKey: false },
  engine: { text: tx('Le moteur n’a pas pu produire l’analyse.'), retry: true, askKey: false },
  cut: { text: tx('La connexion a été coupée avant la fin de l’analyse.'), retry: true, askKey: false },
  timeout: { text: tx('L’analyse n’a pas répondu dans le délai prévu.'), retry: true, askKey: false },
  credential: { text: tx('Cette clé ou ce mot de passe contient un caractère que le navigateur ne peut pas transmettre.'), retry: false, askKey: true },
};

const BY_STATUS = {
  401: { text: tx('Clé API absente ou refusée.'), retry: false, askKey: true },
  403: { text: tx('Accès bloqué par le serveur après trop d’essais. Réessayez plus tard.'), retry: false, askKey: false },
  404: { text: tx('Passage introuvable.'), retry: false, askKey: false },
  503: { text: tx('Le texte coranique n’est pas disponible sur le serveur pour l’instant.'), retry: true, askKey: false },
};

const SERVER_ERROR = { text: tx('Le serveur a rencontré une erreur.'), retry: true, askKey: false };

// Message pour le visiteur : un texte français source (à traduire par l'interface), et ce qu'il peut faire.
// Le détail technique (failure.detail) n'entre jamais dans ce texte : l'interface le montre à part.
export function describeFailure(failure) {
  if (!failure || typeof failure.kind !== 'string') return { ...GENERAL };
  if (failure.kind === 'http') return { ...(BY_STATUS[failure.status] || SERVER_ERROR) };
  return { ...(Object.prototype.hasOwnProperty.call(BY_KIND, failure.kind) ? BY_KIND[failure.kind] : GENERAL) };
}

// Lecture publique du Scanner ou de la page Tarteel : ni analyse, ni clé. Le texte français source dit
// seulement si c'est le réseau, un blocage du serveur, ou une erreur du serveur.
export function describeReadFailure(failure) {
  if (failure && failure.kind === 'network') return BY_KIND.network.text;
  if (failure && failure.kind === 'http' && failure.status === 403) return BY_STATUS[403].text;
  return SERVER_ERROR.text;
}

// Après une coupure ou un délai dépassé, le serveur a pu terminer l'analyse (et la clé être facturée) sans
// que la réponse arrive : le visiteur doit le savoir avant de relancer.
export const BILLED_NOTICE = tx('Cette demande a peut-être été facturée : le serveur a pu terminer l’analyse sans pouvoir vous l’envoyer. Réessayer lance une nouvelle demande.');

export const maybeBilled = (failure) => Boolean(failure) && (failure.kind === 'cut' || failure.kind === 'timeout');
