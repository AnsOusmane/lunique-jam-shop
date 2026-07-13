import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { FcfaPipe } from '../fcfa.pipe';
import { ART_STUDIOS, GARMENTS, Product } from '../models';

interface SizeRow {
  size: string;
  stock: number;
}

const EMPTY_FORM = {
  slug: '', name: '', price: null as number | null, color: '', description: '', category: '',
  badge: '', garment: 'tee', art: 'p1', garm_color: '#101010', mark_color: '#F7F4EC',
};

@Component({
  selector: 'app-admin-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FcfaPipe],
  template: `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px">
      <p style="opacity: 0.6; max-width: 60ch">
        Catalogue complet — {{ products().length }} pièce(s). Les pièces désactivées restent en base
        (historique des commandes) mais disparaissent de la boutique.
      </p>
      <button class="btn btn--dark btn--sm" (click)="openCreate()">+ Nouvelle pièce</button>
    </div>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }
    @if (ok()) {
      <p class="alert alert--ok" role="status">{{ ok() }}</p>
    }

    @if (formOpen()) {
      <form class="form-grid" style="margin-bottom: 30px" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="p-name">Nom</label>
          <input id="p-name" name="p-name" [(ngModel)]="form.name" (ngModelChange)="onNameChange($event)" required />
        </div>
        <div class="field">
          <label for="p-slug">Slug (URL)</label>
          <input id="p-slug" name="p-slug" [(ngModel)]="form.slug" (ngModelChange)="slugTouched = true" required
                 pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="genesis-tee" />
        </div>
        <div class="field">
          <label for="p-price">Prix (F CFA)</label>
          <input id="p-price" name="p-price" type="number" min="1" [(ngModel)]="form.price" required />
        </div>
        <div class="field">
          <label for="p-color">Couleur (libellé)</label>
          <input id="p-color" name="p-color" [(ngModel)]="form.color" placeholder="Noir éclipse" required />
        </div>
        <div class="field">
          <label for="p-category">Catégorie</label>
          <input id="p-category" name="p-category" [(ngModel)]="form.category" list="categories" required />
          <datalist id="categories">
            @for (c of categories(); track c) { <option [value]="c"></option> }
          </datalist>
        </div>
        <div class="field">
          <label for="p-badge">Badge (optionnel)</label>
          <input id="p-badge" name="p-badge" [(ngModel)]="form.badge" placeholder="Nouveau, Best-seller…" />
        </div>
        <div class="field">
          <label for="p-garment">Type de vêtement</label>
          <select id="p-garment" name="p-garment" [(ngModel)]="form.garment">
            @for (g of garments; track g) { <option [value]="g">{{ g }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="p-garm-color">Couleur du vêtement</label>
          <input id="p-garm-color" name="p-garm-color" type="color" [(ngModel)]="form.garm_color" />
        </div>
        <div class="field">
          <label for="p-mark-color">Couleur du logo</label>
          <input id="p-mark-color" name="p-mark-color" type="color" [(ngModel)]="form.mark_color" />
        </div>
        <div class="field full">
          <label>Fond visuel</label>
          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            @for (a of arts; track a) {
              <button type="button" class="art-swatch ljart--{{ a }}" [class.art-swatch--active]="form.art === a"
                      (click)="form.art = a" [attr.aria-label]="'Fond ' + a" [attr.aria-pressed]="form.art === a"></button>
            }
          </div>
        </div>
        <div class="field full">
          <label for="p-desc">Description</label>
          <textarea id="p-desc" name="p-desc" rows="3" [(ngModel)]="form.description" required></textarea>
        </div>

        <div class="full">
          <label style="display: block; margin-bottom: 8px">Tailles &amp; stock</label>
          <div style="display: flex; flex-direction: column; gap: 8px">
            @for (row of sizeRows; track $index) {
              <div style="display: flex; gap: 10px; align-items: center">
                <input [(ngModel)]="row.size" [name]="'size' + $index" placeholder="S, M, L, Unique…" style="max-width: 140px" />
                <input type="number" min="0" max="9999" [(ngModel)]="row.stock" [name]="'stock' + $index" placeholder="Stock" style="max-width: 100px" />
                @if (sizeRows.length > 1) {
                  <button type="button" class="btn btn--ghost btn--sm" (click)="removeSizeRow($index)">Retirer</button>
                }
              </div>
            }
          </div>
          <button type="button" class="btn btn--ghost btn--sm" style="margin-top: 10px" (click)="addSizeRow()">+ Taille</button>
        </div>

        <div class="full" style="display: flex; gap: 12px">
          <button class="btn btn--dark btn--sm" type="submit" [disabled]="saving()">
            @if (saving()) { Enregistrement… } @else if (editingId() !== null) { Enregistrer } @else { Créer la pièce }
          </button>
          <button type="button" class="btn btn--ghost btn--sm" (click)="closeForm()">Annuler</button>
        </div>
      </form>
    }

    <div class="table-scroll">
      <table class="admin-table">
        <thead>
          <tr><th>Pièce</th><th>Catégorie</th><th>Prix</th><th>Tailles</th><th>Statut</th><th></th></tr>
        </thead>
        <tbody>
          @for (p of products(); track p.id) {
            <tr>
              <td>
                <strong>{{ p.name }}</strong><br />
                <small style="opacity: 0.6">{{ p.slug }} · {{ p.color }}</small>
                @if (p.badge) { <br /><small class="badge-status" style="margin-top: 4px; display: inline-block">{{ p.badge }}</small> }
              </td>
              <td>{{ p.category }}</td>
              <td style="font-family: var(--font-label); white-space: nowrap">{{ p.price | fcfa }}</td>
              <td>
                @for (v of p.variants; track v.id) {
                  <span class="badge-status" style="margin: 0 4px 4px 0; display: inline-block">
                    {{ v.size }} · {{ v.stock }}
                    <button type="button" (click)="removeVariant(p, v.id)" aria-label="Retirer cette taille"
                            style="background: none; border: none; cursor: pointer; margin-left: 4px; opacity: 0.6">✕</button>
                  </span>
                }
              </td>
              <td>
                <button class="badge-status" [class.badge-status--paye]="p.active !== 0" [class.badge-status--annulee]="p.active === 0"
                        (click)="toggleActive(p)">
                  {{ p.active !== 0 ? 'Active' : 'Désactivée' }}
                </button>
              </td>
              <td style="white-space: nowrap">
                <button class="btn btn--ghost btn--sm" (click)="openEdit(p)">Éditer</button>
                <button class="btn btn--ghost btn--sm" style="margin-left: 8px" (click)="remove(p)">Supprimer</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" style="text-align: center; opacity: 0.5; padding: 40px">Aucune pièce pour le moment.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AdminProductsComponent {
  private api = inject(ApiService);

  readonly garments = GARMENTS;
  readonly arts = ART_STUDIOS;

  readonly products = signal<Product[]>([]);
  readonly categories = signal<string[]>([]);
  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  form = { ...EMPTY_FORM };
  sizeRows: SizeRow[] = [{ size: '', stock: 0 }];
  slugTouched = false;

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.api.adminProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.categories.set([...new Set(products.map((p) => p.category))].sort());
      },
      error: (e) => this.fail(e),
    });
  }

  onNameChange(name: string): void {
    if (this.slugTouched) return;
    this.form.slug = name
      .toLowerCase().trim()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.sizeRows = [{ size: '', stock: 0 }];
    this.slugTouched = false;
    this.formOpen.set(true);
    this.error.set(null);
  }

  openEdit(p: Product): void {
    this.editingId.set(p.id);
    this.form = {
      slug: p.slug, name: p.name, price: p.price, color: p.color, description: p.description,
      category: p.category, badge: p.badge || '', garment: p.garment, art: p.art,
      garm_color: p.garm_color, mark_color: p.mark_color,
    };
    this.sizeRows = [];
    this.slugTouched = true;
    this.formOpen.set(true);
    this.error.set(null);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  addSizeRow(): void {
    this.sizeRows.push({ size: '', stock: 0 });
  }

  removeSizeRow(i: number): void {
    this.sizeRows.splice(i, 1);
  }

  submit(): void {
    this.error.set(null);
    const editing = this.editingId();
    const payload = {
      ...this.form,
      price: Number(this.form.price),
      badge: this.form.badge?.trim() || null,
    };

    this.saving.set(true);
    if (editing === null) {
      const sizes: Record<string, number> = {};
      for (const row of this.sizeRows) {
        if (!row.size.trim()) continue;
        sizes[row.size.trim()] = Number(row.stock) || 0;
      }
      this.api.createProduct({ ...payload, sizes }).subscribe({
        next: () => this.succeed('Pièce créée.'),
        error: (e) => this.failSave(e),
      });
    } else {
      this.api.updateProduct(editing, payload).subscribe({
        next: () => this.succeed('Pièce mise à jour.'),
        error: (e) => this.failSave(e),
      });
    }
  }

  toggleActive(p: Product): void {
    this.api.updateProduct(p.id, { active: p.active === 0 }).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
  }

  remove(p: Product): void {
    if (!confirm(`Supprimer définitivement « ${p.name} » ? Cette action est irréversible.`)) return;
    this.api.deleteProduct(p.id).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
  }

  removeVariant(p: Product, variantId: number): void {
    if (p.variants.length <= 1) {
      this.error.set('Impossible de retirer la dernière taille — désactive plutôt la pièce.');
      return;
    }
    if (!confirm('Retirer cette taille du catalogue ?')) return;
    this.api.deleteVariant(variantId).subscribe({
      next: () => this.refresh(),
      error: (e) => this.fail(e),
    });
  }

  private succeed(msg: string): void {
    this.saving.set(false);
    this.formOpen.set(false);
    this.ok.set(msg);
    setTimeout(() => this.ok.set(null), 3000);
    this.refresh();
  }

  private failSave(err: unknown): void {
    this.saving.set(false);
    this.fail(err);
  }

  private fail(err: unknown): void {
    const e = err as { error?: { error?: string } };
    this.error.set(e.error?.error || 'Une erreur est survenue.');
  }
}
