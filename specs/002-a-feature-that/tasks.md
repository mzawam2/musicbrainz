# Tasks: Last.fm Tag Search with Artist Results Display

**Input**: Design documents from `/specs/002-a-feature-that/`
**Prerequisites**: plan.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅)

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Extract: Angular 20.2.1, Angular Material, TypeScript 5.9.2, signals
2. Load design documents: ✅
   → contracts/playlist-creation-ui.contract.ts: UI component contract
   → quickstart.md: Enhanced workflow test scenarios
   → research.md: UI enhancement decisions (backend complete)
3. Generate tasks by category:
   → Setup: N/A (existing Angular project)
   → Tests: UI component contract tests, integration tests
   → Core: UI enhancement implementation (signals, methods, templates)
   → Integration: Component workflow tests
   → Polish: accessibility, performance validation
4. Apply task rules:
   → Different test files = mark [P] for parallel
   → Same component file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness: ✅
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web application**: Angular frontend with existing structure
- Component: `src/app/components/playlist-creation/`
- Tests: Component `.spec.ts` files
- All paths relative to repository root

## Phase 3.1: Setup
**Status**: ✅ SKIPPED - Existing Angular project with complete backend implementation

Based on research analysis:
- ✅ LastfmService.getTopArtistsByTag() - EXISTS (lines 354-389)
- ✅ SpotifyService.createPlaylistFromArtists() - EXISTS (lines 1231-1353)  
- ✅ PlaylistCreationService - EXISTS with complete orchestration
- ✅ All data models - EXISTS (LastfmTagArtist, PlaylistCreationRequest, etc.)

**Only UI enhancement needed**: Add search preview step to existing component

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] T001 [P] UI state signals contract test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test `isSearching()`, `searchResults()`, `hasSearched()` signals
  - Test initial state: `isSearching: false, hasSearched: false, searchResults: []`
  - Must fail: signals don't exist yet

- [ ] T002 [P] Search method contract test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test `searchArtists()` method existence and behavior
  - Test precondition: `canSearch()` returns true
  - Test side effect: `isSearching()` becomes true
  - Must fail: method doesn't exist yet

- [ ] T003 [P] UI element visibility contract test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test search button `[data-testid="search-artists"]` enabled state
  - Test create button visibility after search results
  - Test search results container `.search-results` visibility
  - Must fail: elements don't exist in template yet

- [ ] T004 [P] Artist chips display contract test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test `.artist-chip` elements count matches `searchResults().length`
  - Test first chip contains artist name and "#1" rank
  - Test chips display when `hasSearched()` and results exist
  - Must fail: chips template doesn't exist yet

- [ ] T005 [P] No results handling contract test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test `.no-results` element visibility when `searchResults().length === 0`
  - Test "No artists found" message display
  - Test create button disabled state with no results
  - Must fail: no results template doesn't exist yet

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [ ] T006 Add new state signals to playlist creation component in `src/app/components/playlist-creation/playlist-creation.component.ts`
  - Add `isSearching = signal<boolean>(false)`
  - Add `searchResults = signal<LastfmTagArtist[]>([])`
  - Add `hasSearched = signal<boolean>(false)`
  - Update imports to include `LastfmTagArtist` and `LastfmService`

- [ ] T007 Implement searchArtists method in `src/app/components/playlist-creation/playlist-creation.component.ts`
  - Add `searchArtists(): void` method
  - Implement form validation check
  - Set `isSearching(true)` and reset results
  - Call `lastfmService.getTopArtistsByTag()` with form values
  - Handle success: populate `searchResults()`, set `hasSearched(true)`, set `isSearching(false)`
  - Handle error: show error message, set `isSearching(false)`

- [ ] T008 Update computed validation signals in `src/app/components/playlist-creation/playlist-creation.component.ts`
  - Update `canCreate()` to include `hasSearched() && searchResults().length > 0`
  - Add `canSearch()` computed signal checking form validity and not searching/creating
  - Ensure validation works with new workflow

- [ ] T009 Update reset method in `src/app/components/playlist-creation/playlist-creation.component.ts`
  - Add reset of `isSearching(false)`
  - Add reset of `searchResults([])`
  - Add reset of `hasSearched(false)`
  - Ensure component can restart search workflow

- [ ] T010 Add search UI elements to template in `src/app/components/playlist-creation/playlist-creation.component.html`
  - Add search section with search button after form
  - Add `[data-testid="search-artists"]` to search button
  - Add conditional loading spinner and text during search
  - Add button state binding: `[disabled]="!canSearch()"`

- [ ] T011 Add search results display to template in `src/app/components/playlist-creation/playlist-creation.component.html`
  - Add search results container with `.search-results` class
  - Add conditional display: `@if (hasSearched() && searchResults().length > 0)`
  - Add results heading showing count and tag name
  - Add artist chips grid with `@for` loop over `searchResults()`

- [ ] T012 Add artist chips template in `src/app/components/playlist-creation/playlist-creation.component.html`
  - Add `mat-chip` elements with `.artist-chip` class
  - Add `mat-icon` avatar for each artist
  - Add artist name and rank display (`#{{ artist.tagRank }}`)
  - Add responsive grid layout for multiple artists

- [ ] T013 Add no results template in `src/app/components/playlist-creation/playlist-creation.component.html`
  - Add `.no-results` container
  - Add conditional display: `@if (hasSearched() && searchResults().length === 0)`
  - Add "No artists found" message with suggestions
  - Add search icon and helpful text

- [ ] T014 Update create button visibility in `src/app/components/playlist-creation/playlist-creation.component.html`
  - Update create button condition to include search results check
  - Change to: `@if (!isCreating() && !isCompleted() && hasSearched() && searchResults().length > 0)`
  - Ensure button only shows after successful search

- [ ] T015 Add search styling in `src/app/components/playlist-creation/playlist-creation.component.scss`
  - Add `.search-section` styles for search button container
  - Add `.search-results` styles with background and border
  - Add `.artist-chip` styles for responsive grid display
  - Add `.no-results` styles for centered message display

- [ ] T016 Add Material Design imports in `src/app/components/playlist-creation/playlist-creation.component.ts`
  - Add `MatListModule` to imports array
  - Add `MatChipsModule` to imports array
  - Ensure all required Material components are imported

## Phase 3.4: Integration Tests

- [ ] T017 Complete search workflow integration test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test full workflow: fill tag → click search → verify results → click create
  - Mock `lastfmService.getTopArtistsByTag()` with test data
  - Verify UI state transitions match contract
  - Test creates component fixture and interacts with DOM

- [ ] T018 Error handling integration test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Mock service to return error for search
  - Test error message display to user
  - Verify search button re-enabled after error
  - Test snackbar error message shown

- [ ] T019 Loading state integration test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Mock service with delayed observable (1 second delay)
  - Test loading spinner appears during search
  - Test button text changes to "Searching..."
  - Test loading state clears after completion

## Phase 3.5: Polish

- [ ] T020 [P] Accessibility compliance test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test search button has proper `aria-label`
  - Test search results have `aria-live` announcements
  - Test artist chips have proper `role` and labels
  - Test keyboard navigation works correctly

- [ ] T021 [P] Performance validation test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test search response time under 5 seconds
  - Test UI updates complete within 100ms
  - Test memory usage stays under limits for 20 artists
  - Test component handles large result sets efficiently

- [ ] T022 [P] Mobile responsiveness test in `src/app/components/playlist-creation/playlist-creation.component.spec.ts`
  - Test component layout on mobile viewport sizes
  - Test artist chips wrap properly on small screens
  - Test buttons remain accessible on mobile
  - Test search results scroll appropriately

- [ ] T023 Run enhanced playlist creation quickstart scenarios from `/specs/002-a-feature-that/quickstart.md`
  - Execute Scenario 1: Enhanced UI workflow test
  - Execute UI search workflow tests
  - Execute error handling scenarios
  - Verify all integration test scenarios pass

## Dependencies
- Tests (T001-T005) before implementation (T006-T016)
- T006 (signals) blocks T007 (methods using signals)
- T007 (searchArtists method) blocks T010 (template button)
- T010-T014 (template changes) block T017-T019 (integration tests)
- Implementation (T006-T016) before polish (T020-T023)

## Parallel Example
```bash
# Launch T001-T005 together (different test categories):
Task: "UI state signals contract test in playlist-creation.component.spec.ts"
Task: "Search method contract test in playlist-creation.component.spec.ts"  
Task: "UI element visibility contract test in playlist-creation.component.spec.ts"
Task: "Artist chips display contract test in playlist-creation.component.spec.ts"
Task: "No results handling contract test in playlist-creation.component.spec.ts"

# Launch T020-T022 together (different test aspects):
Task: "Accessibility compliance test in playlist-creation.component.spec.ts"
Task: "Performance validation test in playlist-creation.component.spec.ts"
Task: "Mobile responsiveness test in playlist-creation.component.spec.ts"
```

## Notes
- [P] tasks = different test categories or independent aspects, no dependencies
- **CRITICAL**: All T001-T005 tests MUST FAIL before starting T006
- Backend implementation already complete - focus on UI enhancement only
- Verify tests fail before implementing features
- Commit after each task completion
- Follow TDD: Red → Green → Refactor pattern

## Task Generation Rules Applied

1. **From UI Contract**: playlist-creation-ui.contract.ts
   - State signals → T001 contract test, T006 implementation
   - Methods → T002 contract test, T007 implementation  
   - UI elements → T003-T005 contract tests, T010-T014 implementation

2. **From Quickstart Scenarios**: quickstart.md
   - Enhanced workflow → T017 integration test
   - Error handling → T018 integration test
   - Loading states → T019 integration test

3. **From Research Decisions**: research.md
   - Angular Material chips → T011-T012 template implementation
   - Signals state management → T006 signals implementation
   - Three-stage workflow → T008 validation logic

## Validation Checklist ✅

- [x] UI contract has corresponding tests (T001-T005)
- [x] All UI elements have implementation tasks (T010-T014)
- [x] All tests come before implementation (T001-T005 before T006-T016)
- [x] Parallel tasks truly independent (different test categories)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD order enforced: contract tests must fail first

**Ready for Task Execution**: 23 tasks generated focusing on UI enhancement to existing complete backend