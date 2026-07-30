import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { CartService } from '../services/cart.service';
import { ArtComponent } from '../art.component';
import { FcfaPipe } from '../fcfa.pipe';

@Component({
  selector: 'app-product',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ArtComponent, FcfaPipe],
  template: `
    <main class="page">
      <a class="back-link" routerLink="/">
        <svg><use href="#lj-arrow" /></svg>
        Retour à la boutique
      </a>

      @if (product(); as p) {
        <div class="product-layout" style="margin-top: 26px">
          @if (p.media.length > 0) {
            <div class="product-gallery">
              @if (activeMedia(); as m) {
                @if (m.type === 'image') {
                  <div class="product-gallery__zoom"
                       (mouseenter)="zoomActive.set(true)"
                       (mouseleave)="zoomActive.set(false)"
                       (mousemove)="onZoomMove($event)">
                    <img [src]="m.url" [alt]="p.name" class="product-gallery__main" />
                    <div class="product-gallery__zoom-lens"
                         [class.active]="zoomActive()"
                         [style.background-image]="'url(' + m.url + ')'"
                         [style.background-position]="zoomPos()"></div>
                  </div>
                } @else {
                  <video [src]="m.url" controls class="product-gallery__main"></video>
                }
              }
              @if (p.media.length > 1) {
                <div class="product-gallery__thumbs">
                  @for (m of p.media; track m.id) {
                    <button type="button" class="product-gallery__thumb" [class.active]="activeMediaId() === m.id"
                            (click)="activeMediaId.set(m.id)" [attr.aria-label]="'Voir média ' + $index + 1">
                      @if (m.type === 'image') {
                        <img [src]="m.url" alt="" />
                      } @else {
                        <video [src]="m.url" muted></video>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          } @else {
            <lj-art [art]="p.art" [garment]="p.garment" [garmColor]="p.garm_color" [markColor]="p.mark_color" />
          }

          <div class="product-info">
            @if (p.badge) { <span class="label" style="color: var(--gold)">{{ p.badge }}</span> }
            <h1 class="display">{{ p.name }}</h1>
            <p class="color">{{ p.color }}</p>
            <p class="price">{{ p.price | fcfa }}</p>
            <p class="desc">{{ p.description }}</p>

            <h2 class="label" style="margin-top: 28px">Taille</h2>
            <div class="sizes" role="group" aria-label="Choisir la taille">
              @for (v of p.variants; track v.id) {
                <button
                  class="size-btn"
                  [class.active]="size() === v.size"
                  [disabled]="v.stock <= 0"
                  (click)="pick(v.size)">
                  {{ v.size }}
                </button>
              }
            </div>
            <p class="stock-hint" [class.stock-hint--low]="lowStock()" [class.stock-hint--ok]="!lowStock()">
              @if (selectedVariant(); as v) {
                @if (v.stock <= 3) { Plus que {{ v.stock }} en stock — fais vite. }
                @else { En stock, expédié sous 24h. }
              }
            </p>

            <h2 class="label" style="margin-top: 18px">Quantité</h2>
            <div class="qty" style="margin-top: 10px">
              <button (click)="dec()" [disabled]="qty() <= 1" aria-label="Diminuer">−</button>
              <span>{{ qty() }}</span>
              <button (click)="inc()" [disabled]="qty() >= maxQty()" aria-label="Augmenter">+</button>
            </div>

            <div class="product-actions">
              <button class="btn btn--fill" [disabled]="!size()" (click)="addToCart()">
                @if (added()) { Ajouté ✓ } @else { Ajouter au panier }
                <svg class="btn__arrow"><use href="#lj-arrow" /></svg>
              </button>
              @if (added()) {
                <a class="btn btn--ghost" routerLink="/panier">Voir le panier</a>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="product-layout" style="margin-top: 26px" aria-hidden="true">
          <div class="skeleton" style="aspect-ratio: 4/5"></div>
          <div>
            <div class="skeleton" style="height: 54px; max-width: 380px"></div>
            <div class="skeleton" style="height: 20px; max-width: 220px; margin-top: 18px"></div>
            <div class="skeleton" style="height: 120px; margin-top: 26px"></div>
          </div>
        </div>
      }
    </main>
  `,
})
export class ProductPage {
  private api = inject(ApiService);
  private cart = inject(CartService);
  private router = inject(Router);

  /** Fourni par le router via withComponentInputBinding. */
  slug = input.required<string>();

  readonly product = toSignal(
    toObservable(this.slug).pipe(switchMap((s) => this.api.getProduct(s)))
  );

  readonly size = signal<string | null>(null);
  readonly qty = signal(1);
  readonly added = signal(false);

  readonly activeMediaId = signal<number | null>(null);
  readonly activeMedia = computed(() => {
    const p = this.product();
    if (!p || p.media.length === 0) return null;
    const id = this.activeMediaId();
    return p.media.find((m) => m.id === id) ?? p.media[0];
  });

  readonly zoomActive = signal(false);
  readonly zoomPos = signal('50% 50%');

  onZoomMove(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.zoomPos.set(`${x}% ${y}%`);
  }

  readonly selectedVariant = computed(() => {
    const p = this.product();
    const s = this.size();
    return p && s ? p.variants.find((v) => v.size === s) ?? null : null;
  });

  readonly maxQty = computed(() => Math.min(this.selectedVariant()?.stock ?? 1, 10));
  readonly lowStock = computed(() => (this.selectedVariant()?.stock ?? 99) <= 3);

  pick(size: string): void {
    this.size.set(size);
    this.qty.set(1);
    this.added.set(false);
  }

  inc(): void { this.qty.update((q) => Math.min(q + 1, this.maxQty())); }
  dec(): void { this.qty.update((q) => Math.max(1, q - 1)); }

  addToCart(): void {
    const p = this.product();
    const s = this.size();
    if (!p || !s) return;
    this.cart.add(p, s, this.qty());
    this.added.set(true);
  }
}
