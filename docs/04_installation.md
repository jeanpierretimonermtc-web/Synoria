# 🛠️ Manuel d'installation — Synoria

> Version du logiciel : **1.5.0**  
> Dernière mise à jour : juin 2026

---

## 1. ✅ Configuration requise

### Windows

| Composant | Minimum requis |
|---|---|
| Système d'exploitation | Windows 10 ou Windows 11 (64 bits) |
| Mémoire RAM | 4 Go (8 Go recommandés) |
| Espace disque | 500 Mo libres (+ espace pour vos données patients) |
| Droits | Administrateur local pour l'installation |
| Résolution | 1280 × 720 minimum (1920 × 1080 recommandé) |

### Mac

| Composant | Minimum requis |
|---|---|
| Système d'exploitation | macOS 12 Monterey minimum |
| Processeur | Intel Core i3 ou Apple Silicon (M1, M2, M3, M4) |
| Mémoire RAM | 4 Go (8 Go recommandés) |
| Espace disque | 500 Mo libres |

> 💡 **Conseil :** Synoria fonctionne aussi sur des configurations plus modestes. Les exigences ci-dessus garantissent une expérience fluide même avec des dossiers patients volumineux.

---

## 2. 🪟 Installation Windows

### 2.1 Version installée (recommandée)

La version installée s'intègre à votre système Windows, crée un raccourci sur le bureau et s'ajoute à la liste des programmes.

**Étapes :**

1. Téléchargez le fichier **`Synoria Setup 1.5.0.exe`** depuis le lien fourni
2. Double-cliquez sur le fichier téléchargé
3. Si Windows affiche un avertissement de sécurité, cliquez sur **"Plus d'informations" → "Exécuter quand même"** (voir section 7.2)
4. L'assistant d'installation s'ouvre — suivez les étapes (installation silencieuse en quelques secondes)
5. Un **raccourci est créé automatiquement** sur le bureau
6. Lancez Synoria depuis le raccourci ou le menu Démarrer

**Emplacement des données :**
```
C:\Users\[votre_nom]\AppData\Roaming\Synoria\
```

> ⚠️ **Attention :** Le dossier `AppData` est masqué par défaut dans l'Explorateur Windows. Pour y accéder, collez directement le chemin dans la barre d'adresse de l'Explorateur.

### 2.2 Version portable (sans installation)

La version portable ne s'installe pas sur le système. Elle peut être copiée sur une clé USB et utilisée sur n'importe quel PC Windows sans laisser de trace.

**Étapes :**

1. Téléchargez le fichier **`Synoria 1.5.0.exe`** (version portable)
2. Copiez-le dans le dossier de votre choix (bureau, clé USB, dossier Documents...)
3. Double-cliquez pour lancer — aucune installation requise

**Emplacement des données :**
```
[dossier où se trouve l'exe]\data\
```

> ⚠️ **Attention :** Si vous déplacez l'exe, déplacez aussi le dossier `data\` avec lui, sinon vos données ne seront plus trouvées.

> 💡 **Conseil :** La version portable est idéale pour les thérapeutes qui travaillent sur plusieurs ordinateurs ou qui souhaitent conserver leurs données sur une clé USB sécurisée.

### 2.3 Mise à jour Windows

1. Dans Synoria, allez dans **Paramètres → Mise à jour → Vérifier les mises à jour**
2. Si une mise à jour est disponible, cliquez sur **"Télécharger"**
3. Une fois le téléchargement terminé, cliquez sur **"Installer"**
4. Synoria fermera automatiquement et lancera le nouvel installateur
5. Suivez l'assistant — vos **données sont préservées automatiquement**

> 💡 **Conseil :** Faites une **sauvegarde** avant toute mise à jour (Paramètres → Sauvegarde → Exporter maintenant).

---

## 3. 🍎 Installation Mac

### 3.1 Choisir la bonne version

Synoria est disponible en deux versions pour Mac selon le type de processeur :

1. Cliquez sur le menu **Pomme** () en haut à gauche de votre écran
2. Sélectionnez **"À propos de ce Mac"**
3. Regardez la ligne "Processeur" ou "Puce" :

| Ce que vous voyez | Version à télécharger |
|---|---|
| "Apple M1", "M2", "M3" ou "M4" | **`Synoria-arm64.dmg`** (Apple Silicon) |
| "Intel Core i5", "i7", etc. | **`Synoria-x64.dmg`** (Intel) |

> ⚠️ **Attention :** Télécharger la mauvaise version n'empêche pas l'application de fonctionner (Rosetta 2 peut émuler), mais les performances seront moins bonnes. Préférez toujours la version native.

### 3.2 Installation depuis le DMG

1. Ouvrez le fichier **`.dmg`** téléchargé (double-clic)
2. Une fenêtre s'affiche avec l'icône Synoria et le dossier **Applications**
3. **Glissez l'icône Synoria vers le dossier Applications**
4. Attendez la fin de la copie, puis fermez la fenêtre du DMG
5. Éjectez le disque virtuel depuis le bureau ou le Finder

**Emplacement des données :**
```
~/Library/Application Support/Synoria/
```

**Première ouverture :**

Mac bloque par défaut les applications non téléchargées depuis l'App Store. Pour ouvrir Synoria la première fois :

1. Faites un **clic droit** (ou Ctrl+clic) sur l'icône Synoria dans Applications
2. Sélectionnez **"Ouvrir"** dans le menu contextuel
3. Une boîte de dialogue apparaît — cliquez sur **"Ouvrir"**

> 💡 **Conseil :** Cette manipulation n'est nécessaire qu'à la **première ouverture**. Les fois suivantes, Synoria se lance normalement depuis le Dock ou le Launchpad.

### 3.3 Application non signée — message de sécurité Mac

**Pourquoi ce message apparaît-il ?**

macOS affiche un avertissement pour toute application qui n'est pas signée avec un certificat Apple Developer officiel. Ce certificat est payant (99 €/an) et réservé aux éditeurs de l'App Store ou aux développeurs enregistrés Apple. Synoria est un logiciel indépendant distribué hors App Store — cela n'affecte pas sa sécurité ou son fonctionnement.

**Si le message "Application endommagée" ou "Impossible d'ouvrir" apparaît :**

1. Ouvrez **Paramètres système** (icône Pomme → Paramètres système)
2. Allez dans **Confidentialité et sécurité**
3. Faites défiler vers le bas jusqu'à la section **"Sécurité"**
4. Vous verrez un message du type *"Synoria a été bloqué"* — cliquez sur **"Ouvrir quand même"**
5. Confirmez dans la boîte de dialogue qui s'affiche

**Méthode alternative (Terminal) si la méthode ci-dessus ne fonctionne pas :**

```bash
xattr -cr /Applications/Synoria.app
```

Copiez cette commande dans l'application Terminal (Applications → Utilitaires → Terminal) et appuyez sur Entrée. Cette commande supprime les attributs de quarantaine ajoutés par macOS.

---

## 4. 🚀 Premier démarrage

Quelle que soit la plateforme, le premier démarrage suit toujours la même procédure :

1. Synoria affiche un **écran de bienvenue** pendant 2 secondes
2. Vous êtes invité à **créer votre mot de passe**

> ⚠️ **Attention — Information critique :**  
> Votre mot de passe **chiffre intégralement** toute votre base de données. Sans lui, aucune donnée n'est accessible — ni par vous, ni par personne d'autre.  
> **Notez-le dans un endroit sûr** (gestionnaire de mots de passe, document papier en lieu sûr, coffre-fort...).  
> Il n'existe **aucune procédure de récupération** en cas de perte.

**Recommandations pour le mot de passe :**
- Minimum 8 caractères
- Mélange de lettres, chiffres et symboles recommandé
- Évitez les dates de naissance ou prénoms facilement devinables

3. Saisissez le mot de passe deux fois pour confirmer
4. Synoria initialise votre base de données — cela prend quelques secondes
5. Le **tableau de bord** s'affiche : vous êtes prêt

---

## 5. 🔌 Installation d'un plugin

Les plugins permettent d'adapter le formulaire de séance à votre spécialité. Chaque plugin est un fichier **`.plugin.json`**.

**Plugins disponibles :**

| Plugin | Spécialité |
|---|---|
| `mtc_jp.plugin.json` | Médecine Traditionnelle Chinoise (formulaire JP Timoner) |
| `kinesio.plugin.json` | Kinésiologie (Charlotte Decaens) |
| `osteopathie.plugin.json` | Ostéopathie |

**Procédure d'installation :**

1. Récupérez le fichier `.plugin.json` fourni avec votre licence ou disponible sur le site Synoria
2. Dans Synoria, allez dans **Paramètres → Plugin**
3. Cliquez sur **"Importer un plugin"**
4. Sélectionnez le fichier `.plugin.json` sur votre ordinateur
5. Confirmez l'importation
6. **Redémarrez l'application** pour que le plugin soit actif

> 💡 **Conseil :** Un seul plugin peut être actif à la fois. Pour changer de plugin, importez le nouveau — l'ancien est remplacé. Vos séances passées conservent le formulaire utilisé au moment de leur saisie.

---

## 6. 🗑️ Désinstallation

### Windows

1. Ouvrez **Paramètres** (touche Windows + I)
2. Allez dans **Applications → Applications installées**
3. Recherchez **"Synoria"** dans la liste
4. Cliquez sur les **...** → **"Désinstaller"**
5. Confirmez la désinstallation

### Mac

1. Ouvrez le **Finder** → dossier **Applications**
2. Faites glisser **Synoria.app** vers la **Corbeille**
3. Videz la corbeille

> ⚠️ **Attention :** La désinstallation supprime uniquement l'application. Vos données (base de données, sauvegardes, paramètres) **ne sont PAS supprimées automatiquement**.

**Pour supprimer aussi vos données (suppression complète) :**

- **Windows :** Supprimez manuellement le dossier :
  ```
  C:\Users\[votre_nom]\AppData\Roaming\Synoria\
  ```
- **Mac :** Supprimez manuellement le dossier :
  ```
  ~/Library/Application Support/Synoria/
  ```

> ⚠️ **Attention :** La suppression des données est **irréversible**. Faites une sauvegarde exportée (fichier `.json.enc`) avant toute suppression définitive.

---

## 7. 🔧 Résolution des problèmes courants à l'installation

### 7.1 L'antivirus bloque l'installation

Certains antivirus (Windows Defender, Avast, Bitdefender...) peuvent signaler Synoria comme suspect car c'est un logiciel peu distribué (faux positif).

**Solution :** Ajoutez une exception dans votre antivirus pour le fichier d'installation et pour le dossier d'installation de Synoria. La procédure varie selon l'antivirus — consultez sa documentation ou désactivez-le temporairement pendant l'installation.

### 7.2 "Windows a protégé votre PC" (SmartScreen)

Ce message s'affiche car Synoria n'est pas signé par un éditeur reconnu dans la base Microsoft.

**Solution :**
1. Dans la boîte de dialogue SmartScreen, cliquez sur **"Informations complémentaires"**
2. Un bouton **"Exécuter quand même"** apparaît en bas — cliquez dessus
3. L'installation se poursuit normalement

### 7.3 Mac — "L'application est endommagée et ne peut pas être ouverte"

Ce message peut apparaître même si le fichier est intact. Il s'agit d'une restriction de quarantaine macOS.

**Solution :** Ouvrez le Terminal et exécutez :
```bash
xattr -cr /Applications/Synoria.app
```
Puis relancez l'application.

### 7.4 L'application ne démarre pas après installation

- Vérifiez que votre système est bien en **64 bits** (Windows : Paramètres → Système → À propos)
- Sur Mac, vérifiez que vous avez téléchargé la bonne version (arm64 vs x64)
- Redémarrez votre ordinateur et relancez Synoria
- Consultez les journaux d'erreur dans le dossier d'installation

> 💡 **Conseil :** Si le problème persiste, contactez le support à **jeanpierre.timoner.mtc@gmail.com** en joignant une capture d'écran du message d'erreur.
