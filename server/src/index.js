import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db, { UPLOADS_DIR } from './db.js';
import {
  login, requireAdmin, hashPassword,
  registerCustomer, loginCustomer, customerToken, customerById,
  requireCustomer, optionalCustomer,
} from './auth.js';
import { sendEmail, sendSms, orderConfirmationEmail, orderConfirmationSms, statusUpdateMessages } from './notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Derrière le proxy de l'hébergeur (Railway/Render), nécessaire pour le rate-limiting par IP.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// CSP désactivée : l'app charge Google Fonts et utilise des styles inline Angular.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [/^http:\/\/localhost:\d+$/, process.env.PUBLIC_URL].filter(Boolean),
}));
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

/* ============ Mode maintenance ============ */
// Active via la variable d'env MAINTENANCE_MODE=true sur l'hébergeur, puis redémarrage du service.
// L'espace équipe (/api/admin, /api/auth/login) reste accessible pour pouvoir gérer la boutique pendant la maintenance.
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
if (MAINTENANCE_MODE) {
  const maintenanceAssets = path.join(__dirname, '..', 'public', 'maintenance');
  const maintenancePage = fs.readFileSync(path.join(__dirname, '..', 'public', 'maintenance.html'), 'utf8');
  app.use('/maintenance-assets', express.static(maintenanceAssets, { maxAge: '1d' }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth/login')) return next();
    if (req.path.startsWith('/api')) return res.status(503).json({ error: 'Boutique en maintenance' });
    res.status(503).set('Retry-After', '3600').type('html').send(maintenancePage);
  });
  console.log('⚠ Mode maintenance ACTIF — boutique publique désactivée');
}

const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

/* ============ Helpers ============ */
const ZONES = { dakar: 2000, regions: 3500, retrait: 0 };
const PAYMENTS = ['wave', 'orange_money', 'livraison'];
const STATUSES = ['recue', 'confirmee', 'preparation', 'expediee', 'livree', 'annulee'];

function productWithVariants(row) {
  const variants = db.prepare('SELECT id, size, stock FROM variants WHERE product_id = ? ORDER BY id').all(row.id);
  const mediaRows = db.prepare('SELECT id, type, filename FROM product_media WHERE product_id = ? ORDER BY position, id').all(row.id);
  const media = mediaRows.map((m) => ({ id: m.id, type: m.type, url: `/uploads/${m.filename}` }));
  return { ...row, badge: row.badge || null, variants, media };
}

function makeRef() {
  const chars = 'ACDEFHJKLMNPRTUVWXY345679';
  let ref = 'LJ-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

/** Retourne { discount, promo } ou { error }. */
function checkPromo(code, subtotal) {
  const promo = db.prepare('SELECT * FROM promos WHERE code = ? AND active = 1').get(String(code).toUpperCase().trim());
  if (!promo) return { error: 'Code promo invalide ou expiré' };
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) return { error: 'Code promo expiré' };
  if (subtotal < promo.min_subtotal) {
    return { error: `Ce code demande un minimum de ${promo.min_subtotal.toLocaleString('fr-FR')} F d'achat` };
  }
  const discount = promo.type === 'percent'
    ? Math.round((subtotal * promo.value) / 100)
    : Math.min(promo.value, subtotal);
  return { discount, promo };
}

function notifyOrderCreated(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return;
  const items = db.prepare('SELECT name, size, qty, price FROM order_items WHERE order_id = ?').all(orderId);
  const mail = orderConfirmationEmail(order, items);
  if (order.email) sendEmail({ orderRef: order.ref, to: order.email, ...mail }).catch(() => {});
  sendSms({ orderRef: order.ref, to: order.phone, text: orderConfirmationSms(order) }).catch(() => {});
}

function notifyStatusChanged(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return;
  const msgs = statusUpdateMessages(order);
  if (!msgs) return;
  if (order.email) sendEmail({ orderRef: order.ref, to: order.email, ...msgs.email }).catch(() => {});
  sendSms({ orderRef: order.ref, to: order.phone, text: msgs.sms }).catch(() => {});
}

/* ============ Public : visites ============ */
const insertPageView = db.prepare('INSERT INTO page_views (path, visitor_id) VALUES (?, ?)');
app.post('/api/track', trackLimiter, (req, res) => {
  const path = String(req.body?.path || '').slice(0, 200);
  const visitorId = String(req.body?.visitorId || '').slice(0, 64);
  if (!path.startsWith('/') || !visitorId) return res.status(400).json({ error: 'Requête invalide' });
  insertPageView.run(path, visitorId);
  res.status(204).end();
});

/* ============ Public : produits ============ */
app.get('/api/products', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY id').all();
  res.json(rows.map(productWithVariants));
});

app.get('/api/products/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Pièce introuvable' });
  res.json(productWithVariants(row));
});

/* ============ Public : commandes ============ */
app.post('/api/orders', orderLimiter, optionalCustomer, (req, res) => {
  const { customer, items, payment, promoCode } = req.body || {};

  // Validation
  if (!customer || typeof customer !== 'object') return res.status(400).json({ error: 'Informations client manquantes' });
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const email = String(customer.email || '').trim();
  const address = String(customer.address || '').trim();
  const city = String(customer.city || '').trim();
  const zone = String(customer.zone || '').trim();

  if (name.length < 2 || name.length > 120) return res.status(400).json({ error: 'Nom invalide' });
  if (!/^(\+?\d[\d\s]{7,17})$/.test(phone)) return res.status(400).json({ error: 'Numéro de téléphone invalide' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail invalide' });
  if (address.length < 4 || address.length > 300) return res.status(400).json({ error: 'Adresse invalide' });
  if (city.length < 2 || city.length > 80) return res.status(400).json({ error: 'Ville invalide' });
  if (!(zone in ZONES)) return res.status(400).json({ error: 'Zone de livraison invalide' });
  if (!PAYMENTS.includes(payment)) return res.status(400).json({ error: 'Moyen de paiement invalide' });
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) return res.status(400).json({ error: 'Panier vide ou invalide' });

  for (const it of items) {
    if (!Number.isInteger(it?.productId) || typeof it?.size !== 'string' ||
        !Number.isInteger(it?.qty) || it.qty < 1 || it.qty > 10) {
      return res.status(400).json({ error: 'Article invalide dans le panier' });
    }
  }

  const getVariant = db.prepare('SELECT v.id, v.stock, p.name, p.price FROM variants v JOIN products p ON p.id = v.product_id WHERE v.product_id = ? AND v.size = ? AND p.active = 1');
  const decrement = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?');
  const insertOrder = db.prepare(`
    INSERT INTO orders (ref, customer_name, phone, email, address, city, zone, delivery_fee, subtotal, total, payment_method, customer_id, promo_code, discount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, size, qty, price) VALUES (?, ?, ?, ?, ?, ?)');

  try {
    const result = db.transaction(() => {
      let subtotal = 0;
      const lines = [];

      for (const it of items) {
        const v = getVariant.get(it.productId, it.size);
        if (!v) throw { status: 400, msg: `Article introuvable (produit ${it.productId}, taille ${it.size})` };
        const changed = decrement.run(it.qty, v.id, it.qty).changes;
        if (changed === 0) throw { status: 409, msg: `Stock insuffisant pour ${v.name} (${it.size}) — il en reste ${v.stock}` };
        subtotal += v.price * it.qty;
        lines.push({ productId: it.productId, name: v.name, size: it.size, qty: it.qty, price: v.price });
      }

      let discount = 0;
      let appliedPromo = null;
      if (promoCode) {
        const check = checkPromo(promoCode, subtotal);
        if (check.error) throw { status: 400, msg: check.error };
        discount = check.discount;
        appliedPromo = check.promo.code;
      }

      const deliveryFee = ZONES[zone];
      const total = Math.max(0, subtotal - discount) + deliveryFee;
      let ref = makeRef();
      while (db.prepare('SELECT 1 FROM orders WHERE ref = ?').get(ref)) ref = makeRef();

      const { lastInsertRowid: orderId } = insertOrder.run(
        ref, name, phone, email || null, address, city, zone, deliveryFee, subtotal, total, payment,
        req.customer?.sub ?? null, appliedPromo, discount,
      );
      for (const l of lines) insertItem.run(orderId, l.productId, l.name, l.size, l.qty, l.price);

      return { orderId, ref, subtotal, discount, deliveryFee, total };
    })();

    notifyOrderCreated(result.orderId);
    const { orderId, ...pub } = result;
    res.status(201).json(pub);
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ error: err.msg });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur, réessaie dans un instant' });
  }
});

// Suivi public : ref + téléphone (évite d'exposer les commandes d'autrui)
app.get('/api/orders/:ref', (req, res) => {
  const phone = String(req.query.phone || '').replace(/\s/g, '');
  const order = db.prepare('SELECT * FROM orders WHERE ref = ?').get(String(req.params.ref).toUpperCase().trim());
  if (!order || order.phone.replace(/\s/g, '') !== phone) {
    return res.status(404).json({ error: 'Commande introuvable — vérifie la référence et le téléphone' });
  }
  const items = db.prepare('SELECT name, size, qty, price FROM order_items WHERE order_id = ?').all(order.id);
  const { id, ...pub } = order;
  res.json({ ...pub, items });
});

/* ============ Public : code promo ============ */
app.post('/api/promos/validate', (req, res) => {
  const { code, subtotal } = req.body || {};
  if (!code || !Number.isInteger(subtotal) || subtotal < 0) {
    return res.status(400).json({ error: 'Code ou montant invalide' });
  }
  const check = checkPromo(code, subtotal);
  if (check.error) return res.status(400).json({ error: check.error });
  res.json({ code: check.promo.code, discount: check.discount });
});

/* ============ Comptes clients ============ */
app.post('/api/customers/register', loginLimiter, async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Nom invalide' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) return res.status(400).json({ error: 'E-mail invalide' });
  if (!/^(\+?\d[\d\s]{7,17})$/.test(String(phone || '').trim())) return res.status(400).json({ error: 'Téléphone invalide' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });

  const result = await registerCustomer({ name, email, phone, password });
  if (result.error) return res.status(409).json({ error: result.error });

  sendEmail({
    to: result.customer.email,
    subject: 'Bienvenue dans le Cercle — Lunique Jam',
    text: `Salut ${result.customer.name},\n\nTon compte Lunique Jam est prêt. Accès prioritaire aux drops, suivi simplifié, commandes plus rapides.\n\nClean fits, clean heart.\n— Lunique Jam, Dakar`,
  }).catch(() => {});

  res.status(201).json({ token: customerToken(result.customer), customer: result.customer });
});

app.post('/api/customers/login', loginLimiter, async (req, res) => {
  const customer = await loginCustomer(req.body?.email, req.body?.password);
  if (!customer) return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
  res.json({ token: customerToken(customer), customer });
});

app.get('/api/customers/me', requireCustomer, (req, res) => {
  const customer = customerById(req.customer.sub);
  if (!customer) return res.status(404).json({ error: 'Compte introuvable' });
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC').all(customer.id);
  const itemsStmt = db.prepare('SELECT name, size, qty, price FROM order_items WHERE order_id = ?');
  res.json({ customer, orders: orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) })) });
});

app.patch('/api/customers/me', requireCustomer, (req, res) => {
  const { name, phone, address, city, zone } = req.body || {};
  if (name !== undefined && String(name).trim().length < 2) return res.status(400).json({ error: 'Nom invalide' });
  if (phone !== undefined && !/^(\+?\d[\d\s]{7,17})$/.test(String(phone).trim())) return res.status(400).json({ error: 'Téléphone invalide' });
  if (zone !== undefined && zone !== '' && !(zone in ZONES)) return res.status(400).json({ error: 'Zone invalide' });

  const current = customerById(req.customer.sub);
  if (!current) return res.status(404).json({ error: 'Compte introuvable' });

  db.prepare('UPDATE customers SET name = ?, phone = ?, address = ?, city = ?, zone = ? WHERE id = ?').run(
    name !== undefined ? String(name).trim() : current.name,
    phone !== undefined ? String(phone).trim() : current.phone,
    address !== undefined ? String(address).trim() : current.address,
    city !== undefined ? String(city).trim() : current.city,
    zone !== undefined ? zone : current.zone,
    current.id,
  );
  res.json({ customer: customerById(current.id) });
});

/* ============ Auth admin ============ */
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const result = await login(req.body?.email, req.body?.password);
  if (!result) return res.status(401).json({ error: 'Identifiants incorrects' });
  res.json(result);
});

/* ============ Admin ============ */
app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
  const itemsStmt = db.prepare('SELECT name, size, qty, price FROM order_items WHERE order_id = ?');
  res.json(orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) })));
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const { status, payment_status } = req.body || {};
  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  let statusChanged = false;
  try {
    db.transaction(() => {
      if (status !== undefined && status !== order.status) {
        if (!STATUSES.includes(status)) throw { status: 400, msg: 'Statut invalide' };

        const items = db.prepare('SELECT product_id, size, qty FROM order_items WHERE order_id = ?').all(order.id);
        const restock = db.prepare('UPDATE variants SET stock = stock + ? WHERE product_id = ? AND size = ?');
        const decrement = db.prepare('UPDATE variants SET stock = stock - ? WHERE product_id = ? AND size = ? AND stock >= ?');

        if (status === 'annulee') {
          // Annulation : on restitue le stock
          for (const it of items) restock.run(it.qty, it.product_id, it.size);
        } else if (order.status === 'annulee') {
          // Réactivation : on re-décrémente, en refusant si le stock est parti ailleurs
          for (const it of items) {
            const changed = decrement.run(it.qty, it.product_id, it.size, it.qty).changes;
            if (changed === 0) throw { status: 409, msg: 'Réactivation impossible : stock insuffisant (vendu entre-temps)' };
          }
        }
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
        statusChanged = true;
      }
      if (payment_status !== undefined) {
        if (!['en_attente', 'paye', 'rembourse'].includes(payment_status)) throw { status: 400, msg: 'Statut de paiement invalide' };
        db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(payment_status, order.id);
      }
    })();
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ error: err.msg });
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }

  if (statusChanged) notifyStatusChanged(order.id);
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id));
});

/* ============ Admin : promos ============ */
app.get('/api/admin/promos', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM promos ORDER BY id DESC').all());
});

app.post('/api/admin/promos', requireAdmin, (req, res) => {
  const { code, type, value, min_subtotal, expires_at } = req.body || {};
  const cleanCode = String(code || '').toUpperCase().trim();
  if (!/^[A-Z0-9_-]{3,24}$/.test(cleanCode)) return res.status(400).json({ error: 'Code invalide (3-24 caractères A-Z 0-9)' });
  if (!['percent', 'amount'].includes(type)) return res.status(400).json({ error: 'Type invalide' });
  if (!Number.isInteger(value) || value <= 0 || (type === 'percent' && value > 90)) {
    return res.status(400).json({ error: 'Valeur invalide (percent ≤ 90)' });
  }
  try {
    db.prepare('INSERT INTO promos (code, type, value, min_subtotal, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      cleanCode, type, value, Number.isInteger(min_subtotal) && min_subtotal > 0 ? min_subtotal : 0, expires_at || null,
    );
  } catch {
    return res.status(409).json({ error: 'Ce code existe déjà' });
  }
  res.status(201).json(db.prepare('SELECT * FROM promos WHERE code = ?').get(cleanCode));
});

app.patch('/api/admin/promos/:id', requireAdmin, (req, res) => {
  const promo = db.prepare('SELECT * FROM promos WHERE id = ?').get(req.params.id);
  if (!promo) return res.status(404).json({ error: 'Promo introuvable' });
  const active = req.body?.active;
  if (active !== 0 && active !== 1 && typeof active !== 'boolean') return res.status(400).json({ error: 'Champ active requis' });
  db.prepare('UPDATE promos SET active = ? WHERE id = ?').run(active ? 1 : 0, promo.id);
  res.json(db.prepare('SELECT * FROM promos WHERE id = ?').get(promo.id));
});

/* ============ Admin : produits ============ */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GARMENTS = ['tee', 'hoodie', 'cap', 'pants'];
const ARTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json(rows.map(productWithVariants));
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const b = req.body || {};
  const slug = String(b.slug || '').toLowerCase().trim();
  const name = String(b.name || '').trim();
  const color = String(b.color || '').trim();
  const description = String(b.description || '').trim();
  const category = String(b.category || '').trim();
  const badge = b.badge ? String(b.badge).trim() : null;
  const garment = String(b.garment || '');
  const art = String(b.art || '');
  const garm_color = String(b.garm_color || '');
  const mark_color = String(b.mark_color || '');
  const price = Number(b.price);
  const sizes = b.sizes && typeof b.sizes === 'object' ? b.sizes : null;

  if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Slug invalide (minuscules, chiffres, tirets)' });
  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Nom invalide' });
  if (!Number.isInteger(price) || price <= 0 || price > 1000000) return res.status(400).json({ error: 'Prix invalide' });
  if (color.length < 2 || color.length > 60) return res.status(400).json({ error: 'Couleur invalide' });
  if (description.length < 10 || description.length > 1000) return res.status(400).json({ error: 'Description trop courte' });
  if (category.length < 2 || category.length > 40) return res.status(400).json({ error: 'Catégorie invalide' });
  if (!GARMENTS.includes(garment)) return res.status(400).json({ error: 'Type de vêtement invalide' });
  if (!ARTS.includes(art)) return res.status(400).json({ error: 'Fond visuel invalide' });
  if (!HEX_RE.test(garm_color) || !HEX_RE.test(mark_color)) return res.status(400).json({ error: 'Couleur hexadécimale invalide' });
  if (!sizes || Object.keys(sizes).length === 0) return res.status(400).json({ error: 'Au moins une taille avec son stock' });
  for (const [size, stock] of Object.entries(sizes)) {
    if (!String(size).trim() || !Number.isInteger(stock) || stock < 0 || stock > 9999) {
      return res.status(400).json({ error: `Taille ou stock invalide (${size})` });
    }
  }

  try {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO products (slug, name, price, color, description, category, badge, art, garment, garm_color, mark_color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug, name, price, color, description, category, badge, art, garment, garm_color, mark_color);
    const insertVariant = db.prepare('INSERT INTO variants (product_id, size, stock) VALUES (?, ?, ?)');
    for (const [size, stock] of Object.entries(sizes)) insertVariant.run(lastInsertRowid, String(size).trim(), stock);
    res.status(201).json(productWithVariants(db.prepare('SELECT * FROM products WHERE id = ?').get(lastInsertRowid)));
  } catch {
    res.status(409).json({ error: 'Ce slug existe déjà' });
  }
});

app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Pièce introuvable' });
  const b = req.body || {};
  const next = { ...product };

  if (b.slug !== undefined) {
    const slug = String(b.slug).toLowerCase().trim();
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Slug invalide' });
    next.slug = slug;
  }
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Nom invalide' });
    next.name = name;
  }
  if (b.price !== undefined) {
    const price = Number(b.price);
    if (!Number.isInteger(price) || price <= 0 || price > 1000000) return res.status(400).json({ error: 'Prix invalide' });
    next.price = price;
  }
  if (b.color !== undefined) {
    const color = String(b.color).trim();
    if (color.length < 2 || color.length > 60) return res.status(400).json({ error: 'Couleur invalide' });
    next.color = color;
  }
  if (b.description !== undefined) {
    const description = String(b.description).trim();
    if (description.length < 10 || description.length > 1000) return res.status(400).json({ error: 'Description trop courte' });
    next.description = description;
  }
  if (b.category !== undefined) {
    const category = String(b.category).trim();
    if (category.length < 2 || category.length > 40) return res.status(400).json({ error: 'Catégorie invalide' });
    next.category = category;
  }
  if (b.badge !== undefined) next.badge = b.badge ? String(b.badge).trim() : null;
  if (b.garment !== undefined) {
    if (!GARMENTS.includes(b.garment)) return res.status(400).json({ error: 'Type de vêtement invalide' });
    next.garment = b.garment;
  }
  if (b.art !== undefined) {
    if (!ARTS.includes(b.art)) return res.status(400).json({ error: 'Fond visuel invalide' });
    next.art = b.art;
  }
  if (b.garm_color !== undefined) {
    if (!HEX_RE.test(b.garm_color)) return res.status(400).json({ error: 'Couleur invalide' });
    next.garm_color = b.garm_color;
  }
  if (b.mark_color !== undefined) {
    if (!HEX_RE.test(b.mark_color)) return res.status(400).json({ error: 'Couleur invalide' });
    next.mark_color = b.mark_color;
  }
  if (b.active !== undefined) next.active = b.active ? 1 : 0;

  try {
    db.prepare(`
      UPDATE products SET slug=?, name=?, price=?, color=?, description=?, category=?, badge=?, art=?, garment=?, garm_color=?, mark_color=?, active=?
      WHERE id=?
    `).run(next.slug, next.name, next.price, next.color, next.description, next.category, next.badge, next.art, next.garment, next.garm_color, next.mark_color, next.active, product.id);
  } catch {
    return res.status(409).json({ error: 'Ce slug existe déjà' });
  }
  res.json(productWithVariants(db.prepare('SELECT * FROM products WHERE id = ?').get(product.id)));
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const mediaRows = db.prepare('SELECT filename FROM product_media WHERE product_id = ?').all(req.params.id);
  const { changes } = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!changes) return res.status(404).json({ error: 'Pièce introuvable' });
  for (const m of mediaRows) fs.unlink(path.join(UPLOADS_DIR, m.filename), () => {});
  res.json({ ok: true });
});

app.post('/api/admin/products/:id/variants', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Pièce introuvable' });
  const size = String(req.body?.size || '').trim();
  const stock = Number(req.body?.stock);
  if (!size || size.length > 20) return res.status(400).json({ error: 'Taille invalide' });
  if (!Number.isInteger(stock) || stock < 0 || stock > 9999) return res.status(400).json({ error: 'Stock invalide' });
  try {
    const { lastInsertRowid } = db.prepare('INSERT INTO variants (product_id, size, stock) VALUES (?, ?, ?)').run(product.id, size, stock);
    res.status(201).json(db.prepare('SELECT id, size, stock FROM variants WHERE id = ?').get(lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Cette taille existe déjà pour cette pièce' });
  }
});

app.delete('/api/admin/variants/:id', requireAdmin, (req, res) => {
  const { changes } = db.prepare('DELETE FROM variants WHERE id = ?').run(req.params.id);
  if (!changes) return res.status(404).json({ error: 'Taille introuvable' });
  res.json({ ok: true });
});

/* ============ Admin : photos & vidéos produit ============ */
const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };
const VIDEO_EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };

function makeUpload(allowedMimes, maxBytes) {
  return multer({
    storage: multer.diskStorage({
      destination: UPLOADS_DIR,
      filename: (_req, file, cb) => cb(null, crypto.randomUUID() + allowedMimes[file.mimetype]),
    }),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, Object.prototype.hasOwnProperty.call(allowedMimes, file.mimetype)),
  });
}

const uploadImage = makeUpload(IMAGE_EXT, 8 * 1024 * 1024);
const uploadVideo = makeUpload(VIDEO_EXT, 50 * 1024 * 1024);

app.post('/api/admin/products/:id/media/image', requireAdmin, uploadImage.single('file'), (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Pièce introuvable' });
  }
  if (!req.file) return res.status(400).json({ error: 'Image invalide (jpeg, png, webp, avif — 8 Mo max)' });
  const { lastInsertRowid } = db.prepare('INSERT INTO product_media (product_id, type, filename) VALUES (?, ?, ?)')
    .run(product.id, 'image', req.file.filename);
  res.status(201).json({ id: lastInsertRowid, type: 'image', url: `/uploads/${req.file.filename}` });
});

app.post('/api/admin/products/:id/media/video', requireAdmin, uploadVideo.single('file'), (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Pièce introuvable' });
  }
  if (!req.file) return res.status(400).json({ error: 'Vidéo invalide (mp4, webm, mov — 50 Mo max)' });
  const { lastInsertRowid } = db.prepare('INSERT INTO product_media (product_id, type, filename) VALUES (?, ?, ?)')
    .run(product.id, 'video', req.file.filename);
  res.status(201).json({ id: lastInsertRowid, type: 'video', url: `/uploads/${req.file.filename}` });
});

app.delete('/api/admin/media/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT filename FROM product_media WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Média introuvable' });
  db.prepare('DELETE FROM product_media WHERE id = ?').run(req.params.id);
  fs.unlink(path.join(UPLOADS_DIR, row.filename), () => {});
  res.json({ ok: true });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux' : 'Erreur d\'upload';
    return res.status(400).json({ error: msg });
  }
  next(err);
});

/* ============ Admin : comptes équipe ============ */
app.get('/api/admin/admins', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT id, email, name FROM admins ORDER BY id').all());
});

app.post('/api/admin/admins', requireAdmin, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Nom invalide' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail invalide' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });

  const hash = await hashPassword(password);
  try {
    const { lastInsertRowid } = db.prepare('INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)').run(email, hash, name);
    res.status(201).json({ id: lastInsertRowid, email, name });
  } catch {
    res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail' });
  }
});

app.patch('/api/admin/admins/:id', requireAdmin, async (req, res) => {
  const admin = db.prepare('SELECT id FROM admins WHERE id = ?').get(req.params.id);
  if (!admin) return res.status(404).json({ error: 'Compte introuvable' });
  const { name, password } = req.body || {};
  if (name !== undefined) {
    const clean = String(name).trim();
    if (clean.length < 2 || clean.length > 80) return res.status(400).json({ error: 'Nom invalide' });
    db.prepare('UPDATE admins SET name = ? WHERE id = ?').run(clean, admin.id);
  }
  if (password !== undefined) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
    const hash = await hashPassword(String(password));
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);
  }
  res.json(db.prepare('SELECT id, email, name FROM admins WHERE id = ?').get(admin.id));
});

app.delete('/api/admin/admins/:id', requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.admin.sub) {
    return res.status(400).json({ error: 'Impossible de supprimer ton propre compte' });
  }
  const total = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  if (total <= 1) return res.status(400).json({ error: 'Impossible de supprimer le dernier compte admin' });
  const { changes } = db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
  if (!changes) return res.status(404).json({ error: 'Compte introuvable' });
  res.json({ ok: true });
});

/* ============ Admin : notifications ============ */
app.get('/api/admin/notifications', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all());
});

app.get('/api/admin/stock', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT v.id, p.name, p.slug, v.size, v.stock
    FROM variants v JOIN products p ON p.id = v.product_id
    ORDER BY p.id, v.id
  `).all();
  res.json(rows);
});

app.patch('/api/admin/stock/:variantId', requireAdmin, (req, res) => {
  const stock = req.body?.stock;
  if (!Number.isInteger(stock) || stock < 0 || stock > 9999) return res.status(400).json({ error: 'Stock invalide' });
  const { changes } = db.prepare('UPDATE variants SET stock = ? WHERE id = ?').run(stock, req.params.variantId);
  if (!changes) return res.status(404).json({ error: 'Variante introuvable' });
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS orders,
      COALESCE(SUM(total), 0) AS revenue,
      SUM(CASE WHEN status = 'recue' THEN 1 ELSE 0 END) AS pending
    FROM orders WHERE status != 'annulee'
  `).get();
  const lowStock = db.prepare(`
    SELECT p.name, v.size, v.stock FROM variants v
    JOIN products p ON p.id = v.product_id
    WHERE v.stock <= 3 ORDER BY v.stock
  `).all();
  res.json({ ...stats, lowStock });
});

app.get('/api/admin/traffic', requireAdmin, (_req, res) => {
  const totals = db.prepare(`
    SELECT COUNT(*) AS totalViews, COUNT(DISTINCT visitor_id) AS uniqueVisitors
    FROM page_views
  `).get();
  const today = db.prepare(`
    SELECT COUNT(*) AS n FROM page_views WHERE date(created_at) = date('now')
  `).get();
  const byDay = db.prepare(`
    SELECT date(created_at) AS date, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
    FROM page_views
    WHERE created_at >= datetime('now', '-14 days')
    GROUP BY date(created_at)
    ORDER BY date(created_at)
  `).all();
  const topPages = db.prepare(`
    SELECT path, COUNT(*) AS views
    FROM page_views
    GROUP BY path
    ORDER BY views DESC
    LIMIT 10
  `).all();
  res.json({ ...totals, viewsToday: today.n, byDay, topPages });
});

/* ============ 404 API ============ */
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

/* ============ Front Angular (build de production) ============ */
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist', 'client', 'browser');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log('✓ Front servi depuis client/dist (mode production)');
}

app.listen(PORT, () => {
  console.log(`✓ API Lunique Jam sur http://localhost:${PORT}`);
});
