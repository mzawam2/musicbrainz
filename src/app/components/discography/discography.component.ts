import { Component, input, signal, computed, OnInit, OnDestroy, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { HttpParams } from '@angular/common/http';

import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DiscographyData, EnhancedDiscographyData, EnhancedReleaseGroup, MusicBrainzArtist } from '../../models/musicbrainz.models';
import { DiscogsService } from '../../services/discogs.service';
import { LastfmAuthService } from '../../services/lastfm-auth.service';
import { DiscogsArtistRelease } from '../../models/discogs.models';
import { ReleaseCardComponent } from './release-card/release-card.component';
import { CollaborationNetworkComponent } from '../collaboration-network/collaboration-network.component';

@Component({
  selector: 'app-discography',
  imports: [FormsModule, ReleaseCardComponent, CollaborationNetworkComponent],
  templateUrl: './discography.component.html',
  styleUrl: './discography.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiscographyComponent implements OnInit, OnDestroy {
  // Injected services
  private discogsService = inject(DiscogsService);
  private lastfmAuth = inject(LastfmAuthService);
  private destroy$ = new Subject<void>();

  // Input signals
  discographyData = input<EnhancedDiscographyData | null>(null);
  selectedArtist = input<MusicBrainzArtist | null>(null);
  loading = input(false);
  error = input<string | null>(null);

  // Writable signal that extends discographyData with Discogs thumbs
  private enhancedDiscographyData = signal<EnhancedDiscographyData | null>(null);

  // Last.fm authentication state
  readonly isLastfmAuthenticated = this.lastfmAuth.isAuthenticated;
  readonly lastfmCurrentUser = this.lastfmAuth.currentUser;
  readonly hasDeclinedAuth = signal(false);


  constructor() {
    // Sync input discographyData with enhanced signal
    effect(() => {
      const inputData = this.discographyData();
      if (inputData && !this.enhancedDiscographyData()) {
        // Initialize enhanced data from input data
        this.enhancedDiscographyData.set(inputData);
        console.log(`🎵 📋 Initialized enhanced discography data`);
      }
    });

    // Use effect to watch for changes in artist and discography data
    effect(() => {
      const artist = this.selectedArtist();
      const discography = this.discographyData();
      
      console.log(`🎵 Effect triggered - Artist: ${artist?.name || 'null'}, Discography: ${discography ? 'present' : 'null'}, Release groups: ${discography?.releaseGroups?.length || 0}`);
      
      if (artist && discography && discography.releaseGroups.length > 0) {
        console.log(`🎵 Loading Discogs data for artist: ${artist.name}`);
        this.loadDiscogsArtistReleases(artist);
      }
    });
  }

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
    // Use the enhanced discography data that includes thumbs
    const data = this.enhancedDiscographyData();
    if (!data) return [];
    
    const filtered = this.applyFiltersAndSort(data.releaseGroups);
    
    // Debug: Log thumbs in filtered results
    const withThumbs = filtered.filter(rg => rg.thumb);
    console.log(`🎵 📺 Template: ${filtered.length} release groups, ${withThumbs.length} have thumbs`);
    if (withThumbs.length > 0) {
      console.log(`🎵 📺 First few with thumbs:`, withThumbs.slice(0, 3).map(rg => `"${rg.title}" - ${rg.thumb?.substring(0, 50)}...`));
    }
    
    return filtered;
  });

  // Computed filter options
  availableTypes = computed(() => {
    const data = this.enhancedDiscographyData();
    if (!data) return [];
    const types = [...new Set(data.releaseGroups.map(item => item['primary-type']).filter(type => type))];
    return types.sort();
  });

  availableDecades = computed(() => {
    const data = this.enhancedDiscographyData();
    if (!data?.decades) return [];
    return data.decades.map(d => d.decade).sort();
  });

  availableGenres = computed(() => {
    const data = this.enhancedDiscographyData();
    if (!data?.genres) return [];
    return data.genres.map(g => g.name).slice(0, 10);
  });

  // Computed stats
  totalReleases = computed(() => this.enhancedDiscographyData()?.totalReleases || 0);
  
  careerSpan = computed(() => {
    const data = this.enhancedDiscographyData();
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

  /**
   * Initiates Last.fm authentication flow
   */
  signInWithLastfm(): void {
    this.lastfmAuth.initiateAuth();
  }

  /**
   * Signs out of Last.fm
   */
  signOutLastfm(): void {
    this.lastfmAuth.signOut();
  }

  /**
   * User declines Last.fm authentication
   */
  declineLastfmAuth(): void {
    localStorage.setItem('lastfm_auth_declined', 'true');
    this.hasDeclinedAuth.set(true);
    console.log('🎵 User declined Last.fm authentication');
  }

  ngOnInit() {
    // Check if user has previously declined authentication
    const hasDeclined = localStorage.getItem('lastfm_auth_declined') === 'true';
    this.hasDeclinedAuth.set(hasDeclined);
    
    // Effect in constructor handles Discogs data loading
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load all releases for the artist from Discogs using the artist releases endpoint
   */
  private loadDiscogsArtistReleases(artist: MusicBrainzArtist) {
    
    // Search for the artist on Discogs first to get the artist ID
    this.discogsService.searchDatabase({
      q: artist.name,
      type: 'artist',
      per_page: 5
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (searchResults) => {
          if (searchResults && searchResults.results && searchResults.results.length > 0) {
            // Get the first matching artist and fetch their releases
            const discogsArtist = searchResults.results[0];
            this.fetchArtistReleases(discogsArtist.id);
          } else {
            console.log(`🎵 No Discogs artist found for "${artist.name}"`);
          }
        },
        error: (error) => {
          console.error(`🎵 Error searching for artist "${artist.name}" on Discogs:`, error);
        }
      });
  }

  /**
   * Fetch artist details first to get the releases_url, then fetch releases
   */
  private fetchArtistReleases(artistId: number) {
    console.log(`🎵 Fetching artist details for Discogs artist ID: ${artistId}`);
    
    // First get artist details to get the releases_url
    this.discogsService.getArtist(artistId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (artistDetails) => {
          if (artistDetails && artistDetails.releases_url) {
            console.log(`🎵 Using releases_url: ${artistDetails.releases_url}`);
            this.fetchArtistReleasesFromUrl(artistDetails.releases_url);
          } else {
            console.warn(`🎵 No releases_url found for artist ${artistId}`);
          }
        },
        error: (error) => {
          console.error(`🎵 Error fetching Discogs artist details for ID ${artistId}:`, error);
        }
      });
  }

  /**
   * Fetch releases using the releases_url from artist details
   */
  private fetchArtistReleasesFromUrl(releasesUrl: string) {
    // Add query parameters for sorting and pagination
    const params = new HttpParams({
      fromObject: {
        sort: 'year',
        sort_order: 'asc',
        page: '1',
        per_page: '100'
      }
    });

    console.log(`🎵 Fetching releases from: ${releasesUrl}`);
    
    this.discogsService.makeDirectUrlRequest<any>(releasesUrl, params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (releasesResponse) => {
          if (releasesResponse && releasesResponse.releases) {
            console.log(`🎵 Found ${releasesResponse.releases.length} Discogs releases for artist`);
            console.log(`🎵 Sample releases:`, releasesResponse.releases.slice(0, 3).map((r: { title: any; type: any; thumb: any; }) => `"${r.title}" (${r.type}) - thumb: ${r.thumb ? 'YES' : 'NO'}`));
            this.matchReleasesToReleaseGroups(releasesResponse.releases);
          } else {
            console.log(`🎵 ❌ No releases found in response`);
          }
        },
        error: (error) => {
          console.error(`🎵 Error fetching releases from URL ${releasesUrl}:`, error);
        }
      });
  }

  /**
   * Match Discogs releases to our MusicBrainz release groups and fetch artwork
   */
  private matchReleasesToReleaseGroups(discogsReleases: DiscogsArtistRelease[]) {
    const releaseGroups = this.discographyData()?.releaseGroups || [];
    
    console.log(`🎵 🔍 Starting to match ${releaseGroups.length} MusicBrainz release groups against ${discogsReleases.length} Discogs releases`);
    
    // Create new array with updated release groups (don't mutate originals)
    const updatedReleaseGroups = releaseGroups.map((releaseGroup, index) => {
      console.log(`🎵 [${index + 1}/${releaseGroups.length}] Processing MusicBrainz release: "${releaseGroup.title}" (ID: ${releaseGroup.id})`);
      
      // Find matching Discogs release
      const matchingRelease = this.findBestDiscogsReleaseMatch(releaseGroup, discogsReleases);
      if (matchingRelease) {
        console.log(`🎵 ✅ MATCH FOUND: "${releaseGroup.title}" (MB ID: ${releaseGroup.id}) -> "${matchingRelease.title}" (Discogs ID: ${matchingRelease.id})`);
        console.log(`🎵 📸 Discogs thumb URL: ${matchingRelease.thumb || 'NO THUMB'}`);
        
        // Create new release group object with thumb and resource URL
        const updatedReleaseGroup = { 
          ...releaseGroup, 
          thumb: matchingRelease.thumb,
          discogsResourceUrl: matchingRelease.resource_url
        };
        const currentEnhancedData = this.enhancedDiscographyData();
        if (currentEnhancedData) {
          this.enhancedDiscographyData.set({
            ...currentEnhancedData,
            releaseGroups: currentEnhancedData.releaseGroups.map(rg => rg.id === releaseGroup.id ? updatedReleaseGroup : rg)
          });
        }
        console.log(`🎵 ✅ Created updated release group with thumb: ${updatedReleaseGroup.thumb || 'NULL'} and resource URL: ${updatedReleaseGroup.discogsResourceUrl}`);
        return updatedReleaseGroup;
      } else {
        console.log(`🎵 ❌ NO MATCH: "${releaseGroup.title}" (MB ID: ${releaseGroup.id}) - no exact title match found`);
        return releaseGroup;
      }
    });
    
    // Update the enhanced discography data signal with thumbs
    const currentData = this.enhancedDiscographyData();
    if (currentData) {
      const updatedData = {
        ...currentData,
        releaseGroups: updatedReleaseGroups
      };
      this.enhancedDiscographyData.set(updatedData);
      console.log(`🎵 🔄 Updated enhanced discography data with ${updatedReleaseGroups.length} release groups`);
    }
  }

  /**
   * Find the best matching Discogs release for a MusicBrainz release group
   * Only matches exact titles to avoid incorrect matches
   */
  private findBestDiscogsReleaseMatch(releaseGroup: EnhancedReleaseGroup, discogsReleases: DiscogsArtistRelease[]): DiscogsArtistRelease | null {
    const mbTitle = this.normalizeTitle(releaseGroup.title);
    const mbYear = releaseGroup['first-release-date'] ? new Date(releaseGroup['first-release-date']).getFullYear() : null;
    
    console.log(`🎵 Looking for exact match for: "${mbTitle}" (${mbYear || 'no year'})`);
    
    // Only try exact title matches
    let exactMatches = discogsReleases.filter(release => 
      this.normalizeTitle(release.title) === mbTitle
    );
    
    if (exactMatches.length === 0) {
      console.log(`🎵 No exact title match found for "${releaseGroup.title}"`);
      return null;
    }
    
    console.log(`🎵 Found ${exactMatches.length} exact title match(es) for "${releaseGroup.title}"`);
    
    // If we have multiple exact matches, prefer by year if available
    if (exactMatches.length > 1 && mbYear) {
      const yearMatch = exactMatches.find(release => release.year === mbYear);
      if (yearMatch) {
        console.log(`🎵 Using year-matched release: "${yearMatch.title}" (${yearMatch.year})`);
        return this.preferReleaseOverMaster(yearMatch, exactMatches);
      }
    }
    
    // If we have multiple matches, prefer 'release' type over 'master'
    const bestMatch = this.preferReleaseOverMaster(exactMatches[0], exactMatches);
    console.log(`🎵 Selected match: "${bestMatch.title}" (${bestMatch.year || 'no year'}) - ${bestMatch.type}`);
    
    return bestMatch;
  }

  /**
   * Normalize title for exact matching (remove extra spaces, convert to lowercase, handle common variations)
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/['']/g, "'")  // Normalize apostrophes
      .replace(/[""]/g, '"')  // Normalize quotes
      .replace(/\.$/, '');    // Remove trailing period
  }

  /**
   * Prefer 'release' type over 'master' type when we have multiple exact matches
   */
  private preferReleaseOverMaster(primaryMatch: DiscogsArtistRelease, allMatches: DiscogsArtistRelease[]): DiscogsArtistRelease {
    if (primaryMatch.type === 'master') {
      const releaseMatch = allMatches.find(release => 
        release.type === 'release' && 
        this.normalizeTitle(release.title) === this.normalizeTitle(primaryMatch.title)
      );
      if (releaseMatch) {
        return releaseMatch;
      }
    }
    return primaryMatch;
  }

  

}