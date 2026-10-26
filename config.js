/* Saint Éloi 2026 — configuration Firebase publique.
   Aucun mot de passe n'est conservé ici. L'accès utilise uniquement
   Firebase Authentication par adresse e-mail et les règles Realtime Database.
   Les comptes sont créés exclusivement par l'organisateur. */
window.SAINT_ELOI_CONFIG = {
  // Base partagée active avec authentification e-mail / mot de passe.
  enabled: true,
  inviteUserUrl: 'https://europe-west1-sainteloi26-371e3.cloudfunctions.net/inviteUser',
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
