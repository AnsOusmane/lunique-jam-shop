import Database from 'better-sqlite3';
import argon2 from 'argon2';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'luniquejam.db'));

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
`);

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

const adminCount = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
if (adminCount === 0) {
  const hash = await argon2.hash(process.env.ADMIN_PASSWORD || 'LuniqueJam#2026', {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB — reco OWASP
    timeCost: 2,
    parallelism: 1,
  });
  db.prepare('INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)')
    .run('admin@luniquejam.com', hash, 'Ansoumana');
  console.log('✓ Compte admin créé (admin@luniquejam.com) — hash Argon2id');
}

export default db;
