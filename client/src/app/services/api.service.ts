import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminOrder, AdminStats, AdminUser, Category, Customer, Media, NotificationRow, OrderPayload, OrderResult,
  Product, ProductInput, Promo, StockRow, TrackedOrder, TrafficStats, Variant,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products');
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>('/api/categories');
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

  login(email: string, password: string): Observable<{ token: string; admin: { id: number; email: string; name: string } }> {
    return this.http.post<{ token: string; admin: { id: number; email: string; name: string } }>('/api/auth/login', { email, password });
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

  adminTraffic(): Observable<TrafficStats> {
    return this.http.get<TrafficStats>('/api/admin/traffic');
  }

  trackVisit(path: string, visitorId: string): Observable<void> {
    return this.http.post<void>('/api/track', { path, visitorId });
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

  /* ---- Catégories (admin) ---- */

  adminCategories(): Observable<Category[]> {
    return this.http.get<Category[]>('/api/admin/categories');
  }

  createCategory(data: { key: string; label: string }): Observable<Category> {
    return this.http.post<Category>('/api/admin/categories', data);
  }

  updateCategory(id: number, patch: { label?: string; active?: boolean }): Observable<Category> {
    return this.http.patch<Category>(`/api/admin/categories/${id}`, patch);
  }

  deleteCategory(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/admin/categories/${id}`);
  }

  /* ---- Produits (admin) ---- */

  adminProducts(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/admin/products');
  }

  createProduct(data: ProductInput): Observable<Product> {
    return this.http.post<Product>('/api/admin/products', data);
  }

  updateProduct(id: number, patch: Partial<ProductInput> & { active?: boolean }): Observable<Product> {
    return this.http.patch<Product>(`/api/admin/products/${id}`, patch);
  }

  deleteProduct(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/admin/products/${id}`);
  }

  addVariant(productId: number, size: string, stock: number): Observable<Variant> {
    return this.http.post<Variant>(`/api/admin/products/${productId}/variants`, { size, stock });
  }

  deleteVariant(variantId: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/admin/variants/${variantId}`);
  }

  uploadMedia(productId: number, file: File): Observable<Media> {
    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Media>(`/api/admin/products/${productId}/media/${kind}`, form);
  }

  deleteMedia(mediaId: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/admin/media/${mediaId}`);
  }

  /* ---- Comptes admin ---- */

  adminAdmins(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>('/api/admin/admins');
  }

  createAdmin(data: { name: string; email: string; password: string }): Observable<AdminUser> {
    return this.http.post<AdminUser>('/api/admin/admins', data);
  }

  updateAdmin(id: number, patch: { name?: string; password?: string }): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`/api/admin/admins/${id}`, patch);
  }

  deleteAdmin(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/admin/admins/${id}`);
  }
}
