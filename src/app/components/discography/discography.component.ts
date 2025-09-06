import { Component, input, output, signal, computed, OnInit, OnDestroy, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { HttpParams } from '@angular/common/http';

import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, switchMap, catchError, tap, retry, delay, timer } from 'rxjs';
import { of } from 'rxjs';
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
  
  // Subject for triggering artist searches with proper cancellation
  private artistSearchTrigger$ = new Subject<MusicBrainzArtist>();

  // Input signals
  discographyData = input<EnhancedDiscographyData | null>(null);
  selectedArtist = input<MusicBrainzArtist | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  
  // Output signals for sharing Discogs artist data with parent
  artistImagesLoaded = output<any[]>();
  artistDataLoaded = output<any>();

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

    // Always keep enhancedDiscographyData in sync with incoming input
    effect(() => {
      const data = this.discographyData();
      this.enhancedDiscographyData.set(data);
      console.log('dYZ� dY"< Forced sync of enhanced discography data to input change');
    });

    // Use effect to trigger artist search when artist changes
    effect(() => {
      const artist = this.selectedArtist();
      
      console.log(`🎵 Discography effect triggered - Artist: ${artist?.name || 'null'}`);
      
      if (artist) {
        console.log(`🎵 Triggering artist search for: ${artist.name}`);
        this.artistSearchTrigger$.next(artist);
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
    
    // Set up artist search pipeline with proper cancellation
    this.artistSearchTrigger$
      .pipe(
        tap(artist => console.log(`🎵 Starting artist search pipeline for: ${artist.name}`)),
        switchMap(artist => 
          this.discogsService.searchDatabase({
            q: artist.name,
            type: 'artist',
            per_page: 10
          }).pipe(
            retry({
              count: 2,
              delay: (error, retryCount) => {
                console.log(`🎵 Artist search retry ${retryCount} for "${artist.name}":`, error.message);
                return timer(1000 * retryCount); // Exponential backoff: 1s, 2s
              }
            }),
            switchMap(searchResults => {
              if (searchResults && searchResults.results && searchResults.results.length > 0) {
                // Use smart matching logic - look for exact matches and normalized matches
                const artistName = artist.name;
                console.log(`🎵 Found ${searchResults.results.length} Discogs artists for: "${artistName}"`);
                console.log(`🎵 All results:`, searchResults.results.map(r => `"${r.title}" (ID: ${r.id})`));
                
                // Look for exact title match first
                let selectedResult = searchResults.results.find(result => {
                  const titleMatch = result.title.toLowerCase().trim() === artistName.toLowerCase().trim();
                  console.log(`🎵 Comparing "${result.title.toLowerCase().trim()}" === "${artistName.toLowerCase().trim()}" = ${titleMatch}`);
                  return titleMatch;
                });
                
                // Override with normalized-first match: strip trailing numeric qualifiers like " (2)" and
                // take the first result whose normalized title equals the normalized artistName
                const normalizeTitle = (s: string) => s.toLowerCase().trim().replace(/\s*\(\d+\)\s*$/, '');
                const targetTitle = normalizeTitle(artistName);
                const normalizedMatches = searchResults.results.filter(r => normalizeTitle(r.title) === targetTitle);
                if (normalizedMatches.length > 0) {
                  selectedResult = normalizedMatches[0];
                  console.log(`🎵 Using normalized match: "${selectedResult.title}" (normalized: "${normalizeTitle(selectedResult.title)}")`);
                }
                
                if (!selectedResult) {
                  // If no exact match, use first result
                  selectedResult = searchResults.results[0];
                  console.log(`🎵 No exact match found, using first result: "${selectedResult.title}"`);
                } else {
                  console.log(`🎵 Found exact match: "${selectedResult.title}"`);
                }
                
                console.log(`🎵 Using Discogs artist: ${selectedResult.title} (ID: ${selectedResult.id}) - ${
                  selectedResult.title.toLowerCase().trim() === artistName.toLowerCase().trim() ? 'EXACT MATCH' : 'FALLBACK MATCH'
                }`);
                
                return this.discogsService.getArtist(selectedResult.id).pipe(
                  retry({
                    count: 2,
                    delay: (error, retryCount) => {
                      console.log(`🎵 Artist details retry ${retryCount} for ID ${selectedResult.id}:`, error.message);
                      return timer(1000 * retryCount); // Exponential backoff: 1s, 2s
                    }
                  })
                );
              } else {
                console.log(`🎵 No Discogs artist found for "${artist.name}"`);
                return of(null);
              }
            }),
            catchError(error => {
              console.error(`🎵 Error in artist search pipeline for "${artist.name}" (after retries):`, error);
              // Emit empty arrays to parent so UI shows "no data" state instead of hanging
              this.artistImagesLoaded.emit([]);
              this.artistDataLoaded.emit(null);
              return of(null);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(artistDetails => {
        if (artistDetails) {
          this.handleArtistDetailsReceived(artistDetails);
        }
      });
    
    // Effect in constructor handles triggering the search
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle artist details received from the search pipeline
   */
  private handleArtistDetailsReceived(artistDetails: any) {
    console.log(`🎵 Handling artist details:`, artistDetails);
    
    // Emit artist data and images to parent component
    this.artistDataLoaded.emit(artistDetails);
    if (artistDetails.images && artistDetails.images.length > 0) {
      console.log(`🎵 Emitting ${artistDetails.images.length} artist images to parent`);
      this.artistImagesLoaded.emit(artistDetails.images);
    } else {
      console.log(`🎵 No artist images found, emitting empty array`);
      this.artistImagesLoaded.emit([]);
    }
    
    // Continue with releases if releases_url is available
    if (artistDetails.releases_url) {
      console.log(`🎵 Using releases_url: ${artistDetails.releases_url}`);
      this.fetchArtistReleasesFromUrl(artistDetails.releases_url);
    } else {
      console.warn(`🎵 No releases_url found in artist details`);
    }
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
      .pipe(
        retry({
          count: 2,
          delay: (error, retryCount) => {
            console.log(`🎵 Releases fetch retry ${retryCount} for URL ${releasesUrl}:`, error.message);
            return timer(1500 * retryCount); // Slightly longer delays for releases: 1.5s, 3s
          }
        }),
        takeUntil(this.destroy$)
      )
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
          console.error(`🎵 Error fetching releases from URL ${releasesUrl} (after retries):`, error);
          // Log additional context for debugging
          console.error(`🎵 Error details:`, {
            url: releasesUrl,
            status: error.status,
            message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });
  }

  /**
   * Match Discogs releases to our MusicBrainz release groups and fetch artwork
   */
  private matchReleasesToReleaseGroups(discogsReleases: DiscogsArtistRelease[]) {
    const releaseGroups = this.discographyData()?.releaseGroups || [];
    const usedDiscogsIds = new Set<number>();
    
    console.log(`🎵 🔍 Starting to match ${releaseGroups.length} MusicBrainz release groups against ${discogsReleases.length} Discogs releases`);
    
    // Create new array with updated release groups (don't mutate originals)
    const updatedReleaseGroups = releaseGroups.map((releaseGroup, index) => {
      console.log(`🎵 [${index + 1}/${releaseGroups.length}] Processing MusicBrainz release: "${releaseGroup.title}" (ID: ${releaseGroup.id})`);
      
      // Find matching Discogs release (consider year proximity and type)
      const initialMatch = this.findBestDiscogsReleaseMatchByYear(releaseGroup, discogsReleases);
      let matchingRelease = initialMatch;
      if (matchingRelease && usedDiscogsIds.has(matchingRelease.id)) {
        const unusedPool = discogsReleases.filter(r => !usedDiscogsIds.has(r.id));
        const alternative = this.findBestDiscogsReleaseMatchByYear(releaseGroup, unusedPool);
        matchingRelease = alternative || null;
      }
      if (matchingRelease) {
        console.log(`🎵 ✅ MATCH FOUND: "${releaseGroup.title}" (MB ID: ${releaseGroup.id}) -> "${matchingRelease.title}" (Discogs ID: ${matchingRelease.id})`);
        console.log(`🎵 📸 Discogs thumb URL: ${matchingRelease.thumb || 'NO THUMB'}`);
        
        // Avoid reusing the same Discogs item for other release groups
        usedDiscogsIds.add(matchingRelease.id);
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

  /**
   * Improved matcher: exact title, then closest year (exact year preferred), then prefer 'release' over 'master'.
   */
  private findBestDiscogsReleaseMatchByYear(
    releaseGroup: EnhancedReleaseGroup,
    discogsReleases: DiscogsArtistRelease[]
  ): DiscogsArtistRelease | null {
    const mbTitle = this.normalizeTitle(releaseGroup.title);
    const mbYear = releaseGroup['first-release-date'] ? new Date(releaseGroup['first-release-date']).getFullYear() : null;

    const exactMatches = discogsReleases.filter(r => this.normalizeTitle(r.title) === mbTitle);
    if (exactMatches.length === 0) {
      return null;
    }

    const scored = exactMatches.map(r => ({
      item: r,
      yearScore: (mbYear != null && r.year != null) ? Math.abs(r.year - mbYear) : Number.MAX_SAFE_INTEGER,
      typeScore: r.type === 'release' ? 0 : 1
    }));
    scored.sort((a, b) => (a.yearScore - b.yearScore) || (a.typeScore - b.typeScore));
    return scored[0].item;
  }

  

}
