# Saint-Éloi 2026 — droits cumulables et vues isolées

> Évolution proposée le 27 octobre 2026. Elle remplace le fonctionnement d’« aperçu en lecture seule » décrit dans les sections historiques du README.

## Principe

Une personne peut disposer simultanément de plusieurs accréditations. Le menu **Espace actif** ne présente que les vues attribuées à la personne. **Changer de vue change l’ensemble des fonctions affichées et utilisables.** Les droits ne sont jamais additionnés sur le même écran. Toute modification autorisée est enregistrée dans Firebase.

| Espace actif | Affichage | Écriture autorisée |
| --- | --- | --- |
| Administrateur | Vue globale, gestion des utilisateurs, plan, réservations, arrivées et paiements | Toutes les fonctions |
| Réservations | Réservations, réservants et participants, statuts des dossiers | Créer, corriger, accepter et annuler des réservations |
| Placement | Invités acceptés, tables, places occupées ou libres | Placer et déplacer un invité. **Aucun montant/statut de paiement ni outil d’accueil à l’écran** |
| Entrées | Invités attendus, file 1 ou 2, arrivées et paiements, suivi de l’occupation des tables | Pointer une arrivée, enregistrer le paiement ou le commentaire d’un tiers. **Aucun outil de placement** |
| Consultation | Données en lecture seule | Aucune modification |

Avec **Réservations + Placement + Entrées**, trois vues sont proposées et chacun de ces espaces demeure indépendant. L’administrateur accède à tous ces espaces et peut agir dans les vues opérationnelles exactement selon les fonctions de ces vues.

## Attribution ou invitation

1. Dans Firebase Authentication, créer le compte avec une vraie adresse e-mail. Copier son **UID**.
2. Dans **Gestion des utilisateurs**, saisir l’UID et l’e-mail, puis cocher une ou plusieurs accréditations. **Administrateur** inclut tous les accès et se sélectionne seul.
3. Enregistrer. La mise à jour d’accréditations est relue en direct par les utilisateurs connectés.
4. Le dialogue **Inviter un utilisateur** enregistre les accréditations avant de demander le lien de choix du mot de passe. Vérifier que l’e-mail est réellement reçu.

Les anciens comptes disposant du champ `role` seul restent compatibles. Les nouveaux utilisent en complément `roles: { placement: true, entry: true }`, par exemple.

## Publication Firebase indispensable

Le fichier de règles effectivement ciblé par `firebase.json` est **`database.rules.managed-users.json`**. Il doit être publié dans la **Realtime Database** du projet `sainteloi26-371e3` après vérification. Un commit GitHub ou la publication GitHub Pages ne déploie pas automatiquement ces règles. Ne pas publier à la place `database.rules.json`, fichier historique distinct.

Avant publication, simuler au minimum dans Firebase Emulator Suite : réservations seules, placement seul, entrées seules, réservations + placement, placement + entrées, administrateur et suspension. Vérifier également les validations de plan et les champs de paiement.

## Critères de vérification

- Une personne avec deux accès voit deux choix dans le menu et peut modifier les données uniquement dans la vue active.
- Le statut **Payé / Non payé** est absent des fiches, du résumé et des détails des tables en mode **Placement**.
- La vue **Entrées** n’affiche aucun bouton « Placer », n’ouvre pas l’éditeur de disposition des tables et conserve le suivi de l’occupation par table.
- L’administrateur peut basculer entre toutes les vues et utiliser leurs actions, au lieu d’un aperçu bloqué.
- Une personne sans compte autorisé et une personne suspendue sont refusées.
- Les mises à jour d’arrivées et de placements sont synchronisées sur les appareils autorisés.

**Précision importante :** cette évolution isole les fonctions et les informations **dans l’interface**. Les comptes autorisés continuent de lire le document complet des réservations dans Firebase. Si la confidentialité du paiement vis-à-vis d’un placeur est requise **y compris dans le trafic réseau ou via les outils de développement**, il faut déplacer les champs de paiement dans une branche Firebase distincte, avec des règles de lecture adaptées.
