import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { CartService } from '../services/cart.service';
import { FcfaPipe } from '../fcfa.pipe';
import { PaymentMethod, ZONE_FEES, ZONE_LABELS, Zone } from '../models';

@Component({
  selector: 'app-checkout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, FcfaPipe],
  template: `
    <main class="page">
      <header class="page-head">
        <span class="label">Dernière étape</span>
        <h1 class="display">Commande</h1>
      </header>

      @if (cart.lines().length === 0) {
        <p>Ton panier est vide. <a routerLink="/" style="text-decoration: underline">Retour à la boutique</a>.</p>
      } @else {
        <form class="checkout-layout" (ngSubmit)="submit()" novalidate>
          <div>
            <h2 class="label" style="margin-bottom: 16px">Livraison</h2>
            <div class="form-grid">
              <div class="field">
                <label for="name">Nom complet *</label>
                <input id="name" name="name" [(ngModel)]="name" required autocomplete="name" />
              </div>
              <div class="field">
                <label for="phone">Téléphone *</label>
                <input id="phone" name="phone" [(ngModel)]="phone" required autocomplete="tel"
                       placeholder="+221 77 000 00 00" inputmode="tel" />
              </div>
              <div class="field full">
                <label for="email">E-mail (optionnel)</label>
                <input id="email" name="email" [(ngModel)]="email" type="email" autocomplete="email" />
              </div>
              <div class="field full">
                <label for="address">Adresse *</label>
                <input id="address" name="address" [(ngModel)]="address" required
                       placeholder="Quartier, rue, repère…" autocomplete="street-address" />
              </div>
              <div class="field">
                <label for="city">Ville *</label>
                <input id="city" name="city" [(ngModel)]="city" required autocomplete="address-level2" />
              </div>
              <div class="field">
                <label for="zone">Zone de livraison *</label>
                <select id="zone" name="zone" [(ngModel)]="zone">
                  @for (z of zones; track z) {
                    <option [value]="z">{{ zoneLabels[z] }}</option>
                  }
                </select>
              </div>
            </div>

            <h2 class="label" style="margin: 30px 0 16px">Paiement</h2>
            <div class="pay-options" role="radiogroup" aria-label="Moyen de paiement">
              <label class="pay-option" [class.active]="payment() === 'wave'">
                <input type="radio" name="payment" value="wave" [checked]="payment() === 'wave'" (change)="payment.set('wave')" />
                <span class="pay-logo pay-logo--wave">W</span>
                <span>
                  <span class="pay-name">Wave</span><br />
                  <span class="pay-desc">Tu recevras une demande de paiement sur ton numéro</span>
                </span>
              </label>
              <label class="pay-option" [class.active]="payment() === 'orange_money'">
                <input type="radio" name="payment" value="orange_money" [checked]="payment() === 'orange_money'" (change)="payment.set('orange_money')" />
                <span class="pay-logo pay-logo--om">OM</span>
                <span>
                  <span class="pay-name">Orange Money</span><br />
                  <span class="pay-desc">Paiement par OM à la confirmation de la commande</span>
                </span>
              </label>
              <label class="pay-option" [class.active]="payment() === 'livraison'">
                <input type="radio" name="payment" value="livraison" [checked]="payment() === 'livraison'" (change)="payment.set('livraison')" />
                <span class="pay-logo pay-logo--cash">F</span>
                <span>
                  <span class="pay-name">À la livraison</span><br />
                  <span class="pay-desc">Tu paies en espèces quand tu reçois ta commande</span>
                </span>
              </label>
            </div>

            @if (error()) {
              <p class="alert alert--error" role="alert">{{ error() }}</p>
            }

            <button class="btn btn--fill" style="margin-top: 26px" type="submit" [disabled]="sending()">
              @if (sending()) { Envoi en cours… } @else { Confirmer la commande — {{ total() | fcfa }} }
              <svg class="btn__arrow"><use href="#lj-arrow" /></svg>
            </button>
            <p style="font-size: 12.5px; opacity: 0.55; margin-top: 12px">
              En confirmant, tu acceptes d'être contacté·e au numéro indiqué pour finaliser la livraison.
            </p>
          </div>

          <aside class="recap">
            <h2>Récapitulatif</h2>
            @for (line of cart.lines(); track line.productId + line.size) {
              <div class="row">
                <span>{{ line.name }} · {{ line.size }} × {{ line.qty }}</span>
                <span>{{ line.price * line.qty | fcfa }}</span>
              </div>
            }
            <div class="row" style="margin-top: 10px">
              <span>Sous-total</span><span>{{ cart.subtotal() | fcfa }}</span>
            </div>
            <div class="row">
              <span>Livraison</span>
              @if (fee() === 0) { <span class="free">Gratuite</span> }
              @else { <span>{{ fee() | fcfa }}</span> }
            </div>
            <div class="row row--total">
              <span>Total</span><span>{{ total() | fcfa }}</span>
            </div>
          </aside>
        </form>
      }
    </main>
  `,
})
export class CheckoutPage {
  readonly cart = inject(CartService);
  private api = inject(ApiService);
  private router = inject(Router);

  readonly zones: Zone[] = ['dakar', 'regions', 'retrait'];
  readonly zoneLabels = ZONE_LABELS;

  name = '';
  phone = '';
  email = '';
  address = '';
  city = 'Dakar';
  zone: Zone = 'dakar';

  readonly payment = signal<PaymentMethod>('wave');
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  private readonly zoneSig = signal<Zone>('dakar');

  readonly fee = computed(() => ZONE_FEES[this.zoneSig()]);
  readonly total = computed(() => this.cart.subtotal() + this.fee());

  ngDoCheck(): void {
    // ngModel n'est pas un signal : on synchronise la zone pour le récap réactif.
    if (this.zoneSig() !== this.zone) this.zoneSig.set(this.zone);
  }

  submit(): void {
    this.error.set(null);

    if (this.name.trim().length < 2) return this.error.set('Indique ton nom complet.');
    if (!/^(\+?\d[\d\s]{7,17})$/.test(this.phone.trim())) return this.error.set('Numéro de téléphone invalide (ex : +221 77 000 00 00).');
    if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) return this.error.set('E-mail invalide.');
    if (this.address.trim().length < 4) return this.error.set('Indique une adresse de livraison précise.');
    if (this.city.trim().length < 2) return this.error.set('Indique ta ville.');

    this.sending.set(true);
    this.api.createOrder({
      customer: {
        name: this.name.trim(),
        phone: this.phone.trim(),
        email: this.email.trim(),
        address: this.address.trim(),
        city: this.city.trim(),
        zone: this.zone,
      },
      items: this.cart.lines().map((l) => ({ productId: l.productId, size: l.size, qty: l.qty })),
      payment: this.payment(),
    }).subscribe({
      next: (result) => {
        this.cart.clear();
        this.router.navigate(['/merci', result.ref], {
          state: { result, payment: this.payment(), phone: this.phone.trim() },
        });
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.error?.error || 'Impossible d’envoyer la commande. Vérifie ta connexion et réessaie.');
      },
    });
  }
}
