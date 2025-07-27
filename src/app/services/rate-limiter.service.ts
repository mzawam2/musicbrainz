import { Injectable } from '@angular/core';
import { Observable, Subject, concatMap, delay, of } from 'rxjs';

export interface QueuedRequest<T> {
  execute: () => Observable<T>;
  subject: Subject<T>;
}

@Injectable({
  providedIn: 'root'
})
export class RateLimiterService {
  private requestQueue: QueuedRequest<any>[] = [];
  private isProcessing = false;
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests

  /**
   * Queues a request to be executed with rate limiting
   * @param requestFn Function that returns an Observable for the HTTP request
   * @returns Observable that emits when the request completes
   */
  queueRequest<T>(requestFn: () => Observable<T>): Observable<T> {
    const subject = new Subject<T>();
    
    const queuedRequest: QueuedRequest<T> = {
      execute: requestFn,
      subject
    };

    this.requestQueue.push(queuedRequest);
    
    if (!this.isProcessing) {
      this.processQueue();
    }

    return subject.asObservable();
  }

  private processQueue(): void {
    if (this.requestQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const nextRequest = this.requestQueue.shift()!;

    // Execute the request with rate limiting
    of(null).pipe(
      delay(this.RATE_LIMIT_DELAY), // Ensure 1 second delay between requests
      concatMap(() => nextRequest.execute())
    ).subscribe({
      next: (result) => {
        nextRequest.subject.next(result);
        nextRequest.subject.complete();
        this.processQueue(); // Process next request
      },
      error: (error) => {
        nextRequest.subject.error(error);
        this.processQueue(); // Continue processing even on error
      }
    });
  }

  /**
   * Gets the current queue length
   */
  getQueueLength(): number {
    return this.requestQueue.length;
  }

  /**
   * Clears all pending requests
   */
  clearQueue(): void {
    this.requestQueue.forEach(request => {
      request.subject.error(new Error('Request cancelled'));
    });
    this.requestQueue = [];
    this.isProcessing = false;
  }
}