# Saint Éloi 2026 — réservations, tables et accueil

[Ouvrir le site](https://antonin51400.github.io/SaintEloi26/) · [Firebase Realtime Database](https://console.firebase.google.com/project/sainteloi26-371e3/database)

## Connexion des quatre organisateurs

Le site affiche un seul champ de **code confidentiel à 12 chiffres** et le bouton **Entrer**. Aucun formulaire Firebase n'est visible : le site utilise Firebase Authentication en arrière-plan pour vérifier un code gardé privé (le mot de passe du compte technique correspondant). Les premiers quatre chiffres du code identifient le compte ; les huit derniers sont confidentiels, différents pour chaque utilisateur et ne figurent jamais dans GitHub.

| Profil | Préfixe | Compte Firebase |
|---|---|---|
| Antonin Blanckaert | `2002` | `access2002@sainteloi26-371e3.firebaseapp.com` |
| Antonin Bassut | `9425` | `access9425@sainteloi26-371e3.firebaseapp.com` |
| Théotime Laloua | `3186` | `access3186@sainteloi26-371e3.firebaseapp.com` |
| Robin Maret | `4279` | `access4279@sainteloi26-371e3.firebaseapp.com` |

Tous les quatre ont les droits **organisateur** pour créer/modifier/accepter les réservations, attribuer les places, enregistrer les arrivées et les paiements et exporter. Le champ « organisateur contacté » propose ces quatre noms ; la personne qui effectue effectivement la saisie est enregistrée séparément dans `createdBy`.

## Étape obligatoire dans Firebase pour passer en production

**1.** Les quatre utilisateurs ont été annoncés comme créés dans **Firebase Authentication → Utilisateurs** le 26 octobre 2026. Les règles de sécurité du dépôt intègrent leurs quatre identifiants UID et l'adresse e-mail technique correspondante. Pour Antonin Blanckaert, le fichier utilise l'UID complet communiqué d'abord : `nCNc0JdWznOZ6j4B4GjfvQqWX4K2` (la dernière copie du tableau était tronquée). **Vérifier qu'il correspond bien à la console Firebase avant publication.**

**2.** Dans [Realtime Database → Règles](https://console.firebase.google.com/project/sainteloi26-371e3/database), remplacer intégralement les règles par le contenu de [database.rules.json](./database.rules.json) et cliquer **Publier**. Ces règles sont fermées par défaut et n'autorisent la lecture et l'écriture des réservations **qu'aux quatre couples UID + e-mail exacts** sous Firebase Authentication `password`.

**3.** Après confirmation de la publication et vérification des quatre UID, changer dans [config.js](./config.js) `enabled: false` en `enabled: true`. Tant que c'est `false`, les codes à quatre chiffres n'ouvrent qu'une démonstration en mémoire, effacée à l'actualisation. Ne pas enregistrer de vraies réservations dans la démonstration.

**4.** Faire un test croisé dans deux navigateurs : ouvrir avec un code complet, enregistrer une réservation fictive, voir la même réservation s'afficher avec un autre compte, puis vérifier qu'un mauvais code est rejeté. Tester la validation, le plan et les accès à plusieurs appareils. Les tests GitHub ne remplacent pas cette vérification en conditions réelles.

### Sécurité et autres postes

Les identifiants UID de compte Firebase sont **publics mais ne sont pas des mots de passe**. Les codes complets ne doivent être communiqués qu'aux intéressés et **jamais publiés dans GitHub**. Ne surtout pas utiliser `.read: true` / `.write: true` pour gagner du temps : noms, numéros et états de paiement deviendraient accessibles sur Internet.

Les profils prévus pour le placement (`7890`), l'administration (`6930`), la consultation (`1234`) et l'accueil (`0722`) sont encore présents dans l'interface, mais **ne sont pas autorisés dans les règles de production actuelles**, faute de comptes et UID approuvés. Ils pourront être ajoutés ultérieurement par rôle, avec des règles spécifiques. Les quatre comptes organisateurs sont les seuls accès de production préparés ici.

Le dossier `access-approval/` est un ancien essai d'approbation par e-mail **désormais non utilisé** : aucune installation Google Apps Script n'est nécessaire pour le parcours actuel.

## Données et fonctionnement

Le projet démarre sans réservation importée. Les réservations comportent nom du réservant, invités, téléphone facultatif, personne contactée, statut, date et opérateur créateur. Les tables ont 42 sections. Les placements respectent la capacité et les places occupées ; un arrivé est automatiquement payé et un paiement anticipé reste possible.

## Tests locaux et CI

```sh
npm install
npm test
node --check app.js
```

GitHub Actions exécute les tests de l'interface, de la connexion par code en mode Firebase simulé, et des règles UID + e-mail des quatre organisateurs. Ils ne prouvent pas que les règles ont déjà été déployées dans la console Firebase.
