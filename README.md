# Artist Label Search - Angular Playground

An Angular 19 application that allows users to search for music artists and discover their record labels using the MusicBrainz API.

## Features

- **Artist Search**: Type-ahead search with 300ms debounce for smooth UX
- **Label Discovery**: Automatic lookup of record labels when artist is selected
- **Release Aggregation**: Smart counting and sorting of releases per label
- **MusicBrainz Integration**: Real-time data from the comprehensive music database
- **Reactive Forms**: Modern Angular reactive forms with validation
- **CORS Proxy**: Seamless API integration through development proxy
- **Professional UI**: Card-based layouts with loading states and animations
- **Error Handling**: User-friendly error messages and loading states
- **Responsive Design**: Clean, modern UI with SCSS styling

## Quick Start

```bash
# Install dependencies
npm install

# Start development server with API proxy
ng serve

# Open browser to http://localhost:4200
```

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── home/              # Main search interface component
│   │   ├── label-card/        # Individual label display card
│   │   ├── label-grid/        # Grid layout for label collection
│   │   └── loading-spinner/   # Reusable loading indicator
│   ├── models/                # TypeScript interfaces for MusicBrainz API
│   ├── services/              # API service layer with label aggregation
│   └── environments/          # Environment configuration
├── proxy.conf.json            # API proxy configuration
└── projects/nationwide/       # Angular library workspace
```

## API Integration

### MusicBrainz Service

The `MusicBrainzService` provides typed access to the MusicBrainz API:

```typescript
// Artist search with debounced input
searchArtists(query: string, limit: number = 10): Observable<MusicBrainzArtist[]>

// Release lookup with label information
getArtistReleases(artistId: string, limit: number = 100): Observable<MusicBrainzRelease[]>

// Label aggregation with release counting
getArtistLabels(artistId: string): Observable<LabelWithReleaseCount[]>

// Private method for label data processing
private aggregateLabels(releases: MusicBrainzRelease[]): LabelWithReleaseCount[]
```

### Proxy Configuration

Development requests are proxied through `proxy.conf.json` to handle CORS:

```json
{
  "/api/*": {
    "target": "https://musicbrainz.org/ws/2",
    "headers": {
      "User-Agent": "AngularPlayground/1.0.0 (claude-assistant@example.com)"
    }
  }
}
```

### Data Models

Comprehensive TypeScript interfaces for MusicBrainz API responses:

- `MusicBrainzArtist` - Artist information with metadata
- `MusicBrainzRelease` - Release details with label info
- `MusicBrainzLabel` - Record label data
- `LabelWithReleaseCount` - Aggregated label statistics

## Component Stories

### HomeComponent

**Purpose**: Main search interface for artist discovery

**Features**:
- Reactive search input with `FormControl`
- Debounced API calls (300ms) using RxJS operators
- Loading states with spinner animation
- Error handling with user-friendly messages
- Artist selection with detailed information display

**User Flows**:
1. User types artist name → Debounced search triggers
2. API results display in dropdown → User clicks to select
3. Selected artist shows detailed info → Automatic label lookup begins
4. Label grid displays with release counts → Sorted by activity level

**Example Usage**:
```typescript
// Search for "Beatles" → Shows "The Beatles" → Displays labels like "Apple Records", "Capitol Records"
// Search for "Radiohead" → Shows band → Displays "XL Recordings", "Capitol Records", etc.
// Search for "Miles Davis" → Shows jazz artist → Displays "Columbia Records", "Blue Note Records"
```

### LabelGridComponent

**Purpose**: Display collection of record labels in responsive grid layout

**Features**:
- Responsive CSS Grid with auto-fill columns (min 300px)
- Loading state with animated spinner
- Error state with user-friendly messaging
- Empty state for artists without label information
- Label count summary header

**States**:
- Loading: Shows spinner with "Loading record labels..." message
- Error: Displays error icon and specific error message
- Empty: Shows label icon with "No Labels Found" message
- Success: Grid of label cards sorted by release count

### LabelCardComponent

**Purpose**: Individual label information card with release statistics

**Features**:
- Professional card design with hover animations
- Gradient release counter with singular/plural text handling
- Label metadata display (type, label code, disambiguation)
- Responsive layout that adapts to different screen sizes
- Visual hierarchy with typography and color coding

**Data Display**:
- Primary: Label name and release count
- Secondary: Label type, label code (LC number)
- Tertiary: Disambiguation text and MusicBrainz ID

### LoadingSpinnerComponent

**Purpose**: Reusable loading indicator with configurable sizing

**Features**:
- Three size variants: small (20px), medium (40px), large (60px)
- Customizable message text
- Consistent animation and branding
- Accessible design with proper contrast ratios

**Usage**:
```html
<app-loading-spinner message="Loading artists..." size="medium"></app-loading-spinner>
```

## Development Workflow

### Available Scripts

```bash
npm start              # Start development server
npm run build          # Build for production
npm run watch          # Build with file watching
npm test              # Run unit tests
```

### Library Development

```bash
ng build @nationwide/my-lib      # Build custom library
ng test @nationwide/my-lib       # Test library components
```

## Implementation Phases

### ✅ Phase 1: Core Functionality (Complete)
- Environment and HttpClient setup
- MusicBrainz API integration with proper headers
- Artist search with reactive forms
- HomeComponent with autocomplete
- Error handling and loading states

### ✅ Phase 2: Label Integration (Complete)
- Release lookup by artist ID with label information
- Label data aggregation and release counting
- LabelGridComponent with responsive design
- LabelCardComponent with professional styling
- LoadingSpinnerComponent for reusable loading states
- Enhanced HomeComponent with integrated label workflow

### 📋 Phase 3: Polish (Future)
- Advanced autocomplete with highlighting
- Accessibility compliance (ARIA labels)
- Performance optimizations and caching
- Additional label metadata and filtering options

## API Rate Limiting

MusicBrainz API has a 1 request/second rate limit. The service includes:
- Built-in 1000ms delay between requests
- Proper User-Agent header via proxy
- Error handling for rate limit responses (429)

## Testing

Try these artist searches to test full functionality:

### Artist Search Testing:
- **"Beatles"** → Multiple results with disambiguation → Select "The Beatles" → See Apple Records, Capitol Records
- **"Radiohead"** → Band with clear metadata → See XL Recordings, Capitol Records, etc.
- **"Miles Davis"** → Jazz artist with life span data → See Columbia Records, Blue Note Records
- **"Bob Dylan"** → Prolific artist → See Columbia Records with high release count
- **"xyz123"** → Tests error handling for both artist search and label lookup

### Label Integration Testing:
- Select any artist to trigger automatic label lookup
- Observe loading states during API calls
- Check responsive grid layout on different screen sizes
- Verify release count sorting (highest counts first)
- Test error handling when API fails

## Architecture Notes

- **Angular 19**: Latest features including control flow (`@if`, `@for`)
- **Standalone Components**: No NgModules, modern Angular architecture  
- **RxJS**: Reactive programming with operators for API calls
- **SCSS**: Styled with modern CSS features and animations
- **TypeScript**: Strict typing for API responses and component state

## Contributing

This project follows the feature plan outlined in `FEATURE_PLAN.md`. See `CLAUDE.md` for development guidance and commands.

---

*Generated with [Claude Code](https://claude.ai/code)*
