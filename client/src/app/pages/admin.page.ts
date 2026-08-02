import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { FcfaPipe } from '../fcfa.pipe';
import { AdminOrder, AdminStats, Category, NotificationRow, PAYMENT_LABELS, Promo, STATUS_LABELS, StockRow, TrafficStats } from '../models';
import { AdminProductsComponent } from './admin-products.component';
import { AdminAccountsComponent } from './admin-accounts.component';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FcfaPipe, SlicePipe, AdminProductsComponent, AdminAccountsComponent],
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
        <button class="chip" [class.active]="tab() === 'products'" (click)="tab.set('products')" role="tab">Produits</button>
        <button class="chip" [class.active]="tab() === 'categories'" (click)="tab.set('categories')" role="tab">Catégories</button>
        <button class="chip" [class.active]="tab() === 'stock'" (click)="tab.set('stock')" role="tab">Stocks</button>
        <button class="chip" [class.active]="tab() === 'promos'" (click)="tab.set('promos')" role="tab">Promos</button>
        <button class="chip" [class.active]="tab() === 'notifs'" (click)="tab.set('notifs')" role="tab">Notifications</button>
        <button class="chip" [class.active]="tab() === 'traffic'" (click)="tab.set('traffic')" role="tab">Visites</button>
        <button class="chip" [class.active]="tab() === 'admins'" (click)="tab.set('admins')" role="tab">Comptes admin</button>
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
      } @else if (tab() === 'products') {
        <app-admin-products />
      } @else if (tab() === 'categories') {
        <form class="form-grid" style="max-width: 560px; margin-bottom: 30px" (ngSubmit)="createCategory()" novalidate>
          <div class="field">
            <label for="ckey">Clé (technique)</label>
            <input id="ckey" name="ckey" [(ngModel)]="categoryKey" placeholder="pantalon" style="text-transform: lowercase" />
          </div>
          <div class="field">
            <label for="clabel">Libellé (affiché)</label>
            <input id="clabel" name="clabel" [(ngModel)]="categoryLabel" placeholder="Pantalons" />
          </div>
          <div class="full">
            <button class="btn btn--dark btn--sm" type="submit">Ajouter la catégorie</button>
          </div>
        </form>

        <div class="table-scroll">
          <table class="admin-table" style="max-width: 620px">
            <thead>
              <tr><th>Clé</th><th>Libellé</th><th>État</th><th></th></tr>
            </thead>
            <tbody>
              @for (c of categories(); track c.id) {
                <tr>
                  <td style="font-family: var(--font-label)">{{ c.key }}</td>
                  <td>{{ c.label }}</td>
                  <td>
                    <span class="badge-status" [class.badge-status--paye]="c.active" [class.badge-status--annulee]="!c.active">
                      {{ c.active ? 'Active' : 'Désactivée' }}
                    </span>
                  </td>
                  <td style="white-space: nowrap">
                    <button class="btn btn--ghost btn--sm" (click)="toggleCategory(c)">
                      {{ c.active ? 'Désactiver' : 'Réactiver' }}
                    </button>
                    <button class="btn btn--ghost btn--sm" style="margin-left: 8px" (click)="removeCategory(c)">Supprimer</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" style="text-align: center; opacity: 0.5; padding: 30px">Aucune catégorie.</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (tab() === 'stock') {
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
      } @else if (tab() === 'promos') {
        <form class="form-grid" style="max-width: 720px; margin-bottom: 30px" (ngSubmit)="createPromo()" novalidate>
          <div class="field">
            <label for="pcode">Code</label>
            <input id="pcode" name="pcode" [(ngModel)]="promoCode" placeholder="DROP002" style="text-transform: uppercase" />
          </div>
          <div class="field">
            <label for="ptype">Type</label>
            <select id="ptype" name="ptype" [(ngModel)]="promoType">
              <option value="percent">Pourcentage (%)</option>
              <option value="amount">Montant fixe (F)</option>
            </select>
          </div>
          <div class="field">
            <label for="pvalue">Valeur</label>
            <input id="pvalue" name="pvalue" type="number" min="1" [(ngModel)]="promoValue" />
          </div>
          <div class="field">
            <label for="pmin">Minimum d'achat (F, optionnel)</label>
            <input id="pmin" name="pmin" type="number" min="0" [(ngModel)]="promoMin" />
          </div>
          <div class="full">
            <button class="btn btn--dark btn--sm" type="submit">Créer la promo</button>
          </div>
        </form>

        <div class="table-scroll">
          <table class="admin-table" style="max-width: 760px">
            <thead>
              <tr><th>Code</th><th>Remise</th><th>Min. achat</th><th>État</th><th></th></tr>
            </thead>
            <tbody>
              @for (p of promos(); track p.id) {
                <tr>
                  <td style="font-family: var(--font-label)">{{ p.code }}</td>
                  <td>{{ p.type === 'percent' ? '-' + p.value + ' %' : '-' + (p.value | fcfa) }}</td>
                  <td>{{ p.min_subtotal > 0 ? (p.min_subtotal | fcfa) : '—' }}</td>
                  <td>
                    <span class="badge-status" [class.badge-status--paye]="p.active" [class.badge-status--annulee]="!p.active">
                      {{ p.active ? 'Active' : 'Désactivée' }}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn--ghost btn--sm" (click)="togglePromo(p)">
                      {{ p.active ? 'Désactiver' : 'Réactiver' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" style="text-align: center; opacity: 0.5; padding: 30px">Aucune promo.</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (tab() === 'notifs') {
        <p style="opacity: 0.6; margin-bottom: 18px; max-width: 62ch">
          Journal des e-mails et SMS. Statut <strong>logged</strong> = archivé dans <code>server/outbox/</code>
          (aucun fournisseur configuré) ; <strong>sent</strong> = réellement envoyé via SMTP.
        </p>
        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr><th>Date</th><th>Canal</th><th>Commande</th><th>Destinataire</th><th>Sujet / message</th><th>Statut</th></tr>
            </thead>
            <tbody>
              @for (n of notifs(); track n.id) {
                <tr>
                  <td style="white-space: nowrap">{{ n.created_at }}</td>
                  <td>{{ n.channel === 'email' ? '📧' : '💬' }} {{ n.channel }}</td>
                  <td style="font-family: var(--font-label)">{{ n.order_ref || '—' }}</td>
                  <td>{{ n.recipient }}</td>
                  <td style="max-width: 380px">{{ n.subject || (n.body | slice: 0 : 90) }}</td>
                  <td>
                    <span class="badge-status" [class.badge-status--paye]="n.status === 'sent'"
                          [class.badge-status--annulee]="n.status === 'failed'">{{ n.status }}</span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" style="text-align: center; opacity: 0.5; padding: 30px">Aucune notification.</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (tab() === 'traffic') {
        @if (traffic(); as t) {
          <div class="admin-stats">
            <div class="stat-card">
              <span class="label">Vues totales</span>
              <p class="num">{{ t.totalViews }}</p>
            </div>
            <div class="stat-card stat-card--accent">
              <span class="label">Visiteurs uniques</span>
              <p class="num">{{ t.uniqueVisitors }}</p>
            </div>
            <div class="stat-card">
              <span class="label">Vues aujourd'hui</span>
              <p class="num">{{ t.viewsToday }}</p>
            </div>
          </div>

          <p style="opacity: 0.6; margin: 10px 0 18px; max-width: 62ch">
            MVP maison — pas de tracking tiers pour l'instant. On enrichira (graphique, sources de trafic)
            avant de brancher Google Analytics si besoin.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: start">
            <div class="table-scroll">
              <h2 class="label" style="margin-bottom: 10px">14 derniers jours</h2>
              <table class="admin-table">
                <thead><tr><th>Date</th><th>Vues</th><th>Visiteurs</th></tr></thead>
                <tbody>
                  @for (d of t.byDay; track d.date) {
                    <tr><td>{{ d.date }}</td><td>{{ d.views }}</td><td>{{ d.visitors }}</td></tr>
                  } @empty {
                    <tr><td colspan="3" style="text-align: center; opacity: 0.5; padding: 20px">Pas encore de données.</td></tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="table-scroll">
              <h2 class="label" style="margin-bottom: 10px">Pages les plus vues</h2>
              <table class="admin-table">
                <thead><tr><th>Page</th><th>Vues</th></tr></thead>
                <tbody>
                  @for (p of t.topPages; track p.path) {
                    <tr><td>{{ p.path }}</td><td>{{ p.views }}</td></tr>
                  } @empty {
                    <tr><td colspan="2" style="text-align: center; opacity: 0.5; padding: 20px">Pas encore de données.</td></tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="table-scroll">
              <h2 class="label" style="margin-bottom: 10px">Par pays</h2>
              <table class="admin-table">
                <thead><tr><th>Pays</th><th>Vues</th></tr></thead>
                <tbody>
                  @for (c of t.byCountry; track c.country) {
                    <tr><td>{{ c.country }}</td><td>{{ c.views }}</td></tr>
                  } @empty {
                    <tr><td colspan="2" style="text-align: center; opacity: 0.5; padding: 20px">Pas encore de données (IP locales non géolocalisables).</td></tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="table-scroll">
              <h2 class="label" style="margin-bottom: 10px">Dernières visites</h2>
              <table class="admin-table">
                <thead><tr><th>Date</th><th>Heure</th><th>Page</th><th>Pays</th></tr></thead>
                <tbody>
                  @for (v of t.recent; track $index) {
                    <tr>
                      <td>{{ v.created_at.slice(0, 10) }}</td>
                      <td style="font-family: var(--font-label)">{{ v.created_at.slice(11, 16) }} UTC</td>
                      <td>{{ v.path }}</td>
                      <td>{{ v.country || '—' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" style="text-align: center; opacity: 0.5; padding: 20px">Pas encore de données.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      } @else {
        <app-admin-accounts />
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

  readonly tab = signal<'orders' | 'products' | 'categories' | 'stock' | 'promos' | 'notifs' | 'traffic' | 'admins'>('orders');
  readonly orders = signal<AdminOrder[]>([]);
  readonly stock = signal<StockRow[]>([]);
  readonly stats = signal<AdminStats | null>(null);
  readonly promos = signal<Promo[]>([]);
  readonly notifs = signal<NotificationRow[]>([]);
  readonly traffic = signal<TrafficStats | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly error = signal<string | null>(null);

  pending: Record<number, number> = {};

  // Formulaire nouvelle promo
  promoCode = '';
  promoType: 'percent' | 'amount' = 'percent';
  promoValue: number | null = null;
  promoMin: number | null = null;

  // Formulaire nouvelle catégorie
  categoryKey = '';
  categoryLabel = '';

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.api.adminOrders().subscribe({ next: (o) => this.orders.set(o), error: (e) => this.fail(e) });
    this.api.adminStock().subscribe({ next: (s) => this.stock.set(s), error: (e) => this.fail(e) });
    this.api.adminStats().subscribe({ next: (s) => this.stats.set(s), error: (e) => this.fail(e) });
    this.api.adminPromos().subscribe({ next: (p) => this.promos.set(p), error: (e) => this.fail(e) });
    this.api.adminNotifications().subscribe({ next: (n) => this.notifs.set(n), error: (e) => this.fail(e) });
    this.api.adminTraffic().subscribe({ next: (t) => this.traffic.set(t), error: (e) => this.fail(e) });
    this.api.adminCategories().subscribe({ next: (c) => this.categories.set(c), error: (e) => this.fail(e) });
  }

  createCategory(): void {
    if (!this.categoryKey.trim() || !this.categoryLabel.trim()) return;
    this.api.createCategory({ key: this.categoryKey.trim().toLowerCase(), label: this.categoryLabel.trim() }).subscribe({
      next: () => {
        this.categoryKey = '';
        this.categoryLabel = '';
        this.refresh();
      },
      error: (e) => this.fail(e),
    });
  }

  toggleCategory(cat: Category): void {
    this.api.updateCategory(cat.id, { active: !cat.active }).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
  }

  removeCategory(cat: Category): void {
    if (!confirm(`Supprimer la catégorie « ${cat.label} » ?`)) return;
    this.api.deleteCategory(cat.id).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
  }

  createPromo(): void {
    if (!this.promoCode.trim() || !this.promoValue) return;
    this.api.createPromo({
      code: this.promoCode.trim(),
      type: this.promoType,
      value: Number(this.promoValue),
      min_subtotal: this.promoMin ? Number(this.promoMin) : 0,
    }).subscribe({
      next: () => {
        this.promoCode = '';
        this.promoValue = null;
        this.promoMin = null;
        this.refresh();
      },
      error: (e) => this.fail(e),
    });
  }

  togglePromo(promo: Promo): void {
    this.api.togglePromo(promo.id, !promo.active).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
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
