import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import db from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'lunique-jam-dev-secret-change-me';

export async function login(email, password) {
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(String(email || '').toLowerCase().trim());
  if (!admin) return null;
  const ok = await argon2.verify(admin.password_hash, String(password || '')).catch(() => false);
  if (!ok) return null;
  const token = jwt.sign({ sub: admin.id, email: admin.email, name: admin.name }, JWT_SECRET, { expiresIn: '12h' });
  return { token, admin: { email: admin.email, name: admin.name } };
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée, reconnecte-toi' });
  }
}
