/**
 * Contract for Last.fm Service Extensions
 * Tests must be written first and must FAIL before implementation
 */

export interface LastfmServiceContract {
  /**
   * Retrieve top artists for a specific tag from Last.fm
   * @param tag - The Last.fm tag name
   * @param limit - Maximum number of artists to return (default: 20)
   * @param page - Page number for pagination (default: 1)
   * @returns Observable of artists with tag-specific metadata
   */
  getTopArtistsByTag(tag: string, limit?: number, page?: number): Observable<LastfmTagArtist[]>;
}

// Expected Request Format
export interface GetTopArtistsByTagRequest {
  tag: string;
  limit: number;
  page: number;
}

// Expected Response Format
export interface LastfmTagArtist {
  name: string;
  mbid?: string;
  url: string;
  streamable: string;
  image: Array<{
    '#text': string;
    size: string;
  }>;
  tagRank: number;        // Position in tag ranking (1-based)
  tagRelevance: number;   // Relevance score (0-100)
  listeners?: string;
  playcount?: string;
}

// Error Scenarios to Test
export interface LastfmTagErrorScenarios {
  // HTTP 400: Invalid tag name
  invalidTag: {
    input: { tag: '', limit: 20 };
    expectedError: 'Invalid tag parameter';
  };
  
  // HTTP 404: Tag not found
  tagNotFound: {
    input: { tag: 'nonexistent-tag-12345', limit: 20 };
    expectedError: 'Tag not found';
  };
  
  // HTTP 429: Rate limit exceeded
  rateLimitExceeded: {
    input: { tag: 'rock', limit: 20 };
    expectedError: 'Rate limit exceeded';
  };
  
  // Network timeout
  networkTimeout: {
    input: { tag: 'rock', limit: 20 };
    expectedError: 'Request timeout';
  };
}

// Success Scenarios to Test
export interface LastfmTagSuccessScenarios {
  // Valid tag with results
  validTag: {
    input: { tag: 'rock', limit: 20 };
    expectedMinResults: 1;
    expectedMaxResults: 20;
    expectedFields: ['name', 'url', 'tagRank'];
  };
  
  // Tag with fewer than requested artists
  smallTag: {
    input: { tag: 'obscure-genre', limit: 20 };
    expectedMinResults: 1;
    expectedMaxResults: 19;
  };
  
  // Pagination
  pagination: {
    input: { tag: 'rock', limit: 10, page: 2 };
    expectedResults: 10;
    expectedDifferentFrom: 'page 1 results';
  };
}

// Performance Requirements
export interface LastfmTagPerformanceRequirements {
  maxResponseTime: 5000; // 5 seconds
  cacheEnabled: true;
  rateLimitRespected: true;
}