import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import db from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'lunique-jam-dev-secret-change-me';

const ARGON_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — reco OWASP
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (pwd) => argon2.hash(pwd, ARGON_OPTS);

/* ---------- Admin ---------- */

export async function login(email, password) {
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(String(email || '').toLowerCase().trim());
  if (!admin) return null;
  const ok = await argon2.verify(admin.password_hash, String(password || '')).catch(() => false);
  if (!ok) return null;
  const token = jwt.sign(
    { sub: admin.id, role: 'admin', email: admin.email, name: admin.name },
    JWT_SECRET,
    { expiresIn: '12h' },
  );
  return { token, admin: { id: admin.id, email: admin.email, name: admin.name } };
}

export function requireAdmin(req, res, next) {
  const payload = readToken(req);
  if (!payload) return res.status(401).json({ error: 'Authentification requise' });
  if (payload.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l’équipe' });
  req.admin = payload;
  next();
}

/* ---------- Clients ---------- */

export async function registerCustomer({ name, email, phone, password }) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const exists = db.prepare('SELECT 1 FROM customers WHERE email = ?').get(cleanEmail);
  if (exists) return { error: 'Un compte existe déjà avec cet e-mail' };

  const hash = await hashPassword(String(password));
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO customers (name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
  ).run(String(name).trim(), cleanEmail, String(phone).trim(), hash);

  return { customer: customerById(lastInsertRowid) };
}

export async function loginCustomer(email, password) {
  const row = db.prepare('SELECT * FROM customers WHERE email = ?').get(String(email || '').toLowerCase().trim());
  if (!row) return null;
  const ok = await argon2.verify(row.password_hash, String(password || '')).catch(() => false);
  return ok ? customerById(row.id) : null;
}

export function customerToken(customer) {
  return jwt.sign({ sub: customer.id, role: 'customer', email: customer.email }, JWT_SECRET, { expiresIn: '30d' });
}

export function customerById(id) {
  const row = db.prepare('SELECT id, name, email, phone, address, city, zone, created_at FROM customers WHERE id = ?').get(id);
  return row || null;
}

export function requireCustomer(req, res, next) {
  const payload = readToken(req);
  if (!payload || payload.role !== 'customer') {
    return res.status(401).json({ error: 'Connecte-toi pour accéder à ton compte' });
  }
  req.customer = payload;
  next();
}

/** N'échoue jamais : attache req.customer si un token client valide est présent. */
export function optionalCustomer(req, _res, next) {
  const payload = readToken(req);
  if (payload && payload.role === 'customer') req.customer = payload;
  next();
}

function readToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
