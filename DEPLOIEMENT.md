# Mise en service des arrivées, paiements et invitations

Le code GitHub et GitHub Pages ne publient pas les règles ni les Cloud Functions Firebase. Publier les règles avant le nouveau site pour que l’accueil puisse enregistrer les nouveaux champs.

1. Dans un environnement connecté au projet Firebase `sainteloi26-371e3`, installer les dépendances du serveur : `npm --prefix functions install`.
2. Avec Firebase CLI, exécuter `firebase deploy --project sainteloi26-371e3 --only "database,functions:inviteUser"`. Cela déploie la nouvelle fonction et les règles sans redéployer l’ancienne fonction `accessByCode` et ses secrets historiques. Le projet doit permettre Cloud Functions (facturation et permissions nécessaires).
3. Publier le site via la branche principale / GitHub Pages. L’URL configurée est `https://europe-west1-sainteloi26-371e3.cloudfunctions.net/inviteUser` ; son origine autorisée est `https://antonin51400.github.io`.
4. Avec un administrateur réel, inviter une adresse accessible, vérifier la réception, définir le mot de passe et compléter le prénom/nom. Réinviter ce compte doit conserver son rôle. Vérifier qu’un compte Accueil ne peut pas appeler le service d’invitation.
5. Avec deux postes Accueil sur des files différentes et une réservation fictive, enregistrer un paiement par un tiers puis une arrivée : vérifier l’encadré jaune, le nom du payeur, le commentaire, l’heure et la file sur les deux postes. Nettoyer la réservation fictive après le test.

Les tests locaux couvrent les parcours simulés, conflits et contrôles d’autorisation du serveur. Les tests des règles vérifient des expressions et leur structure ; ils ne remplacent pas un test avec le moteur Firebase et de vrais comptes. Aucun déploiement Firebase ni réception d’e-mail n’est confirmé par ces tests.
