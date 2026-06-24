# Foire aux questions — Synoria

> 💡 **Navigation rapide :** [Installation](#installation--démarrage) | [Mot de passe](#mot-de-passe--sécurité) | [Patients & séances](#patients--séances) | [Calendrier](#calendrier--rdv) | [Google Calendar](#google-calendar) | [Sauvegardes](#sauvegarde--données) | [RGPD](#rgpd)

---

## Installation & démarrage

### ❓ Mon antivirus bloque Synoria ou le signale comme suspect — quoi faire ?

C'est une situation fréquente avec les logiciels indépendants non signés par un grand éditeur. Synoria n'est pas un virus. Pour l'autoriser :

1. **Windows Defender :** Ouvrez Sécurité Windows → Protection contre les virus et menaces → Historique de protection → trouvez l'alerte Synoria → cliquez "Autoriser".
2. **Autres antivirus :** Ajoutez le dossier d'installation de Synoria à la liste des exclusions.
3. **SmartScreen Windows :** Si une fenêtre bleue "Windows a protégé votre PC" s'affiche, cliquez "Informations complémentaires" puis "Exécuter quand même".

> ⚠️ **Attention :** Cette manipulation est sans risque uniquement si vous avez téléchargé Synoria depuis le site officiel ou reçu le fichier directement de l'éditeur.

---

### ❓ L'application ne démarre pas après l'installation — que faire ?

Vérifiez dans l'ordre :
1. Vous êtes sur Windows 10 ou 11 en 64 bits (Synoria ne supporte pas Windows 32 bits)
2. Redémarrez l'ordinateur et relancez Synoria
3. Désinstallez et réinstallez en faisant un clic droit sur le fichier Setup → "Exécuter en tant qu'administrateur"
4. Si le problème persiste, contactez le support avec une capture d'écran du message d'erreur

---

### ❓ Synoria s'ouvre mais reste bloqué sur l'écran de chargement — que faire ?

L'écran de chargement dure 2 secondes au démarrage. Si l'application reste bloquée plus longtemps :

1. Fermez Synoria complètement (Gestionnaire des tâches si nécessaire)
2. Relancez l'application
3. Si le problème persiste, il peut s'agir d'un problème de base de données. Contactez le support en précisant si vous utilisez un mot de passe.

---

### ❓ Comment installer Synoria sur un nouveau PC en conservant mes données ?

Consultez le [Guide de migration](08_migration.md). En résumé :

1. Créez une sauvegarde depuis l'ancienne installation (`Paramètres → Sauvegarde → Exporter`)
2. Installez Synoria sur le nouveau PC
3. Au premier démarrage, créez un mot de passe
4. Importez votre sauvegarde (`Paramètres → Sauvegarde → Importer`)

---

### ❓ L'application est lente — que faire ?

Synoria est conçu pour être rapide même sur des configurations modestes. Si vous constatez des lenteurs :

1. Fermez les autres applications gourmandes en mémoire
2. Vérifiez que votre disque dur n'est pas presque plein (laissez au moins 2 Go libres)
3. Sur les PC avec disque dur mécanique (HDD), les performances sont réduites — un SSD améliore considérablement la rapidité
4. Redémarrez l'ordinateur si l'utilisation de la RAM est élevée

---

## Mot de passe & sécurité

### ❓ J'ai oublié mon mot de passe — que faire ?

> ⚠️ **Attention :** Le mot de passe Synoria est la clé de chiffrement de vos données. **Il est impossible à récupérer.** Aucune "réinitialisation par email" n'existe : si le mot de passe est perdu sans sauvegarde accessible, les données ne peuvent pas être récupérées.

**Si vous avez une sauvegarde récente :**
1. Désinstallez Synoria
2. Supprimez le dossier de données (`%APPDATA%\Dossier Patient MTC\`)
3. Réinstallez Synoria
4. Créez un nouveau mot de passe
5. Importez votre sauvegarde (elle est protégée par un mot de passe distinct que vous avez choisi lors de l'export)

**Si vous n'avez pas de sauvegarde :** Les données sont irrécupérables. C'est pourquoi les sauvegardes régulières sont essentielles.

> 💡 **Conseil :** Notez votre mot de passe Synoria dans un gestionnaire de mots de passe (Bitwarden, 1Password) ou sur un papier stocké en lieu sûr.

---

### ❓ Comment changer mon mot de passe ?

`Paramètres → Sécurité → Changer le mot de passe`

Vous devrez saisir l'ancien mot de passe, puis le nouveau deux fois. Le changement est immédiat et la base de données est rechiffrée avec le nouveau mot de passe.

---

### ❓ Comment savoir si mes données sont sécurisées ?

Synoria chiffre votre base de données avec l'algorithme **AES-256-GCM** (le même niveau que les banques). La clé est dérivée de votre mot de passe via PBKDF2 avec 600 000 itérations.

En pratique : même si quelqu'un vole votre disque dur, il ne peut pas lire vos données patients sans connaître votre mot de passe.

> 💡 **Conseil :** Activez le verrouillage automatique de Windows (touches `Windows + L`) quand vous quittez votre bureau.

---

### ❓ L'application se verrouille automatiquement — est-ce normal ?

Oui. Synoria se verrouille automatiquement après **20 minutes d'inactivité** pour protéger les données patients. C'est une mesure de sécurité RGPD. Saisissez votre mot de passe pour reprendre.

---

## Patients & séances

### ❓ Comment retrouver rapidement un patient ?

Sur la page Patients, utilisez la barre de recherche en haut : elle filtre en temps réel par nom, prénom ou numéro de téléphone. La recherche est insensible à la casse et aux accents.

---

### ❓ Peut-on avoir plusieurs praticiens dans Synoria ?

Synoria est conçu pour un praticien unique par installation. Le champ "Praticien" dans les séances est un champ texte libre — vous pouvez y indiquer différents noms si vous partagez un cabinet, mais il n'y a pas de gestion multi-utilisateurs avec comptes séparés.

---

### ❓ Comment dupliquer une séance ?

Depuis la page **Historique des séances**, cliquez sur le bouton "Dupliquer" à côté de la séance souhaitée. Une nouvelle séance est créée avec les mêmes données (sauf la date, qui prend la date du jour). Utile pour les séances de suivi similaires.

---

### ❓ Comment supprimer un patient et toutes ses données ?

Page **Patients** → ouvrez la fiche du patient → bouton "Supprimer le patient".

> ⚠️ **Attention :** La suppression d'un patient efface définitivement toutes ses séances, rendez-vous et données associées. Cette opération est **irréversible**. Vérifiez vos obligations de conservation RGPD avant de supprimer.

---

### ❓ Comment exporter les données d'un patient pour lui transmettre ?

Depuis la fiche patient ou la page de résumé d'une séance, vous pouvez :
- Exporter le **dossier complet en JSON** (format structuré, archivable)
- Exporter une **séance en Excel** (format lisible par le patient)
- Imprimer un résumé de séance depuis la page Résumé

---

## Calendrier & RDV

### ❓ Comment créer un rendez-vous pour un patient non enregistré ?

Dans le calendrier, cliquez sur un créneau horaire et choisissez **"Invité"**. Renseignez le nom, prénom et téléphone de l'invité. Ce rendez-vous ne sera pas lié à un dossier patient mais apparaîtra dans le calendrier.

---

### ❓ Un rendez-vous créé depuis une séance apparaît aussi dans le calendrier — est-ce normal ?

Oui, c'est le comportement attendu. Quand vous renseignez la date du prochain rendez-vous à la fin d'une séance (section "Plan de suivi"), Synoria crée ou met à jour automatiquement le rendez-vous dans le calendrier. Les deux restent synchronisés.

---

### ❓ Comment marquer un rendez-vous comme "réalisé" ?

Dans le calendrier, cliquez sur le rendez-vous → bouton "Marquer comme réalisé". Le rendez-vous passe en vert et reste visible dans le calendrier comme historique.

---

### ❓ Comment bloquer des créneaux pour des indisponibilités personnelles ?

Dans le calendrier, cliquez sur un créneau → choisissez **"Bloc personnel / Indisponibilité"**. Indiquez le motif (déjeuner, formation, etc.). Ces créneaux apparaissent en gris et empêchent la création de rendez-vous patients sur cette plage.

---

## Google Calendar

### ❓ Comment connecter Synoria à Google Calendar ?

`Paramètres → Google Calendar → Connecter un compte Google`

Suivez l'authentification Google dans le navigateur. Une fois connecté, choisissez quel(s) calendrier(s) importer et si vous souhaitez exporter les rendez-vous Synoria vers Google.

---

### ❓ Les rendez-vous Google Calendar apparaissent en double — comment résoudre ?

Ce problème est résolu depuis la version 1.5.0 grâce à un marqueur anti-cycle d'import. Si vous utilisez une version antérieure, mettez à jour Synoria.

Si le problème persiste après la mise à jour :
1. Déconnectez Google Calendar dans les paramètres
2. Supprimez manuellement les doublons dans le calendrier Synoria
3. Reconnectez Google Calendar

---

### ❓ Mes rendez-vous Synoria sont-ils visibles dans Google Calendar ?

Oui, si vous avez activé l'export vers Google Calendar. Les événements sont créés avec le titre générique "Consultation" (sans le nom du patient, pour respecter la confidentialité). Seuls les horaires et la durée sont transmis.

> ⚠️ **Attention :** Aucune donnée médicale n'est transmise à Google. Si vous notez des informations sensibles dans le champ "Note" d'un rendez-vous synchronisé, elles apparaîtront dans Google Calendar.

---

### ❓ J'ai supprimé un rendez-vous dans Google Calendar mais il réapparaît dans Synoria — pourquoi ?

La synchronisation Google Calendar → Synoria est unidirectionnelle pour l'import. Les suppressions dans Google Calendar sont répercutées lors de la prochaine synchronisation. Si l'événement réapparaît, vérifiez qu'il a bien été supprimé dans Google Calendar (et non simplement masqué).

---

## Sauvegarde & données

### ❓ Comment récupérer une sauvegarde après réinstallation ?

1. Installez Synoria et créez un mot de passe d'application
2. `Paramètres → Sauvegarde → Importer une sauvegarde`
3. Sélectionnez votre fichier `.json.enc`
4. Saisissez le **mot de passe de la sauvegarde** (distinct du mot de passe Synoria, choisi lors de l'export)
5. Redémarrez l'application

> 💡 **Conseil :** Notez le mot de passe de vos sauvegardes séparément du mot de passe Synoria.

---

### ❓ Comment transférer mes données vers un nouveau PC ?

Voir [Guide de migration](08_migration.md) pour la procédure complète. La méthode recommandée est d'utiliser la sauvegarde chiffrée `.json.enc`.

---

### ❓ À quelle fréquence sauvegarder ?

| Activité | Fréquence recommandée |
|---|---|
| Cabinet actif (5+ séances/semaine) | Sauvegarde automatique quotidienne + copie externe hebdomadaire |
| Cabinet modéré (1-4 séances/semaine) | Sauvegarde automatique + copie externe mensuelle |
| Début d'utilisation | Sauvegarde manuelle après chaque séance le premier mois |

Activez la sauvegarde automatique dans `Paramètres → Sauvegarde → Sauvegarde automatique à la fermeture`.

---

### ❓ Où sont stockées mes données ?

Toutes les données sont stockées localement sur votre PC, dans le dossier :
`C:\Users\[votre nom]\AppData\Roaming\Dossier Patient MTC\`

Ce dossier contient la base de données chiffrée, les paramètres, les exports et les sauvegardes locales. Il n'est jamais envoyé vers l'extérieur.

---

## RGPD

### ❓ Un patient demande à accéder à ses données — que faire ?

Vous avez **un mois** pour répondre. Depuis Synoria :
1. Ouvrez la fiche du patient
2. Exportez ses données (export JSON ou résumés de séances)
3. Transmettez-lui les données par un canal sécurisé (email chiffré ou remise en main propre)

> 💡 **Conseil :** Documentez la demande et votre réponse dans les notes générales du patient ou dans un registre externe.

---

### ❓ Un patient demande la suppression de ses données — suis-je obligé ?

Le droit à l'effacement (Art. 17 RGPD) n'est pas absolu pour les données de santé. Vous pouvez refuser si :
- La conservation est nécessaire à la continuité des soins
- Une obligation légale impose la conservation (Code de la Santé Publique)

Si le droit à l'effacement s'applique (patient hors suivi depuis longtemps), supprimez le dossier dans Synoria et conservez une preuve de la suppression.

---

### ❓ Dois-je déclarer mon logiciel à la CNIL ?

Depuis le RGPD (mai 2018), le régime de déclaration préalable à la CNIL a été supprimé. Vous n'avez plus à déclarer votre logiciel. En revanche, vous devez tenir un **registre des activités de traitement** (Art. 30) que Synoria génère automatiquement.
