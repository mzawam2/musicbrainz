import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { HomeComponent } from './home.component';
import { ArtistPhotoModalComponent } from '../artist-photo-modal/artist-photo-modal.component';
import { MusicBrainzArtist } from '../../models/musicbrainz.models';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let mockDialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    mockDialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: MatDialog, useValue: mockDialog },
        provideHttpClient(),
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
