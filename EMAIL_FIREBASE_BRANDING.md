# Saint Éloi 2026 — e-mail officiel de gestion du mot de passe

Ce modèle est prêt à être collé dans **Firebase Console → Authentication → Modèles (Templates) → Réinitialisation du mot de passe**.

Le site envoie ces demandes via `firebase.auth().sendPasswordResetEmail(...)` : **les textes des e-mails ne sont pas contrôlés par les fichiers HTML du site**. Modifier ce document GitHub n'actualise pas l'e-mail réellement envoyé. Le texte doit être enregistré manuellement dans Firebase Console.

## Paramètres à configurer

| Champ Firebase | Valeur |
|---|---|
| Nom de l'expéditeur | **Saint Éloi 2026 • Organisation** |
| Nom public du projet | **Saint Éloi 2026** |
| Objet | **Saint Éloi 2026 — Définissez votre mot de passe** |
| Adresse de réponse | Adresse de contact organisation, si souhaitée ; ne pas inventer d'adresse |
| Langue | **Français** (le site définit déjà `auth.languageCode = 'fr'`) |

### Message — à copier/coller

```text
SAINT ÉLOI 2026
ESPACE ORGANISATION

Bienvenue dans l'équipe !

Une demande a été effectuée pour définir ou renouveler le mot de passe associé à votre espace d'organisation de la Saint Éloi 2026.

Pour accéder à votre compte en toute sécurité, utilisez le lien ci-dessous :

%LINK%

Une fois votre mot de passe défini, retrouvez votre espace ici :
https://antonin51400.github.io/SaintEloi26/

Connectez-vous avec votre adresse e-mail. Lors de votre première connexion, indiquez simplement votre prénom et votre nom.

Si vous n'avez pas effectué cette demande, vous pouvez ignorer cet e-mail. Votre compte restera inchangé.

À très bientôt,
L'équipe d'organisation Saint Éloi 2026
Jeunes Agriculteurs Suippes × Givry / Menou

---
Message automatique lié à la sécurité de votre compte.
Ne transmettez jamais ce lien à un tiers.
```

**Conserver `%LINK%` exactement tel quel** : Firebase le remplace par un lien unique de réinitialisation. Ne pas y mettre l'URL générale du site.

Le contenu est volontairement adapté aux **deux contextes** utilisant ce même modèle Firebase : **première activation de compte** et **mot de passe oublié**.

## Identité visuelle

Identité actuelle de la page Saint Éloi :

- Rouge principal : `#c0392b`
- Rouge soutenu : `#a93226`
- Or : `#c9a84c`
- Ivoire : `#f5f3ef`
- Signature : **JA Suippes × JA Givry / Menou**
- Nom affiché : **Saint Éloi 2026**

**Limite de la personnalisation native Firebase :** l'expéditeur, l'objet et le texte sont configurables. Pour un e-mail entièrement graphique avec bandeau rouge/or, logo, bouton HTML sur mesure et pied de page formaté, il faut générer le lien d'action depuis un environnement serveur sécurisé (Firebase Admin SDK) et envoyer un véritable e-mail HTML par un service transactionnel. Ce n'est **pas activé** par ce document.

L'utilisation d'un domaine personnalisé comme expéditeur nécessite de **posséder et vérifier le domaine avec des enregistrements DNS**. Le domaine GitHub Pages `github.io` ne peut pas être présenté comme domaine privé possédé sans cette vérification.

**Ne pas définir une « URL d'action personnalisée » pointant simplement vers la page d'accueil GitHub Pages :** le lien de réinitialisation échouerait si la page cible n'implémente pas le traitement des paramètres sécurisés `mode` et `oobCode`. Il faut laisser le gestionnaire Firebase existant tant qu'un véritable gestionnaire personnalisé n'a pas été développé et testé.

## Test après mise à jour

1. Enregistrer le modèle dans **Authentication → Modèles → Réinitialisation du mot de passe**.
2. Ouvrir https://antonin51400.github.io/SaintEloi26/, cliquer **Première connexion ? Activer mon compte**, saisir l'adresse d'un compte Firebase existant et cliquer **Recevoir mon lien par e-mail**.
3. Vérifier l'expéditeur, l'objet, le corps et la présence du lien; ouvrir le lien de test et choisir un nouveau mot de passe.
4. Revenir au site et se connecter. Contrôler aussi le dossier indésirables.

Sources officielles :
- https://support.google.com/firebase/answer/7000714?hl=fr
- https://firebase.google.com/docs/auth/admin/email-action-links
- https://firebase.google.com/docs/auth/email-custom-domain
