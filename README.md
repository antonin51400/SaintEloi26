# Saint Éloi 2026 — réservations, plan de table et accueil

**Site :** https://antonin51400.github.io/SaintEloi26/  
**Firebase :** projet `sainteloi26-371e3`, base Realtime Database en `europe-west1`.

## Connexion : e-mail exclusivement

La connexion par code de 4 ou 12 chiffres a été **supprimée**.

L'accueil propose :

- **Se connecter** : adresse e-mail et mot de passe.
- **Première connexion ? Activer mon compte** : saisir uniquement l'adresse e-mail, puis cliquer « Recevoir mon lien par e-mail ». Firebase envoie un **lien de réinitialisation** pour choisir le premier mot de passe. Retourner ensuite à l'accueil pour se connecter.
- **Mot de passe oublié ?** : ouvre le même formulaire e-mail seul.
- **Première connexion réussie** : saisir le prénom et le nom une fois ; ils sont ensuite conservés comme identité de l'opérateur pour les réservations.

Il n'y a **aucun bouton d'inscription publique**. La création libre de comptes a été désactivée dans Firebase Authentication par le propriétaire le 26 octobre 2026.

## E-mail Saint Éloi personnalisé

Le texte et les réglages de l'e-mail de définition/réinitialisation du mot de passe sont prêts dans [**EMAIL_FIREBASE_BRANDING.md**](./EMAIL_FIREBASE_BRANDING.md). Pour les appliquer à tous les e-mails envoyés par Firebase, les copier dans **Authentication → Modèles → Réinitialisation du mot de passe** dans la console Firebase. Un logo ou un e-mail HTML entièrement personnalisé nécessite un service d'envoi distinct ; ce projet utilise actuellement le modèle natif Firebase.

## Ajouter un utilisateur (organisateur uniquement)

1. Dans [Firebase Authentication → Utilisateurs](https://console.firebase.google.com/project/sainteloi26-371e3/authentication/users), créer un compte avec **l'adresse e-mail réelle et accessible** de la personne et un **mot de passe provisoire robuste**. Le mot de passe provisoire n'a pas besoin d'être communiqué.
2. Sur le site, le propriétaire de l'UID `nCNc0JdWznOZ6j4B4GjfvQqWX4K2` peut aussi ouvrir **Inviter un utilisateur**, saisir l'e-mail du compte déjà créé, et envoyer son lien de définition du mot de passe.
3. Autrement, la personne clique elle-même sur **Première connexion ? Activer mon compte**, saisit son e-mail, puis ouvre le lien reçu.
4. Elle choisit son mot de passe via Firebase, revient sur le site, se connecte et enregistre **prénom + nom**. Cela ouvre l'accès aux réservations.
5. À la prochaine connexion, le prénom/nom est retrouvé automatiquement et n'est plus demandé.

**Important :** le site n'envoie pas un e-mail de création d'un compte inexistant. L'utilisateur doit déjà avoir été créé **dans la console Firebase**, et l'adresse doit être une vraie boîte de réception. Selon les paramètres de protection contre l'énumération, Firebase peut accepter la demande sans confirmer publiquement l'existence du compte.

### Les quatre comptes historiques : adresses techniques

Les anciens comptes avaient des adresses fictives (`access2002@sainteloi26-371e3.firebaseapp.com`, etc.). **Ces adresses ne reçoivent pas d'e-mail**, donc elles ne conviennent pas pour le lien « Première connexion ».

**Méthode la plus simple** : créer dans Firebase Authentication un compte neuf avec une **vraie adresse e-mail personnelle** pour chacune des personnes concernées ; chacune peut utiliser immédiatement « Première connexion » pour définir son mot de passe, saisir son prénom/nom et accéder aux réservations. Les réservations déjà créées ne sont pas effacées : elles restent enregistrées dans Realtime Database. Après un essai réel réussi, les anciens comptes techniques peuvent être désactivés ou supprimés depuis Firebase Authentication.

**Autre possibilité** : changer l'adresse d'un ancien compte existant tout en conservant son UID (par exemple via l'Admin SDK Firebase). Si tu choisis cette méthode, **publie d'abord la version à jour de `database.rules.managed-users.json`** qui autorise les UID historiques même après changement d'adresse.

## Sécurité et règles Realtime Database

Le propriétaire a confirmé la désactivation de la création libre de comptes et la publication de la version initiale des règles avec profils.

Le fichier [`database.rules.managed-users.json`](./database.rules.managed-users.json) a été mis à jour lors du passage à l'e-mail seul : il reconnaît les **quatre anciens UID indépendamment de leurs anciennes adresses techniques**. Il faut **publier cette version actualisée dans Firebase Realtime Database → Règles avant de changer les e-mails des quatre comptes**.

[`firebase.json`](./firebase.json) pointe vers ce fichier de règles pour les futurs déploiements.

Règles principales : refus par défaut au niveau racine ; lecture et écriture des réservations seulement par un compte e-mail/mot de passe déjà créé dans Firebase et disposant soit d'un ancien UID autorisé, soit de son propre profil nominatif sous `events/saint-eloi-2026/profiles/{UID}`. Le profil ne peut être créé que par le compte connecté avec ce même UID et une seule fois. **Les nouvelles personnes disposent des droits de gestion des réservations** : ne créer que des utilisateurs auxquels on souhaite donner cet accès. Les règles conservées dans `database.rules.json` sont les anciennes règles de référence.

**Ne jamais remplacer les règles par `.read: true` / `.write: true`**. Ne jamais exposer de mot de passe, clé privée ou compte de service dans GitHub.

## Vérifications et tests

```sh
npm install
npm test
node --check app.js
```

Les tests GitHub simulent l'interface et Firebase Authentication, mais **ne prouvent pas la délivrabilité d'un e-mail ni la bonne publication de règles en production**. Faire un test réel : créer un utilisateur avec une adresse accessible, demander le lien depuis **Première connexion**, choisir le mot de passe, compléter prénom et nom, créer une réservation fictive et vérifier sa présence avec un deuxième compte. Après le test, supprimer la réservation fictive.

Le mode démonstration est encore accessible dans les options discrètes, sans synchronisation ni sauvegarde.
