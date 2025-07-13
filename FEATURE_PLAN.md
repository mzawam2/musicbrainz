# Artist Label Search Feature Plan

## Frontend UX Architecture

### Component Structure
- **HomeComponent**: Main search interface with artist input field
- **ArtistSearchComponent**: Autocomplete search with debounced input
- **LabelGridComponent**: Display grid of labels with release counts
- **LabelCardComponent**: Individual label card with logo, name, and release info
- **LoadingSpinnerComponent**: Reusable loading indicator
- **ErrorMessageComponent**: User-friendly error display

### User Experience Flow
1. **Search Input**: Type-ahead search with 300ms debounce
2. **Artist Selection**: Click to select from autocomplete results
3. **Loading State**: Show spinner while fetching label data
4. **Results Display**: Grid layout of labels with release counts
5. **Error Handling**: Clear error messages for API failures

## Backend Data Flow

### MusicBrainz API Integration
1. **Artist Search**: `/artist?query={searchTerm}&limit=10&fmt=json`
2. **Release Lookup**: `/release?artist={artistId}&inc=labels&limit=100&fmt=json`
3. **Label Aggregation**: Group releases by label and count

### Service Architecture
- **MusicBrainzService**: Core API communication in @nationwide/my-lib
- **ArtistService**: Artist search and selection logic
- **LabelService**: Label data aggregation and formatting
- **HttpInterceptor**: Add User-Agent header and rate limiting

### Data Models
```typescript
interface MusicBrainzArea {
  id: string;
  name: string;
  'sort-name': string;
  disambiguation?: string;
  type?: string | null;
  'type-id'?: string | null;
  'iso-3166-2-codes'?: string[];
}

interface MusicBrainzLifeSpan {
  begin?: string;
  end?: string;
  ended?: boolean;
}

interface MusicBrainzAlias {
  name: string;
  'sort-name': string;
  type?: string;
  'type-id'?: string;
  locale?: string | null;
  primary?: boolean | null;
  begin?: string | null;
  end?: string | null;
  ended?: boolean;
}

interface MusicBrainzGenre {
  id: string;
  name: string;
  disambiguation?: string;
  count: number;
}

interface MusicBrainzTag {
  name: string;
  count: number;
}

interface MusicBrainzRating {
  value: number;
  'votes-count': number;
}

interface MusicBrainzArtist {
  id: string;
  name: string;
  'sort-name': string;
  type?: string;
  'type-id'?: string;
  country?: string;
  gender?: string | null;
  'gender-id'?: string | null;
  'life-span'?: MusicBrainzLifeSpan;
  area?: MusicBrainzArea;
  'begin-area'?: MusicBrainzArea;
  'end-area'?: MusicBrainzArea | null;
  aliases?: MusicBrainzAlias[];
  genres?: MusicBrainzGenre[];
  tags?: MusicBrainzTag[];
  rating?: MusicBrainzRating;
  isnis?: string[];
  ipis?: string[];
  disambiguation?: string;
}

interface MusicBrainzLabel {
  id: string;
  name: string;
  type: string;
  'type-id': string;
  'sort-name': string;
  disambiguation: string;
  country: string;
  'label-code': number;
  'life-span': {
    begin: string;
    end: string | null;
    ended: boolean;
  };
  area: {
    id: string;
    name: string;
    'sort-name': string;
    'type-id': string | null;
    'iso-3166-1-codes': string[];
    disambiguation: string;
    type: null;
  };
  rating: {
    'votes-count': number;
    value: number;
  };
  aliases: Array<{
    name: string;
    'sort-name': string;
    type: string;
    'type-id': string | null;
    locale: string | null;
    primary: boolean | null;
    begin: string | null;
    end: string | null;
    ended: boolean;
  }>;
  tags: Array<{
    name: string;
    count: number;
  }>;
  isnis: string[];
  ipis: string[];
}

interface LabelWithReleaseCount {
  label: MusicBrainzLabel;
  releaseCount: number;
}

interface MusicBrainzRelease {
  id: string;
  title: string;
  status?: string;
  quality?: string;
  date?: string;
  country?: string;
  barcode?: string | null;
  asin?: string;
  disambiguation?: string;
  packaging?: string;
  
  'status-id'?: string;
  'packaging-id'?: string;
  
  'text-representation'?: {
    language?: string;
    script?: string;
  };
  
  'cover-art-archive': {
    artwork: boolean;
    count: number;
    front: boolean;
    back: boolean;
    darkened?: boolean;
  };
  
  'release-events'?: Array<{
    date?: string;
    area?: {
      id: string;
      name: string;
      'sort-name': string;
      'iso-3166-1-codes'?: string[];
      disambiguation?: string;
      type?: string;
      'type-id'?: string;
    };
  }>;
  
  'label-info'?: Array<{
    'catalog-number'?: string;
    label?: {
      id: string;
      name: string;
      'sort-name'?: string;
      disambiguation?: string;
      type?: string;
      'type-id'?: string;
      'label-code'?: number;
    };
  }>;
  
  'artist-credit'?: Array<{
    name: string;
    joinphrase?: string;
    artist: {
      id: string;
      name: string;
      'sort-name': string;
      disambiguation?: string;
      type?: string;
      'type-id'?: string;
    };
  }>;
  
  'release-group'?: {
    id: string;
    title: string;
    'primary-type': string;
    'primary-type-id': string;
    'secondary-types'?: string[];
    'secondary-type-ids'?: string[];
    'first-release-date'?: string;
    disambiguation?: string;
  };
  
  media?: Array<{
    position: number;
    title?: string;
    format?: string;
    'format-id'?: string;
    'track-count': number;
    'track-offset'?: number;
  }>;
}
```

## Technical Implementation Steps

### 1. Infrastructure Setup
- Configure HttpClient in app.config.ts
- Create environment configuration for API base URL
- Add Angular Material for UI components

### 2. Service Layer
- Implement MusicBrainzService with rate limiting
- Create typed models for API responses
- Add error handling and retry logic

### 3. Component Development
- Clear existing app.component.html content
- Create HomeComponent with search functionality
- Implement reactive forms with validation
- Add responsive grid layout for results

### 4. UX Enhancements
- Add loading states and skeleton screens
- Implement debounced search input
- Add empty state messaging
- Ensure accessibility compliance

### 5. Error Handling
- Network error recovery
- API rate limit handling
- User-friendly error messages
- Graceful degradation

## Implementation Priority

### Phase 1: Core Functionality
1. Set up HttpClient and environment config
2. Create MusicBrainzService with basic artist search
3. Build HomeComponent with simple search input
4. Display basic artist search results

### Phase 2: Label Integration
1. Implement release lookup by artist
2. Add label aggregation logic
3. Create label display components
4. Add loading states

### Phase 3: UX Polish
1. Add autocomplete and debouncing
2. Implement responsive design
3. Add error handling and empty states
4. Ensure accessibility compliance