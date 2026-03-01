export interface ArtistPhotoModalData {
  imageUri?: string;
  artistName?: string;
  altText?: string;
  metadata?: ImageMetadata;
  // Carousel navigation data
  carouselData?: CarouselNavigationData;
  // New carousel-only data
  carouselItems?: CarouselItem[];
  currentIndex?: number;
  imageType?: 'album-art' | 'artist-photo';
}

export interface CarouselNavigationData {
  currentIndex: number;
  totalCount: number;
  items: CarouselItem[];
}

export interface CarouselItem {
  imageUri: string;           // High-res Cover Art Archive URL or Discogs URL
  fallbackImageUri?: string;  // Discogs thumb fallback when CAA image is missing
  title: string;
  releaseGroupId?: string;    // For constructing fallback URLs
  resourceUrl?: string;       // DEPRECATED: Discogs resource URL
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
