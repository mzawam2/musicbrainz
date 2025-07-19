export interface MusicBrainzArea {
  id: string;
  name: string;
  'sort-name': string;
  disambiguation?: string;
  type?: string | null;
  'type-id'?: string | null;
  'iso-3166-2-codes'?: string[];
}

export interface MusicBrainzLifeSpan {
  begin?: string;
  end?: string;
  ended?: boolean;
}

export interface MusicBrainzAlias {
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

export interface MusicBrainzGenre {
  id: string;
  name: string;
  disambiguation?: string;
  count: number;
}

export interface MusicBrainzTag {
  name: string;
  count: number;
}

export interface MusicBrainzRating {
  value: number;
  'votes-count': number;
}

export interface MusicBrainzArtist {
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

export interface MusicBrainzLabel {
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

export interface LabelWithReleaseCount {
  label: MusicBrainzLabel;
  releaseCount: number;
}

export interface MusicBrainzRelease {
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

export interface MusicBrainzArtistSearchResponse {
  artists: MusicBrainzArtist[];
  count: number;
  offset: number;
}

export interface MusicBrainzReleaseSearchResponse {
  releases: MusicBrainzRelease[];
  'release-count': number;
  'release-offset': number;
}

// New interfaces for Phase 1: Artist Discography Explorer

export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  'primary-type': 'Album' | 'Single' | 'EP' | 'Broadcast' | 'Other';
  'primary-type-id': string;
  'secondary-types'?: string[];
  'secondary-type-ids'?: string[];
  'first-release-date': string;
  disambiguation?: string;
  'artist-credit'?: Array<{
    name: string;
    joinphrase?: string;
    artist: {
      id: string;
      name: string;
      'sort-name': string;
      disambiguation?: string;
    };
  }>;
  aliases?: MusicBrainzAlias[];
  tags?: MusicBrainzTag[];
  rating?: MusicBrainzRating;
  releases?: MusicBrainzRelease[];
}

export interface MusicBrainzReleaseGroupSearchResponse {
  'release-groups': MusicBrainzReleaseGroup[];
  count: number;
  offset: number;
}

export interface DiscographyData {
  artist: MusicBrainzArtist;
  releaseGroups: MusicBrainzReleaseGroup[];
  totalReleases: number;
  careerSpan: {
    start: string;
    end?: string;
  };
}

// Phase 2 & 3: Enhanced interfaces for detailed release information

export interface MusicBrainzTrack {
  id: string;
  title: string;
  length?: number;
  position: number;
  number?: string;
  recording: {
    id: string;
    title: string;
    length?: number;
    disambiguation?: string;
    'artist-credit'?: Array<{
      name: string;
      joinphrase?: string;
      artist: {
        id: string;
        name: string;
        'sort-name': string;
        disambiguation?: string;
      };
    }>;
  };
}

export interface MusicBrainzMedium {
  position: number;
  title?: string;
  format?: string;
  'format-id'?: string;
  'track-count': number;
  'track-offset'?: number;
  tracks?: MusicBrainzTrack[];
}

export interface CoverArtInfo {
  artwork: boolean;
  count: number;
  front: boolean;
  back: boolean;
  images?: Array<{
    id: string;
    image: string;
    thumbnails: {
      small: string;
      large: string;
      '250': string;
      '500': string;
      '1200': string;
    };
    front: boolean;
    back: boolean;
    types: string[];
    edit: number;
    approved: boolean;
  }>;
}

export interface DetailedRelease extends MusicBrainzRelease {
  media: MusicBrainzMedium[];
  'cover-art-archive': CoverArtInfo;
  totalTracks?: number;
  totalLength?: number;
}

export interface EnhancedReleaseGroup extends MusicBrainzReleaseGroup {
  detailedReleases?: DetailedRelease[];
  coverArt?: CoverArtInfo;
  totalTracks?: number;
  averageLength?: number;
  expanded?: boolean; // UI state for expandable cards
}

export interface MusicBrainzWork {
  id: string;
  title: string;
  type?: string;
  'type-id'?: string;
  disambiguation?: string;
  'attribute-list'?: Array<{
    type: string;
    'type-id': string;
    value: string;
    'value-id'?: string;
  }>;
  aliases?: MusicBrainzAlias[];
  rating?: MusicBrainzRating;
  tags?: MusicBrainzTag[];
  relations?: Array<{
    type: string;
    direction: string;
    'target-credit'?: string;
    'target-type': string;
    work?: MusicBrainzWork;
    artist?: MusicBrainzArtist;
    begin?: string;
    end?: string;
    ended?: boolean;
    attributes?: string[];
  }>;
}

export interface CollaborationInfo {
  artist: MusicBrainzArtist;
  collaborationType: string;
  releaseCount: number;
  releases: string[];
}

export interface EnhancedDiscographyData extends DiscographyData {
  releaseGroups: EnhancedReleaseGroup[];
  collaborations?: CollaborationInfo[];
  genres?: Array<{ name: string; count: number; percentage: number }>;
  decades?: Array<{ decade: string; count: number; percentage: number }>;
  totalTracks?: number;
  totalPlaytime?: number;
}

// API Response interfaces for Phase 2 & 3

export interface MusicBrainzReleaseDetailResponse {
  releases: DetailedRelease[];
  count: number;
  offset: number;
}

export interface MusicBrainzWorkSearchResponse {
  works: MusicBrainzWork[];
  count: number;
  offset: number;
}

export interface CoverArtResponse {
  images: Array<{
    id: string;
    image: string;
    thumbnails: {
      small: string;
      large: string;
      '250': string;
      '500': string;
      '1200': string;
    };
    front: boolean;
    back: boolean;
    types: string[];
    edit: number;
    approved: boolean;
  }>;
  release: string;
}

// Label Family Tree interfaces

export interface LabelRelationship {
  type: 'parent' | 'subsidiary' | 'imprint' | 'reissue-series' | 'holding' | 'renamed-to' | 'other';
  direction: 'forward' | 'backward';
  begin?: string;
  end?: string;
  ended?: boolean;
  attributes?: string[];
  'target-credit'?: string;
}

export interface ArtistRosterEntry {
  artist: MusicBrainzArtist;
  period: {
    begin?: string;
    end?: string;
  };
  releaseCount: number;
  releases?: string[];
  relationshipType?: 'current' | 'former' | 'distributed';
}

export interface LabelTreeNode {
  label: MusicBrainzLabel;
  relationship?: LabelRelationship;
  children: LabelTreeNode[];
  artistRoster?: ArtistRosterEntry[];
  expanded?: boolean;
  loading?: boolean;
  depth: number;
}

export interface LabelFamilyTree {
  rootLabel: MusicBrainzLabel;
  tree: LabelTreeNode;
  totalLabels: number;
  totalArtists: number;
  maxDepth: number;
  lastUpdated: Date;
}

export interface LabelSearchFilters {
  relationshipTypes: string[];
  countries: string[];
  activeOnly: boolean;
  hasArtists: boolean;
  timeRange?: {
    start?: string;
    end?: string;
  };
}

export interface LabelRelationshipSearchResponse {
  relations: Array<{
    type: string;
    direction: string;
    'target-type': 'label';
    label: MusicBrainzLabel;
    begin?: string;
    end?: string;
    ended?: boolean;
    attributes?: string[];
  }>;
}

export interface LabelArtistResponse {
  artists: MusicBrainzArtist[];
  count: number;
  offset: number;
}