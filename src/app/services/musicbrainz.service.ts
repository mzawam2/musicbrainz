import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';
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

  constructor(private http: HttpClient) {}

  searchArtists(query: string, limit: number = 10): Observable<MusicBrainzArtist[]> {
    const params = new HttpParams()
      .set('query', query)
      .set('limit', limit.toString())
      .set('fmt', 'json');

    return this.http.get<MusicBrainzArtistSearchResponse>(`${this.baseUrl}/artist`, { params })
      .pipe(
        delay(1000), // Rate limiting - MusicBrainz allows 1 request per second
        map(response => response.artists),
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