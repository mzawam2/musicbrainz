import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { Router, NavigationEnd } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, catchError, takeUntil, filter } from 'rxjs/operators';
import { of, Subject, firstValueFrom } from 'rxjs';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { DiscogsService } from '../../services/discogs.service';
import { LastfmService } from '../../services/lastfm.service';
import { SpotifyService, SpotifyTrack, SpotifyPlaylist } from '../../services/spotify.service';
import { MusicBrainzArtist, LabelWithReleaseCount, EnhancedDiscographyData } from '../../models/musicbrainz.models';
import { LastFmArtistInfo, LastFmSimilarArtist } from '../../models/lastfm.models';
import { LabelGridComponent } from '../label-grid/label-grid.component';
import { DiscographyComponent } from '../discography/discography.component';
import { ArtistPhotoModalComponent } from '../artist-photo-modal/artist-photo-modal.component';
import { ArtistPhotoModalData } from '../artist-photo-modal/artist-photo-modal-data.interface';

// Interface for persisting component state
interface HomeComponentState {
  selectedArtist: MusicBrainzArtist | null;
  searchTerm: string;
  labels: LabelWithReleaseCount[];
  discographyData: EnhancedDiscographyData | null;
  artistBio: string | null;
  timestamp: number;
  // Discogs data
  discogsArtistData: any;
  discogsArtistImages: any[];
  // Last.fm data
  lastfmArtistInfo: LastFmArtistInfo | null;
}

@Component({
  selector: 'app-home',
  imports: [ReactiveFormsModule, DecimalPipe, LabelGridComponent, DiscographyComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  private musicBrainzService = inject(MusicBrainzService);
  private discogsService = inject(DiscogsService);
  private lastfmService = inject(LastfmService);
  private spotifyService = inject(SpotifyService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();
  
  @ViewChild('pageHeading', { static: false }) pageHeading!: ElementRef<HTMLHeadingElement>;
  
  // Constants for state persistence
  private readonly STATE_STORAGE_KEY = 'homeComponent_state';
  private readonly STATE_EXPIRY_HOURS = 24; // State expires after 24 hours
  private isRestoringFromCache = false;
  private pendingAutoSelectArtist: MusicBrainzArtist | null = null;
  private fromNavigationState = false;
  
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
  
  // Biography-related signals
  artistBio = signal<string | null>(null);
  isLoadingBio = signal(false);
  bioError = signal<string | null>(null);
  
  // Discogs integration signals
  discogsArtistData = signal<any>(null);
  discogsArtistImages = signal<any[]>([]);
  isLoadingDiscogsArtist = signal(false);

  // Last.fm integration signals
  lastfmArtistInfo = signal<LastFmArtistInfo | null>(null);
  isLoadingLastfmArtist = signal(false);
  lastfmError = signal<string | null>(null);
  similarArtists = signal<LastFmSimilarArtist[]>([]);

  // Similar artists playlist builder (inline)
  similarLimit = signal<number>(20);
  similarTracksPerArtist = signal<number>(2);
  isCreatingSimilarPlaylist = signal<boolean>(false);
  similarStatus = signal<string | null>(null);
  
  /**
   * Select a similar artist in-place (no route change) using MBID
   */
  navigateToSimilarArtist(sim: LastFmSimilarArtist): void {
    if (!sim?.mbid) return;
    const artist: MusicBrainzArtist = { id: sim.mbid, name: sim.name, 'sort-name': sim.name } as MusicBrainzArtist;
    this.selectArtist(artist);
  }

  // Computed signals for Discogs data
  primaryArtistImage = computed(() => {
    const images = this.discogsArtistImages();
    return images.find(img => img.type === 'primary') || images[0] || null;
  });
  
  hasPrimaryArtistImage = computed(() => {
    const images = this.discogsArtistImages();
    return images.length > 0 && images.some(img => img.type === 'primary');
  });
  
  hasAnyArtistImage = computed(() => {
    return this.discogsArtistImages().length > 0;
  });
  enhancedDiscography = computed(() => {
    if (this.discographyData() !== null && this.labels().length > 0) {
      const discographyData: EnhancedDiscographyData = this.discographyData()!;
      const labels: LabelWithReleaseCount[] = this.labels();
      
      const enhancedReleaseGroups = discographyData.releaseGroups.map(releaseGroup => {
        if (releaseGroup.title) {
          const releaseLabels = labels.find(label => label.releases?.some(r => r.title === releaseGroup.title));
          return {
            ...releaseGroup,
            labels: releaseLabels ? [releaseLabels] : []
          };
        }
        return releaseGroup;
      });

      return {
        ...discographyData,
        releaseGroups: enhancedReleaseGroups
      };
    }
    return null;
  });

  // Computed values for derived state
  
  hasSelectedArtist = computed(() => this.selectedArtist() !== null);
  showSearchResults = computed(() => this.artists().length > 0 && this.currentSearchTerm().length >= 2 && !this.fromNavigationState);
  canClearSearch = computed(() => this.hasSelectedArtist() || this.currentSearchTerm().length > 0);
  

  searchState = computed(() => ({
    hasQuery: this.currentSearchTerm().length >= 2,
    hasResults: this.artists().length > 0,
    isLoading: this.loading(),
    hasError: this.error() !== null
  }));

  ngOnInit() {
    console.log('🔄 HomeComponent ngOnInit - starting component initialization');
    
    // Focus the main heading for accessibility when navigating to this page
    setTimeout(() => {
      if (this.pageHeading?.nativeElement) {
        this.pageHeading.nativeElement.focus();
      }
    }, 100);
    
    // Check for navigation state first (artist from roster)
    this.checkNavigationState();
    
    // If no navigation state, restore from cache
    if (!this.pendingAutoSelectArtist) {
      console.log('🔄 No navigation state, attempting to restore from cache');
      this.restoreState();
    }
    
    // Listen for navigation events to capture state
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Check for navigation state after navigation completes
        this.checkNavigationState();
      });
    
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap(query => {
          console.log('🔄 Search subscription triggered with query:', query, 'pendingAutoSelectArtist:', !!this.pendingAutoSelectArtist);
          if (!query || query.length < 2) {
            console.log('🔄 Query too short, clearing results');
            this.artists.set([]);
            this.error.set(null);
            this.currentSearchTerm.set('');
            return of([]);
          }
          
          console.log('🔄 Executing search for:', query);
          this.loading.set(true);
          this.error.set(null);
          this.currentSearchTerm.set(query);
          // Only reset navigation state flag if we don't have a pending auto-select artist
          // (which indicates this search came from user typing, not navigation)
          if (!this.pendingAutoSelectArtist) {
            console.log('🔄 Resetting fromNavigationState flag');
            this.fromNavigationState = false;
          } else {
            console.log('🔄 Keeping fromNavigationState flag due to pending auto-select');
          }
          
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
        console.log('🔄 Search completed, found', artists.length, 'artists');
        this.artists.set(artists);
        this.loading.set(false);
        
        // Check if we need to auto-select an artist from navigation
        if (this.pendingAutoSelectArtist) {
          console.log('🔄 Have pending auto-select artist:', this.pendingAutoSelectArtist.name);
          const matchingArtist = artists.find(artist => artist.id === this.pendingAutoSelectArtist!.id);
          if (matchingArtist) {
            console.log('🔄 Auto-selecting artist from navigation:', matchingArtist.name);
            // Small delay to let the search results render first
            setTimeout(() => {
              this.selectArtist(matchingArtist);
              this.pendingAutoSelectArtist = null;
            }, 100);
          } else {
            console.log('🔄 Artist not found in search results, selecting directly');
            // If the exact artist isn't in search results, select it directly
            this.selectArtist(this.pendingAutoSelectArtist);
            this.pendingAutoSelectArtist = null;
          }
        } else {
          console.log('🔄 No pending auto-select artist');
        }
      });
  }

  /**
   * Navigate to Similar Artists builder with current artist as seed
   */
  navigateToSimilarArtists(): void {
    const artist = this.selectedArtist();
    if (!artist) return;
    const seed = artist.name;
    const similarCount = Math.min(10, this.lastfmArtistInfo()?.similar?.artist?.length || 10);
    this.router.navigate(['/similar-artists'], {
      queryParams: { seed, count: similarCount, tracks: 2 }
    });
  }

  /**
   * Create a Spotify playlist using Last.fm similar artists' top tracks (inline, no navigation)
   */
  async createSimilarArtistsPlaylist(): Promise<void> {
    const artist = this.selectedArtist();
    const lastfm = this.lastfmArtistInfo();
    const baseList = this.similarArtists().length > 0
      ? this.similarArtists()
      : (lastfm?.similar?.artist || []);
    if (!artist || baseList.length === 0) {
      this.similarStatus.set('Similar artists not available yet.');
      return;
    }
    if (!this.spotifyService.isAuthenticated()) {
      this.similarStatus.set('Please sign in to Spotify to create playlists.');
      this.spotifyService.initiateAuth();
      return;
    }

    const seed = artist.name;
    const selected = baseList.slice(0, this.similarLimit());
    const tracksPer = Math.max(1, Math.min(10, this.similarTracksPerArtist()));

    this.isCreatingSimilarPlaylist.set(true);
    this.similarStatus.set('Fetching top tracks from Last.fm…');

    try {
      // Collect Last.fm top tracks
      const wanted: Array<{ artist: string; title: string }> = [];
      for (const a of selected) {
        const top = await firstValueFrom(this.lastfmService.getTopTracks(a.name, tracksPer));
        for (const t of top || []) {
          if (t?.name) wanted.push({ artist: a.name, title: t.name });
        }
      }

      if (wanted.length === 0) {
        this.similarStatus.set('No top tracks found for similar artists.');
        return;
      }

      // Resolve Spotify URIs
      this.similarStatus.set(`Searching ${wanted.length} tracks on Spotify…`);
      const uris: string[] = [];
      for (const w of wanted) {
        const query = `track:"${w.title}" artist:"${w.artist}"`;
        const results: SpotifyTrack[] = await firstValueFrom(this.spotifyService.searchTracks(query, 1));
        if (results && results[0]?.uri) uris.push(results[0].uri);
      }

      if (uris.length === 0) {
        this.similarStatus.set('Could not match any tracks on Spotify.');
        return;
      }

      // Create playlist
      const name = `Similar to ${seed} — Top Tracks`;
      const desc = `Top ${tracksPer} tracks from artists similar to ${seed} (Last.fm)`;
      const playlist: SpotifyPlaylist | null = await firstValueFrom(this.spotifyService.createPlaylist(name, desc, true));
      if (!playlist) {
        this.similarStatus.set('Failed to create playlist.');
        return;
      }

      // Add tracks in batches of 100
      this.similarStatus.set(`Adding ${uris.length} tracks to playlist…`);
      const batchSize = 100;
      for (let i = 0; i < uris.length; i += batchSize) {
        const batch = uris.slice(i, i + batchSize);
        await firstValueFrom(this.spotifyService.addTracksToPlaylist(playlist.id, batch));
      }

      this.similarStatus.set(`Playlist created: ${playlist.name}`);
    } catch (e) {
      console.error('Similar playlist creation failed:', e);
      this.similarStatus.set('Unexpected error while creating playlist.');
    } finally {
      this.isCreatingSimilarPlaylist.set(false);
    }
  }

  // Template helpers
  setSimilarLimit(ev: Event): void {
    const v = parseInt((ev.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.similarLimit.set(v);
  }
  setSimilarTracks(ev: Event): void {
    const v = parseInt((ev.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) this.similarTracksPerArtist.set(v);
  }
  isSpotifyAuthenticated(): boolean {
    return this.spotifyService.isAuthenticated();
  }
  signInSpotify(): void {
    this.spotifyService.initiateAuth();
  }

  ngOnDestroy() {
    console.log('🔄 HomeComponent ngOnDestroy - saving state before destruction');
    // Save state when component is destroyed
    this.saveState();
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectArtist(artist: MusicBrainzArtist) {
    console.log('🔄 selectArtist called with:', artist.name, 'isRestoringFromCache:', this.isRestoringFromCache);
    this.selectedArtist.set(artist);
    this.searchControl.setValue(artist.name, { emitEvent: false }); // Prevent triggering search
    this.artists.set([]);
    this.currentSearchTerm.set(''); // Clear search term to hide results
    this.fromNavigationState = false; // Reset navigation flag when artist is selected
    console.log('🔄 About to load labels and discography for:', artist.id);
    this.loadArtistLabels(artist.id);
    this.loadArtistDiscography(artist.id);
    this.loadArtistBio(artist.name);
    this.searchDiscogsArtist(artist.name);
    this.loadLastfmArtistInfo(artist.id);
    this.similarArtists.set([]);
    this.loadLastfmSimilarArtists(artist.name);
    
    // Keep focus on the main heading after auto-selection from navigation
    setTimeout(() => {
      if (this.pageHeading?.nativeElement) {
        this.pageHeading.nativeElement.focus();
      }
    }, 150);
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
    this.artistBio.set(null);
    this.bioError.set(null);
    // Clear Discogs data
    this.discogsArtistData.set(null);
    this.discogsArtistImages.set([]);
    // Clear Last.fm data
    this.lastfmArtistInfo.set(null);
    this.lastfmError.set(null);
    this.currentSearchTerm.set('');
    this.fromNavigationState = false;
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
    console.log('🔄 loadArtistLabels called for artistId:', artistId, 'isRestoringFromCache:', this.isRestoringFromCache);
    // Skip API call if we're restoring from cache
    if (this.isRestoringFromCache) {
      console.log('🔄 Skipping label loading - restoring from cache');
      return;
    }

    console.log('🔄 Making API call for artist labels');
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
    console.log('🔄 loadArtistDiscography called for artistId:', artistId, 'isRestoringFromCache:', this.isRestoringFromCache);
    // Skip API call if we're restoring from cache
    if (this.isRestoringFromCache) {
      console.log('🔄 Skipping discography loading - restoring from cache');
      return;
    }

    console.log('🔄 Making API call for artist discography');
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

  private loadArtistBio(artistName: string) {
    // Simple Wikipedia API call to get artist summary
    this.isLoadingBio.set(true);
    this.bioError.set(null);
    this.artistBio.set(null);

    // Try with different search terms with common suffixes
    const searchTerms = [
      `${artistName} (band)`,
      `${artistName} (musician)`,
      `${artistName} (singer)`,
      `${artistName} (artist)`,
      artistName
    ];

    this.tryWikipediaSearch(searchTerms, 0);
  }

  private loadLastfmSimilarArtists(artistName: string): void {
    this.lastfmService.getSimilarArtists(artistName, 20).pipe(takeUntil(this.destroy$)).subscribe({
      next: (artists: LastFmSimilarArtist[]) => {
        this.similarArtists.set(artists || []);
      },
      error: () => {
        // Non-fatal; keep empty and rely on fallback from artist info
        this.similarArtists.set([]);
      }
    });
  }

  private tryWikipediaSearch(searchTerms: string[], index: number) {
    if (index >= searchTerms.length) {
      this.bioError.set('Biography not available');
      this.isLoadingBio.set(false);
      return;
    }

    // Use the Wikipedia API to get the full intro section
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(searchTerms[index])}&prop=extracts&exintro=1&explaintext=1&origin=*`;
    
    fetch(searchUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Biography not found');
        }
        return response.json();
      })
      .then(data => {
        if (data.query && data.query.pages) {
          const pages = data.query.pages;
          const pageId = Object.keys(pages)[0];
          const page = pages[pageId];
          
          if (page.extract && page.extract.trim() && !page.missing) {
            // Found a valid biography
            let extract = page.extract;
            // Keep more content since we're getting the full intro
            if (extract.length > 1000) {
              extract = extract.substring(0, 1000) + '...';
            }
            this.artistBio.set(extract);
            this.isLoadingBio.set(false);
          } else {
            // Try next search term
            this.tryWikipediaSearch(searchTerms, index + 1);
          }
        } else {
          // Try next search term
          this.tryWikipediaSearch(searchTerms, index + 1);
        }
      })
      .catch(error => {
        // Try next search term on error
        this.tryWikipediaSearch(searchTerms, index + 1);
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
        artistBio: this.artistBio(),
        timestamp: Date.now(),
        // Discogs data
        discogsArtistData: this.discogsArtistData(),
        discogsArtistImages: this.discogsArtistImages(),
        // Last.fm data
        lastfmArtistInfo: this.lastfmArtistInfo()
      };
      
      sessionStorage.setItem(this.STATE_STORAGE_KEY, JSON.stringify(state));
      console.log('🔄 Saved home component state:', {
        hasSelectedArtist: !!state.selectedArtist,
        searchTerm: state.searchTerm,
        labelsCount: state.labels.length,
        hasDiscography: !!state.discographyData,
        hasDiscogsData: !!state.discogsArtistData,
        hasDiscogsImages: !!state.discogsArtistImages?.length
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

      if (state.artistBio) {
        this.artistBio.set(state.artistBio);
      }

      // Restore Discogs data
      if (state.discogsArtistData) {
        this.discogsArtistData.set(state.discogsArtistData);
      }
      
      if (state.discogsArtistImages) {
        this.discogsArtistImages.set(state.discogsArtistImages);
      }

      // Restore Last.fm data
      if (state.lastfmArtistInfo) {
        this.lastfmArtistInfo.set(state.lastfmArtistInfo);
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



  private checkNavigationState(): void {
    // Try multiple ways to get navigation state
    const navigation = this.router.getCurrentNavigation();
    const navigationState = navigation?.extras?.state;
    const historyState = window.history.state;
    
    console.log('🔄 Checking navigation state:', { 
      hasNavigation: !!navigation, 
      hasNavigationState: !!navigationState,
      navigationState: navigationState,
      historyState: historyState
    });
    
    // Check navigation state first
    if (navigationState?.['selectedArtist'] && navigationState?.['fromArtistRoster']) {
      console.log('🔄 Found navigation state with artist:', navigationState['selectedArtist'].name);
      this.initializeWithArtist(navigationState['selectedArtist']);
      return;
    }
    
    // Fallback to history state
    if (historyState?.selectedArtist && historyState?.fromArtistRoster) {
      console.log('🔄 Found history state with artist:', historyState.selectedArtist.name);
      this.initializeWithArtist(historyState.selectedArtist);
      return;
    }
    
    console.log('🔄 No valid navigation state found');
  }

  private initializeWithArtist(artist: MusicBrainzArtist): void {
    console.log('🔄 Initializing with artist from navigation:', artist.name, 'isRestoringFromCache:', this.isRestoringFromCache);
    
    // Set flag to indicate this came from navigation state BEFORE anything else
    this.fromNavigationState = true;
    
    // Set the pending artist first
    this.pendingAutoSelectArtist = artist;
    
    // Clear error states
    this.error.set(null);
    
    // Populate search box and trigger search using the form control
    console.log('🔄 Triggering search for artist:', artist.name);
    // Small delay to ensure the search subscription is fully set up
    setTimeout(() => {
      console.log('🔄 Actually setting search value for:', artist.name);
      this.searchControl.setValue(artist.name, { emitEvent: true });
    }, 0);
  }

  /**
   * Search for artist on Discogs and get artist details including images
   */
  private searchDiscogsArtist(artistName: string): void {
    console.log(`🎵 Searching Discogs for artist: ${artistName}`);
    this.isLoadingDiscogsArtist.set(true);
    this.discogsArtistData.set(null);
    this.discogsArtistImages.set([]);

    // Search for the artist on Discogs
    this.discogsService.searchDatabase({
      q: artistName,
      type: 'artist',
      per_page: 10
    }).subscribe({
      next: (searchResult) => {
        console.log(`🎵 Found ${searchResult.results.length} Discogs artists for: "${artistName}"`);
        console.log(`🎵 All results:`, searchResult.results.map(r => `"${r.title}" (ID: ${r.id})`));
        
        if (searchResult.results.length > 0) {
          // Look for exact title match first, then fall back to first result
          let selectedResult = searchResult.results.find(result => {
            const titleMatch = result.title.toLowerCase().trim() === artistName.toLowerCase().trim();
            console.log(`🎵 Comparing "${result.title.toLowerCase().trim()}" === "${artistName.toLowerCase().trim()}" = ${titleMatch}`);
            return titleMatch;
          });
          
          if (!selectedResult) {
            // If no exact match, use first result
            selectedResult = searchResult.results[0];
            console.log(`🎵 No exact match found, using first result: "${selectedResult.title}"`);
          } else {
            console.log(`🎵 Found exact match: "${selectedResult.title}"`);
          }
          
          console.log(`🎵 Using Discogs artist: ${selectedResult.title} (ID: ${selectedResult.id}) - ${
            selectedResult.title.toLowerCase().trim() === artistName.toLowerCase().trim() ? 'EXACT MATCH' : 'FALLBACK MATCH'
          }`);
          
          // Get detailed artist information
          this.discogsService.getArtist(selectedResult.id).subscribe({
            next: (artistDetails) => {
              if (artistDetails) {
                console.log(`🎵 Got Discogs artist details:`, artistDetails);
                this.discogsArtistData.set(artistDetails);
                
                // Extract images if available
                if (artistDetails.images && artistDetails.images.length > 0) {
                  this.discogsArtistImages.set(artistDetails.images);
                  console.log(`🎵 Found ${artistDetails.images.length} images for artist`);
                } else {
                  console.log(`🎵 No images found for artist: ${artistName}`);
                  this.discogsArtistImages.set([]);
                }
              }
              this.isLoadingDiscogsArtist.set(false);
            },
            error: (error) => {
              console.error(`🎵 Error getting Discogs artist details:`, error);
              this.isLoadingDiscogsArtist.set(false);
            }
          });
        } else {
          console.log(`🎵 No Discogs artists found for: ${artistName}`);
          this.isLoadingDiscogsArtist.set(false);
        }
      },
      error: (error) => {
        console.error(`🎵 Error searching Discogs for artist:`, error);
        this.isLoadingDiscogsArtist.set(false);
      }
    });
  }

  /**
   * Load Last.fm artist information using MusicBrainz ID
   */
  private loadLastfmArtistInfo(musicBrainzId: string): void {
    console.log('🎵 Loading Last.fm artist info for MBID:', musicBrainzId);
    this.isLoadingLastfmArtist.set(true);
    this.lastfmError.set(null);

    this.lastfmService.getArtistInfo(musicBrainzId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (artistInfo) => {
          console.log('🎵 Last.fm artist info loaded successfully:', artistInfo);
          this.lastfmArtistInfo.set(artistInfo);
          this.isLoadingLastfmArtist.set(false);
        },
        error: (error) => {
          console.error('🎵 Error loading Last.fm artist info:', error);
          this.lastfmError.set(error.message || 'Failed to load Last.fm artist information');
          this.isLoadingLastfmArtist.set(false);
        }
      });
  }

  /**
   * Open image in full size in a modal
   */
  openImageFullSize(imageUri: string): void {
    const modalData: ArtistPhotoModalData = {
      imageUri: imageUri,
      artistName: this.selectedArtist()?.name,
      altText: `Photo of ${this.selectedArtist()?.name || 'artist'}`
    };

    this.dialog.open(ArtistPhotoModalComponent, {
      data: modalData,
      panelClass: 'artist-photo-modal',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      disableClose: false
    });
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
