# Lunique Jam — Boutique en ligne

Boutique e-commerce complète de la marque **Lunique Jam** (*Style with Values*, Dakar).
Stack : **Angular 20** (standalone components, signals) + **Express / Node 22** + **SQLite**.

## Fonctionnalités

**Boutique**
- Catalogue Drop 001 — Genesis (8 pièces), filtres par catégorie, visuels 100 % CSS/SVG
- Fiche produit : tailles avec stock en temps réel, alerte stock bas, quantité
- Panier persistant (localStorage, signals), récap avec frais de livraison par zone
- Checkout : livraison Dakar (2 000 F) / régions (3 500 F) / retrait Ouakam (gratuit),
  paiement **Wave**, **Orange Money** ou **à la livraison** (flux simulé, prêt à brancher)
- Confirmation avec référence `LJ-XXXXXX` + suivi de commande public (réf + téléphone)

**Comptes clients** (`/compte`)
- Inscription / connexion (Argon2id, JWT 30 jours), profil avec adresse de livraison
- Historique des commandes lié au compte, checkout pré-rempli

**Notifications**
- E-mail de bienvenue, de confirmation de commande et de changement de statut
- SMS de confirmation et de suivi (crochet prêt pour Twilio / Orange SMS API)
- Sans fournisseur configuré : tout est archivé dans `server/outbox/` + journal en base
  (visible dans l'admin, onglet Notifications). Pour un envoi réel : variables d'env
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (Brevo, Gmail, Resend…)

**Codes promo**
- Pourcentage ou montant fixe, minimum d'achat, activation/désactivation dans l'admin
- Validés et recalculés côté serveur ; `GENESIS10` (-10 %) seedé pour tester

**Back-office** (`/admin`)
- Auth JWT, mots de passe hachés **Argon2id** (paramètres OWASP)
- Stats : commandes, chiffre d'affaires, à traiter, stock critique
- Gestion des commandes (statuts, paiement), stocks par variante, promos, notifications
- Annulation d'une commande = stock restitué automatiquement (réactivation re-vérifie le stock)
- Produits : créer/éditer/désactiver/supprimer une pièce, gérer ses tailles, uploader des
  photos (jpeg/png/webp/avif, 8 Mo max) et vidéos (mp4/webm/mov, 50 Mo max) — stockées sur
  disque sous `DATA_DIR/uploads`, servies via `/uploads/…`
- Comptes admin : inviter/retirer un membre de l'équipe (tous ont un accès complet, pas de
  rôles distincts pour l'instant)

**API Express**
- Commandes transactionnelles : le stock est vérifié et décrémenté atomiquement
- Validation serveur systématique, rate-limiting (commandes, login), helmet, CORS

## Démarrer

```bash
# 1. API (port 3000) — crée et seed la base au premier lancement
cd server && npm install && npm run dev

# 2. Front Angular (port 4200, proxy /api → 3000)
cd client && npm install && npm start
```

- Boutique : http://localhost:4200
- Admin : http://localhost:4200/admin/login — `admin@luniquejam.com`, mot de passe défini par
  la variable d'env `ADMIN_PASSWORD`. À chaque démarrage, le hash en base est resynchronisé
  sur cette variable : pour changer le mot de passe, il suffit de la modifier et de redémarrer.
  Sans variable définie, un mot de passe de dev par défaut est utilisé au premier seed
  (voir `server/src/db.js`) — à ne jamais laisser en prod, tout comme `JWT_SECRET`.

## Production (un seul process)

```bash
cd client && npm run build     # génère client/dist
cd ../server && npm start      # sert l'API et le front sur :3000
```

## Branches & mise en production

- **`main`** → production. Chaque push redéploie Railway. On ne code jamais dessus.
- **`dev`** → travail quotidien. Optionnel : branches `feat/<nom>` fusionnées dans `dev`.

```bash
# Coder (sur dev)
git checkout dev
git add . && git commit -m "…" && git push

# Mettre en production (quand dev est testé)
git checkout main
git merge dev
git push          # → déploiement Railway automatique
git checkout dev  # on repart sur dev
```

## Déploiement (Railway recommandé)

Le `Dockerfile` à la racine construit le client Angular puis lance Express qui sert tout.

1. [railway.com](https://railway.com) → **Login with GitHub** → New Project → **Deploy from GitHub repo** → `lunique-jam-shop`
2. Dans le service : **Settings → Volumes → Add Volume**, mount path `/data`
3. **Variables** :
   - `DATA_DIR=/data` (base SQLite + outbox + photos/vidéos produits sur le volume persistant)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (Brevo)
   - `JWT_SECRET` (longue chaîne aléatoire), `ADMIN_PASSWORD` (resynchronisé à chaque démarrage)
   - `PUBLIC_URL=https://<ton-domaine>` (liens dans les e-mails + CORS)
4. **Settings → Networking → Generate Domain** → l'URL publique est prête (HTTPS inclus)

Chaque `git push` sur `main` redéploie automatiquement.

## Structure

```
client/   Angular 20 — pages: catalogue, produit, panier, commande, merci, suivi, admin
server/   Express — src/db.js (schéma+seed), src/auth.js (Argon2id+JWT), src/index.js (routes)
```

La base `server/luniquejam.db` est créée automatiquement (non versionnée).
Pour repartir de zéro : supprimer ce fichier et relancer le serveur.
