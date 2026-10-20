# Saint Éloi 2026 — réservations, plan de salle et accueil

Site GitHub Pages : https://antonin51400.github.io/SaintEloi26/

## État actuel (20 octobre 2026)

- **Mode essai accessible par codes**, sans connexion Google et sans Firebase Authentication.
- **Données fictives uniquement** : chaque onglet possède son propre état en mémoire. Fermer / actualiser la page efface les réservations saisies. Il n'existe **pas encore de synchronisation entre appareils**.
- La configuration Web et l'adresse de **Realtime Database europe-west1** du projet `sainteloi26-371e3` sont désormais enregistrées dans `config.js`. La base est encore vide (`null` à la racine dans la console).
- L'activation de la base partagée est volontairement bloquée (`enabled: false` dans `config.js`) pour éviter de publier des noms, numéros de téléphone et états de paiement dans une base ouverte.
- Toutes les réservations démarrent à zéro ; aucun import de l'ancien Bal Savoyard.
- Les 42 sections de tables et les styles visuels conservés du Bal Savoyard sont disponibles.

## Codes et droits (uniquement pour l'interface du mode essai)

Les codes figurent dans `config.js`, publié sur GitHub. Ils sont **publics et non secrets** et ne constituent **pas une protection des données**.

| Code | Profil | Droits dans l'interface |
|------|--------|--------------------------|
| 2002 | Antonin Blanckaert | Réservations, validation, placements, arrivées, paiements, export |
| 9425 | Antonin Bassut | Réservations, validation, placements, arrivées, paiements, export |
| 7890 | Équipe placement | Saisir / valider les réservations et placer les invités |
| 6930 | Administration | Gestion complète et export |
| 1234 | Consultation | Voir la liste et le plan sans modification |
| 0722 | Accueil | Choisir **File Gauche** ou **File Droite**, enregistrer arrivées / paiements, sans pouvoir déplacer les tables |

Le bouton « Essayer avec des données fictives » reste disponible pour les essais avec toutes les fonctions.

## Fonctionnement

1. Saisir le réservant, choisir **l'organisateur qu'il a contacté** (Antonin Blanckaert ou Antonin Bassut) et ajouter les invités. Ce contact est distinct de l'opérateur connecté qui effectue la saisie, reste associé à la réservation lors des modifications et figure dans la recherche ainsi que l'export CSV. Enregistrer puis confirmer la réservation.
2. Les profils de placement peuvent attribuer un groupe à une table et choisir la capacité et les places ; les sièges déjà utilisés sont refusés.
3. À l'accueil, choisir la file droite ou gauche, rechercher la personne et cliquer sur « Arrivée ».
4. **Arrivée = payée** : une arrivée confirme automatiquement le paiement de cette personne. L'annulation de son arrivée ne révoque pas le paiement enregistré.
5. **Paiement anticipé autorisé** : quelqu'un peut payer une place pour une personne encore absente, qui reste « Non arrivée / Payée » jusqu'à son entrée.
6. L'annulation d'une réservation libère les places tout en conservant l'historique du paiement dans la réservation annulée.

Les modifications en base utilisent des transactions pour éviter les placements simultanés incompatibles **lorsqu'un service de données correctement sécurisé sera activé**.

## Pourquoi Firebase n'est pas encore activé

GitHub Pages et `config.js` sont publics : n'importe quel visiteur peut consulter les codes JavaScript, même si le formulaire masque les chiffres. Le contrôle des boutons dans le navigateur est contournable. Sans authentification reconnue par Firebase ou un serveur qui valide les opérations, les règles Realtime Database ne peuvent pas accorder des droits distincts aux codes.

**Il ne faut pas activer des règles Firebase `.read: true` et `.write: true` pour des réservations réelles.** Noms, téléphones et paiements seraient accessibles ou modifiables directement via l'API Firebase, sans passer par ce site.

La configuration Firebase existante conserve la base fermée. Le fichier `firebase.json` n'inclut plus le déploiement des fonctions Cloud payantes pour rester sur Spark. Il reste possible d'ajouter un service d'autorisation côté serveur sur une offre gratuite ou d'utiliser un fournisseur d'identité invisible pour l'utilisateur (aucun compte Google à créer), tout en gardant un formulaire de code unique. Il faut choisir et configurer une de ces voies avant de partager les données réelles.

## Développement / tests

```sh
npm install
npm test
node --check app.js
python -m http.server 8765
```

Ouvrir http://localhost:8765 ; les tests vérifient le départ vide, les placements, le paiement à l'arrivée, le prépaiement et les écrans de rôle. Une vérification sur Firebase réel et entre appareils n'a pas été effectuée.
