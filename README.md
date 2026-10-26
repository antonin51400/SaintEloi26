# Saint Éloi 2026 — réservations, placement et accueil

Site : **https://antonin51400.github.io/SaintEloi26/**

## Connexion simplifiée par code — fonctionnement cible

L'utilisateur voit **un seul champ « Ton code d'accès » et un bouton « Entrer »**. Il ne saisit jamais d'e-mail, ne voit aucun écran Firebase et n'a pas à approuver un appareil. Les données sont partagées par la Realtime Database de Firebase, et le **code confidentiel est vérifié par Firebase Authentication en arrière-plan**.

Les quatre chiffres des anciens codes sont déjà visibles publiquement dans le dépôt GitHub. Ils **ne suffisent donc pas à protéger** les noms, téléphones, plans de table et paiements. En mode réel, chaque code confidentiel contient **12 chiffres** : les 4 chiffres de son profil + 8 chiffres secrets choisis lors de la configuration dans Firebase. N'enregistrez **jamais** les codes secrets dans GitHub.

| Préfixe de code | Profil | Adresse de connexion technique, invisible |
|---|---|---|
| `2002` | Antonin Blanckaert — organisateur | `access2002@sainteloi26-371e3.firebaseapp.com` |
| `9425` | Antonin Bassut — organisateur | `access9425@sainteloi26-371e3.firebaseapp.com` |
| `7890` | Placement | `access7890@sainteloi26-371e3.firebaseapp.com` |
| `6930` | Administrateur | `access6930@sainteloi26-371e3.firebaseapp.com` |
| `1234` | Consultation | `access1234@sainteloi26-371e3.firebaseapp.com` |
| `0722` | Entrée gauche / droite | `access0722@sainteloi26-371e3.firebaseapp.com` |

Les e-mails ci-dessus sont **des noms de comptes techniques**, pas des boîtes de réception. Ils ne sont pas demandés à l'utilisateur. Si vous perdez le code, remplacez son mot de passe depuis la console Firebase.

## Mise en service Firebase, une seule fois par l'organisateur

**État actuel :** configuration Firebase connue (`sainteloi26-371e3`, base `europe-west1`) mais **`config.js` garde `enabled: false`**. En attendant la configuration et la publication des règles, le site reste une démonstration locale : ne saisissez pas de vraies réservations.

### 1. Activer les comptes à mot de passe

Ouvrir **Firebase Console → Authentication → Sign-in method → Adresse e-mail / Mot de passe**, activer **Adresse e-mail / Mot de passe**. Conserver le forfait Spark gratuit. L'authentification anonyme précédemment activée n'est plus utilisée par le site.

### 2. Créer les deux comptes organisateurs (puis les autres au besoin)

Dans **Firebase Console → Authentication → Utilisateurs → Ajouter un utilisateur**, créer chacun des comptes ci-dessus, en commençant par `access2002@...` et `access9425@...`.

Pour chacun : choisir un **mot de passe composé de 12 chiffres**, qui **commence par le préfixe correspondant** (ex. `2002` pour le premier), et se termine par **8 chiffres aléatoires et secrets**. **Ne choisissez jamais l'ancien code à 4 chiffres seul et ne reprenez pas un exemple publié.** Le code complet est celui que l'utilisateur tapera, sans autre identifiant. Ne pas activer une politique Firebase qui exige des lettres ou symboles si vous conservez uniquement des chiffres.

Noter depuis **Authentication → Utilisateurs** le **UID** attribué automatiquement à chaque compte ; ne pas confondre UID et e-mail.

### 3. Autoriser les UID dans Realtime Database

Dans **Realtime Database → Données**, créer pour chaque compte une entrée :

```text
events
  saint-eloi-2026
    members
      UID_DU_PREMIER_COMPTE
        name: Antonin Blanckaert
        role: organizer
      UID_DU_SECOND_COMPTE
        name: Antonin Bassut
        role: organizer
```

Pour les autres rôles : `placement`, `admin`, `view`, `entry`, en respectant le tableau ci-dessus. Si vous avez besoin d'un poste d'entrée, créez son compte dans Authentication et autorisez son UID avec `role: entry`.

**Cette liste blanche côté serveur est essentielle** : même si un tiers crée un compte Firebase avec un e-mail connu, il ne pourra ni lire ni modifier les données sans un UID ajouté par le propriétaire.

### 4. Publier les règles

Ouvrir **Realtime Database → Règles** et remplacer la totalité des règles par le contenu du fichier [database.rules.json](./database.rules.json), puis **Publier**. Les règles exigent à la fois une connexion à un des comptes autorisés et sa présence dans la liste `members`. La base est fermée aux anonymes et aux comptes inconnus. **Ne jamais publier des règles `.read: true` / `.write: true`**.

### 5. Activer le mode réel

Une fois les deux comptes créés, leurs UID inscrits dans `members` et les règles **publiées**, modifier `config.js` : `enabled: false` → `enabled: true`.

Tester depuis deux navigateurs, en utilisant chacun son code privé à 12 chiffres : une réservation créée avec le premier doit apparaître chez le deuxième. Vérifier également qu'un mauvais code est refusé et qu'un navigateur non autorisé ne lit pas les réservations.

**Le site ne peut pas modifier automatiquement la console Firebase tant que cette opération n'est pas réalisée depuis une connexion administrative autorisée.** Ne pas activer la synchronisation en avance.

## Permissions en mode réel

- Organisateurs `2002` et `9425` : créer, accepter, modifier, annuler et placer les réservations ; suivre l'arrivée et les paiements.
- Administrateur `6930` : les mêmes droits étendus.
- Accueil `0722` : choisir la file gauche / droite, marquer arrivé et payé, sans changer les tables.
- Consultation `1234` : lecture seule.
- Placement `7890` : lecture en mode réel pour le moment ; ses écritures sont bloquées dans les règles et dans l'interface, en attendant une implémentation de placement à droits limités sûre.

Chaque réservation conserve le nom du réservant, ses invités, l'organisateur **contacté** et la personne ayant saisi la réservation. Une arrivée marque automatiquement payé ; le paiement anticipé d'un absent est possible. Les 42 sections du plan de salle sont conservées.

## Ancien système d'approbation par e-mail

Le dossier `access-approval/` correspond à une piste **abandonnée / non déployée**, conservée à titre d'historique. Le système principal n'utilise ni Google Apps Script, ni e-mail de validation, ni connexion anonyme.

## Tests

```sh
npm install
npm test
node --check app.js
```

Le projet utilise les SDK Firebase via `<script>` et ne nécessite aucun bundler.
