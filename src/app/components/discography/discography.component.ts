import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiscographyData, EnhancedDiscographyData, EnhancedReleaseGroup } from '../../models/musicbrainz.models';
import { ReleaseCardComponent } from './release-card/release-card.component';
import { CollaborationNetworkComponent } from '../collaboration-network/collaboration-network.component';

@Component({
  selector: 'app-discography',
  imports: [CommonModule, FormsModule, ReleaseCardComponent, CollaborationNetworkComponent],
  templateUrl: './discography.component.html',
  styleUrl: './discography.component.scss'
})
export class DiscographyComponent implements OnChanges {
  @Input() discographyData: EnhancedDiscographyData | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

  filteredReleaseGroups: EnhancedReleaseGroup[] = [];
  searchTerm = '';
  sortBy: 'date' | 'title' | 'type' = 'date';
  sortDirection: 'asc' | 'desc' = 'asc';
  filterByType = '';
  filterByDecade = '';
  filterByGenre = '';
  viewMode: 'grid' | 'list' = 'grid';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['discographyData']) {
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

  toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.applyFiltersAndSort();
  }

  private applyFiltersAndSort() {
    if (!this.discographyData) {
      this.filteredReleaseGroups = [];
      return;
    }

    let filtered = [...this.discographyData.releaseGroups];

    // Apply search filter
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        (item.disambiguation && item.disambiguation.toLowerCase().includes(searchLower))
      );
    }

    // Apply type filter
    if (this.filterByType) {
      filtered = filtered.filter(item => item['primary-type'] === this.filterByType);
    }

    // Apply decade filter
    if (this.filterByDecade) {
      filtered = filtered.filter(item => {
        if (!item['first-release-date']) return false;
        const year = parseInt(item['first-release-date'].split('-')[0]);
        const decade = `${Math.floor(year / 10) * 10}s`;
        return decade === this.filterByDecade;
      });
    }

    // Apply genre filter
    if (this.filterByGenre) {
      filtered = filtered.filter(item => 
        item.tags && item.tags.some(tag => tag.name === this.filterByGenre)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
          const dateA = a['first-release-date'] || '';
          const dateB = b['first-release-date'] || '';
          comparison = dateA.localeCompare(dateB);
          break;
        case 'type':
          comparison = (a['primary-type'] || '').localeCompare(b['primary-type'] || '');
          break;
      }

      return this.sortDirection === 'desc' ? -comparison : comparison;
    });

    this.filteredReleaseGroups = filtered;
  }

  get availableTypes(): string[] {
    if (!this.discographyData) {
      return [];
    }
    
    const types = [...new Set(this.discographyData.releaseGroups.map(item => item['primary-type']).filter(type => type))];
    return types.sort();
  }

  get availableDecades(): string[] {
    if (!this.discographyData?.decades) {
      return [];
    }
    return this.discographyData.decades.map(d => d.decade).sort();
  }

  get availableGenres(): string[] {
    if (!this.discographyData?.genres) {
      return [];
    }
    return this.discographyData.genres.map(g => g.name).slice(0, 10); // Top 10 genres
  }

  get totalReleases(): number {
    return this.discographyData?.totalReleases || 0;
  }

  get careerSpan(): string {
    if (!this.discographyData?.careerSpan.start) {
      return '';
    }
    
    const start = this.discographyData.careerSpan.start.split('-')[0];
    const end = this.discographyData.careerSpan.end ? this.discographyData.careerSpan.end.split('-')[0] : 'present';
    
    return start === end ? start : `${start} - ${end}`;
  }

  onViewModeChange(mode: 'grid' | 'list') {
    this.viewMode = mode;
  }

  onReleaseExpand(releaseGroupId: string) {
    // Handle analytics or other tracking if needed
    console.log('Release expanded:', releaseGroupId);
  }

  onReleaseCollapse(releaseGroupId: string) {
    // Handle analytics or other tracking if needed
    console.log('Release collapsed:', releaseGroupId);
  }
}