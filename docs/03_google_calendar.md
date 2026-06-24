# Synchronisation Google Calendar — Synoria

Ce guide explique comment connecter Synoria à votre agenda Google Calendar pour synchroniser vos rendez-vous entre les deux plateformes.

---

## 1. Présentation

La synchronisation Google Calendar permet de faire coexister votre agenda Synoria avec votre agenda Google, depuis n'importe quel appareil connecté.

### Ce que Synoria synchronise

- Les **rendez-vous** créés dans Synoria sont exportés vers Google Calendar
- Le titre de l'événement Google est toujours **"Consultation"** — aucun nom de patient n'est transmis
- L'heure, la durée et la note interne sont synchronisées

### Ce qui n'est PAS synchronisé

- Le contenu des séances (anamnèse, traitement, notes cliniques)
- L'identité des patients (nom, prénom, coordonnées)
- Les données médicales ou paramédicales de quelque nature que ce soit

> 💡 **Conseil :** Cette conception garantit que votre agenda Google ne contient aucune donnée de santé. Vous pouvez partager votre agenda Google avec votre secrétaire sans risque de divulgation médicale.

### Sens de la synchronisation

La synchronisation est **bidirectionnelle** :

| Direction | Comportement |
|-----------|-------------|
| Synoria → Google Calendar | Les RDV créés dans Synoria apparaissent dans GCal |
| Google Calendar → Synoria | Les événements de vos calendriers importés sont visibles en lecture seule dans Synoria |

---

## 2. Prérequis

- Un compte Google actif
- Un accès à [Google Cloud Console](https://console.cloud.google.com) (gratuit — aucune carte bancaire requise pour ce niveau d'utilisation)
- Environ **15 à 20 minutes** pour la configuration initiale (à faire une seule fois)

---

## 3. Étape 1 — Créer un projet Google Cloud

1. Rendez-vous sur [console.cloud.google.com](https://console.cloud.google.com)
2. Cliquez sur le sélecteur de projet en haut à gauche → **Nouveau projet**
3. Nommez le projet : `Synoria Agenda` (ou tout autre nom de votre choix)
4. Cliquez **Créer** et attendez quelques secondes

Une fois le projet créé, accédez à **API et services → Bibliothèque**.

5. Recherchez **Google Calendar API**
6. Cliquez sur le résultat → **Activer**

> ⚠️ **Attention :** Assurez-vous que le projet `Synoria Agenda` est bien sélectionné avant d'activer l'API, sinon l'activation s'appliquera à un autre projet.

---

## 4. Étape 2 — Créer les identifiants OAuth 2.0

1. Dans le menu, allez dans **API et services → Identifiants**
2. Cliquez **Créer des identifiants → ID client OAuth 2.0**
3. Type d'application : sélectionnez **Application de bureau**
4. Nom : `Synoria` (libre)
5. Dans la section **URI de redirection autorisés**, ajoutez exactement :
   ```
   http://127.0.0.1:42813/oauth2callback
   ```
6. Cliquez **Créer**

Une fenêtre affiche votre **Client ID** et votre **Client Secret**. Copiez-les ou téléchargez le fichier JSON.

> ⚠️ **Attention :** Ne partagez jamais votre Client Secret. Quiconque le possède pourrait usurper l'identité de votre application Google.

---

## 5. Étape 3 — Configurer l'écran de consentement

Avant de pouvoir autoriser l'accès, Google requiert la configuration d'un écran de consentement.

1. Dans le menu, allez dans **API et services → Écran de consentement OAuth**
2. Type d'utilisateur : sélectionnez **Externe** → **Créer**
3. Remplissez les champs obligatoires :
   - Nom de l'application : `Synoria`
   - E-mail d'assistance : votre adresse Gmail
   - Coordonnées du développeur : votre adresse Gmail
4. Cliquez **Enregistrer et continuer** sur les écrans suivants (Portées, Utilisateurs de test)
5. Sur l'écran **Utilisateurs de test**, cliquez **Ajouter des utilisateurs** et saisissez votre adresse Gmail

> 💡 **Conseil :** En mode "Test", seuls les comptes ajoutés comme utilisateurs de test peuvent autoriser l'application. C'est suffisant pour un usage personnel — vous n'avez pas besoin de passer en production.

---

## 6. Étape 4 — Connecter dans Synoria

1. Dans Synoria, allez dans **Paramètres → Google Calendar**
2. Collez votre **Client ID** dans le premier champ
3. Collez votre **Client Secret** dans le second champ
4. Cliquez **Connecter**

Une fenêtre de navigateur s'ouvre automatiquement. Connectez-vous à votre compte Google et autorisez l'accès à votre agenda.

5. Une fois l'autorisation accordée, Synoria affiche la liste de vos calendriers Google
6. Sélectionnez le calendrier dans lequel Synoria doit écrire vos rendez-vous (par exemple "Mon agenda" ou un calendrier dédié "Consultations")
7. Cliquez **Enregistrer**

> ⚠️ **Attention :** Si une fenêtre Google affiche "Cette application n'est pas vérifiée", cliquez sur **Paramètres avancés → Accéder à Synoria (non sécurisé)**. Ce message est normal pour une application personnelle non soumise à validation Google.

---

## 7. Calendriers à importer (optionnel)

Synoria peut afficher des événements provenant d'autres calendriers Google en lecture seule — utile pour voir vos engagements personnels ou professionnels aux côtés de vos consultations.

1. Dans Paramètres → Google Calendar → section *Calendriers importés*
2. Cliquez **Charger mes calendriers**
3. Cochez les calendriers que vous souhaitez afficher dans Synoria
4. Pour chaque calendrier importé, choisissez une **couleur distinctive** afin de les différencier visuellement de vos consultations

> 💡 **Conseil :** Assignez une couleur claire (gris, vert pâle) aux calendriers importés et gardez la couleur vive (bleu) pour vos consultations Synoria. Cela évite toute confusion visuelle dans le planning.

Les événements importés apparaissent dans le calendrier de Synoria mais **ne peuvent pas être modifiés depuis Synoria** — seule la consultation des horaires est possible.

---

## 8. Synchronisation

Une fois la connexion établie, un bouton de synchronisation (icône circulaire) apparaît dans la vue Calendrier de Synoria.

**Fréquence recommandée :** déclenchez une synchronisation à l'ouverture et à la fermeture de Synoria, ou après toute modification importante de l'agenda.

### Ce qui se passe lors d'une synchronisation

| Action dans Synoria | Résultat dans Google Calendar |
|---------------------|-------------------------------|
| Création d'un RDV | Création d'un événement "Consultation" |
| Modification d'un RDV | Mise à jour de l'événement correspondant |
| Suppression d'un RDV | Suppression de l'événement dans GCal |

| Action dans Google Calendar | Résultat dans Synoria |
|-----------------------------|----------------------|
| Événement d'un calendrier importé | Visible en lecture seule dans Synoria |
| Événement supprimé depuis GCal | Retiré de l'affichage Synoria |

> ⚠️ **Attention :** La suppression d'un rendez-vous dans Synoria entraîne sa suppression dans Google Calendar lors de la prochaine synchronisation. Cette action est irréversible côté GCal.

---

## 9. Déconnecter Google Calendar

Pour révoquer l'accès de Synoria à votre agenda Google :

1. Paramètres → Google Calendar → **Déconnecter**
2. Confirmez l'action

**Effets de la déconnexion :**

- Les RDV importés depuis Google Calendar sont **supprimés de Synoria**
- Les RDV Synoria qui avaient été exportés vers GCal **restent dans Google Calendar** — vous devez les supprimer manuellement depuis l'agenda Google si nécessaire
- Les identifiants OAuth (Client ID / Secret) sont effacés de Synoria

> 💡 **Conseil :** Après déconnexion, révoquez également l'autorisation depuis [myaccount.google.com/permissions](https://myaccount.google.com/permissions) → trouvez `Synoria` dans la liste → Supprimer l'accès. Cela révoque le token d'accès côté Google.

---

## 10. Résolution de problèmes

### "Erreur d'authentification" à la synchronisation

Le token OAuth a expiré (validité limitée par Google). Solution : Paramètres → Google Calendar → **Reconnecter** → répétez la procédure d'autorisation depuis le navigateur.

### Doublons dans Google Calendar

Cause probable : le même calendrier a été configuré à la fois comme cible d'export Synoria **et** comme calendrier importé. Solution : dans les paramètres, vérifiez que le calendrier sélectionné pour l'export n'est pas coché dans la liste des calendriers importés.

### Rendez-vous non synchronisés

- Vérifiez que la synchronisation a bien été déclenchée (bouton circulaire dans le calendrier)
- Vérifiez la connexion internet
- Certaines synchronisations ne portent que sur une plage de dates (±3 mois autour de la date courante) — les événements très anciens ou très futurs peuvent ne pas être remontés

### L'application Google est "bloquée" ou "non vérifiée"

Ce message apparaît car Synoria est une application personnelle non soumise au processus de vérification Google. Il est normal et sans danger. Cliquez sur **Paramètres avancés → Accéder à Synoria** pour continuer.

### Révoquer complètement l'accès

Depuis [myaccount.google.com/permissions](https://myaccount.google.com/permissions), localisez `Synoria` et cliquez **Supprimer l'accès**. Ensuite, déconnectez depuis Synoria (Paramètres → Google Calendar → Déconnecter) pour effacer les identifiants locaux.
