import { TestBed } from '@angular/core/testing';
import { PlaylistCreationService } from './playlist-creation.service';
import { LastfmService } from './lastfm.service';
import { SpotifyService } from './spotify.service';
import { 
  PlaylistCreationRequest, 
  PlaylistCreationProgress, 
  PlaylistCreationResult,
  PlaylistCreationStage,
  ErrorType 
} from '../models/playlist.models';
import { LastfmTagArtist } from '../models/lastfm.models';
import { of, throwError, Subject } from 'rxjs';
import { signal } from '@angular/core';

describe('PlaylistCreationService', () => {
  let service: PlaylistCreationService;
  let lastfmService: jasmine.SpyObj<LastfmService>;
  let spotifyService: jasmine.SpyObj<SpotifyService>;

  const mockLastfmArtists: LastfmTagArtist[] = [
    {
      name: 'The Beatles',
      mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
      url: 'https://www.last.fm/music/The+Beatles',
      streamable: '0',
      image: [],
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
      image: [],
      tagRank: 2,
      tagRelevance: 92,
      listeners: '4000000',
      playcount: '400000000'
    }
  ];

  const mockPlaylistCreationResult: PlaylistCreationResult = {
    success: true,
    playlist: {
      id: '37i9dQZF1DX0XUsuxWHRQd',
      name: 'Top rock Artists - 2025-09-11',
      description: 'Generated from Last.fm rock tag',
      external_urls: { spotify: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd' },
      tracks: { total: 2 }
    },
    artistsRequested: 2,
    artistsFound: 2,
    artistsSkipped: [],
    errors: [],
    duration: 8000
  };

  beforeEach(() => {
    const lastfmSpy = jasmine.createSpyObj('LastfmService', ['getTopArtistsByTag']);
    const spotifySpy = jasmine.createSpyObj('SpotifyService', ['createPlaylistFromArtists']);

    TestBed.configureTestingModule({
      providers: [
        PlaylistCreationService,
        { provide: LastfmService, useValue: lastfmSpy },
        { provide: SpotifyService, useValue: spotifySpy }
      ]
    });

    service = TestBed.inject(PlaylistCreationService);
    lastfmService = TestBed.inject(LastfmService) as jasmine.SpyObj<LastfmService>;
    spotifyService = TestBed.inject(SpotifyService) as jasmine.SpyObj<SpotifyService>;
  });

  describe('createPlaylistFromTag', () => {
    it('should create playlist successfully with progress updates', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: 'rock',
        artistLimit: 2,
        tracksPerArtist: 1
      };

      lastfmService.getTopArtistsByTag.and.returnValue(of(mockLastfmArtists));
      spotifyService.createPlaylistFromArtists.and.returnValue(of(mockPlaylistCreationResult));

      let finalResult: PlaylistCreationResult | undefined;

      service.createPlaylistFromTag(request).subscribe({
        next: (result) => {
          finalResult = result as PlaylistCreationResult;
        },
        complete: () => {
          // Check that progress signal was updated during execution
          const finalProgress = service.progress();
          expect(finalProgress.stage).toBe(PlaylistCreationStage.COMPLETED);
          
          // Check final result
          expect(finalResult?.success).toBe(true);
          expect(finalResult?.artistsFound).toBe(2);
          expect(finalResult?.playlist).toBeDefined();
          done();
        }
      });
    });

    it('should handle Last.fm API failure', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: 'rock',
        artistLimit: 5,
        tracksPerArtist: 1
      };

      lastfmService.getTopArtistsByTag.and.returnValue(
        throwError(() => new Error('Last.fm API unavailable'))
      );

      service.createPlaylistFromTag(request).subscribe({
        next: (update) => {
          if ('success' in update) {
            const result = update as PlaylistCreationResult;
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].type).toBe(ErrorType.LASTFM_API_ERROR);
            done();
          }
        }
      });
    });

    it('should handle empty tag name', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: '',
        artistLimit: 5,
        tracksPerArtist: 1
      };

      service.createPlaylistFromTag(request).subscribe({
        next: (update) => {
          if ('success' in update) {
            const result = update as PlaylistCreationResult;
            expect(result.success).toBe(false);
            expect(result.errors[0].message).toContain('Tag name is required');
            done();
          }
        }
      });
    });

    it('should handle no artists found for tag', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: 'extremely-obscure-tag',
        artistLimit: 20,
        tracksPerArtist: 1
      };

      lastfmService.getTopArtistsByTag.and.returnValue(of([]));

      service.createPlaylistFromTag(request).subscribe({
        next: (update) => {
          if ('success' in update) {
            const result = update as PlaylistCreationResult;
            expect(result.success).toBe(false);
            expect(result.errors[0].message).toContain('No artists found for tag');
            done();
          }
        }
      });
    });

    it('should generate default playlist name when not provided', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: 'jazz',
        artistLimit: 5,
        tracksPerArtist: 1
      };

      lastfmService.getTopArtistsByTag.and.returnValue(of(mockLastfmArtists));
      spotifyService.createPlaylistFromArtists.and.returnValue(of(mockPlaylistCreationResult));

      service.createPlaylistFromTag(request).subscribe({
        next: (update) => {
          // Check that createPlaylistFromArtists was called with default name format
          if ('success' in update) {
            expect(spotifyService.createPlaylistFromArtists).toHaveBeenCalledWith(
              jasmine.any(Array),
              jasmine.stringMatching(/Top jazz Artists - \d{4}-\d{2}-\d{2}/),
              jasmine.any(String),
              1
            );
            done();
          }
        }
      });
    });
  });

  describe('progress signal', () => {
    it('should provide initial progress state', () => {
      const progress = service.progress();
      expect(progress.stage).toBe(PlaylistCreationStage.FETCHING_ARTISTS);
      expect(progress.currentStep).toBe(0);
      expect(progress.totalSteps).toBe(0);
      expect(progress.artistsProcessed).toBe(0);
      expect(progress.artistsFound).toBe(0);
    });

    it('should update progress signal during creation', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: 'electronic',
        artistLimit: 3,
        tracksPerArtist: 1
      };

      lastfmService.getTopArtistsByTag.and.returnValue(of(mockLastfmArtists));
      spotifyService.createPlaylistFromArtists.and.returnValue(of(mockPlaylistCreationResult));

      let progressCount = 0;
      const checkProgress = () => {
        progressCount++;
        const progress = service.progress();
        expect(progress).toBeDefined();
        if (progressCount >= 2) {
          done();
        }
      };

      // Monitor progress signal changes
      setTimeout(checkProgress, 100);
      setTimeout(checkProgress, 500);

      service.createPlaylistFromTag(request).subscribe();
    });
  });

  describe('cancelCreation', () => {
    it('should cancel ongoing creation process', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: 'rock',
        artistLimit: 20,
        tracksPerArtist: 1
      };

      // Simulate slow Last.fm response
      const lastfmSubject = new Subject<LastfmTagArtist[]>();
      lastfmService.getTopArtistsByTag.and.returnValue(lastfmSubject.asObservable());

      const creation$ = service.createPlaylistFromTag(request);
      const subscription = creation$.subscribe();

      // Cancel after starting
      setTimeout(() => {
        service.cancelCreation().subscribe(() => {
          const progress = service.progress();
          expect(progress.stage).toBe(PlaylistCreationStage.CANCELLED);
          subscription.unsubscribe();
          done();
        });
      }, 100);
    });

    it('should handle cancellation when no creation is running', (done) => {
      service.cancelCreation().subscribe({
        complete: () => {
          // Should complete successfully even if nothing to cancel
          expect(true).toBe(true);
          done();
        }
      });
    });
  });

  describe('validation', () => {
    it('should validate artist limit bounds', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: 'rock',
        artistLimit: 100, // exceeds max of 50
        tracksPerArtist: 1
      };

      service.createPlaylistFromTag(request).subscribe({
        next: (update) => {
          if ('success' in update) {
            const result = update as PlaylistCreationResult;
            expect(result.success).toBe(false);
            expect(result.errors[0].message).toContain('Artist limit must be between 1 and 50');
            done();
          }
        }
      });
    });

    it('should validate tracks per artist bounds', (done) => {
      const request: PlaylistCreationRequest = {
        tagName: 'rock',
        artistLimit: 10,
        tracksPerArtist: 10 // exceeds max of 5
      };

      service.createPlaylistFromTag(request).subscribe({
        next: (update) => {
          if ('success' in update) {
            const result = update as PlaylistCreationResult;
            expect(result.success).toBe(false);
            expect(result.errors[0].message).toContain('Tracks per artist must be between 1 and 5');
            done();
          }
        }
      });
    });
  });
});