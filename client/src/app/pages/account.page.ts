import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AccountService } from '../services/account.service';
import { FcfaPipe } from '../fcfa.pipe';
import { Customer, STATUS_LABELS, TrackedOrder, ZONE_LABELS, Zone } from '../models';

@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, FcfaPipe],
  template: `
    <main class="page page--narrow">
      <header class="page-head" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px">
        <div>
          <span class="label">Le Cercle</span>
          <h1 class="display" style="font-size: clamp(30px, 6vw, 64px)">Mon compte</h1>
        </div>
        <button class="btn btn--ghost btn--sm" (click)="logout()">Déconnexion</button>
      </header>

      @if (customer(); as c) {
        <h2 class="label" style="margin-bottom: 16px">Mes informations</h2>
        <form class="form-grid" (ngSubmit)="save()" novalidate>
          <div class="field">
            <label for="name">Nom complet</label>
            <input id="name" name="name" [(ngModel)]="name" required />
          </div>
          <div class="field">
            <label for="phone">Téléphone</label>
            <input id="phone" name="phone" [(ngModel)]="phone" required inputmode="tel" />
          </div>
          <div class="field full">
            <label for="address">Adresse de livraison</label>
            <input id="address" name="address" [(ngModel)]="address" placeholder="Quartier, rue, repère…" />
          </div>
          <div class="field">
            <label for="city">Ville</label>
            <input id="city" name="city" [(ngModel)]="city" />
          </div>
          <div class="field">
            <label for="zone">Zone de livraison</label>
            <select id="zone" name="zone" [(ngModel)]="zone">
              <option value="">—</option>
              @for (z of zones; track z) {
                <option [value]="z">{{ zoneLabels[z] }}</option>
              }
            </select>
          </div>
          <div class="full" style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap">
            <button class="btn btn--dark btn--sm" type="submit" [disabled]="saving()">
              @if (saving()) { Enregistrement… } @else { Enregistrer }
            </button>
            @if (saved()) { <span class="label" style="color: var(--emerald)">Enregistré ✓</span> }
          </div>
        </form>

        <h2 class="label" style="margin: 44px 0 6px">Mes commandes</h2>
        @if (orders().length === 0) {
          <p style="opacity: 0.6">Aucune commande pour l'instant. <a routerLink="/" style="text-decoration: underline">Le drop Genesis t'attend</a>.</p>
        } @else {
          <ul>
            @for (o of orders(); track o.ref) {
              <li style="display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; padding: 16px 0; border-bottom: 1px solid rgba(11,11,10,0.1)">
                <div>
                  <span style="font-family: var(--font-label)">{{ o.ref }}</span>
                  <small style="opacity: 0.5; display: block">{{ o.created_at }} · {{ o.items.length }} article(s)</small>
                </div>
                <span class="badge-status badge-status--{{ o.status }}">{{ statusLabels[o.status] }}</span>
                <span style="font-family: var(--font-label)">{{ o.total | fcfa }}</span>
                <a class="btn btn--ghost btn--sm" routerLink="/suivi" [queryParams]="{ ref: o.ref }">Suivre</a>
              </li>
            }
          </ul>
        }
      } @else {
        <div class="skeleton" style="height: 220px"></div>
      }
    </main>
  `,
})
export class AccountPage {
  private api = inject(ApiService);
  private account = inject(AccountService);
  private router = inject(Router);

  readonly zones: Zone[] = ['dakar', 'regions', 'retrait'];
  readonly zoneLabels = ZONE_LABELS;
  readonly statusLabels = STATUS_LABELS;

  readonly customer = signal<Customer | null>(null);
  readonly orders = signal<(TrackedOrder & { id: number })[]>([]);
  readonly saving = signal(false);
  readonly saved = signal(false);

  name = '';
  phone = '';
  address = '';
  city = '';
  zone = '';

  constructor() {
    this.api.me().subscribe({
      next: ({ customer, orders }) => {
        this.customer.set(customer);
        this.orders.set(orders);
        this.name = customer.name;
        this.phone = customer.phone;
        this.address = customer.address ?? '';
        this.city = customer.city ?? '';
        this.zone = customer.zone ?? '';
      },
      error: () => this.logout(),
    });
  }

  save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.api.updateMe({
      name: this.name, phone: this.phone,
      address: this.address, city: this.city, zone: this.zone as Customer['zone'],
    }).subscribe({
      next: ({ customer }) => {
        this.account.customer.set(customer);
        this.customer.set(customer);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: () => this.saving.set(false),
    });
  }

  logout(): void {
    this.account.logout();
    this.router.navigate(['/']);
  }
}
