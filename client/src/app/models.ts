export interface Variant {
  id: number;
  size: string;
  stock: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  price: number;
  color: string;
  description: string;
  category: string;
  badge: string | null;
  art: string;
  garment: string;
  garm_color: string;
  mark_color: string;
  variants: Variant[];
}

export interface CartLine {
  productId: number;
  slug: string;
  name: string;
  price: number;
  size: string;
  qty: number;
  maxStock: number;
  art: string;
  garment: string;
  garm_color: string;
  mark_color: string;
}

export type PaymentMethod = 'wave' | 'orange_money' | 'livraison';
export type Zone = 'dakar' | 'regions' | 'retrait';

export interface OrderPayload {
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    zone: Zone;
  };
  items: { productId: number; size: string; qty: number }[];
  payment: PaymentMethod;
}

export interface OrderResult {
  ref: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export interface TrackedOrder {
  ref: string;
  customer_name: string;
  status: string;
  payment_method: string;
  payment_status: string;
  zone: string;
  city: string;
  delivery_fee: number;
  subtotal: number;
  total: number;
  created_at: string;
  items: { name: string; size: string; qty: number; price: number }[];
}

export interface AdminOrder extends TrackedOrder {
  id: number;
  phone: string;
  email: string | null;
  address: string;
}

export interface StockRow {
  id: number;
  name: string;
  slug: string;
  size: string;
  stock: number;
}

export interface AdminStats {
  orders: number;
  revenue: number;
  pending: number;
  lowStock: { name: string; size: string; stock: number }[];
}

export const ZONE_FEES: Record<Zone, number> = { dakar: 2000, regions: 3500, retrait: 0 };

export const ZONE_LABELS: Record<Zone, string> = {
  dakar: 'Dakar — livraison 24/48h (2 000 F)',
  regions: 'Régions — livraison 2-4 jours (3 500 F)',
  retrait: 'Retrait sur place — Ouakam (gratuit)',
};

export const STATUS_LABELS: Record<string, string> = {
  recue: 'Reçue',
  confirmee: 'Confirmée',
  preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

export const PAYMENT_LABELS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  livraison: 'À la livraison',
};
