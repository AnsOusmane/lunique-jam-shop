import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { FcfaPipe } from '../fcfa.pipe';
import { ART_STUDIOS, Category, GARMENTS, Media, Product } from '../models';

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
          <select id="p-category" name="p-category" [(ngModel)]="form.category" required>
            <option value="" disabled>Choisir…</option>
            @for (c of categories(); track c.id) {
              <option [value]="c.key">{{ c.label }}{{ c.active ? '' : ' (désactivée)' }}</option>
            }
          </select>
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

        <div class="full">
          <label style="display: block; margin-bottom: 8px">Photos &amp; vidéos</label>
          @if (editingId() === null) {
            <p style="opacity: 0.6; font-size: 13px">Enregistre la pièce d'abord — tu pourras ajouter des photos et vidéos juste après.</p>
          } @else {
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px">
              @for (m of editingMedia(); track m.id) {
                <div style="position: relative; width: 110px">
                  @if (m.type === 'image') {
                    <img [src]="m.url" alt="" style="width: 110px; height: 110px; object-fit: cover; border-radius: 4px; display: block" />
                  } @else {
                    <video [src]="m.url" muted style="width: 110px; height: 110px; object-fit: cover; border-radius: 4px; display: block"></video>
                  }
                  <button type="button" (click)="removeMedia(m.id)" aria-label="Supprimer ce média"
                          style="position: absolute; top: 4px; right: 4px; background: var(--ink); color: var(--bone); border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer">✕</button>
                </div>
              } @empty {
                <p style="opacity: 0.5; font-size: 13px">Aucun média pour l'instant.</p>
              }
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
                   (change)="onMediaSelected($event)" [disabled]="uploadingMedia()" />
            <p style="opacity: 0.5; font-size: 12px; margin-top: 6px">Images : jpeg/png/webp/avif, 8 Mo max · Vidéos : mp4/webm/mov, 50 Mo max.</p>
            @if (uploadingMedia()) { <p style="font-size: 13px; margin-top: 6px">Envoi en cours…</p> }
          }
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
                <div style="display: flex; gap: 10px; align-items: center">
                  @if (coverImage(p); as cover) {
                    <img [src]="cover.url" alt="" style="width: 44px; height: 44px; object-fit: cover; border-radius: 4px; flex-shrink: 0" />
                  } @else {
                    <div class="art-swatch ljart--{{ p.art }}" style="width: 44px; height: 44px; flex-shrink: 0"></div>
                  }
                  <div>
                    <strong>{{ p.name }}</strong><br />
                    <small style="opacity: 0.6">{{ p.slug }} · {{ p.color }}</small>
                    @if (p.badge) { <br /><small class="badge-status" style="margin-top: 4px; display: inline-block">{{ p.badge }}</small> }
                  </div>
                </div>
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
  readonly categories = signal<Category[]>([]);
  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly editingMedia = signal<Media[]>([]);
  readonly uploadingMedia = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  form = { ...EMPTY_FORM };
  sizeRows: SizeRow[] = [{ size: '', stock: 0 }];
  slugTouched = false;

  constructor() {
    this.refresh();
    this.api.adminCategories().subscribe({ next: (c) => this.categories.set(c) });
  }

  refresh(): void {
    this.api.adminProducts().subscribe({
      next: (products) => this.products.set(products),
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
    this.editingMedia.set([]);
    this.form = { ...EMPTY_FORM };
    this.sizeRows = [{ size: '', stock: 0 }];
    this.slugTouched = false;
    this.formOpen.set(true);
    this.error.set(null);
  }

  openEdit(p: Product): void {
    this.editingId.set(p.id);
    this.editingMedia.set(p.media);
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

  coverImage(p: Product): Media | undefined {
    return p.media.find((m) => m.type === 'image');
  }

  onMediaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const productId = this.editingId();
    if (!file || productId === null) return;

    this.uploadingMedia.set(true);
    this.error.set(null);
    this.api.uploadMedia(productId, file).subscribe({
      next: (media) => {
        this.uploadingMedia.set(false);
        this.editingMedia.update((list) => [...list, media]);
        input.value = '';
        this.refresh();
      },
      error: (e) => {
        this.uploadingMedia.set(false);
        input.value = '';
        this.fail(e);
      },
    });
  }

  removeMedia(mediaId: number): void {
    if (!confirm('Supprimer ce média ?')) return;
    this.api.deleteMedia(mediaId).subscribe({
      next: () => {
        this.editingMedia.update((list) => list.filter((m) => m.id !== mediaId));
        this.refresh();
      },
      error: (e) => this.fail(e),
    });
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
