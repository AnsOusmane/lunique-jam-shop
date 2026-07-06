import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-infos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page page--narrow">
      <header class="page-head">
        <span class="label">Tout ce qu'il faut savoir</span>
        <h1 class="display">Infos pratiques</h1>
      </header>

      <section id="livraison" style="margin-bottom: 44px">
        <h2 class="display" style="font-size: 22px; margin-bottom: 14px">Livraison</h2>
        <ul style="display: grid; gap: 10px">
          <li>🛵 <strong>Dakar</strong> — 2 000 F, sous 24 à 48 h ouvrées.</li>
          <li>🚚 <strong>Régions</strong> — 3 500 F, 2 à 4 jours ouvrés partout au Sénégal.</li>
          <li>🤝 <strong>Retrait Ouakam</strong> — gratuit, sur rendez-vous après confirmation.</li>
        </ul>
        <p style="opacity: 0.65; margin-top: 12px">
          Notre livreur t'appelle toujours avant de passer. Garde ton téléphone allumé —
          et ta référence <span style="font-family: var(--font-label)">LJ-XXXXXX</span> sous la main.
        </p>
      </section>

      <section id="retours" style="margin-bottom: 44px">
        <h2 class="display" style="font-size: 22px; margin-bottom: 14px">Échanges & retours</h2>
        <p>
          Taille pas bonne ? Tu as <strong>7 jours</strong> après réception pour échanger,
          tant que la pièce n'a pas été portée ni lavée, étiquettes en place.
          Écris-nous à <a href="mailto:hello@luniquejam.com" style="text-decoration: underline">hello&#64;luniquejam.com</a>
          avec ta référence — on gère l'échange à la livraison suivante.
        </p>
        <p style="opacity: 0.65; margin-top: 10px">
          Article défectueux : échange ou remboursement intégral, frais de course à notre charge. Sans discussion.
        </p>
      </section>

      <section id="tailles" style="margin-bottom: 44px">
        <h2 class="display" style="font-size: 22px; margin-bottom: 14px">Guide des tailles</h2>
        <p style="opacity: 0.65; margin-bottom: 14px">
          Nos coupes sont pensées amples (fit streetwear). Si tu hésites entre deux tailles :
          prends la plus petite pour un fit ajusté, la plus grande pour le tombé oversize.
        </p>
        <div class="table-scroll">
          <table class="admin-table" style="max-width: 560px">
            <thead>
              <tr><th>Taille</th><th>Poitrine (cm)</th><th>Longueur tee (cm)</th><th>Équivalent</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>S</strong></td><td>96 – 102</td><td>70</td><td>≈ M classique</td></tr>
              <tr><td><strong>M</strong></td><td>103 – 110</td><td>73</td><td>≈ L classique</td></tr>
              <tr><td><strong>L</strong></td><td>111 – 118</td><td>76</td><td>≈ XL classique</td></tr>
              <tr><td><strong>XL</strong></td><td>119 – 126</td><td>79</td><td>≈ XXL classique</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="paiement">
        <h2 class="display" style="font-size: 22px; margin-bottom: 14px">Paiement</h2>
        <p>
          <strong>Wave</strong> et <strong>Orange Money</strong> : après ta commande, notre équipe
          t'envoie la demande de paiement sur ton numéro. La commande part dès validation.
          <strong>À la livraison</strong> : prépare le montant exact en espèces.
        </p>
        <p style="opacity: 0.65; margin-top: 10px">Clean fits, clean cash. Aucun frais caché.</p>
      </section>
    </main>
  `,
})
export class InfosPage {}
