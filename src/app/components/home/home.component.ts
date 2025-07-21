import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { MusicBrainzArtist, LabelWithReleaseCount, EnhancedDiscographyData } from '../../models/musicbrainz.models';
import { LabelGridComponent } from '../label-grid/label-grid.component';
import { DiscographyComponent } from '../discography/discography.component';

// Interface for persisting component state
interface HomeComponentState {
  selectedArtist: MusicBrainzArtist | null;
  searchTerm: string;
  labels: LabelWithReleaseCount[];
  discographyData: EnhancedDiscographyData | null;
  timestamp: number;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, ReactiveFormsModule, LabelGridComponent, DiscographyComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  private musicBrainzService = inject(MusicBrainzService);
  
  // Constants for state persistence
  private readonly STATE_STORAGE_KEY = 'homeComponent_state';
  private readonly STATE_EXPIRY_HOURS = 24; // State expires after 24 hours
  private isRestoringFromCache = false;
  
  searchControl = new FormControl('');
  
  // Signals for reactive state management
  artists = signal<MusicBrainzArtist[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedArtist = signal<MusicBrainzArtist | null>(null);
  currentSearchTerm = signal('');
  
  // Label-related signals
  labels = signal<LabelWithReleaseCount[]>([]);
  labelsLoading = signal(false);
  labelsError = signal<string | null>(null);

  // Discography-related signals
  discographyData = signal<EnhancedDiscographyData | null>(null);
  discographyLoading = signal(false);
  discographyError = signal<string | null>(null);

  // Computed values for derived state
  
  hasSelectedArtist = computed(() => this.selectedArtist() !== null);
  showSearchResults = computed(() => this.artists().length > 0 && this.currentSearchTerm().length >= 2);
  canClearSearch = computed(() => this.hasSelectedArtist() || this.currentSearchTerm().length > 0);
  
  searchState = computed(() => ({
    hasQuery: this.currentSearchTerm().length >= 2,
    hasResults: this.artists().length > 0,
    isLoading: this.loading(),
    hasError: this.error() !== null
  }));

  ngOnInit() {
    console.log('🔄 HomeComponent ngOnInit - starting component initialization');
    
    // Restore state from storage if available
    this.restoreState();
    
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => {
          if (!query || query.length < 2) {
            this.artists.set([]);
            this.error.set(null);
            this.currentSearchTerm.set('');
            return of([]);
          }
          
          this.loading.set(true);
          this.error.set(null);
          this.currentSearchTerm.set(query);
          
          return this.musicBrainzService.searchArtists(query).pipe(
            catchError(err => {
              this.error.set(err.message || 'Failed to search artists');
              this.loading.set(false);
              return of([]);
            })
          );
        })
      )
      .subscribe(artists => {
        this.artists.set(artists);
        this.loading.set(false);
      });
  }

  ngOnDestroy() {
    console.log('🔄 HomeComponent ngOnDestroy - saving state before destruction');
    // Save state when component is destroyed
    this.saveState();
  }

  selectArtist(artist: MusicBrainzArtist) {
    this.selectedArtist.set(artist);
    this.searchControl.setValue(artist.name, { emitEvent: false }); // Prevent triggering search
    this.artists.set([]);
    this.currentSearchTerm.set(''); // Clear search term to hide results
    this.loadArtistLabels(artist.id);
    this.loadArtistDiscography(artist.id);
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.selectedArtist.set(null);
    this.artists.set([]);
    this.error.set(null);
    this.labels.set([]);
    this.labelsError.set(null);
    this.discographyData.set(null);
    this.discographyError.set(null);
    this.currentSearchTerm.set('');
    // Clear persisted state when user manually clears search
    this.clearPersistedState();
  }

  highlightSearchTerm(text: string, searchTerm: string): string {
    if (!searchTerm || !text) {
      return text;
    }
    
    const regex = new RegExp(`(${this.escapeRegExp(searchTerm)})`, 'gi');
    return text.replace(regex, '<mark class="highlight">$1</mark>');
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private loadArtistLabels(artistId: string) {
    // Skip API call if we're restoring from cache
    if (this.isRestoringFromCache) {
      console.log('🔄 Skipping label loading - restoring from cache');
      return;
    }

    this.labelsLoading.set(true);
    this.labelsError.set(null);
    this.labels.set([]);

    this.musicBrainzService.getArtistLabels(artistId).subscribe({
      next: (labels) => {
        this.labels.set(labels);
        this.labelsLoading.set(false);
      },
      error: (error) => {
        this.labelsError.set(error.message || 'Failed to load labels');
        this.labelsLoading.set(false);
      }
    });
  }

  private loadArtistDiscography(artistId: string) {
    // Skip API call if we're restoring from cache
    if (this.isRestoringFromCache) {
      console.log('🔄 Skipping discography loading - restoring from cache');
      return;
    }

    this.discographyLoading.set(true);
    this.discographyError.set(null);
    this.discographyData.set(null);

    this.musicBrainzService.getEnhancedArtistDiscography(artistId).subscribe({
      next: (discography) => {
        // Update the artist information in the discography data with the selected artist
        const selectedArtist = this.selectedArtist();
        if (selectedArtist) {
          discography.artist = selectedArtist;
        }
        this.discographyData.set(discography);
        this.discographyLoading.set(false);
      },
      error: (error) => {
        this.discographyError.set(error.message || 'Failed to load discography');
        this.discographyLoading.set(false);
      }
    });
  }

  // State persistence methods
  private saveState(): void {
    try {
      const state: HomeComponentState = {
        selectedArtist: this.selectedArtist(),
        searchTerm: this.searchControl.value || '',
        labels: this.labels(),
        discographyData: this.discographyData(),
        timestamp: Date.now()
      };
      
      sessionStorage.setItem(this.STATE_STORAGE_KEY, JSON.stringify(state));
      console.log('🔄 Saved home component state:', {
        hasSelectedArtist: !!state.selectedArtist,
        searchTerm: state.searchTerm,
        labelsCount: state.labels.length,
        hasDiscography: !!state.discographyData
      });
    } catch (error) {
      console.error('Failed to save home component state:', error);
    }
  }

  private restoreState(): void {
    try {
      const savedState = sessionStorage.getItem(this.STATE_STORAGE_KEY);
      if (!savedState) {
        console.log('🔄 No saved state found');
        return;
      }

      const state: HomeComponentState = JSON.parse(savedState);
      const now = Date.now();
      const stateAge = now - state.timestamp;
      const maxAge = this.STATE_EXPIRY_HOURS * 60 * 60 * 1000;

      if (stateAge > maxAge) {
        console.log('🔄 Saved state expired, clearing storage');
        sessionStorage.removeItem(this.STATE_STORAGE_KEY);
        return;
      }

      console.log('🔄 Restoring home component state:', {
        hasSelectedArtist: !!state.selectedArtist,
        searchTerm: state.searchTerm,
        labelsCount: state.labels.length,
        hasDiscography: !!state.discographyData,
        ageMinutes: Math.round(stateAge / (1000 * 60))
      });

      // Set flag to prevent API calls during restoration
      this.isRestoringFromCache = true;

      // Restore the state
      if (state.selectedArtist) {
        this.selectedArtist.set(state.selectedArtist);
        this.searchControl.setValue(state.searchTerm, { emitEvent: false });
        this.currentSearchTerm.set(state.searchTerm);
      }

      if (state.labels && state.labels.length > 0) {
        this.labels.set(state.labels);
      }

      if (state.discographyData) {
        this.discographyData.set(state.discographyData);
      }

      // Clear the flag after restoration is complete
      setTimeout(() => {
        this.isRestoringFromCache = false;
      }, 0);

      // Keep the saved state for now - it will be overwritten on next save
      // sessionStorage.removeItem(this.STATE_STORAGE_KEY);
      
    } catch (error) {
      console.error('Failed to restore home component state:', error);
      sessionStorage.removeItem(this.STATE_STORAGE_KEY);
    }
  }

  private clearPersistedState(): void {
    sessionStorage.removeItem(this.STATE_STORAGE_KEY);
  }



  // Debug method to manually test state persistence - remove in production
  debugState() {
    console.group('🔄 Manual State Debug');
    
    console.log('Current component state:', {
      selectedArtist: this.selectedArtist()?.name || 'None',
      searchTerm: this.searchControl.value,
      labelsCount: this.labels().length,
      discographyData: !!this.discographyData()
    });
    
    // Check what's in storage
    const savedState = sessionStorage.getItem(this.STATE_STORAGE_KEY);
    console.log('SessionStorage state:', savedState ? JSON.parse(savedState) : 'None');
    
    // Test save manually
    console.log('Testing manual save...');
    this.saveState();
    
    console.groupEnd();
  }
}
