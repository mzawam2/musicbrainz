import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LabelWithReleaseCount } from '../../models/musicbrainz.models';
import { LabelCardComponent } from '../label-card/label-card.component';

@Component({
  selector: 'app-label-grid',
  imports: [CommonModule, LabelCardComponent, FormsModule],
  templateUrl: './label-grid.component.html',
  styleUrl: './label-grid.component.scss'
})
export class LabelGridComponent implements OnChanges {
  @Input() labels: LabelWithReleaseCount[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;

  filteredLabels: LabelWithReleaseCount[] = [];
  searchTerm = '';
  sortBy: 'name' | 'releases' | 'type' = 'releases';
  sortDirection: 'asc' | 'desc' = 'desc';
  filterByType = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['labels']) {
      this.applyFiltersAndSort();
    }
  }

  onSearchChange() {
    this.applyFiltersAndSort();
  }

  onSortChange() {
    this.applyFiltersAndSort();
  }

  onFilterChange() {
    this.applyFiltersAndSort();
  }

  private applyFiltersAndSort() {
    let filtered = [...this.labels];

    // Apply search filter
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.label.name.toLowerCase().includes(searchLower) ||
        (item.label.disambiguation && item.label.disambiguation.toLowerCase().includes(searchLower))
      );
    }

    // Apply type filter
    if (this.filterByType) {
      filtered = filtered.filter(item => item.label.type === this.filterByType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
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

      return this.sortDirection === 'desc' ? -comparison : comparison;
    });

    this.filteredLabels = filtered;
  }

  get availableTypes(): string[] {
    const types = [...new Set(this.labels.map(item => item.label.type).filter(type => type && type !== 'Unknown'))];
    return types.sort();
  }
}
