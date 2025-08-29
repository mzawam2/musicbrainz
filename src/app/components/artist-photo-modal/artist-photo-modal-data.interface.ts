export interface ArtistPhotoModalData {
  imageUri: string;
  artistName?: string;
  altText?: string;
  metadata?: ImageMetadata;
}

export interface ImageMetadata {
  source?: ImageSource;
  dimensions?: ImageDimensions;
  originalUrl?: string;
  thumbnailUrl?: string;
}

export interface ImageDimensions {
  width?: number;
  height?: number;
}

export enum ImageSource {
  DISCOGS = 'discogs',
  MUSICBRAINZ = 'musicbrainz',
  EXTERNAL = 'external'
}

export enum ImageLoadState {
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error'
}