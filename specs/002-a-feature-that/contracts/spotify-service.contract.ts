/**
 * Contract for Spotify Service Extensions
 * Tests must be written first and must FAIL before implementation
 */

export interface SpotifyPlaylistServiceContract {
  /**
   * Create a Spotify playlist from a list of artist names
   * @param artists - Array of artist names to include
   * @param playlistName - Name for the created playlist
   * @param description - Optional playlist description
   * @param tracksPerArtist - Number of top tracks per artist (default: 1)
   * @returns Observable of playlist creation result
   */
  createPlaylistFromArtists(
    artists: string[], 
    playlistName: string, 
    description?: string,
    tracksPerArtist?: number
  ): Observable<PlaylistCreationResult>;
  
  /**
   * Search for an artist on Spotify by name
   * @param artistName - Name of the artist to search for
   * @returns Observable of Spotify artist or null if not found
   */
  searchArtistByName(artistName: string): Observable<SpotifyArtist | null>;
  
  /**
   * Get top tracks for a Spotify artist
   * @param artistId - Spotify artist ID
   * @param market - Market code (default: 'US')
   * @param limit - Number of tracks to return (default: 1)
   * @returns Observable of artist's top tracks
   */
  getArtistTopTracks(artistId: string, market?: string, limit?: number): Observable<SpotifyTrack[]>;
}

// Request/Response Formats
export interface CreatePlaylistFromArtistsRequest {
  artists: string[];
  playlistName: string;
  description?: string;
  tracksPerArtist: number;
}

export interface PlaylistCreationResult {
  success: boolean;
  playlist?: SpotifyPlaylist;
  artistsRequested: number;
  artistsFound: number;
  artistsSkipped: string[];
  errors: PlaylistCreationError[];
  duration: number;
}

export interface PlaylistCreationError {
  type: 'artist_not_found' | 'api_error' | 'auth_error' | 'rate_limit' | 'network_error';
  message: string;
  artistName?: string;
  code?: string;
  retryable: boolean;
}

// Error Scenarios to Test
export interface SpotifyPlaylistErrorScenarios {
  // Invalid authentication
  invalidAuth: {
    input: { artists: ['The Beatles'], playlistName: 'Test' };
    expectedError: 'Authentication required';
  };
  
  // Empty artist list
  emptyArtists: {
    input: { artists: [], playlistName: 'Test' };
    expectedError: 'Artist list cannot be empty';
  };
  
  // Invalid playlist name
  invalidPlaylistName: {
    input: { artists: ['The Beatles'], playlistName: '' };
    expectedError: 'Playlist name is required';
  };
  
  // Artist not found on Spotify
  artistNotFound: {
    input: { artists: ['NonexistentArtist12345'], playlistName: 'Test' };
    expectedBehavior: 'Skip artist, continue with others';
  };
  
  // Spotify API rate limit
  rateLimitError: {
    input: { artists: ['The Beatles'], playlistName: 'Test' };
    expectedError: 'Rate limit exceeded';
    expectedRetry: true;
  };
}

// Success Scenarios to Test
export interface SpotifyPlaylistSuccessScenarios {
  // Single artist playlist
  singleArtist: {
    input: { artists: ['The Beatles'], playlistName: 'Beatles Test', tracksPerArtist: 1 };
    expectedResult: {
      success: true;
      artistsFound: 1;
      playlistTracks: 1;
    };
  };
  
  // Multiple artists playlist
  multipleArtists: {
    input: { 
      artists: ['The Beatles', 'Led Zeppelin', 'Pink Floyd'], 
      playlistName: 'Classic Rock Test',
      tracksPerArtist: 2
    };
    expectedResult: {
      success: true;
      artistsFound: 3;
      playlistTracks: 6;
    };
  };
  
  // Mixed results (some artists not found)
  mixedResults: {
    input: { 
      artists: ['The Beatles', 'NonexistentArtist', 'Led Zeppelin'], 
      playlistName: 'Mixed Test' 
    };
    expectedResult: {
      success: true;
      artistsFound: 2;
      artistsSkipped: ['NonexistentArtist'];
    };
  };
  
  // Custom description
  withDescription: {
    input: { 
      artists: ['The Beatles'], 
      playlistName: 'Test',
      description: 'Generated from Last.fm rock tag'
    };
    expectedResult: {
      playlist: { description: 'Generated from Last.fm rock tag' };
    };
  };
}

// Performance Requirements
export interface SpotifyPlaylistPerformanceRequirements {
  maxTimePerArtist: 2000; // 2 seconds per artist search
  maxTotalTime: 30000; // 30 seconds for 20 artists
  batchOperations: true; // Use batch API calls where possible
  rateLimitHandling: true; // Handle 429 responses gracefully
}