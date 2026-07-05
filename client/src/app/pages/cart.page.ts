import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../services/cart.service';
import { ArtComponent } from '../art.component';
import { FcfaPipe } from '../fcfa.pipe';

@Component({
  selector: 'app-cart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ArtComponent, FcfaPipe],
  template: `
    <main class="page page--narrow">
      <header class="page-head">
        <span class="label">Ton panier</span>
        <h1 class="display">Panier</h1>
      </header>

      @if (cart.lines().length === 0) {
        <div class="cart-empty">
          <svg><use href="#lj-arrow" /></svg>
          <p style="font-family: var(--font-display); font-weight: 700; text-transform: uppercase; font-size: 20px">
            Ton panier est vide
          </p>
          <p style="opacity: 0.6; margin: 10px 0 26px">Le drop Genesis n'attend pas.</p>
          <a class="btn btn--fill" routerLink="/">Découvrir le drop</a>
        </div>
      } @else {
        <ul class="cart-lines">
          @for (line of cart.lines(); track line.productId + line.size) {
            <li class="cart-line">
              <a [routerLink]="['/produit', line.slug]">
                <lj-art [art]="line.art" [garment]="line.garment" [garmColor]="line.garm_color" [markColor]="line.mark_color" />
              </a>
              <div>
                <p class="cart-line__name">{{ line.name }}</p>
                <p class="cart-line__meta">Taille {{ line.size }} · {{ line.price | fcfa }} l'unité</p>
                <button class="cart-line__remove" (click)="cart.remove(line)">Retirer</button>
              </div>
              <div class="qty">
                <button (click)="cart.setQty(line, line.qty - 1)" [disabled]="line.qty <= 1" aria-label="Diminuer">−</button>
                <span>{{ line.qty }}</span>
                <button (click)="cart.setQty(line, line.qty + 1)" [disabled]="line.qty >= line.maxStock || line.qty >= 10" aria-label="Augmenter">+</button>
              </div>
              <span class="cart-line__price">{{ line.price * line.qty | fcfa }}</span>
            </li>
          }
        </ul>

        <div class="cart-summary">
          <div class="row"><span>Sous-total</span><span>{{ cart.subtotal() | fcfa }}</span></div>
          <div class="row" style="opacity: 0.6"><span>Livraison</span><span>calculée à l'étape suivante</span></div>
          <div class="row row--total"><span>Total</span><span>{{ cart.subtotal() | fcfa }}</span></div>
          <a class="btn btn--fill" style="margin-top: 14px" routerLink="/commande">
            Passer commande
            <svg class="btn__arrow"><use href="#lj-arrow" /></svg>
          </a>
          <a class="back-link" routerLink="/" style="margin-top: 8px">
            <svg><use href="#lj-arrow" /></svg>
            Continuer mes achats
          </a>
        </div>
      }
    </main>
  `,
})
export class CartPage {
  readonly cart = inject(CartService);
}
