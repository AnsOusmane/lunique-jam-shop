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
- Admin : http://localhost:4200/admin/login — `admin@luniquejam.com` / `LuniqueJam#2026`
  (changer via la variable d'env `ADMIN_PASSWORD` avant le premier lancement, et `JWT_SECRET` en prod)

## Production (un seul process)

```bash
cd client && npm run build     # génère client/dist
cd ../server && npm start      # sert l'API et le front sur :3000
```

## Structure

```
client/   Angular 20 — pages: catalogue, produit, panier, commande, merci, suivi, admin
server/   Express — src/db.js (schéma+seed), src/auth.js (Argon2id+JWT), src/index.js (routes)
```

La base `server/luniquejam.db` est créée automatiquement (non versionnée).
Pour repartir de zéro : supprimer ce fichier et relancer le serveur.
