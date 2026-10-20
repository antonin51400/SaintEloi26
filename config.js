/* Activer uniquement après configuration d'une base dédiée et du service de connexion par codes.
   Voir README.md. Aucun secret ni compte personnel ne doit être publié ici. */
window.SAINT_ELOI_CONFIG = {
  enabled: false,
  accessEndpoint: '', // URL HTTPS de la fonction accessByCode
  eventPath: 'events/saint-eloi-2026',
  firebase: { apiKey: '', authDomain: '', databaseURL: '', projectId: '', appId: '' }
};
