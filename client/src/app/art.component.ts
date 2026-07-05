import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Visuel produit 100% CSS/SVG — silhouette + flèche signature sur fond studio. */
@Component({
  selector: 'lj-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="ljart" [class]="'ljart--' + art()">
      <svg class="ljart__garment ljart__garment--{{ garment() }}" [style.fill]="garmColor()">
        <use [attr.href]="'#g-' + garment()" />
      </svg>
      <svg class="ljart__mark ljart__mark--{{ garment() }}" [style.fill]="markColor()">
        <use href="#lj-arrow" />
      </svg>
    </figure>
  `,
})
export class ArtComponent {
  art = input.required<string>();
  garment = input.required<string>();
  garmColor = input.required<string>();
  markColor = input.required<string>();
}
