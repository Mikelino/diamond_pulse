# Walk-Up Songs — Guide d'installation

Application de gestion des walk-up songs pour clubs de baseball/softball.  
Chaque joueur a sa chanson d'entrée, gérée en temps réel depuis le terrain.

---

## Fichiers inclus

```
index.html        → Application principale
config.js         → Configuration du club (à modifier)
setup.sql         → Script d'installation Supabase
manifest.json     → Configuration PWA (installation mobile)
icons/            → Logo et icônes
```

---

## Installation en 4 étapes

### Étape 1 — Créer un projet Supabase

1. Rendez-vous sur [supabase.com](https://supabase.com) et créez un compte gratuit
2. Cliquez sur **New project** et donnez-lui un nom (ex: `walkup-monclub`)
3. Choisissez une région **Europe (Frankfurt)** pour le RGPD
4. Notez le mot de passe de la base de données quelque part en sécurité
5. Attendez que le projet soit prêt (~1 minute)

### Étape 2 — Installer la base de données

1. Dans votre projet Supabase, allez dans **SQL Editor** > **New query**
2. Copiez-collez l'intégralité du fichier `setup.sql`
3. Cliquez sur **Run** (▶)
4. Vérifiez qu'il n'y a pas d'erreurs en rouge

### Étape 3 — Configurer l'application

1. Ouvrez le fichier `config.js` dans un éditeur de texte
2. Dans Supabase, allez dans **Project Settings** > **API**
3. Copiez **Project URL** → collez dans `supabaseUrl`
4. Copiez **anon public** (sous "Project API keys") → collez dans `supabaseKey`
5. Remplissez les autres champs :

```js
const APP_CONFIG = {
  supabaseUrl:   'https://abcdefgh.supabase.co',  // votre URL
  supabaseKey:   'eyJhbGc...',                     // votre clé anon
  adminPassword: 'MotDePasseSecret123!',           // choisissez-en un fort
  clubName:      'Black Bears Andenne',            // nom de votre club
  clubSub:       'Walk-Up Songs',                  // sous-titre
  defaultTeams: {
    U12:      'U12',
    Seniors:  'Seniors D1',
    // ajoutez vos équipes ici
  },
  playDuration: 15,  // durée de lecture en secondes
};
```

### Étape 4 — Mettre en ligne

Uploadez tous les fichiers sur votre hébergeur web via FTP ou votre panel d'administration :

```
index.html
config.js
manifest.json
icons/
```

> **Note** : `setup.sql` ne doit pas nécessairement être uploadé, il n'est utilisé que pour l'installation Supabase.

---

## Installer comme application mobile (PWA)

L'application peut s'installer sur iPhone ou Android comme une vraie app, sans passer par l'App Store.

**Sur iPhone (Safari) :**
1. Ouvrez l'URL de votre site dans Safari
2. Appuyez sur le bouton Partager (carré avec flèche)
3. Sélectionnez **Sur l'écran d'accueil**
4. Confirmez

**Sur Android (Chrome) :**
1. Ouvrez l'URL dans Chrome
2. Appuyez sur les 3 points en haut à droite
3. Sélectionnez **Ajouter à l'écran d'accueil**

---

## Utilisation

### Mot de passe admin
Le bouton ⚙️ en haut à droite ouvre la configuration.  
Le mot de passe est celui défini dans `config.js` (ou modifié depuis Config > Sécurité).

### Ajouter des joueurs
Onglet **Batting Order** > **+ Ajouter un joueur**.  
Chaque joueur peut avoir : nom, numéro, position, chanson, artiste, fichier audio.

### Jouer une walk-up song
Cliquez sur la carte d'un joueur pour lancer sa chanson (15 secondes par défaut).

### Exporter les stories Instagram
Onglet **Social Media** : story lineup, story score, story MVP.

---

## Limites du plan gratuit Supabase

| Ressource       | Gratuit          |
|-----------------|------------------|
| Base de données | 500 MB           |
| Stockage        | 1 GB             |
| Bande passante  | 5 GB / mois      |
| Requêtes API    | Illimitées       |

Pour un usage club standard (< 100 joueurs, quelques dizaines de Mo audio), le plan gratuit est largement suffisant.

---

## Support

Pour toute question, contactez le développeur de l'application.
