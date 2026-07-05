import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <main class="page page--narrow" style="max-width: 440px">
      <header class="page-head">
        <span class="label">Espace équipe</span>
        <h1 class="display">Admin</h1>
      </header>

      <form (ngSubmit)="submit()" novalidate style="display: grid; gap: 18px">
        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" [(ngModel)]="email" required autocomplete="username" />
        </div>
        <div class="field">
          <label for="password">Mot de passe</label>
          <input id="password" name="password" type="password" [(ngModel)]="password" required autocomplete="current-password" />
        </div>

        @if (error()) {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
        }

        <button class="btn btn--dark" type="submit" [disabled]="loading()">
          @if (loading()) { Connexion… } @else { Se connecter }
        </button>
      </form>
    </main>
  `,
})
export class AdminLoginPage {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.api.login(this.email, this.password).subscribe({
      next: ({ token, admin }) => {
        this.auth.store(token, admin.name);
        this.router.navigate(['/admin']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Connexion impossible.');
      },
    });
  }
}
