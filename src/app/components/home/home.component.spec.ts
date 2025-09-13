import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { HomeComponent } from './home.component';
import { ArtistPhotoModalComponent } from '../artist-photo-modal/artist-photo-modal.component';
import { MusicBrainzArtist } from '../../models/musicbrainz.models';
import { LastfmService } from '../../services/lastfm.service';
import { SpotifyService } from '../../services/spotify.service';
import { of } from 'rxjs';

class MockLastfmService {
  getTopTracks = jasmine.createSpy('getTopTracks').and.callFake((artist: string, limit: number) => {
    const tracks = Array.from({ length: limit }).map((_, i) => ({ name: `Track ${i+1}`, artist: { name: artist } }));
    return of(tracks as any);
  });
}

class MockSpotifyService {
  isAuthenticated = jasmine.createSpy('isAuthenticated').and.returnValue(true);
  searchTracks = jasmine.createSpy('searchTracks').and.callFake((query: string, limit: number) => {
    return of([{ uri: 'spotify:track:dummy', name: 'X', artists: [{ name: 'Y' }], external_urls: { spotify: '' } }] as any);
  });
  createPlaylist = jasmine.createSpy('createPlaylist').and.returnValue(of({ id: 'pl1', name: 'Test', description: '', external_urls: { spotify: '' }, tracks: { total: 0 } } as any));
  addTracksToPlaylist = jasmine.createSpy('addTracksToPlaylist').and.returnValue(of(true));
}

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let mockDialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    // Prevent auth flows during tests
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('lastfm_auth_declined', '1');
    localStorage.setItem('spotify_auth_declined', '1');
    
    mockDialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [HomeComponent, HttpClientTestingModule],
      providers: [
        { provide: MatDialog, useValue: mockDialog },
        { provide: LastfmService, useClass: MockLastfmService },
        { provide: SpotifyService, useClass: MockSpotifyService },
        provideRouter([])
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Similar Artists inline builder', () => {
    it('uses the selected count of similar artists (not fixed 5)', async () => {
      // Arrange: seed artist and similar list of 8
      component.selectedArtist.set({ id: 'mbid-seed', name: 'Seed', 'sort-name': 'Seed' } as MusicBrainzArtist);
      const similar = Array.from({ length: 8 }).map((_, i) => ({ name: `Similar ${i+1}`, mbid: `mbid-${i+1}`, url: '', image: [] }));
      component.similarArtists.set(similar as any);
      component.similarLimit.set(7); // user-selected count
      component.similarTracksPerArtist.set(2);

      const lastfm = TestBed.inject(LastfmService) as unknown as MockLastfmService;
      const spotify = TestBed.inject(SpotifyService) as unknown as MockSpotifyService;

      // Act
      await component.createSimilarArtistsPlaylist();

      // Assert: Last.fm top tracks fetched for first 7 artists
      expect(lastfm.getTopTracks.calls.count()).toBe(7);
      const calledArtists = lastfm.getTopTracks.calls.allArgs().map(args => args[0]);
      expect(calledArtists).toEqual(['Similar 1','Similar 2','Similar 3','Similar 4','Similar 5','Similar 6','Similar 7']);

      // Assert: playlist created and tracks added
      expect(spotify.createPlaylist).toHaveBeenCalled();
      expect(spotify.addTracksToPlaylist).toHaveBeenCalled();
    });
  });

  describe('openImageFullSize', () => {
    it('should open modal with correct data when artist is selected', () => {
      // Arrange
      const mockArtist: MusicBrainzArtist = {
        id: '123',
        name: 'Test Artist',
        'sort-name': 'Artist, Test',
        type: 'Person'
      };
      const imageUri = 'https://example.com/artist-photo.jpg';
      
      component.selectedArtist.set(mockArtist);

      // Act
      component.openImageFullSize(imageUri);

      // Assert
      expect(mockDialog.open).toHaveBeenCalledWith(ArtistPhotoModalComponent, {
        data: {
          imageUri: imageUri,
          artistName: 'Test Artist',
          altText: 'Photo of Test Artist'
        },
        panelClass: 'artist-photo-modal',
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        disableClose: false
      });
    });

    it('should open modal with fallback alt text when no artist is selected', () => {
      // Arrange
      const imageUri = 'https://example.com/artist-photo.jpg';
      component.selectedArtist.set(null);

      // Act
      component.openImageFullSize(imageUri);

      // Assert
      expect(mockDialog.open).toHaveBeenCalledWith(ArtistPhotoModalComponent, {
        data: {
          imageUri: imageUri,
          artistName: undefined,
          altText: 'Photo of artist'
        },
        panelClass: 'artist-photo-modal',
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        disableClose: false
      });
    });

    it('should not call window.open anymore', () => {
      // Arrange
      spyOn(window, 'open');
      const imageUri = 'https://example.com/test.jpg';

      // Act
      component.openImageFullSize(imageUri);

      // Assert
      expect(window.open).not.toHaveBeenCalled();
      expect(mockDialog.open).toHaveBeenCalled();
    });
  });
});
