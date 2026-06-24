# Historique des versions — Synoria

> 💡 **Mise à jour automatique :** Synoria vérifie la disponibilité d'une nouvelle version au démarrage. Quand une mise à jour est disponible, une notification apparaît dans `Paramètres → Mises à jour`. Cliquez sur "Installer la mise à jour" pour lancer l'installation automatique.

---

## Version 1.5.0 — Juin 2026 *(version actuelle)*

### Calendrier professionnel

- ✅ **Légende du calendrier améliorée** avec des couleurs distinctes par type de rendez-vous (patient, invité, personnel, réalisé)
- ✅ **Blocs personnels visibles dans la grille horaire** : les indisponibilités et créneaux bloqués apparaissent directement sur la vue journalière
- ✅ **Protection des créneaux bloqués** : impossible de créer un rendez-vous patient sur un créneau marqué comme indisponible

### Google Calendar

- ✅ **Synchronisation Google Calendar fiable** : suppression définitive des doublons grâce à un marqueur anti-cycle d'import
- ✅ **Couleurs personnalisables par calendrier Google importé** : attribuez une couleur distincte à chaque calendrier Google connecté pour les différencier d'un coup d'œil

### Dossier patient

- ✅ **Export Dossier Patient PDF complet** : toutes les séances d'un patient regroupées en un seul document médical, prêt à imprimer ou à transmettre

### Rendez-vous & communication

- ✅ **Rappels email automatiques J-1** : vos patients reçoivent un rappel la veille de leur rendez-vous (configuration dans Paramètres)

### Comptabilité & facturation

- ✅ **Alertes factures non payées** avec seuil configurable (alerte si une facture dépasse X jours sans paiement)
- ✅ **Statut payé / non payé sur les factures** : suivi visuel du règlement directement dans le journal des factures

### Compatibilité

- ✅ **Build macOS disponible** : Synoria est désormais disponible pour Mac en version Intel x64 et Apple Silicon arm64

---

## Version 1.4.4 — Mai 2026

### Google Calendar bidirectionnel

- ✅ **Synchronisation bidirectionnelle Google Calendar** : les rendez-vous Synoria apparaissent dans Google Calendar, et les événements Google sont importés dans Synoria
- ✅ **Blocs calendrier personnels et indisponibilités** : créez des créneaux bloqués dans votre planning (déjeuner, formation, congés)

### Sauvegardes

- ✅ **Format de sauvegarde v3 sécurisé** : les sauvegardes sont désormais protégées par un mot de passe portable, indépendant du mot de passe de l'application — vos sauvegardes sont lisibles sur n'importe quel PC

### Comptabilité

- ✅ **Export comptabilité Excel professionnel** en 6 onglets : revenus mensuels, URSSAF, types de consultations, dépenses, factures, synthèse annuelle
- ✅ **Clôture de séance avec comptabilité intégrée** : enregistrez le type de consultation et le tarif directement depuis la page de nouvelle séance

### Formulaire simple enrichi

- ✅ **7 sections dans le formulaire simple** (pour les praticiens sans plugin spécifique) : anamnèse, observation, diagnostic, traitement, réactions, plan de suivi

---

## Version 1.4.3 — Avril 2026

- ✅ **Résumé de la séance précédente** affiché en accordéon en haut du formulaire de nouvelle séance — consultez rapidement l'évolution avant de commencer
- ✅ **Décalage de date corrigé** : les dates ne glissaient plus d'un jour selon le fuseau horaire de la machine
- ✅ **Rendez-vous réalisés visibles dans le calendrier** : les RDV marqués comme réalisés restent affichés en vert pour conserver l'historique visuel

---

## Versions 1.4.0 à 1.4.2 — Mars 2026

### Tableau de bord

- ✅ **Tableau de bord enrichi** : statistiques d'activité, prochains rendez-vous de la semaine, séances récentes et alertes en un coup d'œil

### Calendrier

- ✅ **Vue semaine** dans le calendrier : planning sur 7 jours avec créneaux horaires
- ✅ **Vue jour** : focus sur une journée avec tous les créneaux en détail

### Plugins

- ✅ **Plugin Kinésiologie Charlotte DECAENS** : formulaire d'anamnèse spécifique à la kinésiologie, installable depuis `Paramètres → Plugin → Importer`

### RGPD

- ✅ **Page RGPD complète** : gestion des consentements patients, journal d'accès, alertes de conservation et génération du registre Art. 30
- ✅ **Taux de consentement** visible avec barre de progression
- ✅ **Export du registre Art. 30** en HTML prêt à imprimer

### Interface

- ✅ **Mode sombre / clair** : basculez selon vos préférences depuis les paramètres d'affichage

---

## Version 1.3.0 et antérieures — Version initiale

Cette version constitue la première version publique de Synoria avec les fonctionnalités fondamentales :

- Plugin MTC JP avec formulaire complet (langue, pouls, systèmes, tests énergétiques, barrage)
- Gestion des patients (création, modification, recherche, historique)
- Calendrier mensuel avec rendez-vous patients et invités
- Comptabilité de base (revenus mensuels, URSSAF)
- Facturation PDF avec numérotation automatique
- Chiffrement AES-256 de la base de données
- Sauvegardes chiffrées exportables
- Version portable (clé USB) sans installation requise
