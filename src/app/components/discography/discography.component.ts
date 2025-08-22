import { Component, input, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DiscographyData, EnhancedDiscographyData, EnhancedReleaseGroup } from '../../models/musicbrainz.models';
import { ReleaseCardComponent } from './release-card/release-card.component';
import { CollaborationNetworkComponent } from '../collaboration-network/collaboration-network.component';

@Component({
  selector: 'app-discography',
  imports: [FormsModule, ReleaseCardComponent, CollaborationNetworkComponent],
  templateUrl: './discography.component.html',
  styleUrl: './discography.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiscographyComponent {
  // Input signals
  discographyData = input<EnhancedDiscographyData | null>(null);
  loading = input(false);
  error = input<string | null>(null);

  // Filter and sorting signals
  searchTerm = signal('');
  sortBy = signal<'date' | 'title' | 'type'>('date');
  sortDirection = signal<'asc' | 'desc'>('asc');
  filterByType = signal('');
  filterByDecade = signal('');
  filterByGenre = signal('');
  viewMode = signal<'grid' | 'list'>('grid');

  // Computed filtered and sorted release groups
  filteredReleaseGroups = computed(() => {
    const data = this.discographyData();
    if (!data) return [];
    return this.applyFiltersAndSort(data.releaseGroups);
  });

  // Computed filter options
  availableTypes = computed(() => {
    const data = this.discographyData();
    if (!data) return [];
    const types = [...new Set(data.releaseGroups.map(item => item['primary-type']).filter(type => type))];
    return types.sort();
  });

  availableDecades = computed(() => {
    const data = this.discographyData();
    if (!data?.decades) return [];
    return data.decades.map(d => d.decade).sort();
  });

  availableGenres = computed(() => {
    const data = this.discographyData();
    if (!data?.genres) return [];
    return data.genres.map(g => g.name).slice(0, 10);
  });

  // Computed stats
  totalReleases = computed(() => this.discographyData()?.totalReleases || 0);
  
  careerSpan = computed(() => {
    const data = this.discographyData();
    if (!data?.careerSpan.start) return '';
    const start = data.careerSpan.start.split('-')[0];
    const end = data.careerSpan.end ? data.careerSpan.end.split('-')[0] : 'present';
    return start === end ? start : `${start} - ${end}`;
  });


  onSearchChange(value: string) {
    this.searchTerm.set(value);
  }

  onSortChange(sortBy: 'date' | 'title' | 'type') {
    this.sortBy.set(sortBy);
  }

  onFilterChange(filterType: 'type' | 'decade' | 'genre', value: string) {
    switch (filterType) {
      case 'type':
        this.filterByType.set(value);
        break;
      case 'decade':
        this.filterByDecade.set(value);
        break;
      case 'genre':
        this.filterByGenre.set(value);
        break;
    }
  }

  toggleSortDirection() {
    this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
  }

  private applyFiltersAndSort(releaseGroups: EnhancedReleaseGroup[]): EnhancedReleaseGroup[] {
    let filtered = [...releaseGroups];

    // Apply search filter
    const searchTerm = this.searchTerm();
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        (item.disambiguation && item.disambiguation.toLowerCase().includes(searchLower))
      );
    }

    // Apply type filter
    const filterByType = this.filterByType();
    if (filterByType) {
      filtered = filtered.filter(item => item['primary-type'] === filterByType);
    }

    // Apply decade filter
    const filterByDecade = this.filterByDecade();
    if (filterByDecade) {
      filtered = filtered.filter(item => {
        if (!item['first-release-date']) return false;
        const year = parseInt(item['first-release-date'].split('-')[0]);
        const decade = `${Math.floor(year / 10) * 10}s`;
        return decade === filterByDecade;
      });
    }

    // Apply genre filter
    const filterByGenre = this.filterByGenre();
    if (filterByGenre) {
      filtered = filtered.filter(item => 
        item.tags && item.tags.some(tag => tag.name === filterByGenre)
      );
    }

    // Apply sorting
    const sortBy = this.sortBy();
    const sortDirection = this.sortDirection();
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
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

      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }


  onViewModeChange(mode: 'grid' | 'list') {
    this.viewMode.set(mode);
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