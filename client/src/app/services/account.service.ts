import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from './api.service';
import { Customer } from '../models';

export const CUSTOMER_TOKEN_KEY = 'lj_customer_token';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private api = inject(ApiService);

  readonly customer = signal<Customer | null>(null);
  readonly ready = signal(false);

  constructor() {
    if (this.token) {
      this.api.me().subscribe({
        next: ({ customer }) => { this.customer.set(customer); this.ready.set(true); },
        error: () => { this.logout(); this.ready.set(true); },
      });
    } else {
      this.ready.set(true);
    }
  }

  get token(): string | null {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY);
  }

  get isLogged(): boolean {
    return !!this.token;
  }

  storeSession(token: string, customer: Customer): void {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    this.customer.set(customer);
  }

  logout(): void {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    this.customer.set(null);
  }
}

export const customerGuard: CanActivateFn = () => {
  const account = inject(AccountService);
  const router = inject(Router);
  return account.isLogged ? true : router.createUrlTree(['/compte/connexion']);
};
