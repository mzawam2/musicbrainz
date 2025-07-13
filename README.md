# Artist Label Search - Angular Playground

An Angular 19 application that allows users to search for music artists and discover their record labels using the MusicBrainz API.

## Features

- **Artist Search**: Type-ahead search with 300ms debounce for smooth UX
- **MusicBrainz Integration**: Real-time data from the comprehensive music database
- **Reactive Forms**: Modern Angular reactive forms with validation
- **CORS Proxy**: Seamless API integration through development proxy
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
│   │   └── home/           # Main search interface component
│   ├── models/             # TypeScript interfaces for MusicBrainz API
│   ├── services/           # API service layer
│   └── environments/       # Environment configuration
├── proxy.conf.json         # API proxy configuration
└── projects/nationwide/    # Angular library workspace
```

## API Integration

### MusicBrainz Service

The `MusicBrainzService` provides typed access to the MusicBrainz API:

```typescript
// Artist search with debounced input
searchArtists(query: string, limit: number = 10): Observable<MusicBrainzArtist[]>

// Release lookup for label aggregation (Phase 2)
getArtistReleases(artistId: string, limit: number = 100): Observable<MusicBrainzRelease[]>
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
3. Selected artist shows detailed info → Prepares for label lookup

**Example Usage**:
```typescript
// Search for "Beatles" → Shows "The Beatles" with country, active years
// Search for "Radiohead" → Shows band with disambiguation
// Search for "Miles Davis" → Shows jazz artist with life span
```

### Future Components (Phase 2)

- `LabelGridComponent` - Display grid of record labels
- `LabelCardComponent` - Individual label cards with release counts
- `LoadingSpinnerComponent` - Reusable loading indicator
- `ErrorMessageComponent` - Consistent error display

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

### 🚧 Phase 2: Label Integration (Next)
- Release lookup by artist ID
- Label data aggregation and counting
- Label grid and card components
- Enhanced UX with skeleton screens

### 📋 Phase 3: Polish (Future)
- Advanced autocomplete with highlighting
- Responsive design improvements
- Accessibility compliance (ARIA labels)
- Performance optimizations

## API Rate Limiting

MusicBrainz API has a 1 request/second rate limit. The service includes:
- Built-in 1000ms delay between requests
- Proper User-Agent header via proxy
- Error handling for rate limit responses (429)

## Testing

Try these artist searches to test functionality:
- "Beatles" → Multiple results with disambiguation
- "Radiohead" → Band with clear metadata
- "Miles Davis" → Jazz artist with life span data
- "xyz123" → Tests error handling

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
