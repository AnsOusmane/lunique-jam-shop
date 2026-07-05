import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FcfaPipe } from '../fcfa.pipe';
import { OrderResult, PaymentMethod } from '../models';

interface ConfirmState {
  result?: OrderResult;
  payment?: PaymentMethod;
  phone?: string;
}

@Component({
  selector: 'app-confirm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FcfaPipe],
  template: `
    <main class="page page--narrow confirm">
      <svg class="arrow"><use href="#lj-arrow" /></svg>
      <span class="label" style="color: var(--emerald)">Commande confirmée</span>
      <h1 class="display" style="font-size: clamp(30px, 6vw, 64px); margin-top: 10px">
        Merci, c'est noté.
      </h1>

      <div><span class="ref">{{ ref() }}</span></div>
      <p style="opacity: 0.65; margin-bottom: 8px">
        Garde cette référence précieusement — elle te permet de suivre ta commande.
      </p>

      @if (state.result; as r) {
        <p style="font-family: var(--font-label); margin: 10px 0 24px">
          Total : <strong>{{ r.total | fcfa }}</strong>
          @if (r.deliveryFee === 0) { (retrait gratuit) }
          @else { (dont livraison {{ r.deliveryFee | fcfa }}) }
        </p>
      }

      <div class="note">
        @switch (state.payment) {
          @case ('wave') {
            <strong>Paiement Wave :</strong> notre équipe t'envoie une demande de paiement
            sur {{ state.phone || 'ton numéro' }} d'ici quelques minutes. La commande part dès validation.
          }
          @case ('orange_money') {
            <strong>Paiement Orange Money :</strong> on te contacte sur
            {{ state.phone || 'ton numéro' }} pour finaliser le transfert OM. La commande part dès validation.
          }
          @default {
            <strong>Paiement à la livraison :</strong> prépare le montant exact —
            notre livreur te contacte avant de passer. Clean fits, clean cash.
          }
        }
      </div>

      <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap">
        <a class="btn btn--fill" routerLink="/suivi" [queryParams]="{ ref: ref() }">Suivre ma commande</a>
        <a class="btn btn--ghost" routerLink="/">Retour à la boutique</a>
      </div>
    </main>
  `,
})
export class ConfirmPage {
  private router = inject(Router);

  ref = input.required<string>();
  readonly state: ConfirmState = (this.router.lastSuccessfulNavigation?.extras?.state as ConfirmState) ?? history.state ?? {};
}
