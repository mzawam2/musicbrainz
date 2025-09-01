export interface LastFmImage {
  '#text': string;
  size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega';
}

export interface LastFmArtist {
  name: string;
  mbid?: string;
  url?: string;
}

export interface LastFmAlbum {
  name: string;
  artist: LastFmArtist | string;
  mbid?: string;
  url: string;
  image: LastFmImage[];
  playcount?: number;
  rank?: number | string;
}

export interface LastFmTopAlbumsResponse {
  topalbums: {
    album: LastFmAlbum[];
    '@attr': {
      tag: string;
      page: string;
      perPage: string;
      totalPages: string;
      total: string;
    };
  };
}

export interface LastFmTag {
  name: string;
  count?: number;
  reach?: number;
}

export interface LastFmTopTagsResponse {
  toptags: {
    tag: LastFmTag[];
    '@attr': {
      offset: string;
      num_res: string;
      total: string;
    };
  };
}

export interface LastFmError {
  error: number;
  message: string;
}

export interface AlbumDiscoveryParams {
  genre: string;
  limit?: number;
  page?: number;
}

export interface AlbumDiscoveryResult {
  albums: LastFmAlbum[];
  meta: {
    genre: string;
    page: number;
    perPage: number;
    totalPages: number;
    total: number;
  };
}

// Authentication related interfaces
export interface LastFmAuthConfig {
  apiKey: string;
  sharedSecret: string;
  apiUrl: string;
  authUrl: string;
  callbackUrl: string;
}

export interface LastFmSession {
  name: string;
  key: string;
  subscriber: string;
}

export interface LastFmAuthSessionResponse {
  session: LastFmSession;
}

export interface LastFmUser {
  name: string;
  realname?: string;
  image?: LastFmImage[];
  url?: string;
  country?: string;
  age?: string;
  gender?: string;
  subscriber?: string;
  playcount?: number;
}

// Artist Info related interfaces
export interface LastFmArtistStats {
  listeners: string;
  playcount: string;
}

export interface LastFmSimilarArtist {
  name: string;
  url: string;
  image?: LastFmImage[];
}

export interface LastFmBio {
  published: string;
  summary: string;
  content: string;
}

export interface LastFmArtistInfo {
  name: string;
  mbid?: string;
  url: string;
  image?: LastFmImage[];
  streamable: string;
  ontour?: string;
  stats?: LastFmArtistStats;
  similar?: {
    artist: LastFmSimilarArtist[];
  };
  tags?: {
    tag: LastFmTag[];
  };
  bio?: LastFmBio;
}

export interface LastFmArtistInfoResponse {
  artist: LastFmArtistInfo;
}