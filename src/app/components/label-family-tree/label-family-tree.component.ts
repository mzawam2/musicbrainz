import { Component, inject, signal, computed, effect, ElementRef, ViewChild, OnDestroy, OnInit } from '@angular/core';

import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, takeUntil, filter, firstValueFrom } from 'rxjs';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { SpotifyService, PlaylistCreationRequest, SpotifyPlaylist } from '../../services/spotify.service';
import { TreeNodeComponent } from './tree-node/tree-node.component';
import { 
  MusicBrainzLabel, 
  LabelFamilyTree, 
 
  LabelTreeNode 
} from '../../models/musicbrainz.models';

interface LabelFamilyTreeComponentState {
  selectedLabel: MusicBrainzLabel | null;
  searchTerm: string;
  familyTree: LabelFamilyTree | null;
  timestamp: number;
}

@Component({
  selector: 'app-label-family-tree',
  imports: [ReactiveFormsModule, TreeNodeComponent],
  templateUrl: './label-family-tree.component.html',
  styleUrls: ['./label-family-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelFamilyTreeComponent implements OnInit, OnDestroy {
  private musicBrainzService = inject(MusicBrainzService);
  private spotifyService = inject(SpotifyService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // State persistence constants
  private readonly STATE_STORAGE_KEY = 'labelFamilyTreeComponent_state';
  private readonly STATE_EXPIRY_HOURS = 24;
  private isRestoringFromCache = false;
  private pendingAutoSelectLabel: MusicBrainzLabel | null = null;

  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;

  // Form control for search with debouncing
  searchControl = new FormControl('');

  // Signals for state management
  searchResults = signal<MusicBrainzLabel[]>([]);
  selectedLabel = signal<MusicBrainzLabel | null>(null);
  familyTree = signal<LabelFamilyTree | null>(null);
  isSearching = signal(false);
  isLoadingTree = signal(false);
  error = signal<string | null>(null);
  isActivelySearching = signal(false);
  
  // Spotify integration signals
  showSpotifyCreator = signal(false);
  isCreatingPlaylist = signal(false);
  createdPlaylist = signal<SpotifyPlaylist | null>(null);
  tracksPerAlbum = signal(5); // Default number of tracks per album
  useAllTracks = signal(false); // Whether to use all tracks from each album
  albumSortOrder = signal<'none' | 'year-asc' | 'year-desc'>('none'); // Album sorting preference
  startYear = signal<number | null>(null); // Year range filter start
  endYear = signal<number | null>(null); // Year range filter end
  enableYearFilter = signal(false); // Whether year filtering is enabled
  
  // Cache for all releases from the family tree
  allReleases = signal<any[]>([]);



  hasResults = computed(() => this.searchResults().length > 0);
  hasTree = computed(() => this.familyTree() !== null);
  
  // Computed property for better UI feedback
  trackModeDescription = computed(() => {
    if (this.useAllTracks()) {
      return 'All tracks from each album will be included';
    }
    const count = this.tracksPerAlbum();
    return `${count} track${count === 1 ? '' : 's'} from each album will be included`;
  });

  // Computed property for sort mode description
  sortModeDescription = computed(() => {
    const sortOrder = this.albumSortOrder();
    switch (sortOrder) {
      case 'year-asc':
        return 'Albums sorted by release year (oldest first)';
      case 'year-desc':
        return 'Albums sorted by release year (newest first)';
      case 'none':
      default:
        return 'Albums in original order';
    }
  });

  // Computed property for year filter description
  yearFilterDescription = computed(() => {
    if (!this.enableYearFilter()) {
      return 'All years included';
    }
    const start = this.startYear();
    const end = this.endYear();
    if (start && end) {
      return `Albums from ${start} to ${end}`;
    } else if (start) {
      return `Albums from ${start} onwards`;
    } else if (end) {
      return `Albums up to ${end}`;
    }
    return 'Year filter enabled but no range set';
  });

  constructor() {
    // Set up debounced search using FormControl
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        this.isActivelySearching.set(true);
        this.performSearch(query || '');
      });

    // Visual loading indicators replace form control disable/enable to prevent focus loss

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
  }

  ngOnInit() {
    console.log('🔄 LabelFamilyTreeComponent ngOnInit - starting initialization');
    
    // Try to check navigation state immediately
    this.checkNavigationState();
    
    // If no navigation state was found, restore from cache
    if (!this.pendingAutoSelectLabel) {
      console.log('🔄 No navigation state, attempting to restore from cache');
      this.restoreState();
    }
  }

  ngOnDestroy(): void {
    console.log('🔄 LabelFamilyTreeComponent ngOnDestroy - saving state before destruction');
    this.saveState();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private performSearch(query: string): void {
    if (!query) {
      this.searchResults.set([]);
      this.isActivelySearching.set(false);
      return;
    }

    this.isSearching.set(true);
    this.error.set(null);

    this.musicBrainzService.searchLabels(query, 20).subscribe({
      next: (labels) => {
        this.searchResults.set(labels);
        this.isSearching.set(false);
        
        // Check if we need to auto-select a label from navigation
        if (this.pendingAutoSelectLabel) {
          const matchingLabel = labels.find(label => label.id === this.pendingAutoSelectLabel!.id);
          if (matchingLabel) {
            console.log('🔄 Auto-selecting label from navigation:', matchingLabel.name);
            // Small delay to let the search results render first
            setTimeout(() => {
              this.selectLabel(matchingLabel);
              this.pendingAutoSelectLabel = null;
            }, 100);
          } else {
            console.log('🔄 Label not found in search results, selecting directly');
            // If the exact label isn't in search results, select it directly
            this.selectLabel(this.pendingAutoSelectLabel);
            this.pendingAutoSelectLabel = null;
          }
        }
      },
      error: (error) => {
        console.error('Search error:', error);
        this.error.set(error.message || 'Search failed');
        this.isSearching.set(false);
        this.searchResults.set([]);
        
        // If search fails but we have a pending label, select it directly
        if (this.pendingAutoSelectLabel) {
          console.log('🔄 Search failed, selecting label directly');
          this.selectLabel(this.pendingAutoSelectLabel);
          this.pendingAutoSelectLabel = null;
        }
      }
    });
  }

  selectLabel(label: MusicBrainzLabel): void {
    this.selectedLabel.set(label);
    this.searchResults.set([]);
    this.isActivelySearching.set(false);
    this.searchControl.setValue(label.name, { emitEvent: false }); // Don't trigger search
    this.loadFamilyTree(label.id);
    
    // Restore focus to search input after DOM updates
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 0);
  }

  private loadFamilyTree(labelId: string): void {
    this.isLoadingTree.set(true);
    this.error.set(null);

    this.musicBrainzService.buildLabelFamilyTree(labelId, 3).subscribe({
      next: (tree) => {
        this.familyTree.set(tree);
        
        // Load artist roster data for all labels in the tree, then extract releases
        this.loadArtistRosterForAllLabels(tree).then(() => {
          this.extractAllReleasesFromTree(tree);
          this.isLoadingTree.set(false);
        }).catch((error) => {
          console.error('Error loading artist rosters:', error);
          // Still set the tree even if artist loading fails
          this.extractAllReleasesFromTree(tree);
          this.isLoadingTree.set(false);
        });
      },
      error: (error) => {
        console.error('Tree loading error:', error);
        this.error.set(error.message || 'Failed to load family tree');
        this.isLoadingTree.set(false);
      }
    });
  }

  private async loadArtistRosterForAllLabels(tree: LabelFamilyTree): Promise<void> {
    console.log('Loading artist rosters for all labels in the tree');
    
    // Collect all labels from the tree
    const allLabels: string[] = [];
    const collectLabels = (node: LabelTreeNode) => {
      allLabels.push(node.label.id);
      node.children.forEach(child => collectLabels(child));
    };
    collectLabels(tree.tree);
    
    console.log(`Loading artist rosters for ${allLabels.length} labels`);
    
    // Load artist roster for each label and populate the tree nodes
    const loadPromises = allLabels.map(labelId => {
      return firstValueFrom(this.musicBrainzService.getLabelArtists(labelId))
        .then(artistRoster => {
          // Find the corresponding tree node and set the artist roster
          this.setArtistRosterForNode(tree.tree, labelId, artistRoster);
        })
        .catch(error => {
          console.warn(`Failed to load artist roster for label ${labelId}:`, error);
          // Don't throw, just continue with other labels
        });
    });
    
    await Promise.all(loadPromises);
    console.log('Finished loading artist rosters for all labels');
  }

  private setArtistRosterForNode(node: LabelTreeNode, labelId: string, artistRoster: any[]): void {
    if (node.label.id === labelId) {
      node.artistRoster = artistRoster;
      console.log(`Set artist roster for ${node.label.name}: ${artistRoster.length} artists`);
      return;
    }
    
    // Recursively search child nodes
    for (const child of node.children) {
      this.setArtistRosterForNode(child, labelId, artistRoster);
    }
  }

  private extractAllReleasesFromTree(tree: LabelFamilyTree): void {
    console.log('Extracting releases from family tree:', tree);
    
    const allArtistReleases: Array<{
      artistName: string, 
      releaseIds: string[], 
      releaseDetails?: Array<{id: string, title: string, date?: string, primaryType?: string}>,
      labelName: string
    }> = [];
    
    // Recursive function to extract artist-release mappings from all nodes in the tree
    const extractFromNode = (node: LabelTreeNode, depth = 0) => {
      const indent = '  '.repeat(depth);
      console.log(`${indent}Processing node: ${node.label.name}`);
      console.log(`${indent}Has artist roster:`, !!node.artistRoster);
      console.log(`${indent}Artist roster length:`, node.artistRoster?.length || 0);
      
      // Extract artist roster if available
      if (node.artistRoster) {
        console.log(`${indent}Found artist roster with ${node.artistRoster.length} artists`);
        
        for (const artistEntry of node.artistRoster) {
          console.log(`${indent}  Artist: ${artistEntry.artist.name}`);
          console.log(`${indent}  Has releases:`, !!artistEntry.releases);
          console.log(`${indent}  Release count:`, artistEntry.releaseCount);
          console.log(`${indent}  Releases array:`, artistEntry.releases);
          
          if (artistEntry.releases && artistEntry.releases.length > 0) {
            console.log(`${indent}  Adding all ${artistEntry.releases.length} releases for ${artistEntry.artist.name}`);
            allArtistReleases.push({
              artistName: artistEntry.artist.name,
              releaseIds: artistEntry.releases, // Process all releases per artist
              releaseDetails: artistEntry.releaseDetails, // Include all cached release details
              labelName: node.label.name
            });
          } else {
            console.log(`${indent}  No releases found for ${artistEntry.artist.name}`);
          }
        }
      } else {
        console.log(`${indent}No artist roster found`);
      }
      
      // Recursively process child nodes
      console.log(`${indent}Processing ${node.children.length} child nodes`);
      for (const child of node.children) {
        extractFromNode(child, depth + 1);
      }
    };
    
    // Start extraction from the root tree node
    extractFromNode(tree.tree);
    
    console.log(`Found ${allArtistReleases.length} artists with releases in family tree`);
    console.log('All artist releases:', allArtistReleases);
    
    // Store the artist-release mappings for later use
    this.allReleases.set(allArtistReleases);
  }


  selectNode(node: LabelTreeNode): void {
    // Node selection is now handled within tree-node component
  }

  clearSearch(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.searchResults.set([]);
    this.selectedLabel.set(null);
    this.familyTree.set(null);
    this.isActivelySearching.set(false);
    this.error.set(null);
    // Clear persisted state when user manually clears search
    this.clearPersistedState();
  }


  exportTree(format: 'json' | 'csv'): void {
    const tree = this.familyTree();
    if (!tree) return;

    if (format === 'json') {
      this.exportAsJson(tree);
    } else {
      this.exportAsCsv(tree);
    }
  }

  private exportAsJson(tree: LabelFamilyTree): void {
    const dataStr = JSON.stringify(tree, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-family-tree-${tree.rootLabel.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(tree: LabelFamilyTree): void {
    const csvData = this.convertTreeToCsv(tree.tree);
    const dataBlob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-family-tree-${tree.rootLabel.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  private convertTreeToCsv(node: LabelTreeNode, parentName: string = ''): string {
    let csv = 'Label Name,Type,Country,Relationship Type,Parent Label,Depth,Artist Count\n';
    
    const addNodeToCsv = (n: LabelTreeNode, parent: string) => {
      const artistCount = n.artistRoster?.length || 0;
      const relationshipType = n.relationship?.type || 'root';
      
      csv += `"${n.label.name}","${n.label.type}","${n.label.country}","${relationshipType}","${parent}",${n.depth},${artistCount}\n`;
      
      n.children.forEach(child => addNodeToCsv(child, n.label.name));
    };
    
    addNodeToCsv(node, parentName);
    return csv;
  }

  private saveState(): void {
    try {
      const state: LabelFamilyTreeComponentState = {
        selectedLabel: this.selectedLabel(),
        searchTerm: this.searchControl.value || '',
        familyTree: this.familyTree(),
        timestamp: Date.now()
      };

      sessionStorage.setItem(this.STATE_STORAGE_KEY, JSON.stringify(state));
      console.log('🔄 Saved label family tree component state:', {
        hasSelectedLabel: !!state.selectedLabel,
        searchTerm: state.searchTerm,
        hasFamilyTree: !!state.familyTree
      });
    } catch (error) {
      console.error('Failed to save label family tree component state:', error);
    }
  }

  private restoreState(): void {
    try {
      const savedState = sessionStorage.getItem(this.STATE_STORAGE_KEY);
      if (!savedState) {
        console.log('🔄 No saved state found');
        // Ensure clean state for fresh component load
        this.isSearching.set(false);
        this.isActivelySearching.set(false);
        this.searchResults.set([]);
        return;
      }

      const state: LabelFamilyTreeComponentState = JSON.parse(savedState);
      const now = Date.now();
      const stateAge = now - state.timestamp;
      const maxAge = this.STATE_EXPIRY_HOURS * 60 * 60 * 1000;

      if (stateAge > maxAge) {
        console.log('🔄 Saved state expired, clearing storage');
        sessionStorage.removeItem(this.STATE_STORAGE_KEY);
        // Ensure clean state when cache expires
        this.isSearching.set(false);
        this.isActivelySearching.set(false);
        this.searchResults.set([]);
        return;
      }

      console.log('🔄 Restoring label family tree component state:', {
        hasSelectedLabel: !!state.selectedLabel,
        searchTerm: state.searchTerm,
        hasFamilyTree: !!state.familyTree,
        ageMinutes: Math.round(stateAge / (1000 * 60))
      });

      // Restore the state
      if (state.selectedLabel) {
        this.selectedLabel.set(state.selectedLabel);
        this.searchControl.setValue(state.searchTerm, { emitEvent: false });
        // Clear search results and searching state when restoring selected label
        this.searchResults.set([]);
        this.isActivelySearching.set(false);
        this.isSearching.set(false); // Ensure search loading state is false
      }

      if (state.familyTree) {
        this.familyTree.set(state.familyTree);
      }


    } catch (error) {
      console.error('Failed to restore label family tree component state:', error);
      sessionStorage.removeItem(this.STATE_STORAGE_KEY);
      // Ensure clean state on restoration error
      this.isSearching.set(false);
      this.isActivelySearching.set(false);
      this.searchResults.set([]);
    }
  }

  private clearPersistedState(): void {
    sessionStorage.removeItem(this.STATE_STORAGE_KEY);
  }

  private checkNavigationState(): void {
    // Try multiple ways to get navigation state
    const navigation = this.router.currentNavigation();
    const navigationState = navigation?.extras?.state;
    const historyState = window.history.state;
    
    console.log('🔄 Checking navigation state:', { 
      hasNavigation: !!navigation, 
      hasNavigationState: !!navigationState,
      navigationState: navigationState,
      historyState: historyState
    });
    
    // Check navigation state first
    if (navigationState?.['selectedLabel'] && navigationState?.['fromLabelCard']) {
      console.log('🔄 Found navigation state with label:', navigationState['selectedLabel'].name);
      this.initializeWithLabel(navigationState['selectedLabel']);
      return;
    }
    
    // Fallback to history state
    if (historyState?.selectedLabel && historyState?.fromLabelCard) {
      console.log('🔄 Found history state with label:', historyState.selectedLabel.name);
      this.initializeWithLabel(historyState.selectedLabel);
      return;
    }
    
    console.log('🔄 No valid navigation state found');
  }

  private initializeWithLabel(label: MusicBrainzLabel): void {
    console.log('🔄 Initializing with label from navigation:', label.name);
    
    // Populate search box and trigger search to show the label in results
    this.searchControl.setValue(label.name, { emitEvent: true });
    
    // Clear error states
    this.error.set(null);
    
    // Note: The search will populate searchResults, then we'll auto-select
    // We need to wait for the search to complete before selecting
    // This will be handled by the search subscription, but we need to 
    // mark this label for auto-selection
    this.pendingAutoSelectLabel = label;
  }

  // Spotify Integration Methods
  openSpotifyCreator(): void {
    this.showSpotifyCreator.set(true);
  }

  closeSpotifyCreator(): void {
    this.showSpotifyCreator.set(false);
    this.createdPlaylist.set(null);
  }

  async createSpotifyPlaylistFromSelectedLabel(): Promise<void> {
    console.log('🎵 PLAYLIST CREATION STARTED - Using ONLY cached data, NO API calls');
    
    const selectedLabel = this.selectedLabel();
    const cachedArtistData = this.allReleases();
    
    if (!selectedLabel) {
      this.error.set('No label selected');
      return;
    }

    if (!this.spotifyService.isAuthenticated()) {
      console.log('🎵 User not authenticated, initiating Spotify auth');
      this.spotifyService.initiateAuth();
      return;
    }

    this.isCreatingPlaylist.set(true);
    this.error.set(null);

    try {
      console.log('🎵 Creating playlist for label:', selectedLabel.name);
      console.log(`🎵 Using data from ${cachedArtistData.length} artists from family tree - NO MUSICBRAINZ API CALLS`);
      
      if (cachedArtistData.length === 0) {
        this.error.set('No artists with releases found in the family tree. Make sure the label family tree has loaded completely.');
        return;
      }

      const playlistReleases: any[] = [];
      
      // Process each artist using cached release data
      for (const artistData of cachedArtistData) { // Process all artists
        console.log(`🎵 Using cached releases for artist: ${artistData.artistName} - NO API CALLS`);
        
        if (artistData.releaseDetails && artistData.releaseDetails.length > 0) {
          // Use the cached release details - filter for Albums and EPs and apply sorting
          let sortedReleases = [...artistData.releaseDetails];
          
          // Apply year filtering if enabled
          if (this.enableYearFilter()) {
            const startYear = this.startYear();
            const endYear = this.endYear();
            const initialCount = sortedReleases.length;
            
            console.log(`🎵 YEAR FILTER: Filtering ${initialCount} releases for ${artistData.artistName} with range ${startYear || 'any'}-${endYear || 'any'}`);
            
            sortedReleases = sortedReleases.filter((release: {date?: string, title?: string}) => {
              const releaseYear = this.extractYear(release.date);
              
              console.log(`🎵 CHECKING: "${release.title}" (${release.date}) -> Year: ${releaseYear}`);
              
              // Skip releases without year information when filtering
              if (releaseYear === null) {
                console.log(`🎵 EXCLUDED: No year data for "${release.title}"`);
                return false;
              }
              
              // Apply start year filter
              if (startYear !== null && releaseYear < startYear) {
                console.log(`🎵 EXCLUDED: "${release.title}" (${releaseYear}) is before start year ${startYear}`);
                return false;
              }
              
              // Apply end year filter
              if (endYear !== null && releaseYear > endYear) {
                console.log(`🎵 EXCLUDED: "${release.title}" (${releaseYear}) is after end year ${endYear}`);
                return false;
              }
              
              console.log(`🎵 INCLUDED: "${release.title}" (${releaseYear}) passes filter`);
              return true;
            });
            
            console.log(`🎵 YEAR FILTER RESULT: ${sortedReleases.length}/${initialCount} releases kept for ${artistData.artistName}`);
          }

          // Apply sorting if specified
          const sortOrder = this.albumSortOrder();
          if (sortOrder !== 'none') {
            sortedReleases.sort((a: {date?: string}, b: {date?: string}) => {
              const yearA = this.extractYear(a.date);
              const yearB = this.extractYear(b.date);
              
              // Handle cases where year is missing
              if (yearA === null && yearB === null) return 0;
              if (yearA === null) return 1; // Put releases without dates at the end
              if (yearB === null) return -1;
              
              return sortOrder === 'year-asc' ? yearA - yearB : yearB - yearA;
            });
          }
          
          const artistReleases = sortedReleases
              .map((release: {id: string, title: string, date?: string, primaryType?: string}) => ({
              artistName: artistData.artistName,
              releaseName: release.title,
              releaseId: release.id,
              releaseDate: release.date,
              trackCount: this.useAllTracks() ? 999 : this.tracksPerAlbum() // Use all tracks or user-specified count
            }));
          
          const filterInfo = this.enableYearFilter() ? 
            ` filtered: ${this.startYear() || 'any'}-${this.endYear() || 'any'},` : '';
          console.log(`🎵 Using ${artistReleases.length} cached releases for ${artistData.artistName} (${filterInfo} sorted: ${sortOrder}) - NO API CALLS`);
          playlistReleases.push(...artistReleases);
        } else {
          console.log(`🎵 No cached release details found for ${artistData.artistName}`);
        }
      }

      console.log(`Total releases selected for playlist: ${playlistReleases.length}`);
      
      if (playlistReleases.length === 0) {
        this.error.set('No suitable album or EP releases found for this label\'s artists. Try a different label.');
        return;
      }

      // Create the playlist request
      const request: PlaylistCreationRequest = {
        labelName: selectedLabel.name,
        releases: playlistReleases,
        yearFilter: {
          enabled: this.enableYearFilter(),
          startYear: this.startYear(),
          endYear: this.endYear()
        }
      };

      console.log('🎵 Creating Spotify playlist with request - ONLY Spotify API calls from here:', request);

      const playlist = await firstValueFrom(this.spotifyService.createPlaylistFromLabelReleases(request));
      
      if (playlist) {
        this.createdPlaylist.set(playlist);
        console.log('🎵 Playlist created successfully:', playlist.name);
      } else {
        console.error('🎵 Playlist creation returned null - check Spotify authentication and API calls');
        if (!this.spotifyService.isAuthenticated()) {
          this.error.set('Spotify authentication expired. Please reconnect and try again.');
        } else {
          this.error.set('Failed to create playlist on Spotify. Check console for details.');
        }
      }

    } catch (error) {
      console.error('Failed to create Spotify playlist:', error);
      this.error.set('Failed to create playlist. Please try again.');
    } finally {
      this.isCreatingPlaylist.set(false);
    }
  }

  onPlaylistCreated(playlist: SpotifyPlaylist): void {
    this.createdPlaylist.set(playlist);
    // Optionally close the creator after a delay
    setTimeout(() => {
      this.closeSpotifyCreator();
    }, 3000);
  }

  /**
   * Update the tracks per album count with validation
   */
  updateTracksPerAlbum(value: number): void {
    const clampedValue = Math.max(1, Math.min(50, value));
    this.tracksPerAlbum.set(clampedValue);
  }

  /**
   * Reset tracks per album to default
   */
  resetTracksPerAlbum(): void {
    this.tracksPerAlbum.set(5);
  }

  /**
   * Toggle all tracks mode
   */
  toggleAllTracks(): void {
    this.useAllTracks.set(!this.useAllTracks());
  }

  /**
   * Get the effective track count for display
   */
  getEffectiveTrackCount(): string {
    return this.useAllTracks() ? 'all' : this.tracksPerAlbum().toString();
  }

  /**
   * Update the album sort order
   */
  updateAlbumSortOrder(sortOrder: 'none' | 'year-asc' | 'year-desc'): void {
    this.albumSortOrder.set(sortOrder);
  }

  /**
   * Toggle year filter on/off
   */
  toggleYearFilter(): void {
    this.enableYearFilter.set(!this.enableYearFilter());
  }

  /**
   * Update start year with validation
   */
  updateStartYear(year: number | null): void {
    if (year === null || (year >= 1900 && year <= new Date().getFullYear() + 10)) {
      this.startYear.set(year);
    }
  }

  /**
   * Update end year with validation
   */
  updateEndYear(year: number | null): void {
    if (year === null || (year >= 1900 && year <= new Date().getFullYear() + 10)) {
      this.endYear.set(year);
    }
  }

  /**
   * Get current year for template use
   */
  getCurrentYear(): number {
    return new Date().getFullYear();
  }

  /**
   * Extract year from date string (handles YYYY, YYYY-MM, YYYY-MM-DD formats)
   */
  private extractYear(dateStr?: string): number | null {
    if (!dateStr) return null;
    const yearMatch = dateStr.match(/^(\d{4})/);
    return yearMatch ? parseInt(yearMatch[1], 10) : null;
  }
}