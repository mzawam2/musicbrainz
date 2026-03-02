# Quickstart: Last.fm Tag-Based Spotify Playlist Creation

## Prerequisites
- Angular development environment set up
- Last.fm API authentication configured
- Spotify API authentication configured 
- User authenticated to both Last.fm and Spotify services

## Integration Test Scenarios

### Scenario 1: Enhanced UI Workflow with Search Preview (Happy Path)
**Given**: User is authenticated to both Last.fm and Spotify  
**When**: User enters tag "rock" and requests artist search  
**Then**: System should:
1. Display search results showing 5 rock artists from Last.fm
2. Show artist names with rankings (#1, #2, etc.)
3. Allow user to proceed with playlist creation
4. Find matching artists on Spotify
5. Create playlist named "Top rock Artists - [date]" 
6. Add 1 track per artist to the playlist
7. Return success result with playlist details

**Test Steps**:
```typescript
// 1. Authenticate user to both services
await authService.authenticateLastfm();
await authService.authenticateSpotify();

// 2. Search for artists first (new workflow step)
const searchResults = await lastValueFrom(
  lastfmService.getTopArtistsByTag('rock', 5)
);

expect(searchResults.length).toBeGreaterThan(0);
expect(searchResults[0].tagRank).toBe(1);
expect(searchResults[0].name).toBeDefined();

// 3. Create playlist after user confirms
const request: PlaylistCreationRequest = {
  tagName: 'rock',
  artistLimit: 5,
  tracksPerArtist: 1
};

const result$ = playlistCreationService.createPlaylistFromTag(request);

// 3. Verify progress updates
const progressUpdates: PlaylistCreationProgress[] = [];
result$.pipe(
  filter(update => 'stage' in update)
).subscribe(progress => progressUpdates.push(progress as PlaylistCreationProgress));

// 4. Verify final result
const finalResult = await lastValueFrom(result$.pipe(
  filter(update => 'success' in update),
  take(1)
)) as PlaylistCreationResult;

expect(finalResult.success).toBe(true);
expect(finalResult.artistsFound).toBeGreaterThan(0);
expect(finalResult.playlist).toBeDefined();
expect(finalResult.playlist!.name).toContain('rock');
```

### Scenario 2: Partial Success (Some Artists Not Found)
**Given**: User is authenticated and tag has artists not available on Spotify  
**When**: User requests playlist creation for obscure tag  
**Then**: System should:
1. Skip unavailable artists gracefully
2. Continue with available artists
3. Return success with skipped artist details

**Test Steps**:
```typescript
const request: PlaylistCreationRequest = {
  tagName: 'very-obscure-genre',
  artistLimit: 10,
  tracksPerArtist: 1
};

const finalResult = await lastValueFrom(
  playlistCreationService.createPlaylistFromTag(request).pipe(
    filter(update => 'success' in update),
    take(1)
  )
) as PlaylistCreationResult;

expect(finalResult.success).toBe(true);
expect(finalResult.artistsFound).toBeLessThan(finalResult.artistsRequested);
expect(finalResult.artistsSkipped.length).toBeGreaterThan(0);
expect(finalResult.playlist).toBeDefined();
```

### Scenario 3: Error Handling (Last.fm API Failure)
**Given**: Last.fm API is unavailable or returns error  
**When**: User attempts playlist creation  
**Then**: System should:
1. Provide clear error message
2. Not create empty playlist
3. Allow user to retry later

**Test Steps**:
```typescript
// Mock Last.fm service to return error
spyOn(lastfmService, 'getTopArtistsByTag').and.returnValue(
  throwError(() => new Error('Last.fm API unavailable'))
);

const request: PlaylistCreationRequest = {
  tagName: 'rock',
  artistLimit: 5
};

const finalResult = await lastValueFrom(
  playlistCreationService.createPlaylistFromTag(request).pipe(
    filter(update => 'success' in update),
    take(1),
    catchError(error => of({ success: false, errors: [error] }))
  )
) as PlaylistCreationResult;

expect(finalResult.success).toBe(false);
expect(finalResult.errors.length).toBeGreaterThan(0);
expect(finalResult.playlist).toBeUndefined();
```

### Scenario 4: Progress Tracking
**Given**: User initiates playlist creation for 20 artists  
**When**: Process is running  
**Then**: System should:
1. Emit progress updates for each stage
2. Update progress signal in real-time
3. Provide estimated completion time

**Test Steps**:
```typescript
const request: PlaylistCreationRequest = {
  tagName: 'electronic',
  artistLimit: 20,
  tracksPerArtist: 1
};

const progressUpdates: PlaylistCreationProgress[] = [];
const progressSignalValues: PlaylistCreationProgress[] = [];

// Track progress signal changes
effect(() => {
  progressSignalValues.push(playlistCreationService.progress());
});

// Track stream progress updates
playlistCreationService.createPlaylistFromTag(request).pipe(
  filter(update => 'stage' in update),
  takeUntil(timer(30000)) // 30 second timeout
).subscribe(progress => {
  progressUpdates.push(progress as PlaylistCreationProgress);
});

await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for some progress

expect(progressUpdates.length).toBeGreaterThan(0);
expect(progressSignalValues.length).toBeGreaterThan(0);
expect(progressUpdates[0].stage).toBe(PlaylistCreationStage.FETCHING_ARTISTS);
expect(progressUpdates[0].message).toContain('Fetching');
```

### Scenario 5: Cancellation
**Given**: User starts playlist creation  
**When**: User cancels during processing  
**Then**: System should:
1. Stop processing gracefully
2. Clean up any partial progress
3. Not create incomplete playlist

**Test Steps**:
```typescript
const request: PlaylistCreationRequest = {
  tagName: 'jazz',
  artistLimit: 15,
  tracksPerArtist: 1
};

// Start creation
const creation$ = playlistCreationService.createPlaylistFromTag(request);
const subscription = creation$.subscribe();

// Cancel after 2 seconds
setTimeout(() => {
  playlistCreationService.cancelCreation().subscribe(() => {
    subscription.unsubscribe();
  });
}, 2000);

// Wait for cancellation to complete
await new Promise(resolve => setTimeout(resolve, 3000));

// Verify no playlist was created
const currentProgress = playlistCreationService.progress();
expect(currentProgress.stage).toBe(PlaylistCreationStage.CANCELLED);
```

## Enhanced UI Component Integration Tests

### UI Search Workflow Test
**Purpose**: Verify the enhanced playlist creation component workflow with search step

```typescript
describe('PlaylistCreationComponent Enhanced Workflow', () => {
  it('should complete search -> preview -> create workflow', async () => {
    const component = fixture.componentInstance;
    
    // 1. Fill in tag name
    const tagInput = fixture.debugElement.query(By.css('[formControlName="tagName"]'));
    tagInput.nativeElement.value = 'rock';
    tagInput.nativeElement.dispatchEvent(new Event('input'));
    
    // 2. Click search button
    const searchButton = fixture.debugElement.query(By.css('[data-testid="search-artists"]'));
    expect(searchButton.nativeElement.disabled).toBe(false);
    searchButton.nativeElement.click();
    
    fixture.detectChanges();
    await fixture.whenStable();
    
    // 3. Verify search results are displayed
    expect(component.searchResults().length).toBeGreaterThan(0);
    expect(component.hasSearched()).toBe(true);
    expect(component.isSearching()).toBe(false);
    
    // 4. Verify artist chips are shown
    const artistChips = fixture.debugElement.queryAll(By.css('.artist-chip'));
    expect(artistChips.length).toBeGreaterThan(0);
    expect(artistChips[0].nativeElement.textContent).toContain('#1');
    
    // 5. Create button should now be enabled
    const createButton = fixture.debugElement.query(By.css('[data-testid="create-playlist"]'));
    expect(createButton.nativeElement.disabled).toBe(false);
    
    // 6. Click create playlist
    createButton.nativeElement.click();
    
    fixture.detectChanges();
    await fixture.whenStable();
    
    // 7. Verify playlist creation started
    expect(component.isCreating()).toBe(true);
  });
  
  it('should handle no search results gracefully', async () => {
    // Mock service to return empty results
    spyOn(lastfmService, 'getTopArtistsByTag').and.returnValue(of([]));
    
    const component = fixture.componentInstance;
    
    // Fill in tag and search
    const tagInput = fixture.debugElement.query(By.css('[formControlName="tagName"]'));
    tagInput.nativeElement.value = 'nonexistent-tag';
    tagInput.nativeElement.dispatchEvent(new Event('input'));
    
    const searchButton = fixture.debugElement.query(By.css('[data-testid="search-artists"]'));
    searchButton.nativeElement.click();
    
    fixture.detectChanges();
    await fixture.whenStable();
    
    // Verify no results state
    expect(component.searchResults().length).toBe(0);
    expect(component.hasSearched()).toBe(true);
    
    // Verify no results message is shown
    const noResultsElement = fixture.debugElement.query(By.css('.no-results'));
    expect(noResultsElement).toBeTruthy();
    expect(noResultsElement.nativeElement.textContent).toContain('No artists found');
    
    // Create button should be disabled
    const createButton = fixture.debugElement.query(By.css('[data-testid="create-playlist"]'));
    expect(createButton.nativeElement.disabled).toBe(true);
  });
  
  it('should show loading state during search', async () => {
    // Create delayed observable to test loading state
    const delayedResults = of([]).pipe(delay(1000));
    spyOn(lastfmService, 'getTopArtistsByTag').and.returnValue(delayedResults);
    
    const component = fixture.componentInstance;
    
    const tagInput = fixture.debugElement.query(By.css('[formControlName="tagName"]'));
    tagInput.nativeElement.value = 'rock';
    tagInput.nativeElement.dispatchEvent(new Event('input'));
    
    const searchButton = fixture.debugElement.query(By.css('[data-testid="search-artists"]'));
    searchButton.nativeElement.click();
    
    fixture.detectChanges();
    
    // Verify loading state
    expect(component.isSearching()).toBe(true);
    
    // Button should show loading text and spinner
    expect(searchButton.nativeElement.textContent).toContain('Searching');
    const spinner = fixture.debugElement.query(By.css('mat-spinner'));
    expect(spinner).toBeTruthy();
    
    // Wait for completion
    await fixture.whenStable();
    fixture.detectChanges();
    
    expect(component.isSearching()).toBe(false);
  });
});
```

### UI Component Test
**Purpose**: Verify the playlist creation component integrates properly with services

```typescript
@Component({
  template: `
    <playlist-creation 
      [tagName]="'rock'"
      [artistLimit]="10"
      (playlistCreated)="onPlaylistCreated($event)"
      (creationError)="onCreationError($event)">
    </playlist-creation>
  `
})
class TestHostComponent {
  playlistResult?: PlaylistCreationResult;
  error?: PlaylistCreationError;
  
  onPlaylistCreated(result: PlaylistCreationResult) {
    this.playlistResult = result;
  }
  
  onCreationError(error: PlaylistCreationError) {
    this.error = error;
  }
}

// Test component integration
const fixture = TestBed.createComponent(TestHostComponent);
const component = fixture.componentInstance;
fixture.detectChanges();

// Trigger playlist creation via UI
const createButton = fixture.debugElement.query(By.css('[data-testid="create-playlist"]'));
createButton.nativeElement.click();

// Wait for completion
await fixture.whenStable();

expect(component.playlistResult?.success).toBe(true);
expect(component.error).toBeUndefined();
```

## Performance Validation

### Load Test
**Purpose**: Verify performance under realistic conditions

```typescript
describe('Playlist Creation Performance', () => {
  it('should complete within 30 seconds for 20 artists', async () => {
    const startTime = Date.now();
    
    const request: PlaylistCreationRequest = {
      tagName: 'pop',
      artistLimit: 20,
      tracksPerArtist: 1
    };
    
    const result = await lastValueFrom(
      playlistCreationService.createPlaylistFromTag(request).pipe(
        filter(update => 'success' in update),
        take(1)
      )
    ) as PlaylistCreationResult;
    
    const duration = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(30000); // 30 seconds
    expect(result.duration).toBeLessThan(30000);
  });
});
```

## Deployment Checklist
- [ ] All integration tests pass
- [ ] Performance requirements met
- [ ] Error handling tested with real API failures  
- [ ] Progress tracking works correctly
- [ ] Cancellation functionality tested
- [ ] Component integration verified
- [ ] Authentication flows tested
- [ ] Rate limiting respected