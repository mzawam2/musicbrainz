import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelWithReleaseCount } from '../../models/musicbrainz.models';

@Component({
  selector: 'app-label-card',
  imports: [CommonModule],
  templateUrl: './label-card.component.html',
  styleUrl: './label-card.component.scss'
})
export class LabelCardComponent {
  @Input() labelData!: LabelWithReleaseCount;
}
