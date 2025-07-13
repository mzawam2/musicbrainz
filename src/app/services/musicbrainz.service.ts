import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, delay, tap } from 'rxjs/operators';
import { 
  MusicBrainzArtistSearchResponse, 
  MusicBrainzReleaseSearchResponse,
  MusicBrainzArtist,
  MusicBrainzRelease,
  LabelWithReleaseCount
} from '../models/musicbrainz.models';

@Injectable({
  providedIn: 'root'
})
export class MusicBrainzService {
  private readonly baseUrl = '/api';
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  
  // Cache for artist searches
  private artistSearchCache = new Map<string, { data: MusicBrainzArtist[], timestamp: number }>();
  
  // Cache for label data
  private labelCache = new Map<string, { data: LabelWithReleaseCount[], timestamp: number }>();

  constructor(private http: HttpClient) {}

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
      .set('fmt', 'json');

    return this.http.get<MusicBrainzArtistSearchResponse>(`${this.baseUrl}/artist`, { params })
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

    return this.http.get<MusicBrainzReleaseSearchResponse>(`${this.baseUrl}/release`, { params })
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
    
    if (error.status === 503) {
      return throwError(() => new Error('MusicBrainz service is temporarily unavailable. Please try again later.'));
    } else if (error.status === 429) {
      return throwError(() => new Error('Rate limit exceeded. Please wait before making another request.'));
    } else if (error.status === 0) {
      return throwError(() => new Error('Network error. Please check your internet connection. (API requests may be blocked by CORS)'));
    } else {
      return throwError(() => new Error('An error occurred while fetching data from MusicBrainz.'));
    }
  }
}