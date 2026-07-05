import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { FcfaPipe } from '../fcfa.pipe';
import { AdminOrder, AdminStats, PAYMENT_LABELS, STATUS_LABELS, StockRow } from '../models';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FcfaPipe],
  template: `
    <main class="page">
      <header class="page-head" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px">
        <div>
          <span class="label">Salut {{ auth.adminName() || 'chef' }} 👋</span>
          <h1 class="display">Tableau de bord</h1>
        </div>
        <button class="btn btn--ghost btn--sm" (click)="logout()">Déconnexion</button>
      </header>

      @if (stats(); as s) {
        <div class="admin-stats">
          <div class="stat-card">
            <span class="label">Commandes</span>
            <p class="num">{{ s.orders }}</p>
          </div>
          <div class="stat-card stat-card--accent">
            <span class="label">Chiffre d'affaires</span>
            <p class="num">{{ s.revenue | fcfa }}</p>
          </div>
          <div class="stat-card">
            <span class="label">À traiter</span>
            <p class="num">{{ s.pending }}</p>
          </div>
          <div class="stat-card">
            <span class="label">Stock critique</span>
            <p class="num" [class.low-stock]="s.lowStock.length > 0">{{ s.lowStock.length }}</p>
          </div>
        </div>
      }

      <div class="admin-tabs" role="tablist">
        <button class="chip" [class.active]="tab() === 'orders'" (click)="tab.set('orders')" role="tab">Commandes</button>
        <button class="chip" [class.active]="tab() === 'stock'" (click)="tab.set('stock')" role="tab">Stocks</button>
      </div>

      @if (error()) {
        <p class="alert alert--error" role="alert">{{ error() }}</p>
      }

      @if (tab() === 'orders') {
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Réf</th><th>Client</th><th>Contenu</th><th>Total</th>
                <th>Paiement</th><th>Statut</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of orders(); track o.id) {
                <tr>
                  <td style="font-family: var(--font-label); white-space: nowrap">{{ o.ref }}<br />
                    <small style="opacity: 0.5">{{ o.created_at }}</small>
                  </td>
                  <td>
                    <strong>{{ o.customer_name }}</strong><br />
                    <small>{{ o.phone }}</small><br />
                    <small style="opacity: 0.6">{{ o.address }}, {{ o.city }}</small>
                  </td>
                  <td>
                    @for (item of o.items; track $index) {
                      {{ item.name }} · {{ item.size }} × {{ item.qty }}<br />
                    }
                  </td>
                  <td style="font-family: var(--font-label); white-space: nowrap">{{ o.total | fcfa }}</td>
                  <td>
                    {{ paymentLabels[o.payment_method] }}<br />
                    <button class="badge-status" [class.badge-status--paye]="o.payment_status === 'paye'"
                            (click)="togglePaid(o)"
                            [title]="o.payment_status === 'paye' ? 'Marquer non payé' : 'Marquer payé'">
                      {{ o.payment_status === 'paye' ? 'Payé ✓' : 'En attente' }}
                    </button>
                  </td>
                  <td>
                    <span class="badge-status badge-status--{{ o.status }}">{{ statusLabels[o.status] }}</span>
                  </td>
                  <td>
                    <select [ngModel]="o.status" (ngModelChange)="setStatus(o, $event)" [name]="'st' + o.id" aria-label="Changer le statut">
                      @for (s of statuses; track s) {
                        <option [value]="s">{{ statusLabels[s] }}</option>
                      }
                    </select>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" style="text-align: center; opacity: 0.5; padding: 40px">Aucune commande pour le moment.</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="table-scroll">
          <table class="admin-table" style="max-width: 640px">
            <thead>
              <tr><th>Pièce</th><th>Taille</th><th>Stock</th><th></th></tr>
            </thead>
            <tbody>
              @for (row of stock(); track row.id) {
                <tr>
                  <td><strong>{{ row.name }}</strong></td>
                  <td style="font-family: var(--font-label)">{{ row.size }}</td>
                  <td>
                    <span [class.low-stock]="row.stock <= 3">{{ row.stock }}</span>
                    @if (row.stock === 0) { <span class="badge-status badge-status--annulee" style="margin-left: 8px">Épuisé</span> }
                  </td>
                  <td>
                    <input type="number" min="0" max="9999" [ngModel]="row.stock"
                           (ngModelChange)="pending[row.id] = $event" [name]="'stock' + row.id"
                           aria-label="Nouveau stock" />
                    <button class="btn btn--sm btn--dark" style="margin-left: 8px"
                            (click)="saveStock(row)">OK</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </main>
  `,
})
export class AdminPage {
  private api = inject(ApiService);
  readonly auth = inject(AuthService);
  private router = inject(Router);

  readonly statusLabels = STATUS_LABELS;
  readonly paymentLabels = PAYMENT_LABELS;
  readonly statuses = Object.keys(STATUS_LABELS);

  readonly tab = signal<'orders' | 'stock'>('orders');
  readonly orders = signal<AdminOrder[]>([]);
  readonly stock = signal<StockRow[]>([]);
  readonly stats = signal<AdminStats | null>(null);
  readonly error = signal<string | null>(null);

  pending: Record<number, number> = {};

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.api.adminOrders().subscribe({ next: (o) => this.orders.set(o), error: (e) => this.fail(e) });
    this.api.adminStock().subscribe({ next: (s) => this.stock.set(s), error: (e) => this.fail(e) });
    this.api.adminStats().subscribe({ next: (s) => this.stats.set(s), error: (e) => this.fail(e) });
  }

  setStatus(order: AdminOrder, status: string): void {
    this.api.patchOrder(order.id, { status }).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
  }

  togglePaid(order: AdminOrder): void {
    const payment_status = order.payment_status === 'paye' ? 'en_attente' : 'paye';
    this.api.patchOrder(order.id, { payment_status }).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
  }

  saveStock(row: StockRow): void {
    const value = this.pending[row.id];
    if (value == null || value === row.stock) return;
    this.api.patchStock(row.id, Number(value)).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }

  private fail(err: unknown): void {
    const e = err as { status?: number; error?: { error?: string } };
    if (e.status === 401) {
      this.auth.logout();
      this.router.navigate(['/admin/login']);
      return;
    }
    this.error.set(e.error?.error || 'Erreur de chargement.');
  }
}
