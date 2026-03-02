# Data Model: Last.fm Tag-Based Spotify Playlist Creation

## Entities

### PlaylistCreationRequest
**Purpose**: Input data for playlist creation process  
**Fields**:
- `tagName: string` - The Last.fm tag to use for artist discovery
- `playlistName?: string` - Optional custom playlist name (defaults to tag-based name)
- `artistLimit: number` - Number of artists to include (default: 20)
- `tracksPerArtist: number` - Number of tracks per artist (default: 1)

**Validation Rules**:
- tagName: required, non-empty string, max 100 characters
- playlistName: optional string, max 200 characters
- artistLimit: integer, min 1, max 50
- tracksPerArtist: integer, min 1, max 5

### PlaylistCreationProgress
**Purpose**: Real-time progress tracking during playlist creation  
**Fields**:
- `stage: PlaylistCreationStage` - Current stage of the process
- `currentStep: number` - Current step number
- `totalSteps: number` - Total number of steps
- `message: string` - Human-readable status message
- `artistsProcessed: number` - Number of artists processed so far
- `artistsFound: number` - Number of artists successfully found on Spotify
- `errors: PlaylistCreationError[]` - Non-fatal errors encountered

**State Transitions**:
```
FETCHING_ARTISTS -> MATCHING_ARTISTS -> CREATING_PLAYLIST -> ADDING_TRACKS -> COMPLETED | FAILED
```

### PlaylistCreationResult
**Purpose**: Final result of playlist creation process  
**Fields**:
- `success: boolean` - Whether the operation completed successfully
- `playlist?: SpotifyPlaylist` - Created Spotify playlist (if successful)
- `artistsRequested: number` - Number of artists requested
- `artistsFound: number` - Number of artists successfully found and added
- `artistsSkipped: LastfmArtist[]` - Artists that couldn't be found on Spotify
- `errors: PlaylistCreationError[]` - Any errors encountered during the process
- `duration: number` - Total time taken in milliseconds

### PlaylistCreationError
**Purpose**: Structured error information  
**Fields**:
- `type: ErrorType` - Category of error
- `message: string` - Human-readable error message
- `artistName?: string` - Artist name if error is artist-specific
- `code?: string` - API error code if applicable
- `retryable: boolean` - Whether this error could be retried

**Error Types**:
```typescript
enum ErrorType {
  LASTFM_API_ERROR = 'lastfm_api_error',
  SPOTIFY_API_ERROR = 'spotify_api_error',
  ARTIST_NOT_FOUND = 'artist_not_found',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NETWORK_ERROR = 'network_error'
}
```

### LastfmTagArtist (extends existing LastfmArtist)
**Purpose**: Artist data from Last.fm tag endpoint  
**Additional Fields**:
- `tagRank: number` - Rank within the specific tag (1-based)
- `tagRelevance: number` - Relevance score for the tag (0-100)

## Enums

### PlaylistCreationStage
```typescript
enum PlaylistCreationStage {
  FETCHING_ARTISTS = 'fetching_artists',
  MATCHING_ARTISTS = 'matching_artists', 
  CREATING_PLAYLIST = 'creating_playlist',
  ADDING_TRACKS = 'adding_tracks',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
```

## Relationships

### Service Dependencies
- **LastfmService**: Provides `getTopArtistsByTag()` returning `LastfmTagArtist[]`
- **SpotifyService**: Provides playlist creation and track addition methods
- **PlaylistCreationService**: Orchestrates the entire process, manages state

### Data Flow
```
TagName -> LastfmService -> LastfmTagArtist[] -> PlaylistCreationService 
  -> SpotifyService -> PlaylistCreationResult
```

### Progress Updates
```
PlaylistCreationService -> PlaylistCreationProgress signal -> UI Components
```

## Validation & Business Rules

### Artist Matching
- Case-insensitive name matching between Last.fm and Spotify
- Basic normalization (remove "The ", trim whitespace)
- Skip artists not found on Spotify, continue processing

### Playlist Naming
- Default format: "Top {tagName} Artists - {currentDate}"
- User-provided names are validated and sanitized
- Maximum playlist name length: 200 characters

### Error Recovery
- Individual artist failures don't stop the entire process
- Retry logic for transient API errors
- Minimum success threshold: 50% of requested artists must be found

### Rate Limiting
- Respect existing rate limiting infrastructure
- Batch Spotify operations where possible
- Provide estimated completion time to users