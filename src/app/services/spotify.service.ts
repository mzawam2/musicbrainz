import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap, firstValueFrom, switchMap, expand, reduce, EMPTY, from, throwError } from 'rxjs';
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
    const params = new HttpParams()
      .set('q', query)
      .set('type', 'track')
      .set('limit', limit.toString());

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
  searchAlbums(query: string, limit: number = 20): Observable<SpotifyAlbum[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('type', 'album')
      .set('limit', limit.toString());

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
    const params = new HttpParams()
      .set('limit', limit.toString())
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
                .set('limit', limit.toString())
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
   * Find a Spotify album by artist and album name, then get all its tracks
   */
  getTracksFromAlbum(artistName: string, albumName: string): Observable<SpotifyTrack[]> {
    const searchQuery = `artist:"${artistName}" album:"${albumName}"`;
    
    return this.searchAlbums(searchQuery, 10).pipe(
      switchMap(albums => {
        if (albums.length === 0) {
          console.warn(`No album found for: ${artistName} - ${albumName}`);
          return of([]);
        }
        
        // Find the best matching album (exact name match preferred)
        const exactMatch = albums.find(album => 
          album.name.toLowerCase() === albumName.toLowerCase() &&
          album.artists.some(artist => artist.name.toLowerCase() === artistName.toLowerCase())
        );
        
        const selectedAlbum = exactMatch || albums[0];
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
    const searchQuery = `artist:"${artistName}" album:"${albumName}"`;
    
    return this.searchAlbums(searchQuery, 10).pipe(
      map(albums => {
        if (albums.length === 0) {
          return null;
        }
        
        // Find the best matching album (exact name match preferred)
        const exactMatch = albums.find(album => 
          album.name.toLowerCase() === albumName.toLowerCase() &&
          album.artists.some(artist => artist.name.toLowerCase() === artistName.toLowerCase())
        );
        
        return exactMatch || albums[0];
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
        
        // Get all tracks from the album
        const allAlbumTracks = await firstValueFrom(this.getTracksFromAlbum(release.artistName, release.releaseName));
        
        if (allAlbumTracks.length > 0) {
          // Take the requested number of tracks (or all if requesting more than available)
          const selectedTracks = allAlbumTracks.slice(0, release.trackCount);
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
          console.warn(`No tracks found for ${release.artistName} - ${release.releaseName}, falling back to search`);
          
          // Fallback to original search method if album not found
          const searchQuery = `artist:"${release.artistName}" album:"${release.releaseName}"`;
          const tracks = await firstValueFrom(this.searchTracks(searchQuery, release.trackCount));
          let addedCount = 0;
          let duplicateCount = 0;
          
          for (const track of tracks?.slice(0, release.trackCount) || []) {
            if (!trackUriSet.has(track.uri)) {
              trackUriSet.add(track.uri);
              addedTracks.set(track.uri, `${release.artistName} - ${release.releaseName}`);
              addedCount++;
            } else {
              duplicateCount++;
              console.log(`Skipping duplicate track: "${track.name}" by ${track.artists[0]?.name} (already added from ${addedTracks.get(track.uri)})`);
            }
          }
          
          console.log(`Added ${addedCount} tracks from search for ${release.releaseName} (${duplicateCount} duplicates skipped)`);
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
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
        await firstValueFrom(this.addTracksToPlaylist(playlistId, batch));
        
        // Add delay between batches
        if (i + batchSize < uniqueTrackUris.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
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
   * Handle authorization errors by triggering reauth flow
   */
  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    console.warn('Spotify authorization error detected, clearing auth and redirecting to reauthorize...');
    this.signOut();
    this.initiateAuth();
    return throwError(() => new Error('Authorization expired, redirecting to reauthorize'));
  }

  /**
   * Create an HTTP request with automatic reauth on 401/403 errors
   */
  private makeAuthenticatedRequest<T>(requestFn: () => Observable<T>): Observable<T> {
    return requestFn().pipe(
      catchError(error => {
        if (this.isAuthError(error)) {
          return this.handleAuthError(error);
        }
        return throwError(() => error);
      })
    );
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
}