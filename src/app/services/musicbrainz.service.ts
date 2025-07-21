import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, delay, tap, switchMap } from 'rxjs/operators';
import { 
  MusicBrainzArtistSearchResponse, 
  MusicBrainzReleaseSearchResponse,
  MusicBrainzReleaseGroupSearchResponse,
  MusicBrainzReleaseDetailResponse,
  CoverArtResponse,
  MusicBrainzArtist,
  MusicBrainzRelease,
  MusicBrainzReleaseGroup,
  DetailedRelease,
  EnhancedReleaseGroup,
  EnhancedDiscographyData,
  LabelWithReleaseCount,
  DiscographyData,
  CoverArtInfo,
  CollaborationInfo,
  MusicBrainzLabel,
  LabelRelationshipSearchResponse,
  LabelArtistResponse,
  LabelTreeNode,
  LabelFamilyTree,
  LabelRelationship,
  ArtistRosterEntry
} from '../models/musicbrainz.models';

@Injectable({
  providedIn: 'root'
})
export class MusicBrainzService {
  private readonly baseUrl = 'https://musicbrainz.org/ws/2';
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly defaultHeaders = new HttpHeaders({
    'User-Agent': 'AngularPlayground/1.0 (musicbrainz@example.com)'
  });
  
  // Cache for artist searches
  private artistSearchCache = new Map<string, { data: MusicBrainzArtist[], timestamp: number }>();
  
  // Cache for label data
  private labelCache = new Map<string, { data: LabelWithReleaseCount[], timestamp: number }>();
  
  // Cache for discography data
  private discographyCache = new Map<string, { data: DiscographyData, timestamp: number }>();
  
  // Cache for enhanced discography data (Phase 2 & 3)
  private enhancedDiscographyCache = new Map<string, { data: EnhancedDiscographyData, timestamp: number }>();
  
  // Cache for cover art data
  private coverArtCache = new Map<string, { data: CoverArtInfo, timestamp: number }>();
  
  // Cache for detailed releases
  private detailedReleaseCache = new Map<string, { data: DetailedRelease, timestamp: number }>();
  
  // Cache for label family trees
  private labelTreeCache = new Map<string, { data: LabelFamilyTree, timestamp: number }>();
  
  // Cache for label relationships
  private labelRelationshipCache = new Map<string, { data: LabelTreeNode[], timestamp: number }>();
  
  // Cache for label artist rosters
  private labelArtistCache = new Map<string, { data: ArtistRosterEntry[], timestamp: number }>();

  private http = inject(HttpClient);

  searchArtists(query: string, limit: number = 10): Observable<MusicBrainzArtist[]> {
    const cacheKey = `${query.toLowerCase()}_${limit}`;
    
    // Check cache first
    const cached = this.artistSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    const params = new HttpParams()
      .set('query', query)
      .set('limit', limit.toString())
      .set('inc', 'tags+genres')
      .set('fmt', 'json');

    return this.http.get<MusicBrainzArtistSearchResponse>(`${this.baseUrl}/artist`, { params, headers: this.defaultHeaders })
      .pipe(
        delay(1000), // Rate limiting - MusicBrainz allows 1 request per second
        map(response => response.artists),
        tap(artists => {
          // Cache the results
          this.artistSearchCache.set(cacheKey, { data: artists, timestamp: Date.now() });
          
          // Clean up old cache entries
          this.cleanupCache(this.artistSearchCache);
        }),
        catchError(this.handleError)
      );
  }

  getArtistReleases(artistId: string, limit: number = 100): Observable<MusicBrainzRelease[]> {
    const params = new HttpParams()
      .set('artist', artistId)
      .set('inc', 'labels')
      .set('limit', limit.toString())
      .set('fmt', 'json');

    return this.http.get<MusicBrainzReleaseSearchResponse>(`${this.baseUrl}/release`, { params, headers: this.defaultHeaders })
      .pipe(
        delay(1000), // Rate limiting
        map(response => response.releases),
        catchError(this.handleError)
      );
  }

  getArtistLabels(artistId: string): Observable<LabelWithReleaseCount[]> {
    // Check cache first
    const cached = this.labelCache.get(artistId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    return this.getArtistReleases(artistId, 100).pipe(
      map(releases => this.aggregateLabels(releases)),
      tap(labels => {
        // Cache the results
        this.labelCache.set(artistId, { data: labels, timestamp: Date.now() });
        
        // Clean up old cache entries
        this.cleanupCache(this.labelCache);
      }),
      catchError(this.handleError)
    );
  }

  // New methods for Phase 1: Artist Discography Explorer
  
  getArtistReleaseGroups(artistId: string, limit: number = 100): Observable<MusicBrainzReleaseGroup[]> {
    const params = new HttpParams()
      .set('artist', artistId)
      .set('limit', limit.toString())
      .set('fmt', 'json');

    return this.http.get<MusicBrainzReleaseGroupSearchResponse>(`${this.baseUrl}/release-group`, { params, headers: this.defaultHeaders })
      .pipe(
        delay(1000), // Rate limiting
        map(response => {
          console.log('Raw API response for release groups:', response);
          return response['release-groups'];
        }),
        tap(releaseGroups => {
          console.log('Processed release groups:', releaseGroups);
        }),
        catchError(this.handleError)
      );
  }

  // New method to get releases for a specific release group
  getReleaseGroupReleases(releaseGroupId: string): Observable<MusicBrainzRelease[]> {
    const params = new HttpParams()
      .set('release-group', releaseGroupId)
      .set('inc', 'labels')  // Include label information
      .set('limit', '25')  // Limit to avoid too many releases
      .set('fmt', 'json');

    return this.http.get<MusicBrainzReleaseSearchResponse>(`${this.baseUrl}/release`, { params, headers: this.defaultHeaders })
      .pipe(
        delay(1000), // Rate limiting
        map(response => {
          console.log(`Releases for release group ${releaseGroupId}:`, response.releases);
          return response.releases;
        }),
        catchError(this.handleError)
      );
  }

  getArtistDiscography(artistId: string): Observable<DiscographyData> {
    // Check cache first
    const cached = this.discographyCache.get(artistId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    return this.getArtistReleaseGroups(artistId, 100).pipe(
      map(releaseGroups => this.aggregateDiscographyData(releaseGroups, artistId)),
      tap(discography => {
        // Cache the results
        this.discographyCache.set(artistId, { data: discography, timestamp: Date.now() });
        
        // Clean up old cache entries
        this.cleanupCache(this.discographyCache);
      }),
      catchError(this.handleError)
    );
  }

  private aggregateDiscographyData(releaseGroups: MusicBrainzReleaseGroup[], artistId: string): DiscographyData {
    // Sort release groups by date
    const sortedReleaseGroups = releaseGroups
      .filter(rg => rg['first-release-date']) // Only include releases with dates
      .sort((a, b) => a['first-release-date'].localeCompare(b['first-release-date']));

    // Calculate career span
    const careerSpan = this.calculateCareerSpan(sortedReleaseGroups);

    // For now, we'll create a minimal artist object since we need it for DiscographyData
    // In a real implementation, this would be passed in or fetched separately
    const artist: MusicBrainzArtist = {
      id: artistId,
      name: '',
      'sort-name': ''
    };

    return {
      artist,
      releaseGroups: sortedReleaseGroups,
      totalReleases: releaseGroups.length,
      careerSpan
    };
  }

  private calculateCareerSpan(releaseGroups: MusicBrainzReleaseGroup[]): { start: string; end?: string } {
    if (releaseGroups.length === 0) {
      return { start: '' };
    }

    const dates = releaseGroups
      .map(rg => rg['first-release-date'])
      .filter(date => date)
      .sort();

    return {
      start: dates[0] || '',
      end: dates.length > 1 ? dates[dates.length - 1] : undefined
    };
  }

  // Phase 2 & 3: Enhanced methods for detailed release information
  
  getEnhancedArtistDiscography(artistId: string): Observable<EnhancedDiscographyData> {
    // Check cache first
    const cached = this.enhancedDiscographyCache.get(artistId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    return this.getArtistDiscography(artistId).pipe(
      map(basicDiscography => this.enhanceDiscographyData(basicDiscography)),
      tap(enhancedDiscography => {
        // Cache the results
        this.enhancedDiscographyCache.set(artistId, { data: enhancedDiscography, timestamp: Date.now() });
        
        // Clean up old cache entries
        this.cleanupCache(this.enhancedDiscographyCache);
      }),
      catchError(this.handleError)
    );
  }

  getReleaseDetails(releaseId: string): Observable<DetailedRelease> {
    // Check cache first
    const cached = this.detailedReleaseCache.get(releaseId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    const params = new HttpParams()
      .set('inc', 'recordings+media+artist-credits+labels')
      .set('fmt', 'json');

    return this.http.get<DetailedRelease>(`${this.baseUrl}/release/${releaseId}`, { params, headers: this.defaultHeaders })
      .pipe(
        delay(1000), // Rate limiting
        map(release => this.enhanceReleaseWithCalculatedData(release)),
        tap(detailedRelease => {
          // Cache the results
          this.detailedReleaseCache.set(releaseId, { data: detailedRelease, timestamp: Date.now() });
          
          // Clean up old cache entries
          this.cleanupCache(this.detailedReleaseCache);
        }),
        catchError(this.handleError)
      );
  }

  getCoverArt(releaseId: string): Observable<CoverArtInfo> {
    // Check cache first
    const cached = this.coverArtCache.get(releaseId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    // Use Cover Art Archive API (no rate limiting needed as it's a different service)
    return this.http.get<CoverArtResponse>(`https://coverartarchive.org/release/${releaseId}`)
      .pipe(
        map(response => ({
          artwork: true,
          count: response.images.length,
          front: response.images.some(img => img.front),
          back: response.images.some(img => img.back),
          images: response.images
        })),
        tap(coverArt => {
          // Cache the results
          this.coverArtCache.set(releaseId, { data: coverArt, timestamp: Date.now() });
          
          // Clean up old cache entries
          this.cleanupCache(this.coverArtCache);
        }),
        catchError(() => {
          // Return empty cover art info if not found
          return of({
            artwork: false,
            count: 0,
            front: false,
            back: false
          });
        })
      );
  }

  private enhanceDiscographyData(basicDiscography: DiscographyData): EnhancedDiscographyData {
    // Calculate additional statistics
    const genres = this.calculateGenreStatistics(basicDiscography.releaseGroups);
    const decades = this.calculateDecadeStatistics(basicDiscography.releaseGroups);
    const collaborations = this.extractCollaborations(basicDiscography.releaseGroups);

    return {
      ...basicDiscography,
      releaseGroups: basicDiscography.releaseGroups.map(rg => ({
        ...rg,
        expanded: false // Initialize UI state
      })) as EnhancedReleaseGroup[],
      genres,
      decades,
      collaborations,
      totalTracks: 0, // Will be calculated when detailed releases are loaded
      totalPlaytime: 0 // Will be calculated when detailed releases are loaded
    };
  }

  private enhanceReleaseWithCalculatedData(release: DetailedRelease): DetailedRelease {
    const totalTracks = release.media?.reduce((sum, medium) => sum + medium['track-count'], 0) || 0;
    const totalLength = release.media?.reduce((sum, medium) => {
      if (!medium.tracks) return sum;
      return sum + medium.tracks.reduce((trackSum, track) => trackSum + (track.length || 0), 0);
    }, 0) || 0;

    return {
      ...release,
      totalTracks,
      totalLength
    };
  }

  private calculateGenreStatistics(releaseGroups: MusicBrainzReleaseGroup[]): Array<{ name: string; count: number; percentage: number }> {
    const genreMap = new Map<string, number>();
    let totalTags = 0;

    releaseGroups.forEach(rg => {
      if (rg.tags) {
        rg.tags.forEach(tag => {
          genreMap.set(tag.name, (genreMap.get(tag.name) || 0) + tag.count);
          totalTags += tag.count;
        });
      }
    });

    const genres = Array.from(genreMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalTags > 0 ? Math.round((count / totalTags) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 genres

    return genres;
  }

  private calculateDecadeStatistics(releaseGroups: MusicBrainzReleaseGroup[]): Array<{ decade: string; count: number; percentage: number }> {
    const decadeMap = new Map<string, number>();

    releaseGroups.forEach(rg => {
      if (rg['first-release-date']) {
        const year = parseInt(rg['first-release-date'].split('-')[0]);
        if (!isNaN(year)) {
          const decade = `${Math.floor(year / 10) * 10}s`;
          decadeMap.set(decade, (decadeMap.get(decade) || 0) + 1);
        }
      }
    });

    const total = releaseGroups.length;
    const decades = Array.from(decadeMap.entries())
      .map(([decade, count]) => ({
        decade,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => a.decade.localeCompare(b.decade));

    return decades;
  }

  private extractCollaborations(releaseGroups: MusicBrainzReleaseGroup[]): CollaborationInfo[] {
    const collaborationMap = new Map<string, CollaborationInfo>();

    releaseGroups.forEach(rg => {
      if (rg['artist-credit'] && rg['artist-credit'].length > 1) {
        rg['artist-credit'].forEach(credit => {
          if (credit.artist) {
            const artistId = credit.artist.id;
            const existing = collaborationMap.get(artistId);
            
            if (existing) {
              existing.releaseCount++;
              existing.releases.push(rg.id);
            } else {
              collaborationMap.set(artistId, {
                artist: credit.artist,
                collaborationType: 'Featured Artist',
                releaseCount: 1,
                releases: [rg.id]
              });
            }
          }
        });
      }
    });

    return Array.from(collaborationMap.values())
      .sort((a, b) => b.releaseCount - a.releaseCount)
      .slice(0, 10); // Top 10 collaborators
  }

  // Label Family Tree methods

  searchLabels(query: string, limit: number = 10): Observable<MusicBrainzLabel[]> {
    const params = new HttpParams()
      .set('query', query)
      .set('limit', limit.toString())
      .set('fmt', 'json');

    return this.http.get<{ labels: MusicBrainzLabel[] }>(`${this.baseUrl}/label`, { params, headers: this.defaultHeaders })
      .pipe(
        delay(1000), // Rate limiting
        map(response => response.labels),
        catchError(this.handleError)
      );
  }

  getLabelRelationships(labelId: string): Observable<LabelTreeNode[]> {
    const cached = this.labelRelationshipCache.get(labelId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    const params = new HttpParams()
      .set('inc', 'label-rels')
      .set('fmt', 'json');

    return this.http.get<MusicBrainzLabel>(`${this.baseUrl}/label/${labelId}`, { params, headers: this.defaultHeaders })
      .pipe(
        delay(1000), // Rate limiting
        map(labelData => this.buildLabelTreeNodes(labelData)),
        tap(nodes => {
          this.labelRelationshipCache.set(labelId, { data: nodes, timestamp: Date.now() });
          this.cleanupCache(this.labelRelationshipCache);
        }),
        catchError(this.handleError)
      );
  }

  getLabelArtists(labelId: string, maxReleases: number = 3000): Observable<ArtistRosterEntry[]> {
    const cacheKey = `${labelId}_${maxReleases}`;
    
    // Check cache first
    const cached = this.labelArtistCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('🔄 Using cached artist roster for label:', labelId);
      return of(cached.data);
    }

    console.log('🔄 Fetching fresh artist roster for label:', labelId);
    return this.getAllLabelReleases(labelId, maxReleases).pipe(
      map(releases => this.extractUniqueArtistsFromReleases(releases, labelId)),
      tap(roster => {
        // Cache the result
        this.labelArtistCache.set(cacheKey, { data: roster, timestamp: Date.now() });
        this.cleanupCache(this.labelArtistCache);
      }),
      catchError(this.handleError)
    );
  }

  private getAllLabelReleases(labelId: string, maxReleases: number = 3000): Observable<MusicBrainzRelease[]> {
    const limit = 100; // Max per request
    
    return this.fetchLabelReleasesRecursively(labelId, 0, limit, maxReleases, []);
  }

  private fetchLabelReleasesRecursively(
    labelId: string, 
    offset: number, 
    limit: number, 
    maxReleases: number, 
    allReleases: MusicBrainzRelease[]
  ): Observable<MusicBrainzRelease[]> {
    const params = new HttpParams()
      .set('label', labelId)
      .set('inc', 'artist-credits')
      .set('limit', limit.toString())
      .set('offset', offset.toString())
      .set('fmt', 'json');

    console.log(`Fetching releases for label ${labelId}, offset: ${offset}, limit: ${limit}`);

    return this.http.get<MusicBrainzReleaseSearchResponse>(`${this.baseUrl}/release`, { 
      params, 
      headers: this.defaultHeaders 
    }).pipe(
      delay(1000), // Rate limiting
      tap(response => {
        console.log(`Received ${response.releases.length} releases, total count: ${response['release-count']}`);
      }),
      switchMap(response => {
        const newReleases = [...allReleases, ...response.releases];
        const totalCount = response['release-count'] || 0;
        const hasMoreData = offset + limit < totalCount && newReleases.length < maxReleases;
        
        console.log(`Current total releases: ${newReleases.length}, hasMoreData: ${hasMoreData}`);
        
        if (hasMoreData) {
          // Recursively fetch next page
          return this.fetchLabelReleasesRecursively(labelId, offset + limit, limit, maxReleases, newReleases);
        } else {
          // Return all collected releases
          console.log(`Finished fetching. Total releases: ${newReleases.length}`);
          return of(newReleases);
        }
      })
    );
  }

  buildLabelFamilyTree(rootLabelId: string, maxDepth: number = 3): Observable<LabelFamilyTree> {
    const cached = this.labelTreeCache.get(rootLabelId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    return this.buildLabelTreeRecursively(rootLabelId, 0, maxDepth).pipe(
      map(rootNode => {
        const totalLabels = this.countLabelsInTree(rootNode);
        const totalArtists = this.countArtistsInTree(rootNode);
        
        const familyTree: LabelFamilyTree = {
          rootLabel: rootNode.label,
          tree: rootNode,
          totalLabels,
          totalArtists,
          maxDepth: this.calculateTreeDepth(rootNode),
          lastUpdated: new Date()
        };

        this.labelTreeCache.set(rootLabelId, { data: familyTree, timestamp: Date.now() });
        this.cleanupCache(this.labelTreeCache);
        
        return familyTree;
      }),
      catchError(this.handleError)
    );
  }

  private buildLabelTreeRecursively(labelId: string, currentDepth: number, maxDepth: number): Observable<LabelTreeNode> {
    if (currentDepth >= maxDepth) {
      return this.getBasicLabelInfo(labelId).pipe(
        map(label => ({
          label,
          children: [],
          depth: currentDepth,
          expanded: false,
          loading: false
        }))
      );
    }

    return this.getBasicLabelInfo(labelId).pipe(
      map(label => ({
        label,
        children: [], // Will be populated by relationships
        depth: currentDepth,
        expanded: currentDepth === 0, // Expand root node by default
        loading: false
      }))
    );
  }

  private getBasicLabelInfo(labelId: string): Observable<MusicBrainzLabel> {
    const params = new HttpParams()
      .set('fmt', 'json');

    return this.http.get<MusicBrainzLabel>(`${this.baseUrl}/label/${labelId}`, { params, headers: this.defaultHeaders })
      .pipe(
        delay(1000), // Rate limiting
        catchError(this.handleError)
      );
  }

  private buildLabelTreeNodes(labelData: any): LabelTreeNode[] {
    // This would build tree nodes from the relationship data in the API response
    // For now, return empty array as the exact structure depends on the actual API response
    return [];
  }

  private extractUniqueArtistsFromReleases(releases: MusicBrainzRelease[], labelId: string): ArtistRosterEntry[] {
    const artistMap = new Map<string, { 
      artist: MusicBrainzArtist; 
      releaseCount: number;
      firstReleaseDate?: string;
      lastReleaseDate?: string;
    }>();

    releases.forEach(release => {
      if (release['artist-credit']) {
        release['artist-credit'].forEach(credit => {
          if (credit.artist) {
            const artistId = credit.artist.id;
            const releaseDate = release.date;
            const existing = artistMap.get(artistId);
            
            if (existing) {
              existing.releaseCount++;
              // Update date range
              if (releaseDate) {
                if (!existing.firstReleaseDate || releaseDate < existing.firstReleaseDate) {
                  existing.firstReleaseDate = releaseDate;
                }
                if (!existing.lastReleaseDate || releaseDate > existing.lastReleaseDate) {
                  existing.lastReleaseDate = releaseDate;
                }
              }
            } else {
              artistMap.set(artistId, {
                artist: credit.artist,
                releaseCount: 1,
                firstReleaseDate: releaseDate,
                lastReleaseDate: releaseDate
              });
            }
          }
        });
      }
    });

    return Array.from(artistMap.values())
      .map(({ artist, releaseCount, firstReleaseDate, lastReleaseDate }) => ({
        artist,
        period: {
          begin: firstReleaseDate || artist['life-span']?.begin,
          end: lastReleaseDate !== firstReleaseDate ? lastReleaseDate : artist['life-span']?.end
        },
        releaseCount,
        relationshipType: this.determineRelationshipType(artist, lastReleaseDate)
      }))
      .sort((a, b) => b.releaseCount - a.releaseCount); // Sort by release count descending
  }

  private determineRelationshipType(artist: MusicBrainzArtist, lastReleaseDate?: string): 'current' | 'former' {
    const currentYear = new Date().getFullYear();
    
    // If artist has ended (disbanded/died), they're former
    if (artist['life-span']?.end) {
      return 'former';
    }
    
    // If no release date info, assume current
    if (!lastReleaseDate) {
      return 'current';
    }
    
    // If last release was within the last 5 years, consider current
    const lastReleaseYear = parseInt(lastReleaseDate.split('-')[0]);
    if (!isNaN(lastReleaseYear) && (currentYear - lastReleaseYear) <= 5) {
      return 'current';
    }
    
    // Otherwise, consider former
    return 'former';
  }

  private buildArtistRosterEntries(artists: MusicBrainzArtist[], labelId: string): ArtistRosterEntry[] {
    return artists.map(artist => ({
      artist,
      period: {
        begin: artist['life-span']?.begin,
        end: artist['life-span']?.end
      },
      releaseCount: 0, // Would need additional API calls to count releases
      relationshipType: 'current'
    }));
  }

  private countLabelsInTree(node: LabelTreeNode): number {
    return 1 + node.children.reduce((sum, child) => sum + this.countLabelsInTree(child), 0);
  }

  private countArtistsInTree(node: LabelTreeNode): number {
    const nodeArtists = node.artistRoster?.length || 0;
    const childArtists = node.children.reduce((sum, child) => sum + this.countArtistsInTree(child), 0);
    return nodeArtists + childArtists;
  }

  private calculateTreeDepth(node: LabelTreeNode): number {
    if (node.children.length === 0) {
      return node.depth;
    }
    return Math.max(...node.children.map(child => this.calculateTreeDepth(child)));
  }

  private aggregateLabels(releases: MusicBrainzRelease[]): LabelWithReleaseCount[] {
    const labelMap = new Map<string, { label: any, count: number }>();

    releases.forEach(release => {
      if (release['label-info'] && release['label-info'].length > 0) {
        release['label-info'].forEach(labelInfo => {
          if (labelInfo.label) {
            const labelId = labelInfo.label.id;
            const existingLabel = labelMap.get(labelId);
            
            if (existingLabel) {
              existingLabel.count++;
            } else {
              // Create a simplified label object from the label-info
              const label = {
                id: labelInfo.label.id,
                name: labelInfo.label.name,
                'sort-name': labelInfo.label['sort-name'] || labelInfo.label.name,
                disambiguation: labelInfo.label.disambiguation || '',
                type: labelInfo.label.type || 'Unknown',
                'type-id': labelInfo.label['type-id'] || '',
                country: '', // Not available in label-info
                'label-code': labelInfo.label['label-code'] || 0,
                'life-span': { begin: '', end: null, ended: false },
                area: { 
                  id: '', name: '', 'sort-name': '', 'type-id': null, 
                  'iso-3166-1-codes': [], disambiguation: '', type: null 
                },
                rating: { 'votes-count': 0, value: 0 },
                aliases: [],
                tags: [],
                isnis: [],
                ipis: []
              };

              labelMap.set(labelId, { label, count: 1 });
            }
          }
        });
      }
    });

    // Convert map to array and sort by release count (descending)
    return Array.from(labelMap.values())
      .map(item => ({
        label: item.label,
        releaseCount: item.count
      }))
      .sort((a, b) => b.releaseCount - a.releaseCount);
  }

  private cleanupCache<T>(cache: Map<string, { data: T, timestamp: number }>): void {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        cache.delete(key);
      }
    }
  }

  private handleError(error: any): Observable<never> {
    console.error('MusicBrainz API Error:', error);
    console.error('Error details:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      message: error.message,
      error: error.error
    });
    
    if (error.status === 503) {
      return throwError(() => new Error('MusicBrainz service is temporarily unavailable. Please try again later.'));
    } else if (error.status === 429) {
      return throwError(() => new Error('Rate limit exceeded. Please wait before making another request.'));
    } else if (error.status === 0) {
      return throwError(() => new Error('Network error. Please check your internet connection. (API requests may be blocked by CORS)'));
    } else if (error.status === 404) {
      return throwError(() => new Error('The requested resource was not found.'));
    } else if (error.status >= 400 && error.status < 500) {
      return throwError(() => new Error(`Client error (${error.status}): ${error.statusText || 'Bad request'}`));
    } else if (error.status >= 500) {
      return throwError(() => new Error(`Server error (${error.status}): ${error.statusText || 'Internal server error'}`));
    } else {
      return throwError(() => new Error(`An error occurred while fetching data from MusicBrainz (${error.status || 'unknown'}): ${error.message || error.statusText || 'Unknown error'}`));
    }
  }
}