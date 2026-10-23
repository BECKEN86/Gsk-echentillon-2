# GeStock

Application de gestion commerciale : stocks, achats (demandes de prix, bons de
commande, réceptions), caisse POS (sessions, ventes, tickets, factures A4),
clients, fournisseurs, finance (recettes/dépenses, trésorerie, marges) et
paramètres (utilisateurs, configuration société, journal d'audit).

**Stack :** React 19 + TypeScript (strict) + Vite + Tailwind CSS 4 — API Express
locale avec persistance **SQLite uniquement** (`node:sqlite`) — aucune donnée
ne quitte le poste.

## Prérequis

- Node.js **24+** (requis pour `node:sqlite`)
- npm

## Démarrage (2 terminaux)

```bash
npm install

# Terminal 1 — API (port 8787)
npm run server

# Terminal 2 — Frontend Vite (port 3000, proxy /api -> 8787)
npm run dev
```

Ouvrir http://localhost:3000

> Sans `npm run server`, l'application fonctionne en mode dégradé sur
> `localStorage` uniquement.

## Authentification

- À la première ouverture, créez le compte Administrateur dans l’écran de
  configuration initiale. Aucun utilisateur ou mot de passe par défaut n’est
  fourni.
- **Serveur** : `POST /api/auth/login` vérifie le hash **scrypt** côté serveur
  et émet un token de session (12 h) stocké en base (`sessions`).
- Toutes les routes `/api/db*` exigent un en-tête `Authorization: Bearer <token>` ;
  `POST /api/db/reset` est réservé au rôle Administrateur.
- Les mots de passe sont **hachés** à l'écriture (jamais renvoyés aux clients) ;
  les anciens comptes en clair sont migrés automatiquement à la 1ʳᵉ connexion.
- Désactivation, édition et reset de mot de passe : Paramètres → Utilisateurs.
- Si le serveur est éteint : repli local (mode dégradé, non sécurisé).

## Base de données & synchronisation

**SQLite local uniquement** — aucun serveur distant (Supabase/PostgreSQL/Firebase
retirés) : toutes les données restent sur le poste.

| Emplacement    | Fichier                                  |
|----------------|------------------------------------------|
| Mode web/dev   | `server/data/gestock.db`                 |
| App desktop    | `%APPDATA%\GeStock\data\gestock.db`      |

- **Sync par entité** : le frontend envoie uniquement les lignes modifiées
  (`PUT/DELETE /api/db/:collection/:id`) au lieu de réécrire toute la base.
- **Multi-postes** : un compteur de révision (`meta.rev`) est incrémenté à
  chaque écriture ; chaque poste poll `GET /api/rev` (~10 s) et recharge la base
  si un autre poste a écrit.
- `PUT /api/db` (remplacement complet) reste disponible pour import/restauration.

## API

| Méthode | Route                        | Accès     |
|---------|------------------------------|-----------|
| GET     | `/api/auth/setup-status`     | public    |
| POST    | `/api/auth/setup`            | public, une seule fois |
| POST    | `/api/auth/login`            | public    |
| POST    | `/api/auth/logout`           | Bearer    |
| GET     | `/api/auth/me`               | Bearer    |
| GET     | `/api/health`, `/api/stats`  | public    |
| GET     | `/api/rev`                   | Bearer    |
| GET     | `/api/db`                    | Bearer    |
| PUT     | `/api/db`                    | Bearer    |
| PUT/DEL | `/api/db/:collection/:id`    | Bearer    |
| PUT     | `/api/meta`                  | Bearer    |
| POST    | `/api/db/reset`              | Admin     |

## Tests & CI

```bash
npm test        # Vitest — règles métier, numérotation, dates, auth serveur
npm run lint    # tsc --noEmit (strict)
npm run build   # build de production
```

CI : `.github/workflows/ci.yml` exécute `npm ci` → lint → tests → build à
chaque push/PR sur `main`.

## Déploiement

**Application desktop Windows** : `build-windows-exe.bat` (ou `npm run dist:win`)
génère `release/GeStock-Setup-1.0.0.exe` — serveur et base SQLite embarqués,
données dans `%APPDATA%\GeStock\data`. Aucun déploiement cloud n'est prévu :
le serveur est toujours local (`localhost`).
