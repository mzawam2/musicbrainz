import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { RateLimiterService } from './rate-limiter.service';
import { LastfmAuthService } from './lastfm-auth.service';
import { 
  LastFmTopAlbumsResponse, 
  LastFmTopTagsResponse, 
  LastFmTag,
  AlbumDiscoveryResult,
  LastFmError,
  LastFmAuthConfig,
  LastFmArtistInfo,
  LastFmArtistInfoResponse,
  LastFmTopTracksResponse,
  LastFmTrack,
  LastFmSimilarArtist,
  LastfmTagArtist,
  LastFmTopArtistsByTagResponse,
  LastFmArtistTopTagsResponse,
  LastFmTagInfo,
  LastFmTagInfoResponse
} from '../models/lastfm.models';

@Injectable({
  providedIn: 'root'
})
export class LastfmService {
  private readonly http = inject(HttpClient);
  private readonly rateLimiter = inject(RateLimiterService);
  private readonly authService = inject(LastfmAuthService);
  
  private readonly config: LastFmAuthConfig = {
    apiKey: environment.lastfm.apiKey,
    sharedSecret: environment.lastfm.sharedSecret,
    apiUrl: environment.lastfm.apiUrl,
    authUrl: environment.lastfm.authUrl,
    callbackUrl: environment.lastfm.callbackUrl
  };
  
  readonly API_BASE_URL = this.config.apiUrl;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  private cache = new Map<string, { data: any; timestamp: number }>();

  /**
   * Fetches top albums for a specific genre/tag
   * @param genre The genre/tag name
   * @param limit Number of results (default: 50)
   * @param page Page number (default: 1)
   * @returns Observable of album discovery results
   */
  getTopAlbumsByGenre(genre: string, limit: number = 50, page: number = 1): Observable<AlbumDiscoveryResult> {
    const cacheKey = `albums-${genre}-${limit}-${page}`;
    
    // Check cache first
    const cached = this.getFromCache<AlbumDiscoveryResult>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'tag.gettopalbums')
      .set('tag', genre)
      .set('api_key', this.config.apiKey)
      .set('format', 'json')
      .set('limit', limit.toString())
      .set('page', page.toString());

    // Queue request through rate limiter
    return this.rateLimiter.queueRequest(() => 
      this.http.get<LastFmTopAlbumsResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => this.transformAlbumResponse(response, genre)),
        tap(result => this.setCache(cacheKey, result)),
        catchError(error => this.handleError(error))
      )
    );
  }

  /**
   * Fetches popular genre tags
   * @param limit Number of tags to fetch (default: 50)
   * @returns Observable of popular tags
   */
  getPopularTags(limit: number = 50): Observable<LastFmTag[]> {
    const cacheKey = `popular-tags-${limit}`;
    
    // Check cache first
    const cached = this.getFromCache<LastFmTag[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'tag.gettoptags')
      .set('api_key', this.config.apiKey)
      .set('format', 'json')
      .set('limit', limit.toString());

    // Queue request through rate limiter
    return this.rateLimiter.queueRequest(() =>
      this.http.get<LastFmTopTagsResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => response.toptags?.tag || []),
        tap(tags => this.setCache(cacheKey, tags)),
        catchError(error => this.handleError(error))
      )
    );
  }

  /**
   * Transforms Last.fm API response to our internal format
   */
  private transformAlbumResponse(response: LastFmTopAlbumsResponse, genre: string): AlbumDiscoveryResult {
    const albums = response.topalbums?.album || [];
    const attr = response.topalbums?.['@attr'] || {
      tag: genre,
      page: '1',
      perPage: '50',
      totalPages: '0',
      total: '0'
    };

    return {
      albums: albums,
      meta: {
        genre: attr.tag,
        page: parseInt(attr.page, 10),
        perPage: parseInt(attr.perPage, 10),
        totalPages: parseInt(attr.totalPages, 10),
        total: parseInt(attr.total, 10)
      }
    };
  }

  /**
   * Handles HTTP and API errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Network error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 0) {
        errorMessage = 'Network error: Unable to connect to Last.fm API';
      } else if (error.error && typeof error.error === 'object' && 'error' in error.error) {
        // Last.fm API error
        const lastfmError = error.error as LastFmError;
        errorMessage = `Last.fm API error ${lastfmError.error}: ${lastfmError.message}`;
      } else {
        errorMessage = `HTTP error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Gets data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data as T;
    }
    // Remove expired cache entry
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Sets data in cache with timestamp
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clears the entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets current cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Fetches artist information using MusicBrainz ID
   * @param mbid MusicBrainz ID of the artist
   * @param lang Language for biography (optional)
   * @returns Observable of artist information
   */
  getArtistInfo(mbid: string, lang: string = 'en'): Observable<LastFmArtistInfo> {
    const cacheKey = `artist-info-${mbid}-${lang}`;
    
    // Check cache first
    const cached = this.getFromCache<LastFmArtistInfo>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'artist.getInfo')
      .set('mbid', mbid)
      .set('api_key', this.config.apiKey)
      .set('format', 'json')
      .set('lang', lang)
      .set('autocorrect', '1');

    // Queue request through rate limiter
    return this.rateLimiter.queueRequest(() =>
      this.http.get<LastFmArtistInfoResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => response.artist || {} as LastFmArtistInfo),
        tap(artistInfo => this.setCache(cacheKey, artistInfo)),
        catchError(this.handleError.bind(this))
      )
    );
  }

  /**
   * Fetches artist information by name (includes similar artists)
   */
  getArtistInfoByName(artistName: string, lang: string = 'en'): Observable<LastFmArtistInfo> {
    const cacheKey = `artist-info-name-${artistName}-${lang}`;

    const cached = this.getFromCache<LastFmArtistInfo>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'artist.getInfo')
      .set('artist', artistName)
      .set('api_key', this.config.apiKey)
      .set('format', 'json')
      .set('lang', lang)
      .set('autocorrect', '1');

    return this.rateLimiter.queueRequest(() =>
      this.http.get<LastFmArtistInfoResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => response.artist || {} as LastFmArtistInfo),
        tap(artistInfo => this.setCache(cacheKey, artistInfo)),
        catchError(this.handleError.bind(this))
      )
    );
  }

  /**
   * Fetch similar artists for a given artist
   */
  getSimilarArtists(artistName: string, limit: number = 20): Observable<LastFmSimilarArtist[]> {
    const cacheKey = `similar-${artistName}-${limit}`;
    const cached = this.getFromCache<LastFmSimilarArtist[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'artist.getSimilar')
      .set('artist', artistName)
      .set('limit', limit.toString())
      .set('autocorrect', '1')
      .set('api_key', this.config.apiKey)
      .set('format', 'json');

    return this.rateLimiter.queueRequest(() =>
      this.http.get<any>(this.API_BASE_URL, { params }).pipe(
        map(response => (response?.similarartists?.artist || []).map((a: any) => ({
          name: a.name as string,
          mbid: a.mbid || undefined,
          url: a.url || '',
          image: a.image || []
        }) as LastFmSimilarArtist)),
        tap(artists => this.setCache(cacheKey, artists)),
        catchError(this.handleError.bind(this))
      )
    );
  }

  /**
   * Fetch top tracks for an artist
   */
  getTopTracks(artistName: string, limit: number = 5): Observable<LastFmTrack[]> {
    const cacheKey = `toptracks-${artistName}-${limit}`;
    const cached = this.getFromCache<LastFmTrack[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'artist.getTopTracks')
      .set('artist', artistName)
      .set('limit', limit.toString())
      .set('autocorrect', '1')
      .set('api_key', this.config.apiKey)
      .set('format', 'json');

    return this.rateLimiter.queueRequest(() =>
      this.http.get<LastFmTopTracksResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => response?.toptracks?.track || []),
        tap(tracks => this.setCache(cacheKey, tracks)),
        catchError(this.handleError.bind(this))
      )
    );
  }

  /**
   * Fetch top tracks for an artist using MusicBrainz ID
   * @param mbid MusicBrainz ID of the artist
   * @param limit Number of tracks to fetch (default: 10)
   * @returns Observable of top tracks
   */
  getTopTracksByMbid(mbid: string, limit: number = 10): Observable<LastFmTrack[]> {
    const cacheKey = `toptracks-mbid-${mbid}-${limit}`;
    const cached = this.getFromCache<LastFmTrack[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'artist.getTopTracks')
      .set('mbid', mbid)
      .set('limit', limit.toString())
      .set('api_key', this.config.apiKey)
      .set('format', 'json');

    return this.rateLimiter.queueRequest(() =>
      this.http.get<LastFmTopTracksResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => response?.toptracks?.track || []),
        tap(tracks => this.setCache(cacheKey, tracks)),
        catchError(this.handleError.bind(this))
      )
    );
  }

  /**
   * Retrieve top artists for a specific tag from Last.fm
   * @param tag - The Last.fm tag name
   * @param limit - Maximum number of artists to return (default: 20)
   * @param page - Page number for pagination (default: 1)
   * @returns Observable of artists with tag-specific metadata
   */
  getTopArtistsByTag(tag: string, limit: number = 20, page: number = 1): Observable<LastfmTagArtist[]> {
    // Validate input
    if (!tag || tag.trim().length === 0) {
      return throwError(() => new Error('Invalid tag parameter'));
    }

    const cacheKey = `topartists-tag-${tag}-${limit}-${page}`;
    const cached = this.getFromCache<LastfmTagArtist[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'tag.gettopartists')
      .set('tag', tag.trim())
      .set('limit', limit.toString())
      .set('page', page.toString())
      .set('api_key', this.config.apiKey)
      .set('format', 'json');

    return this.rateLimiter.queueRequest(() =>
      this.http.get<LastFmTopArtistsByTagResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => {
          const artists = response?.topartists?.artist || [];
          // Transform to include tag ranking and relevance
          return artists.map((artist, index) => ({
            ...artist,
            tagRank: index + 1 + ((page - 1) * limit), // Calculate position based on page
            tagRelevance: Math.max(100 - (index * 2), 10) // Simple relevance calculation
          }));
        }),
        tap(artists => this.setCache(cacheKey, artists)),
        catchError(this.handleError.bind(this))
      )
    );
  }

  /**
   * Get information about a specific tag from Last.fm
   * @param tag - The Last.fm tag name
   * @param lang - Optional language code (ISO 639 alpha-2)
   * @returns Observable of tag information including wiki content
   */
  getTagInfo(tag: string, lang?: string): Observable<LastFmTagInfo> {
    // Validate input
    if (!tag || tag.trim().length === 0) {
      return throwError(() => new Error('Invalid tag parameter'));
    }

    const cacheKey = `tag-info-${tag}-${lang || 'default'}`;
    const cached = this.getFromCache<LastFmTagInfo>(cacheKey);
    if (cached) {
      return of(cached);
    }

    let params = new HttpParams()
      .set('method', 'tag.getinfo')
      .set('tag', tag.trim())
      .set('api_key', this.config.apiKey)
      .set('format', 'json');

    if (lang && lang.trim().length > 0) {
      params = params.set('lang', lang.trim());
    }

    return this.rateLimiter.queueRequest(() =>
      this.http.get<LastFmTagInfoResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => response?.tag),
        tap(tagInfo => this.setCache(cacheKey, tagInfo)),
        catchError(this.handleError.bind(this))
      )
    );
  }

  /**
   * Get top tags for a specific artist from Last.fm
   * @param artistName - Name of the artist to get tags for
   * @param limit - Maximum number of tags to return (default: 10)
   * @returns Observable of tags for the artist
   */
  getArtistTopTags(artistName: string, limit: number = 10): Observable<LastFmTag[]> {
    // Validate input
    if (!artistName || artistName.trim().length === 0) {
      return throwError(() => new Error('Invalid artist name parameter'));
    }

    const cacheKey = `artist-tags-${artistName.toLowerCase()}-${limit}`;
    const cached = this.getFromCache<LastFmTag[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('method', 'artist.gettoptags')
      .set('artist', artistName.trim())
      .set('api_key', this.config.apiKey)
      .set('format', 'json');

    return this.rateLimiter.queueRequest(() =>
      this.http.get<LastFmArtistTopTagsResponse>(this.API_BASE_URL, { params }).pipe(
        map(response => {
          const tags = response?.toptags?.tag || [];
          // Limit the number of tags returned and ensure they have counts
          return tags
            .filter(tag => tag.name && tag.count !== undefined)
            .slice(0, limit)
            .sort((a, b) => (b.count || 0) - (a.count || 0)); // Sort by count descending
        }),
        tap(tags => this.setCache(cacheKey, tags)),
        catchError(this.handleError.bind(this))
      )
    );
  }
}
