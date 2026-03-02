import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LastfmService } from './lastfm.service';
import { RateLimiterService } from './rate-limiter.service';
import { LastfmAuthService } from './lastfm-auth.service';
import { 
  LastFmTopAlbumsResponse, 
  LastFmTopTagsResponse, 
  AlbumDiscoveryResult,
  LastFmError,
  LastfmTagArtist,
  LastFmTopArtistsByTagResponse 
} from '../models/lastfm.models';
import { of, throwError } from 'rxjs';

describe('LastfmService', () => {
  let service: LastfmService;
  let httpMock: HttpTestingController;
  let rateLimiterService: jasmine.SpyObj<RateLimiterService>;
  let authService: jasmine.SpyObj<LastfmAuthService>;

  const mockTopAlbumsResponse: LastFmTopAlbumsResponse = {
    topalbums: {
      album: [
        {
          name: 'Test Album 1',
          artist: {
            name: 'Test Artist 1',
            mbid: 'artist-mbid-1',
            url: 'https://www.last.fm/music/Test+Artist+1'
          },
          mbid: 'album-mbid-1',
          url: 'https://www.last.fm/music/Test+Artist+1/Test+Album+1',
          image: [
            { '#text': 'https://example.com/small.jpg', size: 'small' },
            { '#text': 'https://example.com/medium.jpg', size: 'medium' },
            { '#text': 'https://example.com/large.jpg', size: 'large' }
          ],
          playcount: 12345,
          rank: '1'
        },
        {
          name: 'Test Album 2',
          artist: 'Test Artist 2',
          url: 'https://www.last.fm/music/Test+Artist+2/Test+Album+2',
          image: [
            { '#text': 'https://example.com/small2.jpg', size: 'small' },
            { '#text': 'https://example.com/medium2.jpg', size: 'medium' },
            { '#text': 'https://example.com/large2.jpg', size: 'large' }
          ],
          playcount: 9876,
          rank: '2'
        }
      ],
      '@attr': {
        tag: 'rock',
        page: '1',
        perPage: '50',
        totalPages: '10',
        total: '500'
      }
    }
  };

  const mockTopTagsResponse: LastFmTopTagsResponse = {
    toptags: {
      tag: [
        { name: 'rock', count: 125000, reach: 500000 },
        { name: 'pop', count: 98000, reach: 450000 },
        { name: 'electronic', count: 75000, reach: 300000 }
      ],
      '@attr': {
        offset: '0',
        num_res: '50',
        total: '1000'
      }
    }
  };

  const mockErrorResponse: LastFmError = {
    error: 6,
    message: 'Invalid parameters'
  };

  beforeEach(() => {
    const rateLimiterSpy = jasmine.createSpyObj('RateLimiterService', ['queueRequest']);
    const authSpy = jasmine.createSpyObj('LastfmAuthService', ['isAuthenticated', 'sessionKey', 'createAuthenticatedParams']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        LastfmService,
        { provide: RateLimiterService, useValue: rateLimiterSpy },
        { provide: LastfmAuthService, useValue: authSpy }
      ]
    });

    service = TestBed.inject(LastfmService);
    httpMock = TestBed.inject(HttpTestingController);
    rateLimiterService = TestBed.inject(RateLimiterService) as jasmine.SpyObj<RateLimiterService>;
    authService = TestBed.inject(LastfmAuthService) as jasmine.SpyObj<LastfmAuthService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTopAlbumsByGenre', () => {
    it('should fetch top albums for a genre with default parameters', () => {
      const genre = 'rock';
      const expectedResult: AlbumDiscoveryResult = {
        albums: mockTopAlbumsResponse.topalbums.album,
        meta: {
          genre: 'rock',
          page: 1,
          perPage: 50,
          totalPages: 10,
          total: 500
        }
      };

      // Mock rate limiter to return the observable immediately
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopAlbumsByGenre(genre).subscribe(result => {
        expect(result).toEqual(expectedResult);
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] && 
        request.params.get('method') === 'tag.gettopalbums' &&
        request.params.get('tag') === genre
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe('50');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(mockTopAlbumsResponse);

      expect(rateLimiterService.queueRequest).toHaveBeenCalled();
    });

    it('should fetch top albums with custom parameters', () => {
      const params = { genre: 'jazz', limit: 25, page: 2 };

      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopAlbumsByGenre(params.genre, params.limit, params.page).subscribe();

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopalbums' &&
        request.params.get('tag') === params.genre &&
        request.params.get('limit') === params.limit.toString() &&
        request.params.get('page') === params.page.toString()
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockTopAlbumsResponse);
    });

    it('should handle API errors', () => {
      const genre = 'invalid-genre';
      
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopAlbumsByGenre(genre).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Last.fm API error');
        }
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopalbums' &&
        request.params.get('tag') === genre
      );
      req.flush(mockErrorResponse, { status: 400, statusText: 'Bad Request' });
    });

    it('should handle HTTP errors', () => {
      const genre = 'rock';
      
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopAlbumsByGenre(genre).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Network error');
        }
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopalbums' &&
        request.params.get('tag') === genre
      );
      req.error(new ErrorEvent('Network error'), { status: 0 });
    });

    it('should handle empty results', () => {
      const emptyResponse: LastFmTopAlbumsResponse = {
        topalbums: {
          album: [],
          '@attr': {
            tag: 'obscure-genre',
            page: '1',
            perPage: '50',
            totalPages: '0',
            total: '0'
          }
        }
      };

      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopAlbumsByGenre('obscure-genre').subscribe(result => {
        expect(result.albums).toEqual([]);
        expect(result.meta.total).toBe(0);
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopalbums' &&
        request.params.get('tag') === 'obscure-genre'
      );
      req.flush(emptyResponse);
    });
  });

  describe('getPopularTags', () => {
    it('should fetch popular tags', () => {
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getPopularTags().subscribe(tags => {
        expect(tags).toEqual(mockTopTagsResponse.toptags.tag);
        expect(tags.length).toBe(3);
        expect(tags[0].name).toBe('rock');
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettoptags'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockTopTagsResponse);
    });

    it('should handle errors when fetching popular tags', () => {
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getPopularTags().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Last.fm API error');
        }
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettoptags'
      );
      req.flush(mockErrorResponse, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('caching', () => {
    it('should cache responses for 5 minutes', () => {
      const genre = 'rock';
      
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      // First request
      service.getTopAlbumsByGenre(genre).subscribe();
      
      const firstReq = httpMock.expectOne((request) => 
        request.params.get('tag') === genre
      );
      firstReq.flush(mockTopAlbumsResponse);

      // Second request within cache TTL should not make HTTP call
      service.getTopAlbumsByGenre(genre).subscribe(result => {
        expect(result.albums.length).toBe(2);
      });

      // No additional HTTP requests should be made
      httpMock.expectNone((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopalbums' &&
        request.params.get('tag') === genre
      );
    });
  });

  describe('rate limiting integration', () => {
    it('should use rate limiter for all requests', () => {
      rateLimiterService.queueRequest.and.returnValue(of(mockTopAlbumsResponse));

      service.getTopAlbumsByGenre('rock').subscribe();

      expect(rateLimiterService.queueRequest).toHaveBeenCalledTimes(1);
      expect(rateLimiterService.queueRequest).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('should handle rate limiter errors', () => {
      const rateLimiterError = new Error('Rate limiter error');
      rateLimiterService.queueRequest.and.returnValue(throwError(() => rateLimiterError));

      service.getTopAlbumsByGenre('rock').subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error).toBe(rateLimiterError);
        }
      });
    });
  });

  describe('getTopArtistsByTag', () => {
    const mockTopArtistsByTagResponse: LastFmTopArtistsByTagResponse = {
      topartists: {
        artist: [
          {
            name: 'The Beatles',
            mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
            url: 'https://www.last.fm/music/The+Beatles',
            streamable: '0',
            image: [
              { '#text': 'https://example.com/beatles-small.jpg', size: 'small' },
              { '#text': 'https://example.com/beatles-large.jpg', size: 'large' }
            ],
            tagRank: 1,
            tagRelevance: 95,
            listeners: '5000000',
            playcount: '500000000'
          },
          {
            name: 'Led Zeppelin',
            mbid: '678d88b2-87b0-403b-b63d-5da7465aecc3',
            url: 'https://www.last.fm/music/Led+Zeppelin',
            streamable: '0',
            image: [
              { '#text': 'https://example.com/zeppelin-small.jpg', size: 'small' },
              { '#text': 'https://example.com/zeppelin-large.jpg', size: 'large' }
            ],
            tagRank: 2,
            tagRelevance: 92,
            listeners: '4000000',
            playcount: '400000000'
          }
        ],
        '@attr': {
          tag: 'rock',
          page: '1',
          perPage: '20',
          totalPages: '500',
          total: '10000'
        }
      }
    };

    it('should fetch top artists by tag successfully', () => {
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopArtistsByTag('rock', 20, 1).subscribe(artists => {
        expect(artists).toBeDefined();
        expect(artists.length).toBe(2);
        expect(artists[0].name).toBe('The Beatles');
        expect(artists[0].tagRank).toBe(1);
        expect(artists[0].tagRelevance).toBe(100);
        expect(artists[1].name).toBe('Led Zeppelin');
        expect(artists[1].tagRank).toBe(2);
        expect(artists[1].tagRelevance).toBe(98);
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopartists' &&
        request.params.get('tag') === 'rock' &&
        request.params.get('limit') === '20' &&
        request.params.get('page') === '1'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockTopArtistsByTagResponse);
    });

    it('should use default parameters when not provided', () => {
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopArtistsByTag('electronic').subscribe(artists => {
        expect(artists).toBeDefined();
        expect(artists.length).toBe(2);
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopartists' &&
        request.params.get('tag') === 'electronic' &&
        request.params.get('limit') === '20' &&
        request.params.get('page') === '1'
      );
      req.flush(mockTopArtistsByTagResponse);
    });

    it('should handle invalid tag parameter', () => {
      service.getTopArtistsByTag('', 20, 1).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Invalid tag parameter');
        }
      });

      // No HTTP request should be made for invalid parameters
    });

    it('should handle tag not found error', () => {
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopArtistsByTag('nonexistent-tag-12345').subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Last.fm API error 6');
        }
      });

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopartists'
      );
      req.flush({ error: 6, message: 'Tag not found' }, { status: 400, statusText: 'Bad Request' });
    });

    it('should respect rate limiting', () => {
      rateLimiterService.queueRequest.and.callFake((requestFn) => requestFn());

      service.getTopArtistsByTag('jazz').subscribe();

      const req = httpMock.expectOne((request) => 
        request.url === service['API_BASE_URL'] &&
        request.params.get('method') === 'tag.gettopartists'
      );
      req.flush(mockTopArtistsByTagResponse);

      expect(rateLimiterService.queueRequest).toHaveBeenCalledTimes(1);
      expect(rateLimiterService.queueRequest).toHaveBeenCalledWith(jasmine.any(Function));
    });
  });
});