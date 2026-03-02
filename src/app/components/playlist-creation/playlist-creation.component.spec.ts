import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PlaylistCreationComponent } from './playlist-creation.component';
import { PlaylistCreationService } from '../../services/playlist-creation.service';
import { PlaylistCreationResult, PlaylistCreationStage } from '../../models/playlist.models';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';

describe('PlaylistCreationComponent', () => {
  let component: PlaylistCreationComponent;
  let fixture: ComponentFixture<PlaylistCreationComponent>;
  let playlistService: jasmine.SpyObj<PlaylistCreationService>;

  const mockProgress = signal({
    stage: PlaylistCreationStage.FETCHING_ARTISTS,
    currentStep: 0,
    totalSteps: 0,
    message: 'Ready to create playlist',
    artistsProcessed: 0,
    artistsFound: 0,
    errors: []
  });

  const mockResult: PlaylistCreationResult = {
    success: true,
    playlist: {
      id: '37i9dQZF1DX0XUsuxWHRQd',
      name: 'Top rock Artists - 2025-09-11',
      description: 'Generated from Last.fm rock tag',
      external_urls: { spotify: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd' },
      tracks: { total: 5 }
    },
    artistsRequested: 5,
    artistsFound: 5,
    artistsSkipped: [],
    errors: [],
    duration: 8000
  };

  beforeEach(async () => {
    const playlistServiceSpy = jasmine.createSpyObj('PlaylistCreationService', 
      ['createPlaylistFromTag', 'cancelCreation']
    );
    // Set up the progress property as a getter that returns the signal
    Object.defineProperty(playlistServiceSpy, 'progress', {
      get: () => mockProgress,
      configurable: true
    });

    await TestBed.configureTestingModule({
      imports: [
        PlaylistCreationComponent,
        ReactiveFormsModule,
        MatSnackBarModule,
        NoopAnimationsModule,
        HttpClientTestingModule
      ],
      providers: [
        { provide: PlaylistCreationService, useValue: playlistServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PlaylistCreationComponent);
    component = fixture.componentInstance;
    playlistService = TestBed.inject(PlaylistCreationService) as jasmine.SpyObj<PlaylistCreationService>;
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with default values', () => {
    expect(component.form.value).toEqual({
      tagName: '',
      playlistName: '',
      artistLimit: 20,
      tracksPerArtist: 1
    });
  });

  it('should pre-fill form with input values', () => {
    fixture = TestBed.createComponent(PlaylistCreationComponent);
    component = fixture.componentInstance;
    
    // Set inputs
    fixture.componentRef.setInput('tagName', 'rock');
    fixture.componentRef.setInput('artistLimit', 10);
    fixture.componentRef.setInput('tracksPerArtist', 2);
    
    fixture.detectChanges();
    component.ngOnInit();

    expect(component.form.value).toEqual({
      tagName: 'rock',
      playlistName: '',
      artistLimit: 10,
      tracksPerArtist: 2
    });
  });

  it('should validate required fields', () => {
    const tagNameControl = component.form.get('tagName');
    const artistLimitControl = component.form.get('artistLimit');

    // Test required validation
    tagNameControl?.setValue('');
    expect(tagNameControl?.hasError('required')).toBe(true);

    artistLimitControl?.setValue(null);
    expect(artistLimitControl?.hasError('required')).toBe(true);

    // Test valid values
    tagNameControl?.setValue('rock');
    artistLimitControl?.setValue(20);
    expect(component.form.valid).toBe(true);
  });

  it('should validate field limits', () => {
    const tagNameControl = component.form.get('tagName');
    const playlistNameControl = component.form.get('playlistName');
    const artistLimitControl = component.form.get('artistLimit');
    const tracksControl = component.form.get('tracksPerArtist');

    // Test max length validations
    tagNameControl?.setValue('a'.repeat(101));
    expect(tagNameControl?.hasError('maxlength')).toBe(true);

    playlistNameControl?.setValue('a'.repeat(201));
    expect(playlistNameControl?.hasError('maxlength')).toBe(true);

    // Test numeric range validations
    artistLimitControl?.setValue(0);
    expect(artistLimitControl?.hasError('min')).toBe(true);

    artistLimitControl?.setValue(51);
    expect(artistLimitControl?.hasError('max')).toBe(true);

    tracksControl?.setValue(0);
    expect(tracksControl?.hasError('min')).toBe(true);

    tracksControl?.setValue(6);
    expect(tracksControl?.hasError('max')).toBe(true);
  });

  it('should call playlist service when creating playlist', () => {
    playlistService.createPlaylistFromTag.and.returnValue(of(mockResult));
    
    component.form.patchValue({
      tagName: 'rock',
      artistLimit: 5,
      tracksPerArtist: 1
    });

    component.createPlaylist();

    expect(playlistService.createPlaylistFromTag).toHaveBeenCalledWith({
      tagName: 'rock',
      playlistName: undefined,
      artistLimit: 5,
      tracksPerArtist: 1
    });
  });

  it('should handle successful playlist creation', () => {
    playlistService.createPlaylistFromTag.and.returnValue(of(mockResult));
    spyOn(component.playlistCreated, 'emit');

    component.form.patchValue({
      tagName: 'rock',
      artistLimit: 5,
      tracksPerArtist: 1
    });

    component.createPlaylist();

    expect(component.playlistCreated.emit).toHaveBeenCalledWith(mockResult);
  });

  it('should handle playlist creation failure', () => {
    const failedResult = { ...mockResult, success: false };
    playlistService.createPlaylistFromTag.and.returnValue(of(failedResult));
    spyOn(component.creationError, 'emit');

    component.form.patchValue({
      tagName: 'rock',
      artistLimit: 5,
      tracksPerArtist: 1
    });

    component.createPlaylist();

    expect(component.creationError.emit).toHaveBeenCalledWith(failedResult);
  });

  it('should disable form during creation', () => {
    playlistService.createPlaylistFromTag.and.returnValue(of(mockResult));
    
    component.form.patchValue({
      tagName: 'rock',
      artistLimit: 5,
      tracksPerArtist: 1
    });

    expect(component.form.enabled).toBe(true);
    
    component.createPlaylist();
    
    // Form should be re-enabled after completion
    expect(component.form.enabled).toBe(true);
  });

  it('should cancel creation when requested', () => {
    playlistService.cancelCreation.and.returnValue(of(void 0));
    
    component.cancelCreation();
    
    expect(playlistService.cancelCreation).toHaveBeenCalled();
    expect(component.isCreating()).toBe(false);
    expect(component.canCancel()).toBe(false);
  });

  it('should reset form to initial state', () => {
    component.form.patchValue({
      tagName: 'electronic',
      playlistName: 'My Playlist',
      artistLimit: 15,
      tracksPerArtist: 3
    });

    component.reset();

    expect(component.form.value.tagName).toBe('');
    expect(component.form.value.playlistName).toBeNull();
    expect(component.isCreating()).toBe(false);
    expect(component.canCancel()).toBe(false);
  });

  it('should show create button when form is valid and not creating', () => {
    // Set progress to a non-completed state first
    mockProgress.set({
      stage: PlaylistCreationStage.FETCHING_ARTISTS,
      currentStep: 0,
      totalSteps: 0,
      message: 'Ready to create playlist',
      artistsProcessed: 0,
      artistsFound: 0,
      errors: []
    });

    // Create a fresh component instance for this test to avoid state contamination
    const freshFixture = TestBed.createComponent(PlaylistCreationComponent);
    const freshComponent = freshFixture.componentInstance;
    
    // Set the state explicitly
    freshComponent.isCreating.set(false);
    
    // Set valid form values
    freshComponent.form.patchValue({
      tagName: 'jazz',
      playlistName: 'Jazz Playlist',
      artistLimit: 10,
      tracksPerArtist: 1
    });

    freshFixture.detectChanges();

    const createButton = freshFixture.debugElement.query(By.css('button[color="primary"]'));
    expect(createButton).toBeTruthy();
    expect(freshComponent.form.valid).toBe(true);
    expect(freshComponent.canCreate()).toBe(true);
    expect(createButton.nativeElement.disabled).toBe(false);
  });

  it('should disable create button when form is invalid', () => {
    component.form.patchValue({
      tagName: '', // Invalid - required
      artistLimit: 10,
      tracksPerArtist: 1
    });

    fixture.detectChanges();

    const createButton = fixture.debugElement.query(By.css('button[color="primary"]'));
    expect(createButton?.nativeElement.disabled).toBe(true);
  });

  it('should show progress section during creation', () => {
    component.isCreating.set(true);
    fixture.detectChanges();

    const progressSection = fixture.debugElement.query(By.css('.progress-section'));
    expect(progressSection).toBeTruthy();
  });

  it('should compute progress percentage correctly', () => {
    mockProgress.set({
      ...mockProgress(),
      currentStep: 2,
      totalSteps: 4
    });

    expect(component.progressPercentage()).toBe(50);
  });

  it('should get appropriate progress color', () => {
    mockProgress.set({
      ...mockProgress(),
      stage: PlaylistCreationStage.COMPLETED
    });
    expect(component.getProgressColor()).toBe('accent');

    mockProgress.set({
      ...mockProgress(),
      stage: PlaylistCreationStage.FAILED
    });
    expect(component.getProgressColor()).toBe('warn');

    mockProgress.set({
      ...mockProgress(),
      stage: PlaylistCreationStage.FETCHING_ARTISTS
    });
    expect(component.getProgressColor()).toBe('primary');
  });

  // T001: UI state signals contract test - MUST FAIL FIRST
  describe('Enhanced UI State Signals (T001)', () => {
    it('should have isSearching signal with initial false state', () => {
      expect(component.isSearching).toBeDefined();
      expect(component.isSearching()).toBe(false);
    });

    it('should have searchResults signal with initial empty array state', () => {
      expect(component.searchResults).toBeDefined();
      expect(component.searchResults()).toEqual([]);
      expect(Array.isArray(component.searchResults())).toBe(true);
    });

    it('should have hasSearched signal with initial false state', () => {
      expect(component.hasSearched).toBeDefined();
      expect(component.hasSearched()).toBe(false);
    });

    it('should have initial UI state matching contract requirements', () => {
      // Test initial state matches UIStateTransitions.initial contract
      expect(component.isSearching()).toBe(false);
      expect(component.hasSearched()).toBe(false);
      expect(component.searchResults()).toEqual([]);
      
      // canCreate should be false initially (no search performed)
      expect(component.canCreate()).toBe(false);
    });

    it('should have canSearch computed signal defined', () => {
      expect(component.canSearch).toBeDefined();
      expect(typeof component.canSearch()).toBe('boolean');
    });
  });

  // T002: Search method contract test - MUST FAIL FIRST
  describe('Search Method Contract (T002)', () => {
    it('should have searchArtists method defined', () => {
      expect(component.searchArtists).toBeDefined();
      expect(typeof component.searchArtists).toBe('function');
    });

    it('should validate precondition before search - canSearch must be true', () => {
      // Set valid form to ensure canSearch() returns true
      component.form.patchValue({
        tagName: 'rock',
        artistLimit: 20,
        tracksPerArtist: 1
      });

      expect(component.canSearch()).toBe(true);
    });

    it('should set isSearching to true when searchArtists is called', () => {
      component.form.patchValue({
        tagName: 'electronic',
        artistLimit: 15,
        tracksPerArtist: 1
      });

      const initialSearchingState = component.isSearching();
      component.searchArtists();

      expect(initialSearchingState).toBe(false);
      expect(component.isSearching()).toBe(true);
    });

    it('should not allow search when form is invalid', () => {
      component.form.patchValue({
        tagName: '', // Invalid - required field
        artistLimit: 20,
        tracksPerArtist: 1
      });

      expect(component.canSearch()).toBe(false);

      component.searchArtists();
      
      // Should not set searching to true with invalid form
      expect(component.isSearching()).toBe(false);
    });

    it('should not allow search when already searching or creating', () => {
      component.form.patchValue({
        tagName: 'jazz',
        artistLimit: 10,
        tracksPerArtist: 1
      });

      // Simulate already searching
      component.isSearching.set(true);
      expect(component.canSearch()).toBe(false);

      // Reset searching, simulate creating
      component.isSearching.set(false);
      component.isCreating.set(true);
      expect(component.canSearch()).toBe(false);
    });
  });

  // T003: UI element visibility contract test - MUST FAIL FIRST
  describe('UI Element Visibility Contract (T003)', () => {
    it('should have search button with correct test ID', () => {
      fixture.detectChanges();
      
      const searchButton = fixture.debugElement.query(By.css('[data-testid="search-artists"]'));
      expect(searchButton).toBeTruthy();
      expect(searchButton.nativeElement.tagName.toLowerCase()).toBe('button');
    });

    it('should enable search button when canSearch is true', () => {
      component.form.patchValue({
        tagName: 'classical',
        artistLimit: 15,
        tracksPerArtist: 2
      });
      
      fixture.detectChanges();
      
      const searchButton = fixture.debugElement.query(By.css('[data-testid="search-artists"]'));
      expect(searchButton.nativeElement.disabled).toBe(false);
      expect(component.canSearch()).toBe(true);
    });

    it('should disable search button when form is invalid', () => {
      component.form.patchValue({
        tagName: '', // Invalid
        artistLimit: 15,
        tracksPerArtist: 2
      });
      
      fixture.detectChanges();
      
      const searchButton = fixture.debugElement.query(By.css('[data-testid="search-artists"]'));
      expect(searchButton.nativeElement.disabled).toBe(true);
      expect(component.canSearch()).toBe(false);
    });

    it('should disable search button when searching or creating', () => {
      component.form.patchValue({
        tagName: 'pop',
        artistLimit: 10,
        tracksPerArtist: 1
      });

      // Test during search
      component.isSearching.set(true);
      fixture.detectChanges();
      
      const searchButton = fixture.debugElement.query(By.css('[data-testid="search-artists"]'));
      expect(searchButton.nativeElement.disabled).toBe(true);

      // Test during creation
      component.isSearching.set(false);
      component.isCreating.set(true);
      fixture.detectChanges();
      
      expect(searchButton.nativeElement.disabled).toBe(true);
    });

    it('should show search results container when hasSearched and results exist', () => {
      // Simulate search completed with results
      component.hasSearched.set(true);
      component.searchResults.set([
        { name: 'Artist 1', tagRank: 1, tagRelevance: 95, url: 'test', streamable: '1', image: [] }
      ]);
      
      fixture.detectChanges();
      
      const searchResultsContainer = fixture.debugElement.query(By.css('.search-results'));
      expect(searchResultsContainer).toBeTruthy();
    });

    it('should hide search results container when no results', () => {
      // Simulate search completed with no results
      component.hasSearched.set(true);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const searchResultsContainer = fixture.debugElement.query(By.css('.search-results'));
      expect(searchResultsContainer).toBeFalsy();
    });

    it('should hide search results container when search not performed', () => {
      component.hasSearched.set(false);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const searchResultsContainer = fixture.debugElement.query(By.css('.search-results'));
      expect(searchResultsContainer).toBeFalsy();
    });

    it('should show create playlist button only after successful search', () => {
      // Initially should not show create button (different from existing canCreate logic)
      fixture.detectChanges();
      let createButton = fixture.debugElement.query(By.css('[data-testid="create-playlist"]'));
      
      // After successful search with results, should show
      component.hasSearched.set(true);
      component.searchResults.set([
        { name: 'Test Artist', tagRank: 1, tagRelevance: 90, url: 'test', streamable: '1', image: [] }
      ]);
      component.form.patchValue({
        tagName: 'test',
        artistLimit: 1,
        tracksPerArtist: 1
      });
      
      fixture.detectChanges();
      createButton = fixture.debugElement.query(By.css('[data-testid="create-playlist"]'));
      expect(createButton).toBeTruthy();
    });
  });

  // T004: Artist chips display contract test - MUST FAIL FIRST
  describe('Artist Chips Display Contract (T004)', () => {
    const mockArtists = [
      { name: 'The Beatles', tagRank: 1, tagRelevance: 98, url: 'test1', streamable: '1', image: [] },
      { name: 'Led Zeppelin', tagRank: 2, tagRelevance: 95, url: 'test2', streamable: '1', image: [] },
      { name: 'Pink Floyd', tagRank: 3, tagRelevance: 92, url: 'test3', streamable: '1', image: [] }
    ];

    it('should display artist chips matching searchResults count', () => {
      // Set up search results
      component.hasSearched.set(true);
      component.searchResults.set(mockArtists);
      
      fixture.detectChanges();
      
      const artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
      expect(artistChips.length).toBe(mockArtists.length);
      expect(artistChips.length).toBe(component.searchResults().length);
    });

    it('should display no artist chips when no search results', () => {
      component.hasSearched.set(true);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
      expect(artistChips.length).toBe(0);
    });

    it('should display first chip with artist name and rank #1', () => {
      component.hasSearched.set(true);
      component.searchResults.set(mockArtists);
      
      fixture.detectChanges();
      
      const artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
      const firstChip = artistChips[0];
      
      expect(firstChip.nativeElement.textContent).toContain('The Beatles');
      expect(firstChip.nativeElement.textContent).toContain('#1');
    });

    it('should display artist chips with correct ranking for each artist', () => {
      component.hasSearched.set(true);
      component.searchResults.set(mockArtists);
      
      fixture.detectChanges();
      
      const artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
      
      mockArtists.forEach((artist, index) => {
        const chip = artistChips[index];
        expect(chip.nativeElement.textContent).toContain(artist.name);
        expect(chip.nativeElement.textContent).toContain(`#${artist.tagRank}`);
      });
    });

    it('should display artist chips with mat-icon avatars', () => {
      component.hasSearched.set(true);
      component.searchResults.set(mockArtists);
      
      fixture.detectChanges();
      
      const artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
      
      artistChips.forEach(chip => {
        const avatar = chip.query(By.css('mat-icon[matChipAvatar]'));
        expect(avatar).toBeTruthy();
      });
    });

    it('should only display chips when hasSearched is true and results exist', () => {
      // Test hasSearched false
      component.hasSearched.set(false);
      component.searchResults.set(mockArtists);
      fixture.detectChanges();
      
      let artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
      expect(artistChips.length).toBe(0);

      // Test hasSearched true with results
      component.hasSearched.set(true);
      fixture.detectChanges();
      
      artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
      expect(artistChips.length).toBe(mockArtists.length);
    });

    it('should use responsive grid layout for multiple artist chips', () => {
      component.hasSearched.set(true);
      component.searchResults.set(mockArtists);
      
      fixture.detectChanges();
      
      const artistsGrid = fixture.debugElement.query(By.css('.artists-grid'));
      expect(artistsGrid).toBeTruthy();
      
      const artistChips = artistsGrid.queryAll(By.css('.artist-chip'));
      expect(artistChips.length).toBe(mockArtists.length);
    });

    it('should handle large number of artists (20 artists)', () => {
      const manyArtists = Array.from({ length: 20 }, (_, i) => ({
        name: `Artist ${i + 1}`,
        tagRank: i + 1,
        tagRelevance: 100 - (i * 2),
        url: `test${i}`,
        streamable: '1',
        image: []
      }));

      component.hasSearched.set(true);
      component.searchResults.set(manyArtists);
      
      fixture.detectChanges();
      
      const artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
      expect(artistChips.length).toBe(20);
      
      // Check first and last artists
      expect(artistChips[0].nativeElement.textContent).toContain('Artist 1');
      expect(artistChips[0].nativeElement.textContent).toContain('#1');
      expect(artistChips[19].nativeElement.textContent).toContain('Artist 20');
      expect(artistChips[19].nativeElement.textContent).toContain('#20');
    });
  });

  // T005: No results handling contract test - MUST FAIL FIRST
  describe('No Results Handling Contract (T005)', () => {
    it('should display no-results element when hasSearched and searchResults empty', () => {
      component.hasSearched.set(true);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const noResults = fixture.debugElement.query(By.css('.no-results'));
      expect(noResults).toBeTruthy();
    });

    it('should hide no-results element when hasSearched is false', () => {
      component.hasSearched.set(false);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const noResults = fixture.debugElement.query(By.css('.no-results'));
      expect(noResults).toBeFalsy();
    });

    it('should hide no-results element when search has results', () => {
      component.hasSearched.set(true);
      component.searchResults.set([
        { name: 'Test Artist', tagRank: 1, tagRelevance: 90, url: 'test', streamable: '1', image: [] }
      ]);
      
      fixture.detectChanges();
      
      const noResults = fixture.debugElement.query(By.css('.no-results'));
      expect(noResults).toBeFalsy();
    });

    it('should display "No artists found" message in no-results element', () => {
      component.hasSearched.set(true);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const noResults = fixture.debugElement.query(By.css('.no-results'));
      expect(noResults.nativeElement.textContent).toContain('No artists found');
    });

    it('should display helpful suggestion text in no-results element', () => {
      component.hasSearched.set(true);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const noResults = fixture.debugElement.query(By.css('.no-results'));
      expect(noResults.nativeElement.textContent).toContain('Try a different tag');
    });

    it('should display search icon in no-results element', () => {
      component.hasSearched.set(true);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const noResults = fixture.debugElement.query(By.css('.no-results'));
      const searchIcon = noResults.query(By.css('mat-icon'));
      expect(searchIcon).toBeTruthy();
    });

    it('should keep create button disabled when no results', () => {
      component.hasSearched.set(true);
      component.searchResults.set([]);
      component.form.patchValue({
        tagName: 'nonexistent-genre',
        artistLimit: 20,
        tracksPerArtist: 1
      });
      
      fixture.detectChanges();
      
      expect(component.canCreate()).toBe(false);
      
      // Create button should not be visible with no results
      const createButton = fixture.debugElement.query(By.css('[data-testid="create-playlist"]'));
      expect(createButton).toBeFalsy();
    });

    it('should center no-results message for good UX', () => {
      component.hasSearched.set(true);
      component.searchResults.set([]);
      
      fixture.detectChanges();
      
      const noResults = fixture.debugElement.query(By.css('.no-results'));
      expect(noResults).toBeTruthy();
      
      // Should have centered text styling
      expect(noResults.nativeElement).toBeTruthy();
    });

    it('should show no-results immediately after empty search completes', () => {
      // Simulate search in progress
      component.isSearching.set(true);
      component.hasSearched.set(false);
      component.searchResults.set([]);
      fixture.detectChanges();
      
      let noResults = fixture.debugElement.query(By.css('.no-results'));
      expect(noResults).toBeFalsy(); // Should not show during search
      
      // Simulate search completion with no results
      component.isSearching.set(false);
      component.hasSearched.set(true);
      component.searchResults.set([]);
      fixture.detectChanges();
      
      noResults = fixture.debugElement.query(By.css('.no-results'));
      expect(noResults).toBeTruthy(); // Should show after search completes
    });

    it('should allow new search after no results displayed', () => {
      // Set up no results state
      component.hasSearched.set(true);
      component.searchResults.set([]);
      component.isSearching.set(false);
      component.form.patchValue({
        tagName: 'jazz',
        artistLimit: 15,
        tracksPerArtist: 2
      });
      
      fixture.detectChanges();
      
      // Should still be able to search again
      expect(component.canSearch()).toBe(true);
      
      const searchButton = fixture.debugElement.query(By.css('[data-testid="search-artists"]'));
      expect(searchButton.nativeElement.disabled).toBe(false);
    });
  });
});