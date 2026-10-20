# Saint Eloi 2026

Gestion des réservations reçues par SMS pour Antonin Blanckaert et Antonin Bassut.
**Départ à zéro au 20 octobre 2026 : aucune ancienne réservation importée.**

## Utilisation

1. Se connecter avec son compte Google autorisé.
2. Cliquer **+ Réservation SMS**, saisir le réservant, éventuellement son téléphone et ses notes, puis une ligne par participant. Le réservant est proposé sur la première ligne : le retirer s’il ne participe pas.
3. Garder **À valider** ou choisir **Acceptée**. Le bouton **Accepter** confirme ensuite tout le groupe.
4. Cliquer **Placer le groupe →** ou **Placer →** pour une seule personne, puis cliquer sur une table. Sur ordinateur, le glisser-déposer ouvre le même placement. Les places et la table sont confirmées avant enregistrement.
5. Au premier placement, indiquer le nombre réel de places de la table. Les capacités ne sont pas inventées. Pour un invité seul, choisir sa place numérotée ; pour un groupe, les premières places libres sont proposées. Le groupe reste ensemble sur cette table. Si la capacité ne suffit pas, choisir une autre table ou répartir individuellement.
6. Cliquer directement sur une table pour voir les places occupées/libres, changer sa capacité ou déplacer un invité. Retirer du plan remet un invité dans **À placer**.
7. Utiliser séparément **Arrivée** et **Paiement**. L’arrivée ne déclenche jamais un paiement. Une réservation acceptée peut être suivie même avant son placement.
8. **Modifier** conserve les identifiants et les statuts des personnes conservées. Une annulation libère les places, conserve l’information de paiement et reste consultable. Export CSV disponible.

Le plan reprend les 42 sections de tables du dépôt d’origine. Aucun participant ni statut de l’ancien bal n’est conservé. `map.html` redirige vers l’unique application pour éviter deux listes différentes.

## État de livraison

L’interface et les fonctions sont implémentées. **La connexion partagée n’est pas encore activée** (`enabled: false` dans `config.js`). Le mode de démonstration démarre vide et conserve uniquement les saisies dans la mémoire de l’onglet. Ce mode n’est pas un stockage de réservations et n’utilise pas Firebase.

Une base Firebase dédiée est nécessaire avant la saisie réelle. Aucun appel ne doit être fait vers les anciens chemins `arrived` et `paid` du bal savoyard. Aucun fichier contenant des noms, téléphones ou réservations réels ne doit être commité dans ce dépôt public.

## Activation du service partagé

À effectuer par le propriétaire Firebase (pas d’accès Firebase administrateur disponible depuis le connecteur GitHub) :

1. Créer un projet Firebase dédié à Saint Eloi 2026, une application Web et une Realtime Database. Choisir une région appropriée (Europe). Copier sa configuration Web publique dans `config.js` ; ne jamais y placer une clé de compte de service.
2. Dans Authentication, activer Google et autoriser le domaine d’hébergement de ce site. Conserver `enabled: false` jusqu’à la fin de cette configuration.
3. Déployer `database.rules.json` **sur cette nouvelle base dédiée uniquement**, avant toute donnée réelle. Ne pas remplacer les règles du projet du bal savoyard. Les lectures et écritures publiques sont refusées ; chaque utilisateur ne lit que sa propre autorisation. Les accès à la liste exigent une authentification et une inscription dans `members`.
4. Activer temporairement la connexion (`enabled: true`) pour que chacun des deux organisateurs se connecte une première fois. Le compte reste refusé tant qu’il n’est pas autorisé. Relever les UID dans Authentication > Users et vérifier les adresses des deux personnes.
5. Depuis la console administrateur, créer seulement ces deux entrées :
   - `events/saint-eloi-2026/members/UID_ANTONIN_BLANCKAERT/name` = `Antonin Blanckaert`
   - `events/saint-eloi-2026/members/UID_ANTONIN_BASSUT/name` = `Antonin Bassut`
   Les UID sont ceux des comptes réellement vérifiés, pas les noms ou adresses e-mail. Ne pas publier de données privées dans GitHub.
6. Laisser `events/saint-eloi-2026/data` absent : la liste démarrera vide. Il n’y a aucun import automatique ni effacement à chaque ouverture.
7. Vérifier sur deux appareils : saisie partagée, acceptation, placement, paiement et arrivée. Vérifier aussi qu’un compte tiers et une requête non authentifiée sont refusés. L’activation Firebase et ces tests réels restent à effectuer.

Les modifications utilisent des transactions sur les données de l’événement : en cas d’attribution simultanée d’une place, l’état courant est relu et la seconde attribution incompatible est refusée. Un formulaire ouvert avant une modification de la même réservation ne l’écrase pas silencieusement. Les écritures hors connexion sont bloquées dans l’interface. Une perte de réseau après le début d’un enregistrement peut laisser l’opération en attente jusqu’à reconnexion : attendre la confirmation affichée.

## Développement

Site statique HTML/CSS/JavaScript, SDK Firebase compat (version reprise du projet existant).

```sh
python -m http.server 8765
node --check app.js
```

Ouvrir `http://localhost:8765` puis le mode de démonstration pour vérifier les parcours sans données réelles.

Tests automatisés : `npm install` puis `npm test` (Node 22+). Tests DOM et logique sans réseau : départ vide, acceptation, placements, saturation, capacité, déplacement, paiements et arrivées séparés, conflit d’édition, annulation, échappement HTML. La vérification visuelle dans un navigateur et la synchronisation sur Firebase réel ne sont pas couvertes par ces tests.
