# Saint Éloi 2026 — réservations et accueil

**Site :** https://antonin51400.github.io/SaintEloi26/  
**Projet Firebase :** `sainteloi26-371e3` — Realtime Database `europe-west1`, forfait Spark gratuit.  
**Base dédiée :** `events/saint-eloi-2026` (aucune donnée importée du Bal Savoyard).

## Nouveau : approbation des appareils par e-mail

Le formulaire peut désormais recueillir le **nom du demandeur et son code**, puis déposer une demande Firebase. Le rôle souhaité correspond au code choisi ; **seul le responsable peut accorder le rôle effectif**. Le système de notification gratuit (Google Apps Script, envoi par MailApp toutes les 5 minutes) et le lien **Autoriser / Refuser** sont préparés dans :

- [Code du service e-mail et approbation](./access-approval/Code.gs)
- [Instructions de configuration du service](./access-approval/README.md)

**Ce service n'est pas encore déployé : aucun e-mail automatique n'est envoyé pour le moment.** Il faut installer les règles Realtime Database, renseigner les propriétés privées du script (notamment l'adresse e-mail de l'approbateur), déployer l'Apps Script, puis activer le mode réel dans `config.js`. Ne jamais mettre de clé privée dans GitHub ou dans une conversation.

## État de déploiement

1. Configuration Web Firebase et adresse Realtime Database renseignées dans `config.js`.
2. La méthode **Firebase Authentication anonyme** a été activée par le propriétaire du projet dans la console.
3. Le site comporte désormais un bouton **Identifier cet appareil avec Firebase** : il génère et affiche son UID anonyme, persistant dans le navigateur.
4. Les règles de contrôle des accès sont préparées dans `database.rules.json`, mais **leur publication dans la console Firebase reste à faire**.
5. `config.js` garde **`enabled: false`** : les saisies par codes et la démonstration fonctionnent localement uniquement ; aucune réservation réelle n'est sauvegardée ni synchronisée.
6. Une fois les règles publiées et les appareils approuvés, modifier `enabled` à `true`, puis tester sur deux appareils. Ne pas activer prématurément.

### Installation sécurisée : mode gratuit Spark

**Étape A — Règles (propriétaire Firebase seulement)**

1. Ouvrir Firebase Console > projet `sainteloi26-371e3` > Realtime Database > onglet **Règles**.
2. Copier **tout** le contenu de `database.rules.json` dans le dépôt GitHub et le coller dans l'éditeur de règles de cette base **seulement**.
3. Vérifier que les règles racine sont `.read:false` et `.write:false`, puis cliquer **Publier**.
4. Les règles refusent les lectures aux appareils inconnus ; aucun utilisateur ne peut modifier sa propre autorisation `members`.

**Étape B — Identifier chaque appareil**

1. Sur l'appareil choisi, ouvrir la page GitHub Pages et cliquer **Identifier cet appareil avec Firebase**.
2. Copier l'UID affiché. Cet UID est l'identifiant du compte anonyme Firebase de **ce navigateur**. Il peut changer si les données du site sont effacées.
3. Depuis la console **Données** de cette base, ajouter manuellement `events/saint-eloi-2026/members/<UID>/name` et `.../role` suivant le tableau ci-dessous. Ne jamais permettre l'écriture publique de `members`.
4. Répéter pour chaque navigateur autorisé. Utiliser son profil autorisé ; le code ne constitue qu'un choix d'interface et ne peut pas transformer un simple visiteur en organisateur.

| Code visible | Champ name dans members | Champ role |
|---|---|---|
| 2002 | Antonin Blanckaert | organizer |
| 9425 | Antonin Bassut | organizer |
| 7890 | Placement des invités | placement |
| 6930 | Administration | admin |
| 1234 | Consultation du plan | view |
| 0722 | Accueil des entrées | entry |

Exemple d'une entrée : `members/UID_REEL = {"name":"Antonin Blanckaert","role":"organizer"}`.

**Étape C — Activation après approbation**

Mettre `enabled:true` dans `config.js` seulement lorsque les règles **sont publiées**, et au moins un UID organisateur est ajouté. Vérifier une vraie réservation, l'affichage sur deux appareils autorisés, et le refus de lecture depuis un appareil inconnu.

**Étape D — Accès et limitations de cette première étape**

- Les profils `organizer` et `admin` ont un accès en lecture/écriture à l'ensemble des données. Le site utilise des transactions afin de préserver l'intégrité des places lorsque ces deux profils placent les invités simultanément.
- Le profil `entry` peut uniquement modifier les statuts individuels arrivé/payé au niveau d'un invité accepté. Arrivée confirme automatiquement le paiement ; un paiement avant arrivée reste possible.
- Le profil `view` peut lire la liste et le plan mais pas écrire.
- Le profil `placement` est préparé comme appareil autorisé en lecture, mais **ses opérations de création/placement partagé sont temporairement désactivées** tant qu'une méthode de transaction sécurisée multi-réservations n'a pas été finalisée. Elles restent testables localement en mode démonstration.
- Les codes JavaScript dans `config.js` sont publics. **La seule autorisation fiable est celle de l'UID anonyme dans les règles serveur Firebase**. Ne jamais utiliser des règles publiques pour compenser une erreur d'accès.
- Déconnexion de l'interface n'efface pas l'identité anonyme ; cela évite de devoir réautoriser le même navigateur à chaque accès.
- Les règles affichées dans GitHub ne sont pas automatiquement déployées dans Firebase. `firebase.json` n'active aucune fonction payante.

## Fonctionnement de l'événement

Les réservations commencent à zéro. Chaque réservation comporte la personne réservante, ses invités et **l'organisateur contacté** (distinct de la personne qui effectue la saisie). Accepter les réservations, attribuer tables et places, vérifier les capacités, puis suivre les deux files (gauche et droite), les arrivées et les paiements. Le plan contient les 42 sections issues du Bal Savoyard.

**Arrivée = payée**, y compris si l'invité ne l'était pas avant d'entrer. Un paiement avant arrivée est permis. Les paiements restent conservés si l'arrivée est annulée.

## Développement

```sh
npm install
npm test
node --check app.js
python -m http.server 8765
```

Les tests sont locaux. Vérification finale de Firebase en conditions réelles à effectuer après déploiement des règles et association des UID.
