/* Saint Éloi 2026 — codes pratiques d'interface UNIQUEMENT.
   Ce fichier est PUBLIC sur GitHub Pages : ces codes ne sont pas secrets.
   Ils ne peuvent pas sécuriser la base Firebase à eux seuls.
   Ne jamais activer la synchronisation de données personnelles sans contrôle
   d'accès côté serveur. Aucun nom/téléphone de réservant dans ce fichier. */
window.SAINT_ELOI_ACCESS_CODES = {
  '2002': {name:'Antonin Blanckaert',role:'organizer'},
  '9425': {name:'Antonin Bassut',role:'organizer'},
  '7890': {name:'Placement des invités',role:'placement'},
  '6930': {name:'Administration',role:'admin'},
  '1234': {name:'Consultation du plan',role:'view'},
  '0722': {name:'Accueil des entrées',role:'entry'}
};

window.SAINT_ELOI_CONFIG = {
  // RESTER false jusqu'à mise en place d'une sécurité des données côté serveur.
  enabled: false,
  eventPath: 'events/saint-eloi-2026',
  firebase: {apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:''}
};
