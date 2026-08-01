import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartService } from './services/cart.service';
import { AccountService } from './services/account.service';
import { TrackingService } from './services/tracking.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly cart = inject(CartService);
  protected readonly account = inject(AccountService);

  constructor() {
    inject(TrackingService).init();
  }

  protected firstName(full: string): string {
    return full.split(' ')[0] || 'Compte';
  }
}
