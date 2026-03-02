/**
 * Contract for Playlist Creation Service
 * Tests must be written first and must FAIL before implementation
 */

export interface PlaylistCreationServiceContract {
  /**
   * Create a Spotify playlist from a Last.fm tag
   * @param request - Playlist creation parameters
   * @returns Observable that emits progress updates and completes with final result
   */
  createPlaylistFromTag(request: PlaylistCreationRequest): Observable<PlaylistCreationProgress | PlaylistCreationResult>;
  
  /**
   * Get current creation progress signal
   * @returns Signal containing current progress state
   */
  readonly progress: Signal<PlaylistCreationProgress>;
  
  /**
   * Cancel an ongoing playlist creation process
   * @returns Observable that completes when cancellation is finished
   */
  cancelCreation(): Observable<void>;
}

// Request Format
export interface PlaylistCreationRequest {
  tagName: string;
  playlistName?: string;
  artistLimit: number; // default: 20
  tracksPerArtist: number; // default: 1
}

// Progress Updates
export interface PlaylistCreationProgress {
  stage: PlaylistCreationStage;
  currentStep: number;
  totalSteps: number;
  message: string;
  artistsProcessed: number;
  artistsFound: number;
  errors: PlaylistCreationError[];
  estimatedTimeRemaining?: number; // milliseconds
}

export enum PlaylistCreationStage {
  FETCHING_ARTISTS = 'fetching_artists',
  MATCHING_ARTISTS = 'matching_artists',
  CREATING_PLAYLIST = 'creating_playlist', 
  ADDING_TRACKS = 'adding_tracks',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Error Scenarios to Test
export interface PlaylistCreationErrorScenarios {
  // Invalid tag name
  invalidTag: {
    input: { tagName: '', artistLimit: 20 };
    expectedError: 'Tag name is required';
    expectedStage: PlaylistCreationStage.FAILED;
  };
  
  // Last.fm service unavailable
  lastfmUnavailable: {
    input: { tagName: 'rock', artistLimit: 20 };
    expectedError: 'Last.fm service unavailable';
    expectedStage: PlaylistCreationStage.FAILED;
  };
  
  // Spotify service unavailable
  spotifyUnavailable: {
    input: { tagName: 'rock', artistLimit: 20 };
    expectedProgress: {
      stage: PlaylistCreationStage.FETCHING_ARTISTS;
      message: 'Found 20 artists from Last.fm';
    };
    expectedError: 'Spotify service unavailable';
    expectedStage: PlaylistCreationStage.FAILED;
  };
  
  // No artists found for tag
  noArtistsFound: {
    input: { tagName: 'extremely-obscure-tag', artistLimit: 20 };
    expectedError: 'No artists found for tag';
    expectedStage: PlaylistCreationStage.FAILED;
  };
  
  // User cancellation
  userCancellation: {
    input: { tagName: 'rock', artistLimit: 20 };
    cancelAt: PlaylistCreationStage.MATCHING_ARTISTS;
    expectedStage: PlaylistCreationStage.CANCELLED;
  };
}

// Success Scenarios to Test  
export interface PlaylistCreationSuccessScenarios {
  // Complete successful flow
  successfulCreation: {
    input: { tagName: 'rock', artistLimit: 5, tracksPerArtist: 1 };
    expectedProgressStages: [
      PlaylistCreationStage.FETCHING_ARTISTS,
      PlaylistCreationStage.MATCHING_ARTISTS,
      PlaylistCreationStage.CREATING_PLAYLIST,
      PlaylistCreationStage.ADDING_TRACKS,
      PlaylistCreationStage.COMPLETED
    ];
    expectedResult: {
      success: true;
      artistsFound: 5;
      playlist: { name: 'Top rock Artists - [current date]' };
    };
  };
  
  // Partial success (some artists not found)
  partialSuccess: {
    input: { tagName: 'obscure-genre', artistLimit: 10 };
    expectedResult: {
      success: true;
      artistsFound: 6; // some artists not on Spotify
      artistsSkipped: 4;
    };
  };
  
  // Custom playlist name
  customPlaylistName: {
    input: { 
      tagName: 'jazz', 
      playlistName: 'My Jazz Collection',
      artistLimit: 10
    };
    expectedResult: {
      playlist: { name: 'My Jazz Collection' };
    };
  };
  
  // Multiple tracks per artist
  multipleTracksPerArtist: {
    input: { tagName: 'electronic', artistLimit: 5, tracksPerArtist: 3 };
    expectedResult: {
      success: true;
      playlist: { tracks: { total: 15 } }; // 5 artists * 3 tracks
    };
  };
}

// Progress Update Requirements
export interface PlaylistCreationProgressRequirements {
  // Progress updates must be emitted at each stage
  stageUpdates: {
    fetching: 'Fetching top [limit] artists for [tag]...';
    matching: 'Finding artists on Spotify ([processed]/[total])...';
    creating: 'Creating playlist "[name]"...';
    adding: 'Adding tracks to playlist ([processed]/[total] artists)...';
    completed: 'Playlist created successfully with [count] tracks';
  };
  
  // Progress signal must be updated in real-time
  signalUpdates: true;
  
  // Estimated time must be calculated based on progress
  timeEstimation: true;
  
  // Error accumulation without stopping process
  errorAccumulation: true;
}

// Performance Requirements
export interface PlaylistCreationPerformanceRequirements {
  maxCreationTime: 30000; // 30 seconds for 20 artists
  progressUpdateFrequency: 500; // Progress updates every 500ms minimum
  memoryLeakPrevention: true; // Proper cleanup on completion/cancellation
  concurrentRequestLimit: 5; // Max concurrent Spotify API requests
}