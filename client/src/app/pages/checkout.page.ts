import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { CartService } from '../services/cart.service';
import { AccountService } from '../services/account.service';
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
        @if (!account.isLogged) {
          <p class="alert alert--ok" style="max-width: 640px">
            Déjà membre du Cercle ?
            <a [routerLink]="['/compte/connexion']" [queryParams]="{ next: 'commande' }" style="text-decoration: underline; font-weight: 700">
              Connecte-toi
            </a>
            pour pré-remplir tes infos et retrouver ta commande dans ton historique.
          </p>
        }
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

            <h2 class="label" style="margin: 30px 0 16px">Code promo</h2>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; max-width: 480px">
              <input name="promo" [(ngModel)]="promoInput" placeholder="Ex : GENESIS10"
                     style="flex: 1 1 180px; background: #fff; border: 1px solid rgba(11,11,10,0.2); border-radius: var(--radius); padding: 13px 15px; text-transform: uppercase"
                     [disabled]="!!promo()" aria-label="Code promo" />
              @if (promo(); as p) {
                <button type="button" class="btn btn--ghost btn--sm" (click)="removePromo()">Retirer {{ p.code }}</button>
              } @else {
                <button type="button" class="btn btn--dark btn--sm" (click)="applyPromo()" [disabled]="checkingPromo()">
                  @if (checkingPromo()) { … } @else { Appliquer }
                </button>
              }
            </div>
            @if (promoError()) { <p class="alert alert--error">{{ promoError() }}</p> }
            @if (promo(); as p) {
              <p class="alert alert--ok">Code {{ p.code }} appliqué : -{{ p.discount | fcfa }}</p>
            }

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
            @if (promo(); as p) {
              <div class="row">
                <span>Remise ({{ p.code }})</span><span class="free">-{{ p.discount | fcfa }}</span>
              </div>
            }
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
  readonly account = inject(AccountService);
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
  promoInput = '';

  readonly payment = signal<PaymentMethod>('wave');
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly promo = signal<{ code: string; discount: number } | null>(null);
  readonly promoError = signal<string | null>(null);
  readonly checkingPromo = signal(false);
  private readonly zoneSig = signal<Zone>('dakar');

  readonly fee = computed(() => ZONE_FEES[this.zoneSig()]);
  readonly total = computed(() =>
    Math.max(0, this.cart.subtotal() - (this.promo()?.discount ?? 0)) + this.fee(),
  );

  constructor() {
    // Pré-remplissage depuis le compte client (dès que le profil est chargé)
    effect(() => {
      const c = this.account.customer();
      if (!c || this.name) return;
      this.name = c.name;
      this.phone = c.phone;
      this.email = c.email;
      this.address = c.address ?? '';
      this.city = c.city ?? 'Dakar';
      if (c.zone === 'dakar' || c.zone === 'regions' || c.zone === 'retrait') {
        this.zone = c.zone;
        this.zoneSig.set(c.zone);
      }
    });
  }

  applyPromo(): void {
    const code = this.promoInput.trim();
    if (!code) return;
    this.promoError.set(null);
    this.checkingPromo.set(true);
    this.api.validatePromo(code, this.cart.subtotal()).subscribe({
      next: (p) => { this.checkingPromo.set(false); this.promo.set(p); },
      error: (err) => {
        this.checkingPromo.set(false);
        this.promoError.set(err?.error?.error || 'Code invalide.');
      },
    });
  }

  removePromo(): void {
    this.promo.set(null);
    this.promoInput = '';
    this.promoError.set(null);
  }

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
      promoCode: this.promo()?.code,
    }).subscribe({
      next: (result) => {
        this.cart.clear();
        this.router.navigate(['/merci', result.ref], {
          state: { result, payment: this.payment(), phone: this.phone.trim(), email: this.email.trim() },
        });
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.error?.error || 'Impossible d’envoyer la commande. Vérifie ta connexion et réessaie.');
      },
    });
  }
}
