# Mise en service gratuite — forfait Firebase Spark

Le site utilise GitHub Pages, Firebase Authentication par e-mail/mot de passe et la base Realtime Database existante. Conserver **Spark**, sans ajouter de compte de facturation ni activer Blaze. Aucune Cloud Function n’est nécessaire au site. Le dossier `functions/` contient uniquement un ancien prototype de connexion par code, inutilisé par le site actuel : ne pas le déployer.

## Publier les règles dans la console Firebase

1. Ouvrir le projet `sainteloi26-371e3` dans Firebase.
2. Aller dans **Realtime Database → Règles**.
3. Copier tout le contenu du fichier `database.rules.managed-users.json` de la branche principale GitHub dans l’éditeur des règles.
4. Publier les règles. Ne pas remplacer les règles par un accès public.

Les champs d’arrivée, de file et de commentaire de paiement seront créés automatiquement lors de leur enregistrement sur le site. Il n’y a pas de colonne à ajouter manuellement dans la base. Le décompte ne demande aucun réglage Firebase.

## Inviter un utilisateur gratuitement

1. Dans le site, ouvrir **Inviter un utilisateur**, puis **Ouvrir Firebase pour créer le compte**.
2. Dans **Authentication → Utilisateurs → Ajouter un utilisateur**, créer le compte avec sa vraie adresse e-mail et un mot de passe provisoire robuste. Inutile de communiquer ce mot de passe.
3. Revenir au site, saisir exactement la même adresse, cocher la confirmation que le compte existe et envoyer le lien de choix du mot de passe.
4. Vérifier sa réception, y compris les spams. La personne choisit son mot de passe puis revient se connecter au site et renseigner son prénom/nom.

Pour un compte déjà créé, passer directement à l’étape 3. Conserver la création libre de comptes désactivée ; la création manuelle dans la console est le parcours prévu. L’envoi Firebase peut accepter une demande sans confirmer publiquement l’existence du compte : le message du site ne garantit pas la délivrance de l’e-mail.

## Vérifications

Avec une réservation fictive, enregistrer un paiement par un tiers puis une arrivée depuis un poste Accueil. Vérifier sur un deuxième poste le payeur, le commentaire, l’heure et la file, puis nettoyer les données fictives. Tester aussi la réception du lien avec une vraie adresse.

Spark impose des quotas gratuits pour la base, les connexions simultanées et les e-mails. Le site ne nécessite pas de facturation ; un dépassement de quota peut limiter le service. Consulter les limites du projet avant l’événement : https://firebase.google.com/pricing et https://firebase.google.com/docs/auth/limits.

Les tests locaux simulent les parcours et contrôlent les expressions des règles ; ils ne remplacent pas les essais avec le moteur Firebase et de vrais comptes. Aucun déploiement Firebase ni réception d’e-mail n’est confirmé par les tests automatiques.
