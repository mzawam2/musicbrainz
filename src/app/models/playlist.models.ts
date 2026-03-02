/**
 * TypeScript interfaces and enums for Last.fm Tag-Based Spotify Playlist Creation
 */

export enum PlaylistCreationStage {
  FETCHING_ARTISTS = 'fetching_artists',
  MATCHING_ARTISTS = 'matching_artists',
  CREATING_PLAYLIST = 'creating_playlist',
  ADDING_TRACKS = 'adding_tracks',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum ErrorType {
  LASTFM_API_ERROR = 'lastfm_api_error',
  SPOTIFY_API_ERROR = 'spotify_api_error',
  ARTIST_NOT_FOUND = 'artist_not_found',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NETWORK_ERROR = 'network_error'
}

export interface PlaylistCreationRequest {
  tagName: string;
  playlistName?: string;
  artistLimit: number;
  tracksPerArtist: number;
}

export interface PlaylistCreationProgress {
  stage: PlaylistCreationStage;
  currentStep: number;
  totalSteps: number;
  message: string;
  artistsProcessed: number;
  artistsFound: number;
  errors: PlaylistCreationError[];
  estimatedTimeRemaining?: number;
}

export interface PlaylistCreationResult {
  success: boolean;
  playlist?: any; // SpotifyPlaylist - will be imported from spotify service
  artistsRequested: number;
  artistsFound: number;
  artistsSkipped: string[];
  errors: PlaylistCreationError[];
  duration: number;
}

export interface PlaylistCreationError {
  type: ErrorType;
  message: string;
  artistName?: string;
  code?: string;
  retryable: boolean;
}