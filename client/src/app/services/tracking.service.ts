import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService } from './api.service';

const VISITOR_KEY = 'lj_visitor_id';

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private api = inject(ApiService);
  private router = inject(Router);

  init(): void {
    this.track(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.track(e.urlAfterRedirects));
  }

  private track(path: string): void {
    if (path.startsWith('/admin')) return;
    this.api.trackVisit(path, this.visitorId()).subscribe({ error: () => {} });
  }

  private visitorId(): string {
    try {
      let id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch {
      return 'anon';
    }
  }
}
