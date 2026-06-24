# Guide RGPD pour le praticien — Synoria

> 💡 **Ce guide est une aide pratique, pas un conseil juridique.** Pour des situations complexes, consultez un juriste spécialisé en protection des données de santé ou la CNIL (cnil.fr).

---

## 1. Votre rôle en tant que responsable de traitement

En tant que praticien de santé, vous êtes le **responsable du traitement** au sens de l'article 4 du RGPD. Cela signifie que c'est vous — et non l'éditeur du logiciel — qui décidez des finalités et des moyens du traitement des données de vos patients.

**Synoria est un outil** : il stocke et organise vos données localement sur votre machine. Il n'est pas un sous-traitant de données au sens du RGPD, car aucune donnée ne transite vers des serveurs externes.

### Vos obligations légales en résumé

- Informer les patients de l'utilisation de leurs données (notice d'information)
- Recueillir leur consentement pour les données de santé
- Garantir la sécurité des données (mot de passe fort, sauvegardes)
- Répondre aux demandes d'accès ou d'effacement dans un délai d'un mois
- Tenir un registre des activités de traitement (Art. 30)
- Signaler toute violation de données à la CNIL dans les 72 heures

---

## 2. Données collectées et leur justification

| Catégorie | Données | Base légale |
|---|---|---|
| Identité | Nom, prénom, date de naissance | Art. 9(2)(h) RGPD — soins de santé |
| Contact | Téléphone, email, adresse | Art. 9(2)(h) ou intérêt légitime (rappels RDV) |
| Profession | Profession du patient | Art. 9(2)(h) — contexte clinique |
| Santé | Antécédents médicaux, médicaments | Art. 9(2)(h) RGPD — soins de santé |
| Séances | Diagnostics, traitements, évolution | Art. 9(2)(h) RGPD — soins de santé |
| Consentement | Date et statut du consentement RGPD | Art. 7 RGPD — preuve du consentement |
| Journal d'accès | Historique d'ouverture des fiches | Art. 5(1)(f) — intégrité et confidentialité |

> ⚠️ **Attention :** L'article 9(2)(h) du RGPD autorise le traitement des données de santé dans le cadre d'une prise en charge médicale ou paramédicale. Cette base légale est conditionnée au secret professionnel et à la relation de soin.

---

## 3. Durée de conservation

La durée de conservation des données patients est **configurable dans Synoria** via `Paramètres → RGPD → Durée de conservation`. La valeur par défaut est **10 ans**.

### Référence légale

Le Code de la Santé Publique (Art. R. 1112-7) fixe à **20 ans** la conservation du dossier médical pour les établissements de santé. Pour les praticiens libéraux, la recommandation CNIL est d'au moins **10 ans** après la dernière consultation.

### Alertes automatiques

Synoria surveille automatiquement la date de la dernière séance pour chaque patient. Lorsqu'un patient approche ou dépasse la durée configurée sans nouvelle consultation, vous recevez une alerte dans la **Page RGPD**. Vous pouvez alors :

- Prendre contact avec le patient pour une reprise de suivi
- Archiver ou supprimer le dossier si la relation de soin est terminée

> 💡 **Conseil :** Configurez la durée à 10 ans et vérifiez les alertes RGPD une fois par an.

---

## 4. Droits des patients

Tout patient peut exercer ses droits à tout moment. Vous disposez d'**un mois** pour répondre à chaque demande.

| Droit | Article | Comment y répondre depuis Synoria |
|---|---|---|
| Droit d'accès | Art. 15 | Ouvrir la fiche patient → exporter les données (export JSON ou PDF) |
| Droit de rectification | Art. 16 | Modifier la fiche patient (coordonnées, antécédents, notes) |
| Droit à l'effacement | Art. 17 | Supprimer le patient (⚠️ irréversible, vérifier les conditions) |
| Droit d'opposition | Art. 21 | Cesser le traitement des données non essentielles aux soins |
| Droit à la portabilité | Art. 20 | Export JSON du dossier complet |

> ⚠️ **Attention :** Le droit à l'effacement ne s'applique pas automatiquement aux données de santé si leur conservation est nécessaire à la prise en charge ou imposée par la loi. Consultez un juriste en cas de doute.

---

## 5. Le consentement dans Synoria

### Enregistrer le consentement

Dans Synoria, chaque fiche patient comporte une section RGPD avec une case à cocher **"Consentement donné"** et la date d'enregistrement. Cette date est conservée dans la base de données comme preuve.

**Étapes pour recueillir le consentement :**

1. Présenter oralement ou par écrit la notice d'information au patient
2. Ouvrir la fiche patient → section RGPD
3. Cocher "Consentement donné" → la date est enregistrée automatiquement

### La notice d'information

La notice explique au patient quelles données vous collectez, pourquoi, combien de temps, et quels sont ses droits. Elle est **personnalisable dans Synoria** via `Paramètres → RGPD → Notice d'information`.

Un modèle conforme est fourni par défaut. Personnalisez-le avec votre nom, votre spécialité et vos coordonnées.

### Suivi du taux de consentement

La **Page RGPD** affiche le taux de consentement global de votre patientèle, ainsi que la liste des patients sans consentement enregistré.

> 💡 **Conseil :** Visez 100 % de consentements enregistrés. Profitez de chaque première séance pour présenter la notice et cocher la case.

---

## 6. Journal d'accès (traçabilité)

Synoria enregistre automatiquement dans un journal chaque action sensible :

| Action enregistrée | Déclencheur |
|---|---|
| `fiche_ouverte` | Ouverture d'une fiche patient |
| `séance_consultée` | Affichage du résumé d'une séance |
| `séance_créée` | Enregistrement d'une nouvelle séance |
| `données_exportées` | Export JSON ou Excel d'un dossier |

Ce journal est consultable dans la **Page RGPD → onglet "Journal d'accès"**. Il vous permet de prouver que les accès aux données sont légitimes et limités aux nécessités professionnelles.

> 💡 **Conseil :** Le journal d'accès est un outil de preuve en cas de contrôle CNIL ou de litige avec un patient.

---

## 7. Registre des activités de traitement (Art. 30)

Tout responsable de traitement manipulant des données de santé doit tenir un **registre des activités de traitement**. C'est une obligation légale, même pour un praticien libéral seul.

### Générer le registre depuis Synoria

`Paramètres → RGPD → Exporter le registre Art. 30`

Le registre est généré au format **HTML**, prêt à imprimer ou à archiver. Il contient :

- L'identité du responsable de traitement (vous)
- La finalité du traitement (soins de santé)
- La base légale (Art. 9(2)(h) RGPD)
- Les catégories de données traitées
- La durée de conservation configurée
- Les mesures de sécurité en place (chiffrement AES-256)
- Des statistiques sur votre patientèle

> ⚠️ **Attention :** Personnalisez vos coordonnées dans `Paramètres → RGPD → Nom du praticien / Email` avant de générer le registre. Archivez ce document au moins une fois par an.

---

## 8. Sécurité des données (vos obligations)

### Ce que Synoria garantit

- **Chiffrement AES-256-GCM** de la base de données au repos (niveau bancaire)
- **Dérivation de clé PBKDF2** avec 600 000 itérations (résistant aux attaques par force brute)
- **Verrouillage automatique** après 20 minutes d'inactivité
- **Aucun envoi de données** vers l'extérieur

### Votre responsabilité complémentaire

| Obligation | Action recommandée |
|---|---|
| Mot de passe fort | Minimum 12 caractères, mélange majuscules/chiffres/symboles |
| PC sécurisé | Compte Windows protégé, verrouillage écran automatique |
| Sauvegardes | Activer la sauvegarde automatique dans les paramètres |
| Chiffrement du PC | Activer BitLocker (Windows 10/11 Pro) |
| Accès tiers | Ne jamais partager le mot de passe Synoria |

### En cas de violation de données

Si votre PC est volé, compromis ou si des données patients sont accessibles par des tiers non autorisés, vous devez :

1. Évaluer la gravité de l'incident
2. **Notifier la CNIL dans les 72 heures** via le portail notifications.cnil.fr
3. Informer les patients concernés si le risque est élevé

---

## 9. Ce que Synoria NE fait PAS

| Pratique | Synoria |
|---|---|
| Stockage cloud | ❌ Jamais |
| Transmission à des tiers | ❌ Jamais |
| Analytics / télémétrie | ❌ Aucune |
| Vente de données | ❌ Jamais |
| Accès à distance au praticien | ❌ Impossible |

La vérification de mises à jour contacte uniquement GitHub pour lire un numéro de version. Aucune donnée patient n'est transmise.

Si vous activez la synchronisation **Google Calendar**, seuls les titres génériques ("Consultation") et les horaires sont transmis à Google. Aucune donnée médicale n'est partagée.

---

## 10. Checklist RGPD praticien

À compléter une fois par an et à chaque nouveau patient :

**Configuration initiale**
- [ ] Notice d'information rédigée et personnalisée (Paramètres → RGPD)
- [ ] Durée de conservation configurée (recommandé : 10 ans)
- [ ] Coordonnées praticien renseignées pour le registre Art. 30
- [ ] Registre Art. 30 généré et archivé

**Pour chaque nouveau patient**
- [ ] Notice d'information présentée au patient
- [ ] Consentement coché dans la fiche patient

**Régulièrement**
- [ ] Sauvegardes automatiques actives et testées
- [ ] Alertes RGPD vérifiées (dossiers à archiver / supprimer)
- [ ] Mot de passe Synoria fort et non partagé
- [ ] Journal d'accès consulté en cas d'anomalie

> 💡 **Conseil :** Programmez un rappel annuel pour vérifier vos alertes RGPD et régénérer le registre Art. 30 avec les statistiques à jour.
