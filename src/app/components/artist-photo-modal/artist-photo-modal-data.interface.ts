export interface ArtistPhotoModalData {
  imageUri: string;
  artistName?: string;
  altText?: string;
  metadata?: ImageMetadata;
  // Carousel navigation data
  carouselData?: CarouselNavigationData;
}

export interface CarouselNavigationData {
  currentIndex: number;
  totalCount: number;
  items: CarouselItem[];
}

export interface CarouselItem {
  imageUri: string;
  title: string;
  resourceUrl?: string;
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