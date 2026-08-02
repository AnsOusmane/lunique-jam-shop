import Database from 'better-sqlite3';
import argon2 from 'argon2';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// En production (Railway/Render…), DATA_DIR pointe vers le volume persistant.
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'luniquejam.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    color TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    badge TEXT,
    art TEXT NOT NULL,
    garment TEXT NOT NULL,
    garm_color TEXT NOT NULL,
    mark_color TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, size)
  );

  CREATE TABLE IF NOT EXISTS product_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL,               -- image | video
    filename TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    zone TEXT NOT NULL,
    delivery_fee INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    total INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'en_attente',
    status TEXT NOT NULL DEFAULT 'recue',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    size TEXT NOT NULL,
    qty INTEGER NOT NULL,
    price INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    address TEXT,
    city TEXT,
    zone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_ref TEXT,
    channel TEXT NOT NULL,            -- email | sms
    recipient TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL,             -- sent | logged | failed
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS promos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,               -- percent | amount
    value INTEGER NOT NULL,
    min_subtotal INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    country TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0
  );
`);

/* ---------- Migrations additives (idempotentes) ---------- */
const orderCols = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
if (!orderCols.includes('customer_id')) db.exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER');
if (!orderCols.includes('promo_code')) db.exec('ALTER TABLE orders ADD COLUMN promo_code TEXT');
if (!orderCols.includes('discount')) db.exec('ALTER TABLE orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0');

const pageViewCols = db.prepare('PRAGMA table_info(page_views)').all().map((c) => c.name);
if (!pageViewCols.includes('country')) db.exec('ALTER TABLE page_views ADD COLUMN country TEXT');

const categoryCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
if (categoryCount === 0) {
  const cats = [
    { key: 'tee', label: 'Tees' },
    { key: 'hoodie', label: 'Hoodies' },
    { key: 'crew', label: 'Crewnecks' },
    { key: 'pantalon', label: 'Pantalons' },
    { key: 'accessoire', label: 'Accessoires' },
  ];
  const insertCat = db.prepare('INSERT INTO categories (key, label, position) VALUES (?, ?, ?)');
  cats.forEach((c, i) => insertCat.run(c.key, c.label, i));
  console.log('✓ Catégories par défaut seedées');
}

/* ---------- Seed (idempotent) ---------- */
const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;

if (productCount === 0) {
  const products = [
    {
      slug: 'genesis-tee', name: 'Genesis Tee', price: 18000, color: 'Noir éclipse',
      description: "La première pièce. Coton lourd 240 g, coupe droite, sérigraphie flèche sur cœur. Le point de départ de tout — porté par ceux qui savent d'où ils viennent.",
      category: 'tee', badge: 'Drop 001', art: 'p1', garment: 'tee', garm_color: '#101010', mark_color: '#0E5A41',
      sizes: { S: 10, M: 14, L: 12, XL: 8 },
    },
    {
      slug: 'covenant-hoodie', name: 'Covenant Hoodie', price: 35000, color: 'Émeraude profond',
      description: "Molleton brossé 420 g, capuche doublée, broderie ton or au poignet. Une alliance entre le confort et la conviction. L'hiver n'a qu'à bien se tenir.",
      category: 'hoodie', badge: 'Best-seller', art: 'p2', garment: 'hoodie', garm_color: '#0E5A41', mark_color: '#F7F4EC',
      sizes: { S: 6, M: 10, L: 10, XL: 6 },
    },
    {
      slug: 'still-waters-tee', name: 'Still Waters Tee', price: 18000, color: 'Blanc os',
      description: "Sérigraphie ton sur ton, presque invisible — comme les eaux calmes, la profondeur ne fait pas de bruit. Coton peigné, col renforcé.",
      category: 'tee', badge: null, art: 'p3', garment: 'tee', garm_color: '#F2EEE3', mark_color: '#0B0B0A',
      sizes: { S: 8, M: 12, L: 12, XL: 7 },
    },
    {
      slug: 'higher-calling-crew', name: 'Higher Calling Crew', price: 28000, color: 'Crème sable',
      description: "Crewneck coupe boxy, bord-côtes épais, flocage velours. Pour ceux qui visent plus haut que la tendance du moment.",
      category: 'crew', badge: null, art: 'p4', garment: 'tee', garm_color: '#E4D9BF', mark_color: '#0B0B0A',
      sizes: { S: 7, M: 11, L: 9, XL: 5 },
    },
    {
      slug: 'anointed-cap', name: 'Anointed Cap', price: 12000, color: 'Noir / fil or',
      description: "Six panneaux, broderie 3D fil or, boucle laiton. La touche finale de chaque fit. Taille unique, ajustable.",
      category: 'accessoire', badge: null, art: 'p5', garment: 'cap', garm_color: '#141412', mark_color: '#C9A25E',
      sizes: { Unique: 20 },
    },
    {
      slug: 'proverbs-cargo', name: 'Proverbs Cargo', price: 32000, color: 'Vert cyprès',
      description: "Ripstop technique, six poches, coupe fuselée cheville. La sagesse dans les détails : coutures triples, zips YKK.",
      category: 'pantalon', badge: 'Nouveau', art: 'p6', garment: 'pants', garm_color: '#26352C', mark_color: '#F7F4EC',
      sizes: { S: 5, M: 9, L: 8, XL: 4 },
    },
    {
      slug: 'grace-oversized-tee', name: 'Grace Oversized Tee', price: 20000, color: 'Émeraude',
      description: "Tombé oversize, épaules descendues, ourlet arrondi. La grâce ne force jamais — elle tombe juste, naturellement.",
      category: 'tee', badge: null, art: 'p7', garment: 'tee', garm_color: '#0F6B4C', mark_color: '#F7F4EC',
      sizes: { S: 9, M: 13, L: 11, XL: 6 },
    },
    {
      slug: 'firstlight-hoodie', name: 'Firstlight Hoodie', price: 35000, color: 'Blanc cassé',
      description: "Intérieur gratté, cordons plats, étiquette tissée émeraude. La lumière du matin, version textile. Se salit avec style.",
      category: 'hoodie', badge: null, art: 'p8', garment: 'hoodie', garm_color: '#EFEAE0', mark_color: '#0B0B0A',
      sizes: { S: 6, M: 9, L: 9, XL: 5 },
    },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (slug, name, price, color, description, category, badge, art, garment, garm_color, mark_color)
    VALUES (@slug, @name, @price, @color, @description, @category, @badge, @art, @garment, @garm_color, @mark_color)
  `);
  const insertVariant = db.prepare('INSERT INTO variants (product_id, size, stock) VALUES (?, ?, ?)');

  const seed = db.transaction(() => {
    for (const p of products) {
      const { lastInsertRowid } = insertProduct.run(p);
      for (const [size, stock] of Object.entries(p.sizes)) {
        insertVariant.run(lastInsertRowid, size, stock);
      }
    }
  });
  seed();
  console.log('✓ Produits GENESIS seedés');
}

const ARGON_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — reco OWASP
  timeCost: 2,
  parallelism: 1,
};

const adminRow = db.prepare('SELECT id, password_hash FROM admins ORDER BY id LIMIT 1').get();
if (!adminRow) {
  const hash = await argon2.hash(process.env.ADMIN_PASSWORD || 'LuniqueJam#2026', ARGON_OPTS);
  db.prepare('INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)')
    .run('admin@luniquejam.com', hash, 'Ansou');
  console.log('✓ Compte admin créé (admin@luniquejam.com) — hash Argon2id');
} else if (process.env.ADMIN_PASSWORD) {
  // ADMIN_PASSWORD fait autorité : on resynchronise le hash si le mot de passe a changé
  const same = await argon2.verify(adminRow.password_hash, process.env.ADMIN_PASSWORD).catch(() => false);
  if (!same) {
    const hash = await argon2.hash(process.env.ADMIN_PASSWORD, ARGON_OPTS);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, adminRow.id);
    console.log('✓ Mot de passe admin resynchronisé depuis ADMIN_PASSWORD');
  }
}

const promoCount = db.prepare('SELECT COUNT(*) AS n FROM promos').get().n;
if (promoCount === 0) {
  db.prepare("INSERT INTO promos (code, type, value, min_subtotal) VALUES ('GENESIS10', 'percent', 10, 0)").run();
  console.log('✓ Code promo GENESIS10 (-10 %) seedé');
}

export default db;
