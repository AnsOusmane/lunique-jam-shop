import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

const TOKEN_KEY = 'lj_admin_token';
const NAME_KEY = 'lj_admin_name';
const ID_KEY = 'lj_admin_id';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly adminName = signal<string | null>(localStorage.getItem(NAME_KEY));
  readonly adminId = signal<number | null>(Number(localStorage.getItem(ID_KEY)) || null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get isLogged(): boolean {
    return !!this.token;
  }

  store(token: string, name: string, id: number): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(ID_KEY, String(id));
    this.adminName.set(name);
    this.adminId.set(id);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(ID_KEY);
    this.adminName.set(null);
    this.adminId.set(null);
  }
}

/** Ajoute le bon JWT selon la route : admin ou client. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('/api/admin')) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  } else if (
    req.url.startsWith('/api/customers/me') ||
    (req.url.startsWith('/api/orders') && req.method === 'POST')
  ) {
    const token = localStorage.getItem('lj_customer_token');
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }
  return next(req);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLogged ? true : router.createUrlTree(['/admin/login']);
};
