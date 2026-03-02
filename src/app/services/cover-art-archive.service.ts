import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Service for constructing Cover Art Archive URLs.
 *
 * Cover Art Archive provides album artwork directly from MusicBrainz release group IDs
 * without requiring API calls or authentication. Images are CDN-backed for fast loading.
 *
 * URL Format: https://coverartarchive.org/release-group/{mbid}/front-{size}
 * Available sizes: 250, 500, 1200 (pixels)
 *
 * @see https://coverartarchive.org/
 */
@Injectable({ providedIn: 'root' })
export class CoverArtArchiveService {
  private http = inject(HttpClient);

  /**
   * Get thumbnail URL for release group (250px).
   * Use this for small displays like release cards and carousels.
   *
   * @param releaseGroupId - MusicBrainz release group ID
   * @returns Cover Art Archive thumbnail URL
   */
  getReleaseGroupThumbnailUrl(releaseGroupId: string): string {
    return `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`;
  }

  /**
   * Get front cover URL with configurable resolution.
   * Use this for modal views and high-resolution displays.
   *
   * @param releaseGroupId - MusicBrainz release group ID
   * @param size - Image size in pixels (250, 500, or 1200)
   * @returns Cover Art Archive front cover URL
   */
  getReleaseGroupFrontCoverUrl(
    releaseGroupId: string,
    size: 250 | 500 | 1200 = 1200
  ): string {
    return `https://coverartarchive.org/release-group/${releaseGroupId}/front-${size}`;
  }

  /**
   * Check if artwork exists for a release group.
   * Optional method for validation if needed.
   *
   * @param releaseGroupId - MusicBrainz release group ID
   * @returns Observable<boolean> - true if artwork exists, false otherwise
   */
  checkArtworkExists(releaseGroupId: string): Observable<boolean> {
    return this.http.head(this.getReleaseGroupThumbnailUrl(releaseGroupId), { observe: 'response' })
      .pipe(
        map(() => true),
        catchError(() => of(false))
      );
  }
}
