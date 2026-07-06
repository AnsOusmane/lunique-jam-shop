import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminOrder, AdminStats, Customer, NotificationRow, OrderPayload, OrderResult,
  Product, Promo, StockRow, TrackedOrder,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products');
  }

  getProduct(slug: string): Observable<Product> {
    return this.http.get<Product>(`/api/products/${slug}`);
  }

  createOrder(payload: OrderPayload): Observable<OrderResult> {
    return this.http.post<OrderResult>('/api/orders', payload);
  }

  trackOrder(ref: string, phone: string): Observable<TrackedOrder> {
    const params = new HttpParams().set('phone', phone.replace(/\s/g, ''));
    return this.http.get<TrackedOrder>(`/api/orders/${encodeURIComponent(ref.trim())}`, { params });
  }

  login(email: string, password: string): Observable<{ token: string; admin: { email: string; name: string } }> {
    return this.http.post<{ token: string; admin: { email: string; name: string } }>('/api/auth/login', { email, password });
  }

  adminOrders(): Observable<AdminOrder[]> {
    return this.http.get<AdminOrder[]>('/api/admin/orders');
  }

  patchOrder(id: number, patch: { status?: string; payment_status?: string }): Observable<AdminOrder> {
    return this.http.patch<AdminOrder>(`/api/admin/orders/${id}`, patch);
  }

  adminStock(): Observable<StockRow[]> {
    return this.http.get<StockRow[]>('/api/admin/stock');
  }

  patchStock(variantId: number, stock: number): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`/api/admin/stock/${variantId}`, { stock });
  }

  adminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>('/api/admin/stats');
  }

  /* ---- Comptes clients ---- */

  register(data: { name: string; email: string; phone: string; password: string }) {
    return this.http.post<{ token: string; customer: Customer }>('/api/customers/register', data);
  }

  customerLogin(email: string, password: string) {
    return this.http.post<{ token: string; customer: Customer }>('/api/customers/login', { email, password });
  }

  me() {
    return this.http.get<{ customer: Customer; orders: (TrackedOrder & { id: number })[] }>('/api/customers/me');
  }

  updateMe(patch: Partial<Pick<Customer, 'name' | 'phone' | 'address' | 'city' | 'zone'>>) {
    return this.http.patch<{ customer: Customer }>('/api/customers/me', patch);
  }

  /* ---- Promos ---- */

  validatePromo(code: string, subtotal: number) {
    return this.http.post<{ code: string; discount: number }>('/api/promos/validate', { code, subtotal });
  }

  adminPromos(): Observable<Promo[]> {
    return this.http.get<Promo[]>('/api/admin/promos');
  }

  createPromo(data: { code: string; type: string; value: number; min_subtotal?: number; expires_at?: string | null }) {
    return this.http.post<Promo>('/api/admin/promos', data);
  }

  togglePromo(id: number, active: boolean) {
    return this.http.patch<Promo>(`/api/admin/promos/${id}`, { active });
  }

  adminNotifications(): Observable<NotificationRow[]> {
    return this.http.get<NotificationRow[]>('/api/admin/notifications');
  }
}
