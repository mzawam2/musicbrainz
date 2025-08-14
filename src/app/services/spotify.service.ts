import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap, firstValueFrom } from 'rxjs';
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
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[];
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
    this.http.get<SpotifyUser>(`${this.SPOTIFY_API_BASE}/me`, {
      headers: this.getAuthHeaders()
    }).subscribe({
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

    return this.http.get<SpotifySearchResult>(`${this.SPOTIFY_API_BASE}/search`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      map(result => result.tracks.items),
      catchError(error => {
        console.error('Search error:', error);
        return of([]);
      })
    );
  }

  /**
   * Create a new playlist
   */
  createPlaylist(name: string, description: string = '', isPublic: boolean = true): Observable<SpotifyPlaylist | null> {
    const userId = this.currentUser()?.id;
    if (!userId) {
      return of(null);
    }

    const body = {
      name,
      description,
      public: isPublic
    };

    return this.http.post<SpotifyPlaylist>(`${this.SPOTIFY_API_BASE}/users/${userId}/playlists`, body, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(error => {
        console.error('Create playlist error:', error);
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

    return this.http.post(`${this.SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, body, {
      headers: this.getAuthHeaders()
    }).pipe(
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
    const playlistName = `${request.labelName} - Label Playlist`;
    const description = `Curated playlist from ${request.labelName} releases`;

    return this.createPlaylist(playlistName, description).pipe(
      map(playlist => {
        if (playlist) {
          this.populatePlaylistFromReleases(playlist.id, request.releases);
        }
        return playlist;
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
    const allTrackUris: string[] = [];

    for (const release of releases) {
      const searchQuery = `artist:"${release.artistName}" album:"${release.releaseName}"`;
      
      try {
        const tracks = await firstValueFrom(this.searchTracks(searchQuery, release.trackCount));
        const trackUris = tracks?.slice(0, release.trackCount).map(track => track.uri) || [];
        allTrackUris.push(...trackUris);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to find tracks for ${release.artistName} - ${release.releaseName}:`, error);
      }
    }

    if (allTrackUris.length > 0) {
      // Add tracks in batches of 100 (Spotify's limit)
      const batchSize = 100;
      for (let i = 0; i < allTrackUris.length; i += batchSize) {
        const batch = allTrackUris.slice(i, i + batchSize);
        await firstValueFrom(this.addTracksToPlaylist(playlistId, batch));
        
        // Add delay between batches
        if (i + batchSize < allTrackUris.length) {
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