# Validation des accès par e-mail — Saint Éloi 2026

Ce composant utilise **Firebase Realtime Database + Authentication anonyme** pour demander l'accès, et **Google Apps Script + MailApp** pour notifier le responsable et lui permettre d'accepter/refuser depuis un e-mail. Aucun déploiement Cloud Functions ni forfait Blaze n'est nécessaire.

## Comment ça fonctionne

1. Le demandeur saisit **son vrai nom** et le **code à quatre chiffres** dans Saint Éloi 2026.
2. Son navigateur se connecte anonymement à Firebase et écrit une demande **en attente** dans `events/saint-eloi-2026/accessRequests/<UID>`, sans enregistrer le code lui-même.
3. Toutes les 5 minutes, un Google Apps Script privé vérifie les nouvelles demandes et **envoie un e-mail au responsable**.
4. Le responsable clique sur le lien de l'e-mail, vérifie le nom et le rôle demandé, puis choisit **Autoriser** ou **Refuser**. Le lien est signé et utilisable une seule fois.
5. En cas d'acceptation, **le script**, avec un compte de service Firebase privé, écrit `events/saint-eloi-2026/members/<UID>` avec le rôle demandé.
6. La connexion en attente détecte l'autorisation et ouvre les données partagées. En cas de refus, aucun droit n'est ajouté.
7. Les données restent **inaccessibles aux UID inconnus**. Les codes de l'interface ne constituent pas des secrets : ils sont visibles dans le dépôt public ; **la validation humaine est la véritable barrière de sécurité**.

Rôles demandés : 2002 = Antonin Blanckaert / organizer ; 9425 = Antonin Bassut / organizer ; 7890 = placement ; 6930 = admin ; 1234 = view ; 0722 = entry.

**Limite temporaire :** le rôle `placement` est autorisé à consulter les réservations approuvées, mais ses modifications partagées sont encore désactivées dans le site pour éviter de contourner la sécurité et les règles de placement. L'accueil (`entry`) peut modifier arrivée/paiement.

## À réaliser une seule fois

### 1. Installer les règles Firebase

Ouvrir [Realtime Database](https://console.firebase.google.com/project/sainteloi26-371e3/database), onglet **Règles**. Copier intégralement le contenu de [`database.rules.json`](https://github.com/antonin51400/SaintEloi26/blob/main/database.rules.json), coller dans l'éditeur Firebase et cliquer sur **Publier**.

Ces règles laissent les utilisateurs anonymes créer uniquement leur demande personnelle et lire son statut. Elles n'autorisent **aucun accès public** aux réservations ou à la liste des autorisations.

### 2. Créer un Google Apps Script privé

- Ouvrir https://script.google.com/ et **Nouveau projet**, par exemple `SaintEloi26-Validation`.
- Supprimer le code d'exemple et copier tout le contenu de [`Code.gs`](./Code.gs).
- Dans **Paramètres du projet > Propriétés du script**, créer :
  - `ADMIN_EMAIL` : **votre adresse e-mail** recevant les demandes.
  - `SERVICE_ACCOUNT_JSON` : **tout le JSON d'une clé privée de compte de service Firebase**, en un seul champ. Créer une clé dédiée depuis **Firebase Console > Paramètres du projet > Comptes de service > Générer une clé privée**.
  - `WEB_APP_URL` : à renseigner après le déploiement ci-dessous.
- **Ne jamais envoyer cette clé privée par e-mail, dans ChatGPT, ni la publier sur GitHub.** Le code Apps Script peut être public, mais votre projet Apps Script et ses propriétés doivent rester privés.

### 3. Déployer la page de validation

Dans Apps Script : **Déployer > Nouveau déploiement > Application Web**. Choisir **Exécuter en tant que moi** et autoriser l'accès **Tout le monde**. Copier l'URL terminant par `/exec`, puis enregistrer dans `WEB_APP_URL` (Propriétés du script).

L'URL publique seule ne donne aucun droit : la page exige une signature HMAC incluse seulement dans le lien d'e-mail. Ne partagez pas les liens d'approbation.

### 4. Autoriser les e-mails et le déclencheur

Dans l'éditeur Apps Script, sélectionner la fonction `installApprovalNotifications`, cliquer **Exécuter**, puis accorder les autorisations Google demandées (envoi de mails, appels HTTPS, gestion des déclencheurs). Cette fonction installe une vérification **toutes les 5 minutes** et lance un premier contrôle.

L'e-mail est envoyé par votre compte Google, via `MailApp`, avec des quotas gratuits et une limite supplémentaire dans notre script de **30 notifications par jour**. Aucun e-mail n'est garanti instantanément.

### 5. Activer le site après vérification des règles

Une fois les règles **publiées**, les propriétés définies et la fonction Apps Script installée, modifier `enabled: false` en `enabled: true` dans [`config.js`](https://github.com/antonin51400/SaintEloi26/blob/main/config.js) puis tester avec un compte anonyme et un **nom fictif** d'abord.

Attention : la première demande du propriétaire doit aussi être **approuvée par lui-même dans l'e-mail**, ou autorisée manuellement depuis Firebase pour initialiser le système. L'approbation par Apps Script ne dépend pas d'un compte déjà approuvé.

### 6. Tester la sécurité et la synchronisation

- Faire une demande avec le code `2002` : avant approbation, aucune réservation accessible.
- Vérifier la réception de l'e-mail (jusqu'à 5 minutes en fonctionnement normal).
- Ouvrir le lien, contrôler le nom et le rôle, cliquer **Autoriser**.
- Vérifier que le site ouvre la liste partagée seulement après validation.
- Demander un accès depuis un second appareil et cliquer **Refuser** : les réservations doivent rester interdites à cet appareil.
- Vérifier les arrivées/paiements séparément sur deux appareils autorisés avant toute donnée réelle.

## En cas de problème

- Aucun e-mail : consulter **Exécutions** et **Déclencheurs** d'Apps Script, puis les propriétés `ADMIN_EMAIL`, `SERVICE_ACCOUNT_JSON` et `WEB_APP_URL`.
- Erreur de compte de service : contrôler les clés privées et les autorisations du compte sur le projet `sainteloi26-371e3`.
- Erreur de permission sur le site : s'assurer que les règles **accessRequests** et **members** sont publiées dans Firebase.
- Une demande refusée ne peut pas être créée de nouveau depuis le même UID sans intervention de l'administrateur ; supprimer la demande correspondante dans la console Firebase si une seconde chance est nécessaire.
- Supprimer les données du site ou utiliser la navigation privée peut produire un nouvel UID : **une nouvelle approbation est nécessaire**.
- Pour révoquer une personne déjà autorisée, supprimer son entrée `members/<UID>` dans la console Firebase.

**Sécurité :** ne pas remplacer les règles par `read: true` ou `write: true`. Les noms, téléphones et informations de paiement doivent rester protégés par les règles Firebase, indépendamment des contrôles de l'interface.
