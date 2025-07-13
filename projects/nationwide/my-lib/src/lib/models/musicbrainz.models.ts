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
  count: number;
  offset: number;
}