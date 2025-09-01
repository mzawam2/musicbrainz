# Spec Tasks

## Tasks

- [ ] 1. Last.fm Service Integration
  - [ ] 1.1 Write tests for Last.fm service with mock API responses
  - [ ] 1.2 Create Last.fm service with HttpClient integration
  - [ ] 1.3 Implement tag.getTopAlbums API endpoint method
  - [ ] 1.4 Add rate limiting with 1 request per second throttling
  - [ ] 1.5 Implement 5-minute TTL caching strategy
  - [ ] 1.6 Add comprehensive error handling for API failures
  - [ ] 1.7 Create TypeScript interfaces for Last.fm album data models
  - [ ] 1.8 Verify all tests pass

- [ ] 2. Genre Tag Navigation Enhancement
  - [ ] 2.1 Write tests for genre tag click navigation
  - [ ] 2.2 Locate existing artist card genre tag components
  - [ ] 2.3 Convert genre tags to clickable RouterLink elements
  - [ ] 2.4 Add genre album discovery route configuration
  - [ ] 2.5 Implement route parameters for genre names
  - [ ] 2.6 Verify all tests pass

- [ ] 3. Genre Album Discovery Component
  - [ ] 3.1 Write tests for genre album discovery component
  - [ ] 3.2 Create standalone Angular component with album grid layout
  - [ ] 3.3 Implement album data fetching from Last.fm service
  - [ ] 3.4 Add infinite scrolling with pagination support
  - [ ] 3.5 Integrate NgOptimizedImage for album cover lazy loading
  - [ ] 3.6 Add loading states and empty results handling
  - [ ] 3.7 Implement album selection for playlist functionality
  - [ ] 3.8 Verify all tests pass

- [ ] 4. Spotify Playlist Integration
  - [ ] 4.1 Write tests for album-to-playlist conversion
  - [ ] 4.2 Extend existing Spotify service for album handling
  - [ ] 4.3 Implement album-to-track URI conversion logic
  - [ ] 4.4 Integrate with existing playlist creation workflow
  - [ ] 4.5 Add bulk album selection and playlist addition
  - [ ] 4.6 Verify all tests pass

- [ ] 5. API Backend Implementation
  - [ ] 5.1 Write tests for API endpoints
  - [ ] 5.2 Create /api/lastfm/albums/by-genre/:genre endpoint
  - [ ] 5.3 Implement pagination and query parameter handling
  - [ ] 5.4 Add rate limiting middleware for Last.fm API calls
  - [ ] 5.5 Create /api/genres/popular endpoint for genre browsing
  - [ ] 5.6 Implement comprehensive API error handling
  - [ ] 5.7 Verify all tests pass