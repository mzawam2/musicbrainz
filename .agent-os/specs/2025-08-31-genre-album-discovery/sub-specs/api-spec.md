# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-31-genre-album-discovery/spec.md

## Endpoints

### GET /api/lastfm/albums/by-genre/:genre

**Purpose:** Fetch top albums for a specific genre from Last.fm API with rate limiting and caching
**Parameters:** 
- `genre` (path parameter): Genre tag name (e.g., "rock", "jazz", "electronic")
- `limit` (query parameter, optional): Number of albums to return (default: 50, max: 200)
- `page` (query parameter, optional): Pagination offset (default: 1)

**Response:** 
```json
{
  "albums": [
    {
      "name": "Album Name",
      "artist": "Artist Name",
      "mbid": "musicbrainz-id-if-available",
      "url": "lastfm-album-url",
      "image": [
        {"#text": "image-url", "size": "small"},
        {"#text": "image-url", "size": "medium"},
        {"#text": "image-url", "size": "large"}
      ],
      "playcount": 12345,
      "rank": 1
    }
  ],
  "meta": {
    "genre": "rock",
    "page": 1,
    "perPage": 50,
    "totalPages": 10,
    "total": 500
  }
}
```

**Errors:** 
- `400 Bad Request`: Invalid genre parameter
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Last.fm API unavailable
- `500 Internal Server Error`: Server processing error

### GET /api/genres/popular

**Purpose:** Fetch list of popular genre tags for genre browsing interface
**Parameters:** None
**Response:**
```json
{
  "genres": [
    {"name": "rock", "count": 125000},
    {"name": "pop", "count": 98000},
    {"name": "electronic", "count": 75000}
  ]
}
```
**Errors:**
- `503 Service Unavailable`: Last.fm API unavailable
- `500 Internal Server Error`: Server processing error