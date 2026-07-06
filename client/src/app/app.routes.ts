import { Routes } from '@angular/router';
import { ShopPage } from './pages/shop.page';
import { ProductPage } from './pages/product.page';
import { CartPage } from './pages/cart.page';
import { CheckoutPage } from './pages/checkout.page';
import { ConfirmPage } from './pages/confirm.page';
import { TrackPage } from './pages/track.page';
import { AdminLoginPage } from './pages/admin-login.page';
import { AdminPage } from './pages/admin.page';
import { CustomerAuthPage } from './pages/customer-auth.page';
import { AccountPage } from './pages/account.page';
import { InfosPage } from './pages/infos.page';
import { adminGuard } from './services/auth.service';
import { customerGuard } from './services/account.service';

export const routes: Routes = [
  { path: '', component: ShopPage, title: 'Lunique Jam — Boutique | Drop 001 Genesis' },
  { path: 'produit/:slug', component: ProductPage, title: 'Lunique Jam — Pièce' },
  { path: 'panier', component: CartPage, title: 'Lunique Jam — Panier' },
  { path: 'commande', component: CheckoutPage, title: 'Lunique Jam — Commande' },
  { path: 'merci/:ref', component: ConfirmPage, title: 'Lunique Jam — Merci' },
  { path: 'suivi', component: TrackPage, title: 'Lunique Jam — Suivi de commande' },
  { path: 'infos', component: InfosPage, title: 'Lunique Jam — Infos pratiques' },
  { path: 'compte/connexion', component: CustomerAuthPage, title: 'Lunique Jam — Connexion' },
  { path: 'compte', component: AccountPage, canActivate: [customerGuard], title: 'Lunique Jam — Mon compte' },
  { path: 'admin/login', component: AdminLoginPage, title: 'Lunique Jam — Admin' },
  { path: 'admin', component: AdminPage, canActivate: [adminGuard], title: 'Lunique Jam — Tableau de bord' },
  { path: '**', redirectTo: '' },
];
