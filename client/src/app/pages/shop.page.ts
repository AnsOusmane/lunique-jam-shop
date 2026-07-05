import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../services/api.service';
import { ArtComponent } from '../art.component';
import { FcfaPipe } from '../fcfa.pipe';
import { Product } from '../models';

const CATEGORIES = [
  { key: 'tous', label: 'Tout' },
  { key: 'tee', label: 'Tees' },
  { key: 'hoodie', label: 'Hoodies' },
  { key: 'crew', label: 'Crewnecks' },
  { key: 'pantalon', label: 'Pantalons' },
  { key: 'accessoire', label: 'Accessoires' },
];

@Component({
  selector: 'app-shop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ArtComponent, FcfaPipe],
  template: `
    <main class="page">
      <header class="page-head">
        <span class="label">Drop 001 — Genesis · Dakar-born, Faith-built</span>
        <h1 class="display">La Boutique</h1>
        <p>Huit pièces, zéro compromis. Chaque vêtement est coupé pour durer
          et pensé pour ceux qui portent leurs valeurs.</p>
      </header>

      <div class="filters" role="group" aria-label="Filtrer par catégorie">
        @for (cat of categories; track cat.key) {
          <button class="chip" [class.active]="filter() === cat.key" (click)="filter.set(cat.key)">
            {{ cat.label }}
          </button>
        }
      </div>

      @if (products(); as list) {
        <ul class="grid-products">
          @for (p of filtered(); track p.id) {
            <li>
              <a class="pcard" [routerLink]="['/produit', p.slug]">
                @if (soldOut(p)) {
                  <span class="pcard__badge pcard__badge--out">Épuisé</span>
                } @else if (p.badge) {
                  <span class="pcard__badge">{{ p.badge }}</span>
                }
                <lj-art [art]="p.art" [garment]="p.garment" [garmColor]="p.garm_color" [markColor]="p.mark_color" />
                <div class="pcard__row">
                  <h3>{{ p.name }}</h3>
                  <span class="pcard__price">{{ p.price | fcfa }}</span>
                </div>
                <p class="pcard__meta">{{ p.color }} · {{ sizesLabel(p) }}</p>
              </a>
            </li>
          }
        </ul>
      } @else {
        <ul class="grid-products" aria-hidden="true">
          @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
            <li><div class="skeleton" style="aspect-ratio: 4/5"></div></li>
          }
        </ul>
      }
    </main>
  `,
})
export class ShopPage {
  private api = inject(ApiService);

  readonly categories = CATEGORIES;
  readonly filter = signal('tous');
  readonly products = toSignal(this.api.getProducts());

  readonly filtered = computed(() => {
    const list = this.products() ?? [];
    const f = this.filter();
    return f === 'tous' ? list : list.filter((p) => p.category === f);
  });

  soldOut(p: Product): boolean {
    return p.variants.every((v) => v.stock <= 0);
  }

  sizesLabel(p: Product): string {
    const inStock = p.variants.filter((v) => v.stock > 0).map((v) => v.size);
    return inStock.length ? inStock.join(' / ') : 'victime de son succès';
  }
}
