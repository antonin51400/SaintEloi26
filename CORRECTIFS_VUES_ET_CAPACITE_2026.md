# Saint-Éloi 2026 — plan des entrées, consultation et quotas de réservations

## Entrées

La vue **Entrées** conserve la même carte de salle que les autres vues, avec **la scène, les rangées et les tables**. Le panneau alternatif en cartes de tables est supprimé de cette vue. La scène et les rangées sont placées sur un même axe horizontal, y compris dans l'éditeur du plan personnalisé. Les droits Entrées continuent à ne pas donner accès au placement.

## Consultation

Une **frise de progression** montre en lecture seule les invités arrivés par rapport à tous les invités des réservations **acceptées**. Elle est actualisée depuis les données Firebase reçues par l'application. Le pourcentage, les compteurs et la jauge sont cachés dans les autres vues.

## Capacité des réservations

Le tableau de capacité apparaît **uniquement dans l'espace « Réservations »** et dans son formulaire d'enregistrement, jamais en Accueil, Placement, Consultation ou sur la vue Administrateur générale. Les administrateurs peuvent y accéder en sélectionnant la vue Réservations dans leur menu de vues.

La capacité est la somme des capacités des tables du plan actif (6 par défaut et valeurs personnalisées si elles existent).

- Chaque invité d'une réservation **à valider** ou **acceptée** consomme une place.
- Une réservation **annulée** libère ses places.
- À **25 places restantes ou moins**, l'interface Réservations affiche l'avertissement jaune.
- À **15 places restantes ou moins**, l'avertissement devient rouge.
- À **0**, le bouton de nouvelle réservation est désactivé et une création/extension qui dépasserait la capacité est refusée par les fonctions d'écriture.
- Une réduction de capacité qui rendrait le nombre de réservations supérieur à la nouvelle capacité est également refusée.

La modification d'un dossier existant conserve son historique ; son nombre d'invités et son statut déterminent les places réellement consommées.

## Limite technique à prendre en compte

Le garde-fou de quota est vérifié par l'application pendant ses transactions. Il est atomique pour les écritures effectuées par un administrateur à la racine des données. **Pour des comptes Réservations différents modifiant en même temps des dossiers distincts, il n'existe pas encore de réservation atomique globale de capacité côté Firebase.** De plus, les règles de base de données actuellement déployées ne vérifient pas le total des participants. Il faut un mécanisme serveur/quotas atomiques avant de considérer le plafond comme garanti face à des écritures simultanées ou directes à l'API.

Avant publication : tests sur mobile et ordinateur, vérification de l'affichage d'une table personnalisée asymétrique, et tests d'ouverture/modification/annulation aux seuils 26, 25, 16, 15, 1 et 0 places.

