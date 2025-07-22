import { Component, input, output, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MusicBrainzService } from '../../../services/musicbrainz.service';
import { LabelTreeNode, ArtistRosterEntry } from '../../../models/musicbrainz.models';

@Component({
  selector: 'app-artist-roster',
  imports: [CommonModule, FormsModule],
  templateUrl: './artist-roster.component.html',
  styleUrls: ['./artist-roster.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArtistRosterComponent implements OnInit {
  private musicBrainzService = inject(MusicBrainzService);
  private router = inject(Router);

  // Input signals
  labelNode = input.required<LabelTreeNode>();
  
  
  // State signals
  artistRoster = signal<ArtistRosterEntry[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  sortBy = signal<'name' | 'period' | 'releases'>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');
  filterType = signal<'all' | 'current' | 'former' | 'distributed'>('all');
  viewMode = signal<'grid' | 'list'>('grid');
  
  // Computed values
  filteredAndSortedRoster = computed(() => {
    let roster = this.artistRoster();
    
    // Apply filter
    if (this.filterType() !== 'all') {
      roster = roster.filter(entry => entry.relationshipType === this.filterType());
    }
    
    // Apply sorting
    const sortBy = this.sortBy();
    const direction = this.sortDirection();
    
    roster = [...roster].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.artist.name.localeCompare(b.artist.name);
          break;
        case 'period':
          const aStart = a.period.begin || '9999';
          const bStart = b.period.begin || '9999';
          comparison = aStart.localeCompare(bStart);
          break;
        case 'releases':
          comparison = a.releaseCount - b.releaseCount;
          break;
      }
      
      return direction === 'desc' ? -comparison : comparison;
    });
    
    return roster;
  });
  
  hasRoster = computed(() => this.artistRoster().length > 0);
  rosterStats = computed(() => {
    const roster = this.artistRoster();
    const total = roster.length;
    const current = roster.filter(r => r.relationshipType === 'current').length;
    const former = roster.filter(r => r.relationshipType === 'former').length;
    const totalReleases = roster.reduce((sum, r) => sum + r.releaseCount, 0);
    
    return { total, current, former, totalReleases };
  });

  ngOnInit(): void {
    this.loadArtistRoster();
  }

  private loadArtistRoster(): void {
    // If roster is already available in the node, use it
    if (this.labelNode().artistRoster && this.labelNode().artistRoster!.length > 0) {
      console.log('🔄 Using artist roster from tree node cache for', this.labelNode().label.name);
      this.artistRoster.set(this.labelNode().artistRoster!);
      return;
    }
    
    // Check if this is a recently restored component that might have stale data
    // In this case, we should still try the service call as it may have cached data
    console.log('🔄 Loading artist roster for label:', this.labelNode().label.name);
    
    // Otherwise, fetch from the service (which has its own caching)
    this.isLoading.set(true);
    this.error.set(null);
    
    this.musicBrainzService.getLabelArtists(this.labelNode().label.id).subscribe({
      next: (roster) => {
        console.log('🔄 Loaded', roster.length, 'artists for', this.labelNode().label.name);
        this.artistRoster.set(roster);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading artist roster:', error);
        this.error.set(error.message || 'Failed to load artist roster');
        this.isLoading.set(false);
      }
    });
  }


  setSortBy(field: 'name' | 'period' | 'releases'): void {
    if (this.sortBy() === field) {
      // Toggle direction if same field
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with ascending direction
      this.sortBy.set(field);
      this.sortDirection.set('asc');
    }
  }

  setFilter(type: 'all' | 'current' | 'former' | 'distributed'): void {
    this.filterType.set(type);
  }

  onViewModeChange(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
  }

  formatPeriod(entry: ArtistRosterEntry): string {
    const begin = entry.period.begin;
    const end = entry.period.end;
    
    if (begin && end) {
      return `${this.formatYear(begin)} - ${this.formatYear(end)}`;
    } else if (begin) {
      return `${this.formatYear(begin)} - present`;
    } else if (end) {
      return `Until ${this.formatYear(end)}`;
    }
    
    return 'Unknown period';
  }

  private formatYear(dateString: string): string {
    // Extract year from date string (handles formats like "1990", "1990-01", "1990-01-01")
    return dateString.split('-')[0];
  }

  getRelationshipBadgeClass(type?: string): string {
    switch (type) {
      case 'current':
        return 'badge-current';
      case 'former':
        return 'badge-former';
      case 'distributed':
        return 'badge-distributed';
      default:
        return 'badge-unknown';
    }
  }

  getArtistTypeIcon(artist: any): string {
    const type = artist.type?.toLowerCase();
    
    switch (type) {
      case 'person':
        return '👤';
      case 'group':
        return '👥';
      case 'orchestra':
        return '🎼';
      case 'choir':
        return '🎵';
      case 'character':
        return '🎭';
      default:
        return '🎤';
    }
  }

  exportRoster(): void {
    const roster = this.filteredAndSortedRoster();
    const labelName = this.labelNode().label.name;
    
    const csvData = this.convertRosterToCsv(roster, labelName);
    const dataBlob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${labelName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_artist_roster.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  private convertRosterToCsv(roster: ArtistRosterEntry[], labelName: string): string {
    let csv = 'Label,Artist Name,Artist Type,Country,Relationship Type,Period Start,Period End,Release Count\n';
    
    roster.forEach(entry => {
      const artistName = `"${entry.artist.name.replace(/"/g, '""')}"`;
      const artistType = entry.artist.type || 'Unknown';
      const country = entry.artist.country || 'Unknown';
      const relationshipType = entry.relationshipType || 'Unknown';
      const periodStart = entry.period.begin || '';
      const periodEnd = entry.period.end || '';
      const releaseCount = entry.releaseCount;
      
      csv += `"${labelName}",${artistName},"${artistType}","${country}","${relationshipType}","${periodStart}","${periodEnd}",${releaseCount}\n`;
    });
    
    return csv;
  }

  navigateToArtistDiscography(entry: ArtistRosterEntry): void {
    console.log('🔄 Artist roster clicked! Navigating to discography for artist:', entry.artist.name);
    console.log('🔄 Artist data being passed:', entry.artist);
    
    // Navigate with state
    this.router.navigate(['/'], {
      state: { 
        selectedArtist: entry.artist,
        fromArtistRoster: true 
      }
    }).then(success => {
      console.log('🔄 Navigation result:', success);
    }).catch(error => {
      console.error('🔄 Navigation error:', error);
    });
  }
}