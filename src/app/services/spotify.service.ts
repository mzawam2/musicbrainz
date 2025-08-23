import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap, firstValueFrom, switchMap, expand, reduce, EMPTY, from, throwError, delay, timer } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SpotifyAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  external_urls: {
    spotify: string;
  };
  tracks: {
    total: number;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    name: string;
  }>;
  external_urls: {
    spotify: string;
  };
  uri: string;
  track_number?: number;
  duration_ms?: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: Array<{
    name: string;
  }>;
  external_urls: {
    spotify: string;
  };
  uri: string;
  total_tracks: number;
}

export interface SpotifyAlbumTracksResponse {
  items: SpotifyTrack[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[];
    total: number;
  };
  albums?: {
    items: SpotifyAlbum[];
    total: number;
  };
}

export interface PlaylistCreationRequest {
  labelName: string;
  releases: Array<{
    artistName: string;
    releaseName: string;
    trackCount: number;
  }>;
  yearFilter?: {
    enabled: boolean;
    startYear?: number | null;
    endYear?: number | null;
  };
}

export interface RateLimitInfo {
  retryAfter: number;
  timestamp: number;
  isRateLimited: boolean;
}

export interface QueuedRequest<T> {
  id: string;
  requestFn: () => Observable<T>;
  priority: 'high' | 'medium' | 'low';
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

@Injectable({
  providedIn: 'root'
})
export class SpotifyService {
  private http = inject(HttpClient);
  
  private readonly SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
  private readonly SPOTIFY_AUTH_BASE = 'https://accounts.spotify.com';
  
  // Signals for state management
  public isAuthenticated = signal<boolean>(false);
  public currentUser = signal<SpotifyUser | null>(null);
  public accessToken = signal<string | null>(null);
  public rateLimitInfo = signal<RateLimitInfo>({ retryAfter: 0, timestamp: 0, isRateLimited: false });
  
  // Request queue for managing API calls
  private requestQueue: QueuedRequest<any>[] = [];
  private isProcessingQueue = false;
  private queueProcessingInterval = 100; // Base interval between requests (ms)
  
  // Rate limit monitoring
  private requestCount = 0;
  private requestCountResetTime = Date.now() + 30000; // 30-second window
  private maxRequestsLogged = false;
  
  private config: SpotifyAuthConfig = {
    clientId: environment.spotify.clientId,
    clientSecret: environment.spotify.clientSecret,
    redirectUri: environment.spotify.redirectUri
  };

  constructor() {
    // Check for existing token on service initialization
    this.loadStoredAuth();
  }

  /**
   * Configure Spotify credentials
   */
  configure(config: Partial<SpotifyAuthConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Initiate Spotify OAuth flow
   */
  initiateAuth(): void {
    const scopes = [
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-private',
      'user-read-email'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: scopes,
      state: this.generateRandomString(16)
    });

    window.location.href = `${this.SPOTIFY_AUTH_BASE}/authorize?${params}`;
  }

  /**
   * Handle OAuth callback with authorization code
   */
  handleAuthCallback(code: string): Observable<boolean> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.config.redirectUri
    });

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`
    });

    return this.http.post<any>(`${this.SPOTIFY_AUTH_BASE}/api/token`, body.toString(), { headers })
      .pipe(
        tap(response => {
          this.accessToken.set(response.access_token);
          this.isAuthenticated.set(true);
          this.storeAuth(response.access_token, response.refresh_token);
          this.loadCurrentUser();
        }),
        map(() => true),
        catchError(error => {
          console.error('Spotify auth error:', error);
          return of(false);
        })
      );
  }

  /**
   * Load current user profile
   */
  private loadCurrentUser(): void {
    this.makeAuthenticatedRequest(() => 
      this.http.get<SpotifyUser>(`${this.SPOTIFY_API_BASE}/me`, {
        headers: this.getAuthHeaders()
      })
    ).subscribe({
      next: user => this.currentUser.set(user),
      error: error => console.error('Failed to load user:', error)
    });
  }

  /**
   * Search for tracks on Spotify
   */
  searchTracks(query: string, limit: number = 20): Observable<SpotifyTrack[]> {
    // Spotify API has a maximum limit of 50 for search results
    const apiLimit = Math.min(limit, 50);
    
    const params = new HttpParams()
      .set('q', query)
      .set('type', 'track')
      .set('limit', apiLimit.toString());

    return this.makeAuthenticatedRequest(() =>
      this.http.get<SpotifySearchResult>(`${this.SPOTIFY_API_BASE}/search`, {
        headers: this.getAuthHeaders(),
        params
      })
    ).pipe(
      map(result => result.tracks.items),
      catchError(error => {
        console.error('Search error:', error);
        return of([]);
      })
    );
  }


  /**
   * Search for albums on Spotify
   */
  searchAlbums(query: string, limit: number = 20, artist?: string): Observable<SpotifyAlbum[]> {
    // Spotify API has a maximum limit of 50 for search results
    const apiLimit = Math.min(limit, 50);
    
    // Construct search query with artist if provided
    let searchQuery = query;
    if (artist) {
      searchQuery = `artist:"${artist}" album:"${query}"`;
    }
    
    const params = new HttpParams()
      .set('q', searchQuery)
      .set('type', 'album')
      .set('limit', apiLimit.toString());

    return this.makeAuthenticatedRequest(() =>
      this.http.get<SpotifySearchResult>(`${this.SPOTIFY_API_BASE}/search`, {
        headers: this.getAuthHeaders(),
        params
      })
    ).pipe(
      map(result => result.albums?.items || []),
      catchError(error => {
        console.error('Album search error:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all tracks from a Spotify album
   */
  getAlbumTracks(albumId: string, limit: number = 50, offset: number = 0): Observable<SpotifyTrack[]> {
    // Spotify API has a maximum limit of 50 for album tracks
    const apiLimit = Math.min(limit, 50);
    
    const params = new HttpParams()
      .set('limit', apiLimit.toString())
      .set('offset', offset.toString());

    return this.makeAuthenticatedRequest(() =>
      this.http.get<SpotifyAlbumTracksResponse>(`${this.SPOTIFY_API_BASE}/albums/${albumId}/tracks`, {
        headers: this.getAuthHeaders(),
        params
      })
    ).pipe(
      expand(response => {
        // If there are more tracks (next page), fetch them recursively
        if (response.next && response.offset + response.limit < response.total) {
          const nextOffset = response.offset + response.limit;
          return this.makeAuthenticatedRequest(() =>
            this.http.get<SpotifyAlbumTracksResponse>(`${this.SPOTIFY_API_BASE}/albums/${albumId}/tracks`, {
              headers: this.getAuthHeaders(),
              params: new HttpParams()
                .set('limit', apiLimit.toString())
                .set('offset', nextOffset.toString())
            })
          );
        }
        return EMPTY;
      }),
      map(response => response.items),
      reduce((allTracks: SpotifyTrack[], tracks: SpotifyTrack[]) => [...allTracks, ...tracks], []),
      catchError(error => {
        console.error('Get album tracks error:', error);
        return of([]);
      })
    );
  }

  /**
   * Normalize artist name for matching (remove 'The', trim, lowercase)
   */
  private normalizeArtistName(name: string): string {
    return name.toLowerCase().replace(/^the\s+/i, '').trim();
  }

  /**
   * Check if artist matches using music-specific multi-strategy approach
   */
  private isArtistMatch(spotifyArtists: Array<{name: string}>, targetArtist: string): boolean {
    const targetNormalized = this.normalizeArtistName(targetArtist);
    
    return spotifyArtists.some(artist => {
      const artistNormalized = this.normalizeArtistName(artist.name);
      
      // Strategy 1: Exact match
      if (artistNormalized === targetNormalized) {
        return true;
      }
      
      // Strategy 2: Direct containment
      if (artistNormalized.includes(targetNormalized) || targetNormalized.includes(artistNormalized)) {
        return true;
      }
      
      // Strategy 3: Handle common music prefixes/suffixes
      const musicVariations = [
        // Remove common collaborations
        artistNormalized.replace(/\s+(feat\.?|featuring|ft\.?|with|&|\+).*/i, ''),
        artistNormalized.replace(/\s+(and|x|vs\.?|versus).*/i, ''),
        // Remove parentheticals and brackets
        artistNormalized.replace(/\s*\([^)]*\)/g, ''),
        artistNormalized.replace(/\s*\[[^\]]*\]/g, '')
      ];
      
      if (musicVariations.some(variation => variation.trim() === targetNormalized)) {
        return true;
      }
      
      // Strategy 4: Core word matching (significant words only)
      const targetWords = targetNormalized.split(/\s+/).filter(w => w.length > 2); // Ignore short words
      const artistWords = artistNormalized.split(/\s+/);
      
      if (targetWords.length > 0) {
        const matchedWords = targetWords.filter(word => 
          artistWords.some(artistWord => artistWord.includes(word) || word.includes(artistWord))
        );
        
        // At least 75% of significant words must match
        return (matchedWords.length / targetWords.length) >= 0.75;
      }
      
      return false;
    });
  }

  /**
   * Find a Spotify album by artist and album name, then get all its tracks
   */
  getTracksFromAlbum(artistName: string, albumName: string): Observable<SpotifyTrack[]> {
    return this.searchAlbums(albumName, 10, artistName).pipe(
      switchMap(albums => {
        if (albums.length === 0) {
          console.log(`No album found with artist search, trying album-only search for: ${albumName}`);
          // Fallback: search by album name only
          return this.searchAlbums(albumName, 20).pipe(
            switchMap(fallbackAlbums => {
              if (fallbackAlbums.length === 0) {
                console.warn(`No album found at all for: ${artistName} - ${albumName}`);
                return of([]);
              }
              
              // Find best matching album by artist similarity
              const matchingAlbum = fallbackAlbums.find(album => 
                this.isArtistMatch(album.artists, artistName)
              );
              
              if (matchingAlbum) {
                console.log(`Found matching album via fallback: ${matchingAlbum.name} by ${matchingAlbum.artists[0]?.name} (multi-strategy match)`);
                return this.getAlbumTracks(matchingAlbum.id);
              } else {
                console.warn(`No artist match found in ${fallbackAlbums.length} albums for: ${artistName} - ${albumName}`);
                return of([]);
              }
            })
          );
        }
        
        const selectedAlbum = albums[0];
        console.log(`Found album: ${selectedAlbum.name} by ${selectedAlbum.artists[0]?.name} (${selectedAlbum.total_tracks} tracks)`);
        
        return this.getAlbumTracks(selectedAlbum.id);
      }),
      catchError(error => {
        console.error(`Failed to get tracks for ${artistName} - ${albumName}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get album information including track count
   */
  getAlbumInfo(artistName: string, albumName: string): Observable<SpotifyAlbum | null> {
    return this.searchAlbums(albumName, 10, artistName).pipe(
      switchMap(albums => {
        if (albums.length === 0) {
          console.log(`No album info found with artist search, trying album-only search for: ${albumName}`);
          // Fallback: search by album name only
          return this.searchAlbums(albumName, 20).pipe(
            map(fallbackAlbums => {
              if (fallbackAlbums.length === 0) {
                console.warn(`No album info found at all for: ${artistName} - ${albumName}`);
                return null;
              }
              
              // Find best matching album by artist similarity
              const matchingAlbum = fallbackAlbums.find(album => 
                this.isArtistMatch(album.artists, artistName)
              );
              
              if (matchingAlbum) {
                console.log(`Found matching album info via fallback: ${matchingAlbum.name} by ${matchingAlbum.artists[0]?.name} (multi-strategy match)`);
                return matchingAlbum;
              } else {
                console.warn(`No artist match found in ${fallbackAlbums.length} albums for album info: ${artistName} - ${albumName}`);
                return null;
              }
            })
          );
        }
        
        return of(albums[0]);
      }),
      catchError(error => {
        console.error(`Failed to get album info for ${artistName} - ${albumName}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Create a new playlist
   */
  createPlaylist(name: string, description: string = '', isPublic: boolean = true): Observable<SpotifyPlaylist | null> {
    const userId = this.currentUser()?.id;
    if (!userId) {
      console.error('Cannot create playlist: User ID not available. Current user:', this.currentUser());
      return of(null);
    }

    const body = {
      name,
      description,
      public: isPublic
    };

    console.log(`Creating playlist "${name}" for user ${userId}`);

    return this.makeAuthenticatedRequest(() =>
      this.http.post<SpotifyPlaylist>(`${this.SPOTIFY_API_BASE}/users/${userId}/playlists`, body, {
        headers: this.getAuthHeaders()
      })
    ).pipe(
      tap(playlist => {
        if (playlist) {
          console.log(`Playlist created successfully: ${playlist.name} (ID: ${playlist.id})`);
        }
      }),
      catchError(error => {
        console.error('Create playlist error:', error);
        console.error('Request details:', { userId, body, headers: this.getAuthHeaders() });
        return of(null);
      })
    );
  }

  /**
   * Add tracks to a playlist
   */
  addTracksToPlaylist(playlistId: string, trackUris: string[]): Observable<boolean> {
    const body = {
      uris: trackUris
    };

    return this.makeAuthenticatedRequest(() =>
      this.http.post(`${this.SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, body, {
        headers: this.getAuthHeaders()
      })
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Add tracks error:', error);
        return of(false);
      })
    );
  }

  /**
   * Create playlist from label releases
   */
  createPlaylistFromLabelReleases(request: PlaylistCreationRequest): Observable<SpotifyPlaylist | null> {
    // Check authentication first
    if (!this.isAuthenticated()) {
      console.error('Not authenticated with Spotify');
      return of(null);
    }

    // Ensure user is loaded
    if (!this.currentUser()) {
      console.log('User not loaded, loading user first...');
      this.loadCurrentUser();
      // Wait a moment for user to load, then retry
      return new Promise(resolve => {
        setTimeout(() => {
          if (this.currentUser()) {
            resolve(this.createPlaylistFromLabelReleases(request));
          } else {
            console.error('Failed to load user information');
            resolve(of(null));
          }
        }, 1000);
      }) as any;
    }

    // Generate playlist name based on year filtering
    let playlistName: string;
    let yearRangeText = '';
    
    if (request.yearFilter?.enabled) {
      const startYear = request.yearFilter.startYear;
      const endYear = request.yearFilter.endYear;
      
      if (startYear && endYear) {
        yearRangeText = `${startYear}-${endYear}`;
      } else if (startYear) {
        yearRangeText = `${startYear}+`;
      } else if (endYear) {
        yearRangeText = `-${endYear}`;
      } else {
        yearRangeText = 'Filtered';
      }
      
      playlistName = `${request.labelName} - ${yearRangeText}`;
    } else {
      playlistName = `${request.labelName} - Label Archive`;
    }

    // Generate description with year range info
    let description = `All of the releases from ${request.labelName}`;
    if (request.yearFilter?.enabled) {
      const startYear = request.yearFilter.startYear;
      const endYear = request.yearFilter.endYear;
      
      if (startYear && endYear) {
        description += ` from ${startYear} to ${endYear}`;
      } else if (startYear) {
        description += ` from ${startYear} onwards`;
      } else if (endYear) {
        description += ` up to ${endYear}`;
      } else {
        description += ` (filtered by year)`;
      }
    }

    console.log(`Creating playlist: ${playlistName} with ${request.releases.length} releases`);
    console.log(`Current user:`, this.currentUser());

    return this.createPlaylist(playlistName, description).pipe(
      switchMap(playlist => {
        if (!playlist) {
          console.error('Failed to create playlist');
          return of(null);
        }
        
        console.log(`Playlist created: ${playlist.name} (ID: ${playlist.id}), now adding tracks...`);
        
        // Convert the promise to observable and wait for completion
        return from(
          this.populatePlaylistFromReleases(playlist.id, request.releases)
            .then(() => {
              console.log('Tracks added successfully to playlist');
              return playlist;
            })
            .catch(error => {
              console.error('Failed to populate playlist with tracks:', error);
              return playlist; // Still return the playlist even if track adding fails
            })
        );
      }),
      catchError(error => {
        console.error('Error in createPlaylistFromLabelReleases:', error);
        return of(null);
      })
    );
  }

  /**
   * Populate playlist with tracks from releases
   */
  private async populatePlaylistFromReleases(
    playlistId: string, 
    releases: Array<{ artistName: string; releaseName: string; trackCount: number }>
  ): Promise<void> {
    const trackUriSet = new Set<string>(); // Use Set to automatically handle deduplication
    const addedTracks = new Map<string, string>(); // Track URI -> Release info for logging

    for (const release of releases) {
      try {
        console.log(`Getting tracks for ${release.artistName} - ${release.releaseName} (requesting ${release.trackCount} tracks)`);
        
        // Get all tracks from the album using queue for rate limiting
        const allAlbumTracks = await this.queueRequest(() => 
          this.getTracksFromAlbum(release.artistName, release.releaseName), 'medium'
        ) as SpotifyTrack[];
        
        if (allAlbumTracks.length > 0) {
          // Take the requested number of tracks (or all tracks if trackCount is 999 or higher)
          const selectedTracks = release.trackCount >= 999 ? allAlbumTracks : allAlbumTracks.slice(0, release.trackCount);
          let addedCount = 0;
          let duplicateCount = 0;
          
          for (const track of selectedTracks) {
            if (!trackUriSet.has(track.uri)) {
              trackUriSet.add(track.uri);
              addedTracks.set(track.uri, `${release.artistName} - ${release.releaseName}`);
              addedCount++;
            } else {
              duplicateCount++;
              console.log(`Skipping duplicate track: "${track.name}" by ${track.artists[0]?.name} (already added from ${addedTracks.get(track.uri)})`);
            }
          }
          
          console.log(`Added ${addedCount} tracks from ${release.releaseName} (${allAlbumTracks.length} total tracks available, ${duplicateCount} duplicates skipped)`);
        } else {
          console.warn(`No tracks found for ${release.artistName} - ${release.releaseName}`);
        }
      } catch (error) {
        console.error(`Failed to find tracks for ${release.artistName} - ${release.releaseName}:`, error);
      }
    }

    const uniqueTrackUris = Array.from(trackUriSet);
    if (uniqueTrackUris.length > 0) {
      console.log(`Adding ${uniqueTrackUris.length} unique tracks to playlist (removed ${releases.reduce((sum, r) => sum + r.trackCount, 0) - uniqueTrackUris.length} duplicates)`);
      
      // Add tracks in batches of 100 (Spotify's limit)
      const batchSize = 100;
      for (let i = 0; i < uniqueTrackUris.length; i += batchSize) {
        const batch = uniqueTrackUris.slice(i, i + batchSize);
        await this.queueRequest(() => 
          this.addTracksToPlaylist(playlistId, batch), 'high'
        ) as boolean;
      }
    }
  }

  /**
   * Sign out and clear stored auth
   */
  signOut(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.clearStoredAuth();
  }

  /**
   * Check if error is an authorization error
   */
  private isAuthError(error: any): boolean {
    return error instanceof HttpErrorResponse && 
           (error.status === 401 || error.status === 403);
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    return error instanceof HttpErrorResponse && error.status === 429;
  }

  /**
   * Extract retry-after value from rate limit error
   */
  private getRetryAfterSeconds(error: HttpErrorResponse): number {
    const retryAfter = error.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      return isNaN(seconds) ? 1 : seconds;
    }
    return 1; // Default to 1 second if header is missing
  }

  /**
   * Handl
   * e rate limit errors with exponential backoff
   */
  private handleRateLimitError<T>(error: HttpErrorResponse, requestFn: () => Observable<T>, attempt: number = 1): Observable<T> {
    const retryAfterSeconds = this.getRetryAfterSeconds(error);
    const maxAttempts = 3;
    
    // Update rate limit info signal
    this.rateLimitInfo.set({
      retryAfter: retryAfterSeconds,
      timestamp: Date.now(),
      isRateLimited: true
    });

    console.warn(`Spotify rate limit hit. Retrying after ${retryAfterSeconds} seconds (attempt ${attempt}/${maxAttempts})`);

    if (attempt >= maxAttempts) {
      console.error('Max retry attempts reached for rate limit');
      return throwError(() => new Error(`Rate limit exceeded after ${maxAttempts} attempts`));
    }

    // Calculate delay with exponential backoff
    const baseDelay = retryAfterSeconds * 1000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Cap at 30 seconds

    return timer(exponentialDelay).pipe(
      switchMap(() => {
        // Clear rate limit flag after delay
        this.rateLimitInfo.set({ retryAfter: 0, timestamp: 0, isRateLimited: false });
        return this.makeAuthenticatedRequestWithRetry(requestFn, attempt + 1);
      })
    );
  }

  /**
   * Handle authorization errors by triggering reauth flow
   */
  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    console.warn('Spotify authorization error detected, clearing auth and redirecting to reauthorize...');
    this.signOut();
    this.initiateAuth();
    return throwError(() => new Error('Authorization expired, redirecting to reauthorize'));
  }

  /**
   * Create an HTTP request with automatic reauth on 401/403 errors and rate limit handling
   */
  private makeAuthenticatedRequest<T>(requestFn: () => Observable<T>): Observable<T> {
    return this.makeAuthenticatedRequestWithRetry(requestFn, 1);
  }

  /**
   * Track request count for monitoring
   */
  private trackRequest(): void {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now > this.requestCountResetTime) {
      this.requestCount = 0;
      this.requestCountResetTime = now + 30000;
      this.maxRequestsLogged = false;
    }
    
    this.requestCount++;
    
    // Log warnings at certain thresholds
    if (this.requestCount === 50 && !this.maxRequestsLogged) {
      console.warn(`Spotify API: Made ${this.requestCount} requests in current 30-second window`);
    } else if (this.requestCount === 80 && !this.maxRequestsLogged) {
      console.warn(`Spotify API: Made ${this.requestCount} requests in current 30-second window - approaching rate limit`);
    } else if (this.requestCount >= 100 && !this.maxRequestsLogged) {
      console.warn(`Spotify API: Made ${this.requestCount} requests in current 30-second window - likely to hit rate limit soon`);
      this.maxRequestsLogged = true;
    }
  }

  /**
   * Internal method for authenticated requests with retry logic
   */
  private makeAuthenticatedRequestWithRetry<T>(requestFn: () => Observable<T>, attempt: number): Observable<T> {
    this.trackRequest();
    
    return requestFn().pipe(
      tap(() => {
        // Log successful request
        console.debug(`Spotify API request successful (${this.requestCount} requests in current window)`);
      }),
      catchError(error => {
        if (this.isAuthError(error)) {
          return this.handleAuthError(error);
        }
        if (this.isRateLimitError(error)) {
          console.warn(`Spotify API rate limit hit after ${this.requestCount} requests`);
          return this.handleRateLimitError(error, requestFn, attempt);
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Add request to queue for batch processing
   */
  private queueRequest<T>(requestFn: () => Observable<T>, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id: this.generateRandomString(8),
        requestFn,
        priority,
        resolve,
        reject
      };

      // Insert based on priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const insertIndex = this.requestQueue.findIndex(req => 
        priorityOrder[req.priority] > priorityOrder[priority]
      );
      
      if (insertIndex === -1) {
        this.requestQueue.push(queuedRequest);
      } else {
        this.requestQueue.splice(insertIndex, 0, queuedRequest);
      }

      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      try {
        // Check if we're currently rate limited
        const rateLimitInfo = this.rateLimitInfo();
        if (rateLimitInfo.isRateLimited) {
          const timeRemaining = rateLimitInfo.retryAfter * 1000 - (Date.now() - rateLimitInfo.timestamp);
          if (timeRemaining > 0) {
            await new Promise(resolve => setTimeout(resolve, timeRemaining));
          }
        }

        const result = await firstValueFrom(this.makeAuthenticatedRequestWithRetry(request.requestFn, 1));
        request.resolve(result);

        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, this.queueProcessingInterval));
      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Get authorization headers for API requests
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.accessToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Store authentication data in localStorage
   */
  private storeAuth(accessToken: string, refreshToken: string): void {
    localStorage.setItem('spotify_access_token', accessToken);
    localStorage.setItem('spotify_refresh_token', refreshToken);
  }

  /**
   * Load stored authentication data
   */
  private loadStoredAuth(): void {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (accessToken) {
      this.accessToken.set(accessToken);
      this.isAuthenticated.set(true);
      this.loadCurrentUser();
    }
  }

  /**
   * Clear stored authentication data
   */
  private clearStoredAuth(): void {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
  }

  /**
   * Generate random string for OAuth state parameter
   */
  private generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Get current rate limit status for UI
   */
  getRateLimitStatus(): { 
    requestCount: number; 
    windowTimeRemaining: number; 
    isRateLimited: boolean; 
    queueLength: number;
  } {
    const now = Date.now();
    const windowTimeRemaining = Math.max(0, this.requestCountResetTime - now);
    
    return {
      requestCount: this.requestCount,
      windowTimeRemaining,
      isRateLimited: this.rateLimitInfo().isRateLimited,
      queueLength: this.requestQueue.length
    };
  }
}