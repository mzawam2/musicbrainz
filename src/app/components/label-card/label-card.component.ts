import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LabelWithReleaseCount } from '../../models/musicbrainz.models';

@Component({
  selector: 'app-label-card',
  imports: [CommonModule],
  templateUrl: './label-card.component.html',
  styleUrl: './label-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelCardComponent {
  private router = inject(Router);

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

  navigateToFamilyTree() {
    const labelData = this.labelData();
    
    console.log('🔄 Label card clicked! Navigating to family tree for label:', labelData.label.name);
    console.log('🔄 Label data being passed:', labelData.label);
    
    // Navigate with state
    this.router.navigate(['/label-family-trees'], {
      state: { 
        selectedLabel: labelData.label,
        fromLabelCard: true 
      }
    }).then(success => {
      console.log('🔄 Navigation result:', success);
    }).catch(error => {
      console.error('🔄 Navigation error:', error);
    });
  }
}
