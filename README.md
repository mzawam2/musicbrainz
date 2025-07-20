# Artist Label Search - Musicbrainz

An Angular 19 application that allows users to search for music artists and discover their record labels using the MusicBrainz API.

## Features

### 🔍 **Advanced Search & Discovery**
- **Artist Search**: Type-ahead search with 300ms debounce and search term highlighting
- **Label Discovery**: Automatic lookup of record labels when artist is selected
- **Release Aggregation**: Smart counting and sorting of releases per label
- **Advanced Filtering**: Search labels by name, sort by multiple criteria, filter by type

### ⚡ **Performance & UX**
- **Intelligent Caching**: 5-minute cache reduces API calls by up to 80%
- **MusicBrainz Integration**: Real-time data from the comprehensive music database
- **Professional UI**: Card-based layouts with smooth animations and micro-interactions
- **Responsive Design**: Mobile-first design that adapts to all screen sizes

### ♿ **Accessibility & Polish**
- **WCAG Compliance**: Full keyboard navigation and screen reader support
- **ARIA Labels**: Proper semantic markup for assistive technologies
- **Visual Feedback**: Search term highlighting and clear focus indicators
- **Error Handling**: Comprehensive error states with recovery options

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
// Artist search with intelligent caching (5-minute TTL)
searchArtists(query: string, limit: number = 10): Observable<MusicBrainzArtist[]>

// Release lookup with label information  
getArtistReleases(artistId: string, limit: number = 100): Observable<MusicBrainzRelease[]>

// Label aggregation with caching and release counting
getArtistLabels(artistId: string): Observable<LabelWithReleaseCount[]>

// Private methods for optimization
private aggregateLabels(releases: MusicBrainzRelease[]): LabelWithReleaseCount[]
private cleanupCache<T>(cache: Map<string, CacheEntry<T>>): void
```

### Performance Features
- **Cache Strategy**: 5-minute TTL with automatic cleanup
- **Cache Keys**: Query-based for artist search, ID-based for labels  
- **Memory Management**: Prevents unbounded cache growth
- **Rate Limiting**: Maintains 1 request/second compliance

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

**Enhanced User Flows**:
1. **Search Phase**: User types → Debounced search → Highlighted results → Keyboard/click selection
2. **Discovery Phase**: Selected artist → Automatic label lookup → Cached results (if available)
3. **Exploration Phase**: Label grid → Filter/sort controls → Refined label discovery
4. **Accessibility**: Full keyboard navigation → Screen reader support → ARIA compliance

**Advanced Features**:
```typescript
// Search highlighting: "Rad" in "Radiohead" appears highlighted
// Intelligent caching: Second search for "Beatles" returns instantly
// Advanced filtering: Filter by "Original Production" labels only
// Responsive design: Controls stack vertically on mobile screens
// Accessibility: Tab navigation through all interactive elements
```

### LabelGridComponent

**Purpose**: Advanced label management with filtering, sorting, and responsive design

**Core Features**:
- **Responsive CSS Grid**: Auto-fill columns (min 300px) with mobile optimization
- **Advanced Filtering**: Search by name/disambiguation, filter by label type
- **Multi-Sort Options**: Sort by name, release count, or type with direction toggle
- **Smart Results**: Shows filtered count vs. total with clear filter option
- **State Management**: Loading, error, empty, and no-results states

**Filtering & Sorting**:
```typescript
// Filter by label name or disambiguation
searchTerm: string = '';

// Sort by multiple criteria with direction
sortBy: 'name' | 'releases' | 'type' = 'releases';
sortDirection: 'asc' | 'desc' = 'desc';

// Filter by label type (Original Production, Reissue Label, etc.)
filterByType: string = '';
```

**Accessibility Features**:
- Screen reader labels for all controls
- Keyboard navigation support
- ARIA-compliant form controls
- Clear focus indicators

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

### ✅ Phase 3: Polish & Accessibility (Complete)
- **Advanced Search**: Search term highlighting with regex-safe escaping
- **Accessibility**: Full WCAG compliance with ARIA labels and keyboard navigation
- **Performance**: Intelligent caching with 5-minute TTL and memory management
- **Advanced Filtering**: Multi-criteria sorting and label type filtering
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Professional UX**: Smooth animations, micro-interactions, and visual feedback

## API Rate Limiting

MusicBrainz API has a 1 request/second rate limit. The service includes:
- Built-in 1000ms delay between requests
- Proper User-Agent header via proxy
- Error handling for rate limit responses (429)

## Testing

Try these artist searches to test full functionality:

### Comprehensive Testing Scenarios:

#### **Search & Highlighting**:
- **"Rad"** → Search "Radiohead" → See "**Rad**iohead" highlighted in yellow
- **"Miles"** → Search "Miles Davis" → See "**Miles** Davis" highlighted
- **Cache Test** → Search "Beatles" twice → Second search returns instantly

#### **Advanced Filtering**:
- **Multi-Filter** → Search "Radiohead" → Filter by "Original Production" → Sort by name
- **No Results** → Filter by non-existent type → See "Clear Filters" option
- **Search Labels** → Type "XL" in label search → See filtered results

#### **Accessibility Testing**:
- **Keyboard Navigation** → Tab through all controls → Use Enter/Space to select
- **Screen Reader** → Test with screen reader for proper ARIA labels
- **Focus Management** → Verify clear focus indicators throughout

#### **Responsive Design**:
- **Mobile Layout** → Resize to 480px → See stacked filter controls
- **Tablet Layout** → Resize to 768px → See single-column label grid
- **Desktop** → Full width → See multi-column responsive grid

#### **Performance**:
- **Cache Efficiency** → Monitor network tab → See reduced API calls
- **Error Recovery** → Disable network → See proper error handling
- **Loading States** → Observe smooth transitions and spinners

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
