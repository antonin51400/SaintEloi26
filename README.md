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

### Prévisualisation des vues depuis un compte administrateur

Dans la barre d'outils, une liste **« Voir l'interface comme : »** est réservée aux comptes possédant réellement le rôle `admin`. Elle affiche :

- **Administrateur (vue normale)** : toutes les fonctions et tableaux de bord d'administration
- **Inscriptions et réservations** : vue des réservataires
- **Placement des tables** : boutons et plan accessibles aux placeurs
- **Accueil — File 1 / File 2** : vue plein écran des invités avec choix de file
- **Consultation** : suivi en lecture seule

En choisissant une autre vue, l'administrateur **ne change pas son accréditation Firebase** : c'est un **aperçu temporaire**. Les boutons de modification sont bloqués pendant l'aperçu et un bandeau visible rappelle ce fonctionnement. Revenir à **Administrateur (vue normale)** restaure immédiatement les fonctionnalités. Le menu reste accessible dans toutes les vues simulées.

Cet aperçu ne remplace pas les tests de sécurité avec de véritables comptes Firebase affectés aux rôles correspondants.

## Tables fixes de six personnes et suivi en couleurs

La salle contient **42 tables de six places**, soit **252 places au total** si toutes sont utilisées. Cette capacité est fixe dans l'application : il n'y a plus de champ pour définir des capacités variables. Les nouvelles réservations ne peuvent pas être placées sur une septième place, et le placement refuse les groupes qui dépassent les places disponibles.

Dès qu'un administrateur se connecte avec une synchronisation active, le site essaie d'enregistrer `capacity: 6` pour les 42 tables dans Realtime Database. Il préserve les réservations et ne lance pas la mise à jour si des invités occupent déjà des numéros de places supérieurs à six : ces cas doivent être corrigés avant migration. Les capacités historiques stockées sont ignorées par le calcul d'affichage qui utilise toujours six.

**Deux légendes distinctes, affichées sur toutes les vues :**

- **Occupation** — gris : table vide (0/6) ; orange : partiellement occupée (1 à 5/6) ; rouge : complète (6/6). Une table en surcapacité est signalée.
- **Arrivées** — bleu : aucun invité de cette table n'est arrivé ; jaune/orange : seulement une partie des invités est arrivée ; vert : tous les invités placés à cette table sont arrivés. Une table vide indique « Aucun invité ».
- Dans la vue **Accueil**, six pastilles par table représentent les places : **gris pour une place libre**, **bleu pour un invité attendu**, **vert pour un invité arrivé**. Les nombres d'arrivées et de places restantes sont affichés sans devoir interpréter uniquement les couleurs.

Le panneau de droite de l'Accueil et le plan sont rafraîchis par les données Firebase en temps réel.

La dernière version de [`database.rules.managed-users.json`](./database.rules.managed-users.json) autorise les nouvelles capacités à **six uniquement**, et empêche l'attribution d'une nouvelle place supérieure à six ; elle préserve temporairement les anciens enregistrements inchangés. **Ces règles nécessitent une nouvelle publication manuelle dans Firebase Console** après validation. Un déploiement GitHub Pages ne déploie pas automatiquement les règles.

## Accréditations et tableaux de bord (mise à jour du 26 octobre 2026)

Cinq vues sont prévues : **Administrateur**, **Inscriptions et réservations**, **Placement**, **Accueil**, **Consultation**. Un rôle `disabled` suspend la lecture des réservations.

- **Administrateur :** toutes les réservations, plan, pointage, export, suivi privé des personnes attendues/arrivées/payées/non placées et accès à « Gestion des utilisateurs ».
- **Inscriptions :** saisie, acceptation et modification de réservations, sans droit de pointage ni de placement.
- **Commande « Placer » :** affichée et utilisable **uniquement** pour le rôle `placement` et les administrateurs. Un compte Inscriptions, Accueil ou Consultation ne peut ni placer ni déplacer un invité. **Toutes les tables ont désormais une capacité fixe de six places**, sans réglage manuel.
- **Placement :** attribution d'une place à un invité à la fois parmi six places fixes par table. **Le contrôle atomique de l'unicité entre plusieurs placeurs n'est pas encore garanti côté serveur** ; éviter plusieurs sessions de placement simultanées avant finalisation.
- **Accueil :** pointage des invités, en choisissant au préalable **File 1 ou File 2** ; à droite, un panneau donne le taux d'occupation et les arrivées de chacune des 42 tables, sans afficher le plan complet.
- **Consultation :** suivi et plan en lecture seule, sans modification.

Les comptes créés dans Firebase Authentication sont authentifiés par e-mail. À la première connexion, leur profil prénom et nom est enregistré, puis un rôle `reservations` est créé pour leur UID si aucun autre rôle n'a été préattribué par un administrateur. Les rôles peuvent être changés depuis « Gestion des utilisateurs » avec le **UID** du compte.

**La création directe des comptes Firebase n'est pas incluse dans le navigateur** : le bouton ouvre **Firebase Authentication → Utilisateurs**, où un administrateur crée le compte. Le site peut ensuite demander l'envoi du lien Firebase de définition du mot de passe.

**Publication obligatoire :** les règles dans [`database.rules.managed-users.json`](./database.rules.managed-users.json) ont été renforcées pour les cinq rôles **après la dernière publication confirmée par l'organisateur**. Elles ne sont pas automatiquement publiées dans Firebase par un commit GitHub. Tester la syntaxe et les autorisations dans **Realtime Database → Règles**, puis publier cette version actualisée avant d'utiliser les profils Accueil, Placement, Consultation ou Gestion des utilisateurs sur le site réel. Les tests GitHub sont des tests statiques et de simulation JavaScript, pas une simulation complète du moteur de règles Firebase.

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
