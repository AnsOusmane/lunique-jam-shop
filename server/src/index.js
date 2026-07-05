import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { login, requireAdmin } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// CSP désactivée : l'app charge Google Fonts et utilise des styles inline Angular.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/] }));
app.use(express.json({ limit: '100kb' }));

const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

/* ============ Helpers ============ */
const ZONES = { dakar: 2000, regions: 3500, retrait: 0 };
const PAYMENTS = ['wave', 'orange_money', 'livraison'];
const STATUSES = ['recue', 'confirmee', 'preparation', 'expediee', 'livree', 'annulee'];

function productWithVariants(row) {
  const variants = db.prepare('SELECT id, size, stock FROM variants WHERE product_id = ? ORDER BY id').all(row.id);
  return { ...row, badge: row.badge || null, variants };
}

function makeRef() {
  const chars = 'ACDEFHJKLMNPRTUVWXY345679';
  let ref = 'LJ-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

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
app.post('/api/orders', orderLimiter, (req, res) => {
  const { customer, items, payment } = req.body || {};

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
    INSERT INTO orders (ref, customer_name, phone, email, address, city, zone, delivery_fee, subtotal, total, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      const deliveryFee = ZONES[zone];
      const total = subtotal + deliveryFee;
      let ref = makeRef();
      while (db.prepare('SELECT 1 FROM orders WHERE ref = ?').get(ref)) ref = makeRef();

      const { lastInsertRowid: orderId } = insertOrder.run(
        ref, name, phone, email || null, address, city, zone, deliveryFee, subtotal, total, payment
      );
      for (const l of lines) insertItem.run(orderId, l.productId, l.name, l.size, l.qty, l.price);

      return { ref, subtotal, deliveryFee, total };
    })();

    res.status(201).json(result);
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

/* ============ Auth ============ */
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
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  if (status !== undefined) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
  }
  if (payment_status !== undefined) {
    if (!['en_attente', 'paye', 'rembourse'].includes(payment_status)) return res.status(400).json({ error: 'Statut de paiement invalide' });
    db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(payment_status, order.id);
  }
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id));
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

/* ============ 404 API ============ */
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

/* ============ Front Angular (build de production) ============ */
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist', 'client', 'browser');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log('✓ Front servi depuis client/dist (mode production)');
}

app.listen(PORT, () => {
  console.log(`✓ API Lunique Jam sur http://localhost:${PORT}`);
});
