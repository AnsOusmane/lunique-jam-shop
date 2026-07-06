import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AccountService } from '../services/account.service';

@Component({
  selector: 'app-customer-auth',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <main class="page page--narrow" style="max-width: 480px">
      <header class="page-head">
        <span class="label">Le Cercle — ton espace</span>
        <h1 class="display" style="font-size: clamp(28px, 5vw, 40px)">{{ mode() === 'login' ? 'Connexion' : 'Inscription' }}</h1>
        <p>Accès prioritaire aux drops, commandes plus rapides, suivi simplifié.</p>
      </header>

      <div class="admin-tabs">
        <button class="chip" [class.active]="mode() === 'login'" (click)="mode.set('login')">J'ai un compte</button>
        <button class="chip" [class.active]="mode() === 'register'" (click)="mode.set('register')">Créer un compte</button>
      </div>

      <form (ngSubmit)="submit()" novalidate style="display: grid; gap: 18px">
        @if (mode() === 'register') {
          <div class="field">
            <label for="name">Nom complet</label>
            <input id="name" name="name" [(ngModel)]="name" required autocomplete="name" />
          </div>
          <div class="field">
            <label for="phone">Téléphone</label>
            <input id="phone" name="phone" [(ngModel)]="phone" required autocomplete="tel" placeholder="+221 77 000 00 00" inputmode="tel" />
          </div>
        }
        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" [(ngModel)]="email" required autocomplete="email" />
        </div>
        <div class="field">
          <label for="password">Mot de passe {{ mode() === 'register' ? '(8 caractères min.)' : '' }}</label>
          <input id="password" name="password" type="password" [(ngModel)]="password" required
                 [autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'" />
        </div>

        @if (error()) {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
        }

        <button class="btn btn--fill" type="submit" [disabled]="loading()">
          @if (loading()) { Un instant… }
          @else if (mode() === 'login') { Se connecter }
          @else { Rejoindre le Cercle }
          <svg class="btn__arrow"><use href="#lj-arrow" /></svg>
        </button>
      </form>
    </main>
  `,
})
export class CustomerAuthPage {
  private api = inject(ApiService);
  private account = inject(AccountService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly mode = signal<'login' | 'register'>(
    this.route.snapshot.queryParamMap.get('mode') === 'inscription' ? 'register' : 'login',
  );
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  name = '';
  phone = '';
  email = '';
  password = '';

  submit(): void {
    this.error.set(null);
    this.loading.set(true);

    const done = ({ token, customer }: { token: string; customer: import('../models').Customer }) => {
      this.account.storeSession(token, customer);
      const next = this.route.snapshot.queryParamMap.get('next');
      this.router.navigateByUrl(next === 'commande' ? '/commande' : '/compte');
    };
    const fail = (err: { error?: { error?: string } }) => {
      this.loading.set(false);
      this.error.set(err?.error?.error || 'Une erreur est survenue, réessaie.');
    };

    if (this.mode() === 'login') {
      this.api.customerLogin(this.email.trim(), this.password).subscribe({ next: done, error: fail });
    } else {
      this.api.register({
        name: this.name.trim(),
        email: this.email.trim(),
        phone: this.phone.trim(),
        password: this.password,
      }).subscribe({ next: done, error: fail });
    }
  }
}
