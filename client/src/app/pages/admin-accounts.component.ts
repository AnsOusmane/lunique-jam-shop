import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { AdminUser } from '../models';

@Component({
  selector: 'app-admin-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <p style="opacity: 0.6; max-width: 60ch; margin-bottom: 18px">
      Tous les comptes ici ont un accès complet au back-office (pas de rôles distincts pour l'instant).
      N'invite que des personnes de confiance dans l'équipe.
    </p>

    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    }
    @if (ok()) {
      <p class="alert alert--ok" role="status">{{ ok() }}</p>
    }

    <form class="form-grid" style="max-width: 720px; margin-bottom: 30px" (ngSubmit)="createAdmin()" novalidate>
      <div class="field">
        <label for="a-name">Nom</label>
        <input id="a-name" name="a-name" [(ngModel)]="newName" required autocomplete="off" />
      </div>
      <div class="field">
        <label for="a-email">E-mail</label>
        <input id="a-email" name="a-email" type="email" [(ngModel)]="newEmail" required autocomplete="off" />
      </div>
      <div class="field">
        <label for="a-password">Mot de passe (min. 8 caractères)</label>
        <input id="a-password" name="a-password" type="password" [(ngModel)]="newPassword" required minlength="8" autocomplete="new-password" />
      </div>
      <div class="full">
        <button class="btn btn--dark btn--sm" type="submit" [disabled]="creating()">
          @if (creating()) { Création… } @else { Inviter dans l'équipe }
        </button>
      </div>
    </form>

    <div class="table-scroll">
      <table class="admin-table" style="max-width: 760px">
        <thead>
          <tr><th>Nom</th><th>E-mail</th><th></th></tr>
        </thead>
        <tbody>
          @for (a of admins(); track a.id) {
            <tr>
              <td>
                {{ a.name }}
                @if (a.id === auth.adminId()) { <span class="badge-status" style="margin-left: 8px">Toi</span> }
              </td>
              <td>{{ a.email }}</td>
              <td>
                @if (a.id !== auth.adminId()) {
                  <button class="btn btn--ghost btn--sm" (click)="remove(a)" [disabled]="admins().length <= 1">Retirer</button>
                } @else {
                  <button class="btn btn--ghost btn--sm" (click)="changeOwnPassword()">Changer mon mot de passe</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="3" style="text-align: center; opacity: 0.5; padding: 30px">Aucun compte.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AdminAccountsComponent {
  private api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly admins = signal<AdminUser[]>([]);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  newName = '';
  newEmail = '';
  newPassword = '';

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.api.adminAdmins().subscribe({ next: (a) => this.admins.set(a), error: (e) => this.fail(e) });
  }

  createAdmin(): void {
    if (!this.newName.trim() || !this.newEmail.trim() || this.newPassword.length < 8) return;
    this.error.set(null);
    this.creating.set(true);
    this.api.createAdmin({ name: this.newName.trim(), email: this.newEmail.trim(), password: this.newPassword }).subscribe({
      next: () => {
        this.creating.set(false);
        this.newName = '';
        this.newEmail = '';
        this.newPassword = '';
        this.succeed('Compte créé.');
      },
      error: (e) => {
        this.creating.set(false);
        this.fail(e);
      },
    });
  }

  remove(a: AdminUser): void {
    if (!confirm(`Retirer l'accès admin de ${a.name} (${a.email}) ?`)) return;
    this.api.deleteAdmin(a.id).subscribe({
      next: () => this.succeed('Compte retiré.'),
      error: (e) => this.fail(e),
    });
  }

  changeOwnPassword(): void {
    const pwd = prompt('Nouveau mot de passe (min. 8 caractères) :');
    if (!pwd) return;
    if (pwd.length < 8) {
      this.error.set('Mot de passe : 8 caractères minimum.');
      return;
    }
    const id = this.auth.adminId();
    if (id === null) return;
    this.api.updateAdmin(id, { password: pwd }).subscribe({
      next: () => this.succeed('Mot de passe mis à jour.'),
      error: (e) => this.fail(e),
    });
  }

  private succeed(msg: string): void {
    this.error.set(null);
    this.ok.set(msg);
    setTimeout(() => this.ok.set(null), 3000);
    this.refresh();
  }

  private fail(err: unknown): void {
    const e = err as { error?: { error?: string } };
    this.error.set(e.error?.error || 'Une erreur est survenue.');
  }
}
