import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, throwError, switchMap, map, tap, catchError, timer, takeUntil, Subject } from 'rxjs';
import { LastfmService } from './lastfm.service';
import { SpotifyService } from './spotify.service';
import { 
  PlaylistCreationRequest, 
  PlaylistCreationProgress, 
  PlaylistCreationResult,
  PlaylistCreationStage,
  PlaylistCreationError,
  ErrorType 
} from '../models/playlist.models';

@Injectable({
  providedIn: 'root'
})
export class PlaylistCreationService {
  private readonly lastfmService = inject(LastfmService);
  private readonly spotifyService = inject(SpotifyService);
  
  private readonly cancelationSubject = new Subject<void>();
  
  // Progress signal - reactive state management
  readonly progress = signal<PlaylistCreationProgress>({
    stage: PlaylistCreationStage.FETCHING_ARTISTS,
    currentStep: 0,
    totalSteps: 0,
    message: 'Ready to create playlist',
    artistsProcessed: 0,
    artistsFound: 0,
    errors: []
  });

  /**
   * Create a Spotify playlist from a Last.fm tag
   * @param request - Playlist creation parameters
   * @returns Observable that emits progress updates and completes with final result
   */
  createPlaylistFromTag(request: PlaylistCreationRequest): Observable<PlaylistCreationProgress | PlaylistCreationResult> {
    const startTime = Date.now();
    
    // Reset cancellation subject
    this.cancelationSubject.next();

    // Validation
    const validationError = this.validateRequest(request);
    if (validationError) {
      const errorResult: PlaylistCreationResult = {
        success: false,
        artistsRequested: request.artistLimit,
        artistsFound: 0,
        artistsSkipped: [],
        errors: [validationError],
        duration: Date.now() - startTime
      };
      this.updateProgress(PlaylistCreationStage.FAILED, 1, 1, 'Validation failed', 0, 0, [validationError]);
      return of(errorResult);
    }

    const totalSteps = 4; // Fetch artists, match artists, create playlist, add tracks
    let currentStep = 0;

    // Step 1: Fetch artists from Last.fm
    this.updateProgress(PlaylistCreationStage.FETCHING_ARTISTS, ++currentStep, totalSteps, 
      `Fetching top ${request.artistLimit} artists for "${request.tagName}"...`, 0, 0, []);

    return this.lastfmService.getTopArtistsByTag(request.tagName, request.artistLimit, 1).pipe(
      takeUntil(this.cancelationSubject),
      switchMap(lastfmArtists => {
        if (lastfmArtists.length === 0) {
          const error: PlaylistCreationError = {
            type: ErrorType.LASTFM_API_ERROR,
            message: `No artists found for tag "${request.tagName}"`,
            retryable: false
          };
          const errorResult: PlaylistCreationResult = {
            success: false,
            artistsRequested: request.artistLimit,
            artistsFound: 0,
            artistsSkipped: [],
            errors: [error],
            duration: Date.now() - startTime
          };
          this.updateProgress(PlaylistCreationStage.FAILED, currentStep, totalSteps, 'No artists found', 0, 0, [error]);
          return of(errorResult);
        }

        // Step 2: Create Spotify playlist
        const artistNames = lastfmArtists.map(artist => artist.name);
        const playlistName = request.playlistName || this.generateDefaultPlaylistName(request.tagName);
        const playlistDescription = `Generated from Last.fm "${request.tagName}" tag`;

        this.updateProgress(PlaylistCreationStage.MATCHING_ARTISTS, ++currentStep, totalSteps,
          `Finding artists on Spotify...`, 0, 0, []);

        this.updateProgress(PlaylistCreationStage.CREATING_PLAYLIST, ++currentStep, totalSteps,
          `Creating playlist "${playlistName}"...`, 0, 0, []);

        return this.spotifyService.createPlaylistFromArtists(
          artistNames, 
          playlistName, 
          playlistDescription,
          request.tracksPerArtist
        ).pipe(
          takeUntil(this.cancelationSubject),
          map(spotifyResult => {
            // Step 4: Final result
            this.updateProgress(PlaylistCreationStage.ADDING_TRACKS, ++currentStep, totalSteps,
              `Adding tracks to playlist...`, spotifyResult.artistsRequested, spotifyResult.artistsFound, spotifyResult.errors);

            if (spotifyResult.success) {
              this.updateProgress(PlaylistCreationStage.COMPLETED, totalSteps, totalSteps,
                `Playlist created successfully with ${spotifyResult.playlist?.tracks.total || 0} tracks`, 
                spotifyResult.artistsRequested, spotifyResult.artistsFound, spotifyResult.errors);
            } else {
              this.updateProgress(PlaylistCreationStage.FAILED, currentStep, totalSteps,
                'Playlist creation failed', spotifyResult.artistsRequested, spotifyResult.artistsFound, spotifyResult.errors);
            }

            const finalResult: PlaylistCreationResult = {
              ...spotifyResult,
              duration: Date.now() - startTime
            };

            return finalResult;
          })
        );
      }),
      catchError(error => {
        const playlistError: PlaylistCreationError = {
          type: ErrorType.LASTFM_API_ERROR,
          message: error.message || 'Unknown error occurred',
          retryable: true
        };
        
        const errorResult: PlaylistCreationResult = {
          success: false,
          artistsRequested: request.artistLimit,
          artistsFound: 0,
          artistsSkipped: [],
          errors: [playlistError],
          duration: Date.now() - startTime
        };

        this.updateProgress(PlaylistCreationStage.FAILED, currentStep, totalSteps, 
          'Error occurred during playlist creation', 0, 0, [playlistError]);

        return of(errorResult);
      })
    );
  }

  /**
   * Cancel an ongoing playlist creation process
   * @returns Observable that completes when cancellation is finished
   */
  cancelCreation(): Observable<void> {
    this.cancelationSubject.next();
    this.updateProgress(PlaylistCreationStage.CANCELLED, 0, 0, 'Playlist creation cancelled', 0, 0, []);
    return of(void 0);
  }

  /**
   * Validate playlist creation request
   */
  private validateRequest(request: PlaylistCreationRequest): PlaylistCreationError | null {
    if (!request.tagName || request.tagName.trim().length === 0) {
      return {
        type: ErrorType.LASTFM_API_ERROR,
        message: 'Tag name is required',
        retryable: false
      };
    }

    if (request.tagName.length > 100) {
      return {
        type: ErrorType.LASTFM_API_ERROR,
        message: 'Tag name must be 100 characters or less',
        retryable: false
      };
    }

    if (request.artistLimit < 1 || request.artistLimit > 50) {
      return {
        type: ErrorType.LASTFM_API_ERROR,
        message: 'Artist limit must be between 1 and 50',
        retryable: false
      };
    }

    if (request.tracksPerArtist < 1 || request.tracksPerArtist > 5) {
      return {
        type: ErrorType.LASTFM_API_ERROR,
        message: 'Tracks per artist must be between 1 and 5',
        retryable: false
      };
    }

    if (request.playlistName && request.playlistName.length > 200) {
      return {
        type: ErrorType.SPOTIFY_API_ERROR,
        message: 'Playlist name must be 200 characters or less',
        retryable: false
      };
    }

    return null;
  }

  /**
   * Generate default playlist name based on tag
   */
  private generateDefaultPlaylistName(tagName: string): string {
    return `Top ${tagName} Artists`;
  }

  /**
   * Update progress signal with new state
   */
  private updateProgress(
    stage: PlaylistCreationStage,
    currentStep: number,
    totalSteps: number,
    message: string,
    artistsProcessed: number,
    artistsFound: number,
    errors: PlaylistCreationError[],
    estimatedTimeRemaining?: number
  ): void {
    this.progress.set({
      stage,
      currentStep,
      totalSteps,
      message,
      artistsProcessed,
      artistsFound,
      errors: [...errors], // Create new array to ensure signal change detection
      estimatedTimeRemaining
    });
  }
}