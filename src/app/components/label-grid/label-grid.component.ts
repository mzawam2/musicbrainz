import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelWithReleaseCount } from '../../models/musicbrainz.models';
import { LabelCardComponent } from '../label-card/label-card.component';

@Component({
  selector: 'app-label-grid',
  imports: [CommonModule, LabelCardComponent],
  templateUrl: './label-grid.component.html',
  styleUrl: './label-grid.component.scss'
})
export class LabelGridComponent {
  @Input() labels: LabelWithReleaseCount[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
}
