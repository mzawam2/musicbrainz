import { Component, input, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { RouterLink } from '@angular/router';
import { LabelWithReleaseCount } from '../../models/musicbrainz.models';

@Component({
  selector: 'app-label-card',
  imports: [RouterLink],
  templateUrl: './label-card.component.html',
  styleUrl: './label-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelCardComponent {
  // Input and output functions
  labelData = input.required<LabelWithReleaseCount>();
  expand = output<string>();
  collapse = output<string>();

  // State signals
  isExpanded = signal(false);

  // Computed values
  labelType = computed(() => this.labelData().label.type || 'Unknown');
  labelName = computed(() => this.labelData().label.name);
  releaseCount = computed(() => this.labelData().releaseCount);
  disambiguation = computed(() => this.labelData().label.disambiguation || '');
  
  toggleExpanded() {
    const labelData = this.labelData();
    const currentExpanded = this.isExpanded();
    
    if (currentExpanded) {
      this.isExpanded.set(false);
      this.collapse.emit(labelData.label.id);
    } else {
      this.isExpanded.set(true);
      this.expand.emit(labelData.label.id);
    }
  }
}
