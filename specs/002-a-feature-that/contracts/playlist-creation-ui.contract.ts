/**
 * Contract for Enhanced Playlist Creation UI Component
 * Tests must be written first and must FAIL before implementation
 */

import { Observable } from 'rxjs';
import { LastfmTagArtist } from '../../../src/app/models/lastfm.models';
import { PlaylistCreationRequest, PlaylistCreationResult } from '../../../src/app/models/playlist.models';

export interface PlaylistCreationUIContract {
  // State Signals
  readonly isSearching: boolean;
  readonly searchResults: LastfmTagArtist[];
  readonly hasSearched: boolean;
  readonly canSearch: boolean;
  readonly canCreate: boolean;
  
  // Methods
  searchArtists(): void;
  createPlaylist(): void;
  reset(): void;
}

// UI State Transitions
export interface UIStateTransitions {
  // Initial state
  initial: {
    isSearching: false;
    hasSearched: false;
    searchResults: [];
    canSearch: boolean; // depends on form validity
    canCreate: false;
  };
  
  // During search
  searching: {
    isSearching: true;
    hasSearched: false;
    searchResults: [];
    canSearch: false;
    canCreate: false;
  };
  
  // After successful search
  searchCompleted: {
    isSearching: false;
    hasSearched: true;
    searchResults: LastfmTagArtist[]; // non-empty
    canSearch: boolean; // depends on form validity
    canCreate: true;
  };
  
  // After search with no results
  searchEmpty: {
    isSearching: false;
    hasSearched: true;
    searchResults: [];
    canSearch: boolean; // depends on form validity
    canCreate: false;
  };
}

// UI Element Test Contracts
export interface UIElementContracts {
  // Search button
  searchButton: {
    selector: '[data-testid="search-artists"]';
    enabledWhen: 'tagName field is valid and not searching/creating';
    textWhenIdle: 'Search Artists';
    textWhenSearching: 'Searching...';
    hasSpinnerWhen: 'isSearching() is true';
  };
  
  // Create playlist button
  createButton: {
    selector: '[data-testid="create-playlist"]';
    enabledWhen: 'hasSearched() && searchResults().length > 0 && !isCreating()';
    visibleWhen: 'hasSearched() && searchResults().length > 0';
    text: 'Create Playlist';
  };
  
  // Search results container
  searchResults: {
    selector: '.search-results';
    visibleWhen: 'hasSearched() && searchResults().length > 0';
    containsHeading: 'Found X Artists for "tag"';
  };
  
  // Artist chips
  artistChips: {
    selector: '.artist-chip';
    count: 'searchResults().length';
    firstChipContains: 'artist name and #1 rank';
  };
  
  // No results message
  noResults: {
    selector: '.no-results';
    visibleWhen: 'hasSearched() && searchResults().length === 0';
    containsText: 'No artists found';
  };
}

// Component Event Contracts
export interface ComponentEventContracts {
  // Search initiation
  searchStart: {
    trigger: 'searchArtists() method called';
    precondition: 'canSearch() returns true';
    sideEffect: 'isSearching() becomes true';
  };
  
  // Search completion
  searchSuccess: {
    trigger: 'lastfmService.getTopArtistsByTag() emits results';
    postcondition: 'searchResults() populated, hasSearched() true, isSearching() false';
  };
  
  // Search error
  searchError: {
    trigger: 'lastfmService.getTopArtistsByTag() throws error';
    postcondition: 'error message shown, isSearching() false';
  };
  
  // Playlist creation start
  createStart: {
    trigger: 'createPlaylist() method called';
    precondition: 'canCreate() returns true';
    sideEffect: 'existing playlist creation flow continues';
  };
}

// Form Validation Contracts
export interface FormValidationContracts {
  tagName: {
    required: true;
    maxLength: 100;
    enablesSearch: 'when valid';
  };
  
  artistLimit: {
    required: true;
    min: 1;
    max: 50;
    affectsSearch: 'determines number of results fetched';
  };
  
  // Form interactions with search state
  formChanges: {
    duringSearch: 'form fields remain enabled';
    afterSearch: 'form changes reset search state if needed';
  };
}

// Accessibility Contracts
export interface AccessibilityContracts {
  searchButton: {
    ariaLabel: 'Search for artists by tag';
    ariaDescribedBy: 'search status or error message';
    focusable: true;
  };
  
  searchResults: {
    ariaLabel: 'Search results';
    ariaLive: 'polite'; // announces results count
  };
  
  artistChips: {
    role: 'listitem';
    ariaLabel: 'Artist name with ranking';
  };
  
  loadingStates: {
    ariaLive: 'assertive'; // announces loading states
    hasSpinnerText: 'Loading artists...';
  };
}

// Performance Contracts
export interface PerformanceContracts {
  searchResponse: {
    maxTime: 5000; // 5 seconds
    cacheHit: 500; // 0.5 seconds for cached results
  };
  
  uiUpdates: {
    stateChange: 50; // 50ms max for signal updates
    rendering: 100; // 100ms max for DOM updates
  };
  
  memory: {
    searchResults: 10000; // 10KB max for 20 artists
    stateSignals: 1000; // 1KB for component state
  };
}

// Error Handling Contracts
export interface ErrorHandlingContracts {
  searchErrors: {
    networkError: {
      userMessage: 'Unable to connect to Last.fm. Please check your connection.';
      retry: true;
    };
    
    invalidTag: {
      userMessage: 'Please enter a valid tag name.';
      retry: false;
    };
    
    noResults: {
      userMessage: 'No artists found for "tag". Try a different tag.';
      retry: true;
    };
    
    rateLimited: {
      userMessage: 'Too many requests. Please wait a moment and try again.';
      retry: true;
      retryAfter: 'rate limit period';
    };
  };
}

// Integration Test Scenarios
export interface IntegrationTestScenarios {
  happyPath: {
    steps: [
      'Fill tag name',
      'Click search button',
      'Verify results displayed',
      'Click create playlist',
      'Verify creation started'
    ];
    expectedResult: 'Playlist creation begins with searched artists';
  };
  
  noResults: {
    steps: [
      'Fill invalid tag name',
      'Click search button',
      'Verify no results message'
    ];
    expectedResult: 'Create button remains disabled';
  };
  
  searchError: {
    steps: [
      'Mock service error',
      'Fill tag name and search',
      'Verify error handling'
    ];
    expectedResult: 'User-friendly error message shown';
  };
  
  loadingState: {
    steps: [
      'Mock delayed service response',
      'Fill tag and search',
      'Verify loading indicators'
    ];
    expectedResult: 'Loading spinner and text shown during search';
  };
}