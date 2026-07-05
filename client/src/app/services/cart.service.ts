import { Injectable, computed, effect, signal } from '@angular/core';
import { CartLine, Product } from '../models';

const STORAGE_KEY = 'lj_cart_v1';

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly lines = signal<CartLine[]>(this.restore());

  readonly count = computed(() => this.lines().reduce((n, l) => n + l.qty, 0));
  readonly subtotal = computed(() => this.lines().reduce((s, l) => s + l.price * l.qty, 0));

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines()));
      } catch { /* stockage indisponible : panier en mémoire seulement */ }
    });
  }

  add(product: Product, size: string, qty: number): void {
    const variant = product.variants.find((v) => v.size === size);
    if (!variant || variant.stock <= 0) return;

    this.lines.update((lines) => {
      const existing = lines.find((l) => l.productId === product.id && l.size === size);
      if (existing) {
        const newQty = Math.min(existing.qty + qty, variant.stock, 10);
        return lines.map((l) => (l === existing ? { ...l, qty: newQty, maxStock: variant.stock } : l));
      }
      return [
        ...lines,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          size,
          qty: Math.min(qty, variant.stock, 10),
          maxStock: variant.stock,
          art: product.art,
          garment: product.garment,
          garm_color: product.garm_color,
          mark_color: product.mark_color,
        },
      ];
    });
  }

  setQty(line: CartLine, qty: number): void {
    const clamped = Math.max(1, Math.min(qty, line.maxStock, 10));
    this.lines.update((lines) => lines.map((l) => (l === line ? { ...l, qty: clamped } : l)));
  }

  remove(line: CartLine): void {
    this.lines.update((lines) => lines.filter((l) => l !== line));
  }

  clear(): void {
    this.lines.set([]);
  }

  private restore(): CartLine[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
