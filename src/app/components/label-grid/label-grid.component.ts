import { Component, input, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LabelWithReleaseCount } from '../../models/musicbrainz.models';
import { LabelCardComponent } from '../label-card/label-card.component';

@Component({
  selector: 'app-label-grid',
  imports: [CommonModule, LabelCardComponent, FormsModule],
  templateUrl: './label-grid.component.html',
  styleUrl: './label-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelGridComponent {
  // Input signals
  labels = input<LabelWithReleaseCount[]>([]);
  loading = input(false);
  error = input<string | null>(null);

  // Filter and sort signals
  searchTerm = signal('');
  sortBy = signal<'name' | 'releases' | 'type'>('releases');
  sortDirection = signal<'asc' | 'desc'>('desc');
  filterByType = signal('');

  // Computed filtered and sorted labels
  filteredLabels = computed(() => {
    return this.applyFiltersAndSort(this.labels());
  });

  // Computed available types
  availableTypes = computed(() => {
    const types = [...new Set(this.labels().map(item => item.label.type).filter(type => type && type !== 'Unknown'))];
    return types.sort();
  });

  onSearchChange(value: string) {
    this.searchTerm.set(value);
  }

  onSortChange(sortBy: 'name' | 'releases' | 'type') {
    this.sortBy.set(sortBy);
  }

  onFilterChange(filterType: string) {
    this.filterByType.set(filterType);
  }

  toggleSortDirection() {
    this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
  }

  private applyFiltersAndSort(labels: LabelWithReleaseCount[]): LabelWithReleaseCount[] {
    let filtered = [...labels];

    // Apply search filter
    const searchTerm = this.searchTerm();
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.label.name.toLowerCase().includes(searchLower) ||
        (item.label.disambiguation && item.label.disambiguation.toLowerCase().includes(searchLower))
      );
    }

    // Apply type filter
    const filterByType = this.filterByType();
    if (filterByType) {
      filtered = filtered.filter(item => item.label.type === filterByType);
    }

    // Apply sorting
    const sortBy = this.sortBy();
    const sortDirection = this.sortDirection();
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.label.name.localeCompare(b.label.name);
          break;
        case 'releases':
          comparison = a.releaseCount - b.releaseCount;
          break;
        case 'type':
          comparison = (a.label.type || '').localeCompare(b.label.type || '');
          break;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }
}
