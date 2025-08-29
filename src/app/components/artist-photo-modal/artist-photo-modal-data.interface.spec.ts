import { ArtistPhotoModalData, ImageMetadata, ImageDimensions, ImageSource, ImageLoadState } from './artist-photo-modal-data.interface';

describe('ArtistPhotoModalData Interfaces and Enums', () => {
  describe('ArtistPhotoModalData', () => {
    it('should create valid modal data with required fields only', () => {
      const modalData: ArtistPhotoModalData = {
        imageUri: 'https://example.com/image.jpg'
      };

      expect(modalData.imageUri).toBe('https://example.com/image.jpg');
      expect(modalData.artistName).toBeUndefined();
      expect(modalData.altText).toBeUndefined();
      expect(modalData.metadata).toBeUndefined();
    });

    it('should create valid modal data with all optional fields', () => {
      const metadata: ImageMetadata = {
        source: ImageSource.DISCOGS,
        dimensions: { width: 800, height: 600 },
        originalUrl: 'https://example.com/original.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg'
      };

      const modalData: ArtistPhotoModalData = {
        imageUri: 'https://example.com/image.jpg',
        artistName: 'Test Artist',
        altText: 'Photo of Test Artist',
        metadata: metadata
      };

      expect(modalData.imageUri).toBe('https://example.com/image.jpg');
      expect(modalData.artistName).toBe('Test Artist');
      expect(modalData.altText).toBe('Photo of Test Artist');
      expect(modalData.metadata).toEqual(metadata);
    });
  });

  describe('ImageMetadata', () => {
    it('should create valid metadata with all optional fields', () => {
      const dimensions: ImageDimensions = { width: 1200, height: 800 };
      const metadata: ImageMetadata = {
        source: ImageSource.MUSICBRAINZ,
        dimensions: dimensions,
        originalUrl: 'https://example.com/full.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg'
      };

      expect(metadata.source).toBe(ImageSource.MUSICBRAINZ);
      expect(metadata.dimensions).toEqual(dimensions);
      expect(metadata.originalUrl).toBe('https://example.com/full.jpg');
      expect(metadata.thumbnailUrl).toBe('https://example.com/thumb.jpg');
    });

    it('should create valid metadata with minimal fields', () => {
      const metadata: ImageMetadata = {
        source: ImageSource.EXTERNAL
      };

      expect(metadata.source).toBe(ImageSource.EXTERNAL);
      expect(metadata.dimensions).toBeUndefined();
      expect(metadata.originalUrl).toBeUndefined();
      expect(metadata.thumbnailUrl).toBeUndefined();
    });
  });

  describe('ImageDimensions', () => {
    it('should create valid dimensions', () => {
      const dimensions: ImageDimensions = {
        width: 1920,
        height: 1080
      };

      expect(dimensions.width).toBe(1920);
      expect(dimensions.height).toBe(1080);
    });

    it('should create valid dimensions with optional fields', () => {
      const dimensions: ImageDimensions = {
        width: 800
      };

      expect(dimensions.width).toBe(800);
      expect(dimensions.height).toBeUndefined();
    });
  });

  describe('ImageSource enum', () => {
    it('should have correct enum values', () => {
      expect(ImageSource.DISCOGS).toBe('discogs');
      expect(ImageSource.MUSICBRAINZ).toBe('musicbrainz');
      expect(ImageSource.EXTERNAL).toBe('external');
    });

    it('should be assignable to metadata', () => {
      const metadata: ImageMetadata = {
        source: ImageSource.DISCOGS
      };

      expect(metadata.source).toBe(ImageSource.DISCOGS);
    });
  });

  describe('ImageLoadState enum', () => {
    it('should have correct enum values', () => {
      expect(ImageLoadState.LOADING).toBe('loading');
      expect(ImageLoadState.LOADED).toBe('loaded');
      expect(ImageLoadState.ERROR).toBe('error');
    });

    it('should represent all possible load states', () => {
      const loadingState = ImageLoadState.LOADING;
      const loadedState = ImageLoadState.LOADED;
      const errorState = ImageLoadState.ERROR;

      expect(loadingState).toBe('loading');
      expect(loadedState).toBe('loaded');
      expect(errorState).toBe('error');
    });
  });

  describe('Interface compatibility', () => {
    it('should work with real-world data structure', () => {
      const realWorldData: ArtistPhotoModalData = {
        imageUri: 'https://i.discogs.com/artist/123.jpg',
        artistName: 'The Beatles',
        altText: 'Photo of The Beatles',
        metadata: {
          source: ImageSource.DISCOGS,
          dimensions: {
            width: 600,
            height: 600
          },
          originalUrl: 'https://i.discogs.com/artist/123.jpg',
          thumbnailUrl: 'https://i.discogs.com/artist/123-150.jpg'
        }
      };

      // Should compile and be valid
      expect(realWorldData).toBeDefined();
      expect(realWorldData.metadata?.source).toBe(ImageSource.DISCOGS);
      expect(realWorldData.metadata?.dimensions?.width).toBe(600);
    });
  });
});