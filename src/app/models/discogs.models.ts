export interface DiscogsAuthConfig {
  consumerKey: string;
  consumerSecret: string;
  apiUrl: string;
}

export interface DiscogsUser {
  id: number;
  username: string;
  resource_url: string;
  consumer_name: string;
}

export interface DiscogsPagination {
  page: number;
  pages: number;
  per_page: number;
  items: number;
  urls: {
    last?: string;
    next?: string;
    prev?: string;
    first?: string;
  };
}

export interface DiscogsImage {
  type: 'primary' | 'secondary';
  uri: string;
  resource_url: string;
  uri150: string;
  width: number;
  height: number;
}

export interface DiscogsArtist {
  id: number;
  name: string;
  anv?: string; // Artist Name Variation
  join?: string;
  role?: string;
  tracks?: string;
  resource_url: string;
}

export interface DiscogsLabel {
  id: number;
  name: string;
  catno?: string; // Catalog Number
  entity_type?: string;
  entity_type_name?: string;
  resource_url: string;
}

export interface DiscogsTrack {
  position: string;
  type_: string;
  title: string;
  duration?: string;
  extraartists?: DiscogsArtist[];
}

export interface DiscogsIdentifier {
  type: string;
  value: string;
}

export interface DiscogsVideo {
  uri: string;
  title: string;
  description: string;
  duration: number;
  embed: boolean;
}

export interface DiscogsFormat {
  name: string;
  qty: string;
  descriptions?: string[];
  text?: string;
}

export interface DiscogsMarketStats {
  in_wantlist: number;
  in_collection: number;
  for_sale: number;
  sold_date?: string;
  lowest_price?: number;
  blocked_from_sale: boolean;
}

export interface DiscogsRelease {
  id: number;
  status: string;
  year: number;
  resource_url: string;
  uri: string;
  artists: DiscogsArtist[];
  artists_sort: string;
  labels: DiscogsLabel[];
  series: any[];
  companies: DiscogsLabel[];
  formats: DiscogsFormat[];
  data_quality: string;
  community: {
    want: number;
    have: number;
  };
  format_quantity: number;
  date_added: string;
  date_changed: string;
  num_for_sale: number;
  lowest_price: number;
  master_id?: number;
  master_url?: string;
  title: string;
  country: string;
  released: string;
  notes?: string;
  released_formatted: string;
  identifiers: DiscogsIdentifier[];
  videos?: DiscogsVideo[];
  genres: string[];
  styles: string[];
  tracklist: DiscogsTrack[];
  extraartists?: DiscogsArtist[];
  images?: DiscogsImage[];
  thumb?: string;
  estimated_weight?: number;
  blocked_from_sale?: boolean;
}

export interface DiscogsMaster {
  id: number;
  main_release: number;
  most_recent_release: number;
  resource_url: string;
  uri: string;
  versions_url: string;
  main_release_url: string;
  most_recent_release_url: string;
  num_for_sale: number;
  lowest_price: number;
  images: DiscogsImage[];
  genres: string[];
  styles: string[];
  year: number;
  tracklist: DiscogsTrack[];
  artists: DiscogsArtist[];
  title: string;
  data_quality: string;
  videos?: DiscogsVideo[];
}

export interface DiscogsArtistDetails {
  id: number;
  name: string;
  resource_url: string;
  uri: string;
  releases_url: string;
  images?: DiscogsImage[];
  profile?: string;
  urls?: string[];
  namevariations?: string[];
  aliases?: DiscogsArtist[];
  members?: DiscogsArtist[];
  groups?: DiscogsArtist[];
  data_quality: string;
}

export interface DiscogsLabelDetails {
  id: number;
  name: string;
  resource_url: string;
  uri: string;
  releases_url: string;
  images?: DiscogsImage[];
  profile?: string;
  urls?: string[];
  contact_info?: string;
  parent_label?: DiscogsLabel;
  sublabels?: DiscogsLabel[];
  data_quality: string;
}

export interface DiscogsSearchItem {
  id: number;
  type: 'release' | 'master' | 'artist' | 'label';
  user_data?: {
    in_wantlist: boolean;
    in_collection: boolean;
  };
  master_id?: number;
  master_url?: string;
  uri: string;
  resource_url: string;
  thumb: string;
  cover_image: string;
  title: string;
  year?: number;
  format?: string[];
  label?: string[];
  genre?: string[];
  style?: string[];
  country?: string;
  catno?: string;
  barcode?: string[];
  community?: {
    want: number;
    have: number;
  };
  format_quantity?: number;
  formats?: DiscogsFormat[];
}

export interface DiscogsSearchResult {
  results: DiscogsSearchItem[];
  pagination: DiscogsPagination;
}

export interface DiscogsSearchParams {
  q?: string;
  type?: 'release' | 'master' | 'artist' | 'label';
  title?: string;
  release_title?: string;
  credit?: string;
  artist?: string;
  anv?: string;
  label?: string;
  genre?: string;
  style?: string;
  country?: string;
  year?: string;
  format?: string;
  catno?: string;
  barcode?: string;
  track?: string;
  submitter?: string;
  contributor?: string;
  page?: number;
  per_page?: number;
}


export interface DiscogsRateLimitInfo {
  retryAfter: number;
  timestamp: number;
  isRateLimited: boolean;
  remaining: number;
  limit: number;
}

export interface DiscogsQueuedRequest<T> {
  id: string;
  requestFn: () => Promise<T>;
  priority: 'high' | 'medium' | 'low';
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

export interface DiscogsArtistRelease {
  id: number;
  title: string;
  year?: number;
  thumb?: string;
  role: string;
  type: 'release' | 'master';
  resource_url: string;
  artist?: string;
  main_release?: number;
  format?: string[];
  label?: string[];
  catno?: string;
  track_info?: string;
}

export interface DiscogsArtistReleasesResponse {
  pagination: DiscogsPagination;
  releases: DiscogsArtistRelease[];
}