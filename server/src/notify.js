import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX = path.join(__dirname, '..', 'outbox');
fs.mkdirSync(OUTBOX, { recursive: true });

/**
 * E-mail : SMTP réel si SMTP_HOST est défini (Brevo, Gmail, Resend SMTP…),
 * sinon archivage dans server/outbox/ + table notifications (mode dev).
 * Env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

const record = db.prepare(`
  INSERT INTO notifications (order_ref, channel, recipient, subject, body, status)
  VALUES (?, ?, ?, ?, ?, ?)
`);

export async function sendEmail({ orderRef = null, to, subject, text }) {
  if (!to) return;
  try {
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'Lunique Jam <hello@luniquejam.com>',
        to, subject, text,
      });
      record.run(orderRef, 'email', to, subject, text, 'sent');
    } else {
      const file = path.join(OUTBOX, `${Date.now()}-email-${(orderRef || 'msg').replace(/[^\w-]/g, '')}.txt`);
      fs.writeFileSync(file, `À: ${to}\nSujet: ${subject}\n\n${text}\n`, 'utf8');
      record.run(orderRef, 'email', to, subject, text, 'logged');
    }
  } catch (err) {
    console.error('E-mail non envoyé :', err.message);
    record.run(orderRef, 'email', to, subject, text, 'failed');
  }
}

/**
 * SMS : crochet prêt pour un fournisseur (Twilio, Orange SMS API, AfricasTalking…).
 * Tant qu'aucune clé n'est configurée, le SMS est journalisé (outbox + DB).
 */
export async function sendSms({ orderRef = null, to, text }) {
  if (!to) return;
  try {
    // TODO fournisseur réel : ex. Twilio
    // if (process.env.TWILIO_SID) { ... client.messages.create({ to, from, body: text }) ... status 'sent'
    const file = path.join(OUTBOX, `${Date.now()}-sms-${(orderRef || 'msg').replace(/[^\w-]/g, '')}.txt`);
    fs.writeFileSync(file, `SMS à: ${to}\n\n${text}\n`, 'utf8');
    record.run(orderRef, 'sms', to, null, text, 'logged');
  } catch (err) {
    console.error('SMS non envoyé :', err.message);
    record.run(orderRef, 'sms', to, null, text, 'failed');
  }
}

/* ---------- Gabarits ---------- */

const F = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/[  ]/g, ' ') + ' F';

const PAY_INSTRUCTIONS = {
  wave: 'Tu recevras une demande de paiement Wave sur ton numéro d’ici peu.',
  orange_money: 'Notre équipe te contacte pour finaliser le paiement Orange Money.',
  livraison: 'Prépare le montant exact — paiement en espèces à la livraison.',
};

export function orderConfirmationEmail(order, items) {
  const lines = items.map((i) => `  • ${i.name} — taille ${i.size} × ${i.qty} : ${F(i.price * i.qty)}`).join('\n');
  const discount = order.discount > 0 ? `\nRemise (${order.promo_code}) : -${F(order.discount)}` : '';
  return {
    subject: `Commande ${order.ref} confirmée — Lunique Jam`,
    text: `Salut ${order.customer_name},

Ta commande est bien reçue. Merci de porter tes valeurs avec nous.

Référence : ${order.ref}

${lines}
${discount}
Livraison : ${order.delivery_fee === 0 ? 'Retrait Ouakam (gratuit)' : F(order.delivery_fee)}
Total : ${F(order.total)}

${PAY_INSTRUCTIONS[order.payment_method] || ''}

Suis ta commande à tout moment : http://localhost:4200/suivi?ref=${order.ref}
(garde ta référence et ton numéro de téléphone sous la main)

Clean fits, clean heart.
— Lunique Jam, Dakar`,
  };
}

export function orderConfirmationSms(order) {
  return `Lunique Jam : commande ${order.ref} recue (${F(order.total)}). ${
    order.payment_method === 'livraison' ? 'Paiement a la livraison.' : 'On te contacte pour le paiement.'
  } Suivi : ${order.ref}`;
}

const STATUS_MESSAGES = {
  confirmee: 'Ta commande est confirmée — on la prépare avec soin.',
  preparation: 'Ta commande est en préparation dans notre atelier.',
  expediee: 'Ça y est : ta commande est en route ! Notre livreur te contacte bientôt.',
  livree: 'Commande livrée. Porte-la fièrement — Faith is the Flex. 🙏',
  annulee: 'Ta commande a été annulée. Si c’est une erreur, réponds-nous vite.',
};

export function statusUpdateMessages(order) {
  const msg = STATUS_MESSAGES[order.status];
  if (!msg) return null;
  return {
    email: {
      subject: `Commande ${order.ref} : ${order.status === 'annulee' ? 'annulée' : 'mise à jour'} — Lunique Jam`,
      text: `Salut ${order.customer_name},\n\n${msg}\n\nRéférence : ${order.ref}\nSuivi : http://localhost:4200/suivi?ref=${order.ref}\n\n— Lunique Jam`,
    },
    sms: `Lunique Jam ${order.ref} : ${msg}`,
  };
}
