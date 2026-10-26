# Saint Éloi 2026 — réservations, plan de table et accueil

**Site :** https://antonin51400.github.io/SaintEloi26/  
**Firebase :** projet `sainteloi26-371e3`, base Realtime Database en `europe-west1`.

## Connexion : e-mail exclusivement

La connexion par code de 4 ou 12 chiffres a été **supprimée**.

La connexion est reprise automatiquement après **F5** dans le même onglet, sans ressaisir le mot de passe. Le profil et les droits sont relus dans Firebase ; un compte suspendu reste bloqué. Pour les postes Accueil, la file choisie est également conservée après F5. **Déconnexion** ferme la session et efface ce choix. La session reste limitée à l’onglet et prend fin à sa fermeture ; aucun mot de passe n’est stocké par le code du site.

L'accueil propose :

- **Se connecter** : adresse e-mail et mot de passe.
- **Première connexion ? Activer mon compte** : saisir uniquement l'adresse e-mail, puis cliquer « Recevoir mon lien par e-mail ». Firebase envoie un **lien de réinitialisation** pour choisir le premier mot de passe. Retourner ensuite à l'accueil pour se connecter.
- **Mot de passe oublié ?** : ouvre le même formulaire e-mail seul.
- **Première connexion réussie** : saisir le prénom et le nom une fois ; ils sont ensuite conservés comme identité de l'opérateur pour les réservations.

Il n'y a **aucun bouton d'inscription publique**. La création libre de comptes a été désactivée dans Firebase Authentication par le propriétaire le 26 octobre 2026.

## E-mail Saint Éloi personnalisé

Le texte et les réglages de l'e-mail de définition/réinitialisation du mot de passe sont prêts dans [**EMAIL_FIREBASE_BRANDING.md**](./EMAIL_FIREBASE_BRANDING.md). Pour les appliquer à tous les e-mails envoyés par Firebase, les copier dans **Authentication → Modèles → Réinitialisation du mot de passe** dans la console Firebase. Un logo ou un e-mail HTML entièrement personnalisé nécessite un service d'envoi distinct ; ce projet utilise actuellement le modèle natif Firebase.

## Ajouter un utilisateur (organisateur uniquement)

Le projet reste sur le forfait **Spark**, sans compte de facturation et sans Cloud Functions. L’invitation se fait en deux étapes :

1. Un administrateur ouvre **Inviter un utilisateur**, puis **Ouvrir Firebase pour créer le compte**. Dans **Authentication → Utilisateurs → Ajouter un utilisateur**, il crée le compte avec une vraie adresse e-mail et un mot de passe provisoire robuste qui n’a pas besoin d’être communiqué.
2. Il revient au site, saisit la même adresse, confirme que le compte existe et clique sur **Envoyer le lien de choix du mot de passe**. Pour un compte existant, seule cette seconde étape est nécessaire.

Le site utilise l’envoi natif Firebase de réinitialisation du mot de passe. Les droits existants et la session de l’administrateur sont conservés. Une réponse positive signifie que la demande est transmise, pas que le compte existe ou que le message est reçu : vérifier la boîte de réception et les spams. La personne choisit son mot de passe puis se connecte au site et renseigne son prénom et son nom.

Voir [DEPLOIEMENT.md](./DEPLOIEMENT.md) pour publier les règles gratuitement. Aucun déploiement de fonction ni activation de Blaze n’est nécessaire.

### Les quatre comptes historiques : adresses techniques

Les anciens comptes avaient des adresses fictives (`access2002@sainteloi26-371e3.firebaseapp.com`, etc.). **Ces adresses ne reçoivent pas d'e-mail**, donc elles ne conviennent pas pour le lien « Première connexion ».

**Méthode la plus simple** : créer dans Firebase Authentication un compte neuf avec une **vraie adresse e-mail personnelle** pour chacune des personnes concernées ; chacune peut utiliser immédiatement « Première connexion » pour définir son mot de passe, saisir son prénom/nom et accéder aux réservations. Les réservations déjà créées ne sont pas effacées : elles restent enregistrées dans Realtime Database. Après un essai réel réussi, les anciens comptes techniques peuvent être désactivés ou supprimés depuis Firebase Authentication.

**Autre possibilité** : changer l'adresse d'un ancien compte existant tout en conservant son UID (par exemple via l'Admin SDK Firebase). Si tu choisis cette méthode, **publie d'abord la version à jour de `database.rules.managed-users.json`** qui autorise les UID historiques même après changement d'adresse.

### Prévisualisation des vues depuis un compte administrateur

Dans la barre d'outils, une liste **« Voir l'interface comme : »** est réservée aux comptes possédant réellement le rôle `admin`. Elle affiche :

- **Administrateur (vue normale)** : toutes les fonctions et tableaux de bord d'administration
- **Inscriptions et réservations** : vue des réservataires
- **Placement des tables** : boutons et plan accessibles aux placeurs
- **Accueil — File 1 / File 2** : liste des invités et même plan de salle que l’administrateur, avec choix de file
- **Consultation** : suivi en lecture seule

En choisissant une autre vue, l'administrateur **ne change pas son accréditation Firebase** : c'est un **aperçu temporaire**. Les boutons de modification sont bloqués pendant l'aperçu et un bandeau visible rappelle ce fonctionnement. Revenir à **Administrateur (vue normale)** restaure immédiatement les fonctionnalités. Le menu reste accessible dans toutes les vues simulées.

Cet aperçu ne remplace pas les tests de sécurité avec de véritables comptes Firebase affectés aux rôles correspondants.

## Capacités et suivi en couleurs

Le plan initial contient 42 tables de six places. L’administrateur peut ajouter ou retirer des tables et régler leur capacité dans l’éditeur du plan. Les réservations et les jauges utilisent la capacité de chaque table. Une capacité absente vaut six ; la connexion administrateur initialise uniquement les capacités manquantes et conserve les valeurs déjà définies.

- **Occupation** : gris pour une table vide, orange lorsqu’il reste des places, rouge lorsqu’elle est complète.
- **Arrivées** : bleu lorsqu’aucun invité n’est arrivé, jaune/orange pour une arrivée partielle et vert lorsque tous les invités de la table sont arrivés.

Le même plan est affiché dans toutes les vues et actualisé en temps réel. Les nouvelles règles de base doivent être publiées manuellement avant la mise en service de l’éditeur.

## Accréditations et tableaux de bord (mise à jour du 26 octobre 2026)

Cinq vues sont prévues : **Administrateur**, **Inscriptions et réservations**, **Placement**, **Accueil**, **Consultation**. Un rôle `disabled` suspend la lecture des réservations.

- **Administrateur :** toutes les réservations, plan, pointage, export, suivi privé des personnes attendues/arrivées/payées/non placées et accès à « Gestion des utilisateurs ».
- **Inscriptions :** saisie, acceptation et modification de réservations, sans droit de pointage ni de placement.
- **Commande « Placer » :** affichée et utilisable **uniquement** pour le rôle `placement` et les administrateurs. Un compte Inscriptions, Accueil ou Consultation ne peut ni placer ni déplacer un invité. **Les tables ont six places par défaut ; seul un administrateur peut changer leur capacité dans « Modifier le plan de table ».**
- **Placement :** attribution d'une place à un invité à la fois parmi les places disponibles selon la capacité définie par l’administrateur. **Le contrôle atomique de l'unicité entre plusieurs placeurs n'est pas encore garanti côté serveur** ; éviter plusieurs sessions de placement simultanées avant finalisation.
- **Accueil :** pointage des invités, en choisissant au préalable **File 1 ou File 2** ; le même plan de salle que la vue Administrateur est affiché, avec la scène, les tables, les couleurs et les jauges d’arrivée.
- **Consultation :** suivi et plan en lecture seule, sans modification.

Les comptes créés dans Firebase Authentication sont authentifiés par e-mail. À la première connexion, leur profil prénom et nom est enregistré, puis un rôle `reservations` est créé pour leur UID si aucun autre rôle n'a été préattribué par un administrateur. Les rôles peuvent être changés depuis « Gestion des utilisateurs » avec le **UID** du compte.

**Inviter un utilisateur** guide la création manuelle dans Firebase Authentication, puis demande l’e-mail de choix du mot de passe. Ce parcours fonctionne sans Cloud Functions sur Spark.

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

## Suivi d’accueil et paiements par un tiers

Chaque arrivée enregistre `arrivedAt`, `arrivedBy` et `arrivalLane` (`left` = File 1, `right` = File 2). Le poste Accueil utilise la file choisie ; l’administrateur choisit une file à chaque pointage. Les anciennes arrivées sans file restent affichées comme « file non renseignée ». L’heure est affichée dans le fuseau Europe/Paris.

Sur un invité confirmé, **Payé par un tiers / commentaire** permet de saisir le nom du payeur et un commentaire. L’enregistrement marque l’invité payé, conserve l’heure de son paiement initial et horodate le commentaire et son opérateur (`paidForBy`, `paymentComment`, `paymentRecordedAt`, `paymentRecordedBy`). Un encadré jaune « À signaler : payé par… » apparaît dans la liste, le tableau administrateur et le détail de table. Ces champs sont aussi exportés en CSV. L’arrivée conserve ces informations. Une correction du commentaire met à jour son horodatage ; ceci n’est pas un historique complet des modifications.

L’accueil public affiche un décompte vers le **5 décembre 2026 à 20 h, heure de Paris** (19 h UTC). Après cette date, il indique que la soirée a commencé.

## Plan commun à toutes les vues

Administrateur, Inscriptions, Placement, Accueil (File 1 et File 2) et Consultation utilisent le même plan de salle et la même disposition responsive. L’ancien panneau Accueil composé de cartes distinctes est masqué. Le visuel et les données des tables sont communs ; les actions restent limitées aux droits du rôle : seuls Administrateur et Placement peuvent placer ou déplacer les invités.

## Éditeur du plan et capacités (administrateur uniquement)

Le bouton **Modifier le plan de table** ouvre un brouillon : choix de 1 à 30 lignes, de 0 à 12 tables par côté et par ligne, puis ajustement ligne par ligne. La scène reste en haut et l’allée au centre. Une table se déplace vers une case libre par deux clics (compatible téléphone), ou par glisser-déposer ; un dépôt sur une table échange leurs emplacements. Une case « + » ajoute une table. Le plan est limité à 200 tables.

Sélectionner une table permet de la renommer, de la retirer ou de régler sa capacité de **1 à 50 personnes**, avec **6 par défaut** pour les nouvelles tables. Une table occupée ne peut pas être supprimée ; une capacité ne peut pas être réduite sous un numéro de siège déjà utilisé. Déplacer une table conserve son identifiant et ses invités. Enregistrer partage le plan et les capacités entre toutes les vues. Annuler abandonne le brouillon. Si un autre administrateur modifie le plan entre-temps, l’enregistrement est refusé pour éviter de l’écraser.

Les installations sans plan personnalisé conservent le plan initial et ses identifiants. Les nouvelles règles `database.rules.managed-users.json` doivent être publiées dans Realtime Database avant la mise en service du nouvel éditeur. Elles réservent le plan et les capacités aux administrateurs et valident les sièges par rapport à la capacité enregistrée. Le contrôle serveur de l’unicité d’un siège entre plusieurs placeurs reste la limitation existante ; éviter des placements simultanés sur la même place.
