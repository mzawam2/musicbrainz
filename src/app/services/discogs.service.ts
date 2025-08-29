import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError, firstValueFrom, delay } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DiscogsAuthConfig,
  DiscogsUser,
  DiscogsRelease,
  DiscogsArtistDetails,
  DiscogsLabelDetails,
  DiscogsMaster,
  DiscogsSearchResult,
  DiscogsSearchParams,
  DiscogsRateLimitInfo,
  DiscogsQueuedRequest,
  DiscogsArtistReleasesResponse
} from '../models/discogs.models';

@Injectable({
  providedIn: 'root'
})
export class DiscogsService {
  private http = inject(HttpClient);
  
  private readonly DISCOGS_API_BASE = environment.discogs.apiUrl;
  
  // Signals for state management
  public isAuthenticated = signal<boolean>(false);
  public currentUser = signal<DiscogsUser | null>(null);
  public rateLimitInfo = signal<DiscogsRateLimitInfo>({ 
    retryAfter: 0, 
    timestamp: 0, 
    isRateLimited: false,
    remaining: 60,
    limit: 60
  });
  
  // Request queue for rate limiting (60 requests per minute)
  private requestQueue: DiscogsQueuedRequest<any>[] = [];
  private isProcessingQueue = false;
  private queueProcessingInterval = 2000; // 30 requests per minute to be more conservative
  
  
  private config: DiscogsAuthConfig = {
    consumerKey: environment.discogs.consumerKey,
    consumerSecret: environment.discogs.consumerSecret,
    apiUrl: environment.discogs.apiUrl
  };

  constructor() {
    // Use simple authentication by default
    this.useSimpleAuth();
  }

  /**
   * Configure Discogs credentials
   */
  configure(config: Partial<DiscogsAuthConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Use simple key/secret authentication for read-only access
   * This bypasses OAuth and works for public data
   */
  useSimpleAuth(): void {
    console.log('🎵 Using simple Discogs authentication for read-only access');
    this.isAuthenticated.set(true);
    // Set a mock user for UI purposes
    this.currentUser.set({
      id: 0,
      username: 'Read-Only Access',
      resource_url: '',
      consumer_name: 'MusicBrainzApp'
    });
  }








  /**
   * Search Discogs database
   */
  searchDatabase(params: DiscogsSearchParams): Observable<DiscogsSearchResult> {
    const searchParams = new HttpParams({ fromObject: this.cleanParams(params) });

    return this.makeAuthenticatedRequest(() =>
      this.http.get<DiscogsSearchResult>(`${this.DISCOGS_API_BASE}/database/search`, {
        headers: this.getAuthHeaders(),
        params: searchParams
      })
    ).pipe(
      catchError(error => {
        console.error('🎵 Search error:', error);
        return of({ results: [], pagination: { page: 1, pages: 0, per_page: 50, items: 0, urls: {} } });
      })
    );
  }

  /**
   * Get release details
   */
  getRelease(id: number): Observable<DiscogsRelease | null> {
    return this.makeAuthenticatedRequest(() =>
      this.http.get<DiscogsRelease>(`${this.DISCOGS_API_BASE}/releases/${id}`, {
        headers: this.getAuthHeaders()
      })
    ).pipe(
      catchError(error => {
        console.error(`🎵 Error fetching release ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Get master release details
   */
  getMaster(id: number): Observable<DiscogsMaster | null> {
    return this.makeAuthenticatedRequest(() =>
      this.http.get<DiscogsMaster>(`${this.DISCOGS_API_BASE}/masters/${id}`, {
        headers: this.getAuthHeaders()
      })
    ).pipe(
      catchError(error => {
        console.error(`🎵 Error fetching master ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Get artist details
   */
  getArtist(id: number): Observable<DiscogsArtistDetails | null> {
    return this.makeAuthenticatedRequest(() =>
      this.http.get<DiscogsArtistDetails>(`${this.DISCOGS_API_BASE}/artists/${id}`, {
        headers: this.getAuthHeaders()
      })
    ).pipe(
      catchError(error => {
        console.error(`🎵 Error fetching artist ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Get artist releases
   */
  getArtistReleases(id: number, sort: 'year' | 'title' | 'format' = 'year', sortOrder: 'asc' | 'desc' = 'asc', page: number = 1, perPage: number = 50): Observable<DiscogsArtistReleasesResponse | null> {
    const params = new HttpParams({
      fromObject: {
        sort: sort,
        sort_order: sortOrder,
        page: page.toString(),
        per_page: perPage.toString()
      }
    });

    return this.makeAuthenticatedRequest(() =>
      this.http.get<DiscogsArtistReleasesResponse>(`${this.DISCOGS_API_BASE}/artists/${id}/releases`, {
        headers: this.getAuthHeaders(),
        params: params
      })
    ).pipe(
      catchError(error => {
        console.error(`🎵 Error fetching artist releases for ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Get label details
   */
  getLabel(id: number): Observable<DiscogsLabelDetails | null> {
    return this.makeAuthenticatedRequest(() =>
      this.http.get<DiscogsLabelDetails>(`${this.DISCOGS_API_BASE}/labels/${id}`, {
        headers: this.getAuthHeaders()
      })
    ).pipe(
      catchError(error => {
        console.error(`🎵 Error fetching label ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Clean parameters object removing undefined/null values
   */
  private cleanParams(params: any): any {
    const cleaned: any = {};
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        cleaned[key] = params[key];
      }
    });
    return cleaned;
  }

  /**
   * Sign out and clear stored auth
   */
  signOut(): void {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
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
      return isNaN(seconds) ? 60 : seconds; // Default to 60 seconds
    }
    return 60; // Default to 60 seconds if header is missing
  }

  /**
   * Create an authenticated HTTP request with rate limiting
   */
  private makeAuthenticatedRequest<T>(requestFn: () => Observable<T>): Observable<T> {
    // Use the queue system for rate limiting
    return new Observable<T>(subscriber => {
      this.queueRequest(requestFn, 'medium').then(
        result => {
          subscriber.next(result);
          subscriber.complete();
        },
        error => {
          subscriber.error(error);
        }
      );
    });
  }

  /**
   * Make a direct URL request (for releases_url from artist details)
   */
  makeDirectUrlRequest<T>(url: string, params?: HttpParams): Observable<T> {
    return this.makeAuthenticatedRequest(() =>
      this.http.get<T>(url, {
        headers: this.getAuthHeaders(),
        params: params
      })
    );
  }

  /**
   * Get authorization headers for API requests
   */
  private getAuthHeaders(): HttpHeaders {
    // Use simple key/secret authentication
    return new HttpHeaders({
      'User-Agent': 'MusicBrainzApp/1.0',
      'Authorization': `Discogs key=${this.config.consumerKey}, secret=${this.config.consumerSecret}`
    });
  }




  /**
   * Get current rate limit status for UI
   */
  getRateLimitStatus(): { 
    remaining: number; 
    limit: number; 
    isRateLimited: boolean; 
    queueLength: number;
  } {
    const rateLimitInfo = this.rateLimitInfo();
    
    return {
      remaining: rateLimitInfo.remaining,
      limit: rateLimitInfo.limit,
      isRateLimited: rateLimitInfo.isRateLimited,
      queueLength: this.requestQueue.length
    };
  }

  /**
   * Queue request for rate limiting
   */
  queueRequest<T>(requestFn: () => Observable<T>, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: DiscogsQueuedRequest<T> = {
        id: Math.random().toString(36).substring(2, 15),
        requestFn: () => firstValueFrom(requestFn()),
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

      console.log(`🎵 Discogs request queued (${priority}). Queue length: ${this.requestQueue.length}`);

      // Process queue with a small delay to avoid immediate processing
      setTimeout(() => this.processQueue(), 100);
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
            // Clear rate limit flag after waiting
            this.rateLimitInfo.set({ retryAfter: 0, timestamp: 0, isRateLimited: false, remaining: 60, limit: 60 });
          }
        }

        const result = await request.requestFn();
        request.resolve(result);

        console.log(`🎵 Discogs request completed. Queue length: ${this.requestQueue.length}`);

        // Add delay between requests to respect rate limits (30 requests per minute = 2000ms)
        await new Promise(resolve => setTimeout(resolve, this.queueProcessingInterval));
      } catch (error: any) {
        // Handle rate limit errors at the queue level
        if (this.isRateLimitError(error)) {
          const retryAfter = this.getRetryAfterSeconds(error);
          
          // Update rate limit info
          this.rateLimitInfo.set({
            retryAfter: retryAfter,
            timestamp: Date.now(),
            isRateLimited: true,
            remaining: 0,
            limit: 60
          });

          console.warn(`🎵 Discogs rate limit hit in queue. Waiting ${retryAfter} seconds before retry`);
          
          // Put the request back at the front of the queue for retry
          this.requestQueue.unshift(request);
          
          // Wait for the retry period
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        } else {
          request.reject(error);
        }
      }
    }

    this.isProcessingQueue = false;
  }
}