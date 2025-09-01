# Spec Requirements Document

> Spec: Genre-Based Album Discovery
> Created: 2025-08-31

## Overview

Implement Last.fm API integration to enable genre-based album discovery, allowing users to browse top albums by specific genres through artist card tags. This feature will enhance music exploration by providing genre-focused discovery paths that integrate seamlessly with existing Spotify playlist creation functionality.

## User Stories

### Genre-Based Album Exploration

As a music enthusiast, I want to click on genre tags in artist cards to discover top albums in that genre, so that I can explore music beyond individual artists and find new albums that match my interests.

Users can click on any genre tag displayed in artist cards, which will navigate them to a genre-specific album discovery view. The system fetches top albums for that genre from Last.fm API and displays them in a familiar album grid layout, allowing users to explore album details and add discovered albums to their Spotify playlists.

### Playlist Integration for Genre Discovery

As a music collector, I want to add albums discovered through genre browsing directly to my Spotify playlists, so that I can build curated playlists based on specific musical styles and genres.

When browsing albums by genre, users can select multiple albums and add them to existing or new Spotify playlists. The system handles the conversion from album metadata to Spotify track URIs and integrates with the existing playlist creation workflow.

## Spec Scope

1. **Last.fm Integration** - Implement Last.fm API service for fetching top albums by genre tags using tag.getTopAlbums method
2. **Genre Tag Navigation** - Enable clickable genre tags in artist cards that navigate to genre-specific album discovery views  
3. **Album Discovery Interface** - Create genre album browser component displaying albums in grid layout with album art and metadata
4. **Spotify Playlist Integration** - Connect genre-discovered albums to existing Spotify playlist creation functionality
5. **Rate Limiting Management** - Implement 1 request per second rate limiting for Last.fm API calls with appropriate caching strategy

## Out of Scope

- Artist or track discovery by genre (focusing only on albums)
- Last.fm user authentication features
- Genre recommendation algorithms
- Custom genre creation or editing

## Expected Deliverable

1. Users can click genre tags in artist cards and be navigated to a genre album discovery page showing relevant albums
2. Genre album discovery page displays album grid with cover art, titles, and artist information fetched from Last.fm API
3. Users can select discovered albums and successfully add them to Spotify playlists through existing integration