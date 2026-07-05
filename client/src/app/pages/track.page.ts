import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../services/api.service';
import { FcfaPipe } from '../fcfa.pipe';
import { PAYMENT_LABELS, STATUS_LABELS, TrackedOrder } from '../models';

const STEPS = ['recue', 'confirmee', 'preparation', 'expediee', 'livree'];

@Component({
  selector: 'app-track',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FcfaPipe],
  template: `
    <main class="page page--narrow">
      <header class="page-head">
        <span class="label">Où en est ton drop ?</span>
        <h1 class="display">Suivi</h1>
        <p>Entre la référence reçue à la commande (ex : LJ-ABC123) et ton numéro de téléphone.</p>
      </header>

      <form class="form-grid" (ngSubmit)="search()" novalidate style="max-width: 560px">
        <div class="field">
          <label for="ref">Référence *</label>
          <input id="ref" name="ref" [(ngModel)]="ref" placeholder="LJ-XXXXXX" required
                 style="text-transform: uppercase" />
        </div>
        <div class="field">
          <label for="phone">Téléphone *</label>
          <input id="phone" name="phone" [(ngModel)]="phone" placeholder="+221 …" required inputmode="tel" />
        </div>
        <div class="full">
          <button class="btn btn--dark" type="submit" [disabled]="loading()">
            @if (loading()) { Recherche… } @else { Retrouver ma commande }
          </button>
        </div>
      </form>

      @if (error()) {
        <p class="alert alert--error" role="alert">{{ error() }}</p>
      }

      @if (order(); as o) {
        <section style="margin-top: 40px">
          <h2 class="display" style="font-size: 24px">{{ o.ref }}</h2>
          <p style="opacity: 0.6; margin-top: 4px">
            Passée le {{ o.created_at }} · {{ paymentLabels[o.payment_method] }}
            @if (o.payment_status === 'paye') { · <strong style="color: var(--emerald)">Payée</strong> }
          </p>

          @if (o.status === 'annulee') {
            <div class="timeline">
              <div class="tstep cancel">
                <span class="tstep__dot">✕</span>
                <span class="tstep__name">Commande annulée
                  <small>Contacte-nous si tu penses qu'il s'agit d'une erreur.</small>
                </span>
              </div>
            </div>
          } @else {
            <div class="timeline">
              @for (step of steps; track step; let i = $index) {
                <div class="tstep" [class.done]="i <= currentStep(o)">
                  <span class="tstep__dot">@if (i <= currentStep(o)) { ✓ } @else { {{ i + 1 }} }</span>
                  <span class="tstep__name">{{ statusLabels[step] }}
                    @if (i === currentStep(o)) { <small>Étape en cours</small> }
                  </span>
                </div>
              }
            </div>
          }

          <h3 class="label" style="margin: 26px 0 12px">Contenu</h3>
          <ul>
            @for (item of o.items; track $index) {
              <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(11,11,10,0.08)">
                <span>{{ item.name }} · {{ item.size }} × {{ item.qty }}</span>
                <span style="font-family: var(--font-label)">{{ item.price * item.qty | fcfa }}</span>
              </li>
            }
          </ul>
          <p style="text-align: right; margin-top: 14px; font-family: var(--font-display); font-weight: 800; text-transform: uppercase">
            Total : {{ o.total | fcfa }}
          </p>
        </section>
      }
    </main>
  `,
})
export class TrackPage {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  readonly steps = STEPS;
  readonly statusLabels = STATUS_LABELS;
  readonly paymentLabels = PAYMENT_LABELS;

  ref = this.route.snapshot.queryParamMap.get('ref') ?? '';
  phone = '';

  readonly order = signal<TrackedOrder | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  currentStep(o: TrackedOrder): number {
    return STEPS.indexOf(o.status);
  }

  search(): void {
    this.error.set(null);
    this.order.set(null);
    if (!this.ref.trim() || !this.phone.trim()) {
      this.error.set('Renseigne la référence et le téléphone.');
      return;
    }
    this.loading.set(true);
    this.api.trackOrder(this.ref, this.phone).subscribe({
      next: (o) => { this.loading.set(false); this.order.set(o); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Commande introuvable.');
      },
    });
  }
}
