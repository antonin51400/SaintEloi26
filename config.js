/* Saint Éloi 2026 — codes pratiques d'interface UNIQUEMENT.
   Ce fichier est PUBLIC sur GitHub Pages : ces codes ne sont pas secrets.
   Ils ne peuvent pas sécuriser la base Firebase à eux seuls.
   Ne jamais activer la synchronisation de données personnelles sans contrôle
   d'accès côté serveur. Aucun nom/téléphone de réservant dans ce fichier. */
window.SAINT_ELOI_ACCESS_CODES = {
  '2002': {name:'Antonin Blanckaert',role:'organizer'},
  '9425': {name:'Antonin Bassut',role:'organizer'},
  '3186': {name:'Théotime Laloua',role:'organizer'},
  '4279': {name:'Robin Maret',role:'organizer'},
  '7890': {name:'Placement des invités',role:'placement'},
  '6930': {name:'Administration',role:'admin'},
  '1234': {name:'Consultation du plan',role:'view'},
  '0722': {name:'Accueil des entrées',role:'entry'}
};

// Identifiants de comptes de service de connexion (PUBLICS, aucun mot de passe ici).
// Chaque membre tape UN code confidentiel de 12 chiffres : préfixe ci-dessous
// suivi de 8 chiffres choisis secrètement dans Firebase Authentication > Utilisateurs.
// Le navigateur utilise automatiquement le bon compte e-mail de connexion.
window.SAINT_ELOI_PIN_ACCOUNTS = {
  '2002': {email:'access2002@sainteloi26-371e3.firebaseapp.com',name:'Antonin Blanckaert',role:'organizer'},
  '9425': {email:'access9425@sainteloi26-371e3.firebaseapp.com',name:'Antonin Bassut',role:'organizer'},
  '3186': {email:'access3186@sainteloi26-371e3.firebaseapp.com',name:'Théotime Laloua',role:'organizer'},
  '4279': {email:'access4279@sainteloi26-371e3.firebaseapp.com',name:'Robin Maret',role:'organizer'},
  '7890': {email:'access7890@sainteloi26-371e3.firebaseapp.com',name:'Placement des invités',role:'placement'},
  '6930': {email:'access6930@sainteloi26-371e3.firebaseapp.com',name:'Administration',role:'admin'},
  '1234': {email:'access1234@sainteloi26-371e3.firebaseapp.com',name:'Consultation du plan',role:'view'},
  '0722': {email:'access0722@sainteloi26-371e3.firebaseapp.com',name:'Accueil des entrées',role:'entry'}
};

window.SAINT_ELOI_CONFIG = {
  // Ne passer à true qu'après création des comptes Firebase et publication des règles adaptées.
  enabled: true,
  eventPath: 'events/saint-eloi-2026',
  firebase: {
    // Paramètres PUBLICS de l'application Web Firebase (sans mot de passe privé).
    apiKey: 'AIzaSyA8oH7LLeY-ZYU8nssatUN4m3QmtNxXTVQ',
    authDomain: 'sainteloi26-371e3.firebaseapp.com',
    // Realtime Database de Saint Éloi 2026 (europe-west1).
    databaseURL: 'https://sainteloi26-371e3-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'sainteloi26-371e3',
    storageBucket: 'sainteloi26-371e3.firebasestorage.app',
    messagingSenderId: '207016607185',
    appId: '1:207016607185:web:f7c028b7550a1e32a8b4f0'
  }
};
