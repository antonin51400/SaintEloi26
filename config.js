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
  firebase: {
    // Paramètres PUBLICS de l'application Web Firebase (sans mot de passe privé).
    apiKey: 'AIzaSyA8oH7LLeY-ZYU8nssatUN4m3QmtNxXTVQ',
    authDomain: 'sainteloi26-371e3.firebaseapp.com',
    // À compléter après la création de Realtime Database ; ne pas deviner la région.
    databaseURL: '',
    projectId: 'sainteloi26-371e3',
    storageBucket: 'sainteloi26-371e3.firebasestorage.app',
    messagingSenderId: '207016607185',
    appId: '1:207016607185:web:f7c028b7550a1e32a8b4f0'
  }
};
