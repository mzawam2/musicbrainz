import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { ArtistPhotoModalComponent } from './artist-photo-modal.component';
import { ArtistPhotoModalData } from './artist-photo-modal-data.interface';

describe('ArtistPhotoModalComponent', () => {
  let component: ArtistPhotoModalComponent;
  let fixture: ComponentFixture<ArtistPhotoModalComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<ArtistPhotoModalComponent>>;
  let mockData: ArtistPhotoModalData;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    mockData = {
      imageUri: 'https://example.com/artist-photo.jpg',
      artistName: 'Test Artist',
      altText: 'Photo of Test Artist'
    };

    await TestBed.configureTestingModule({
      imports: [
        ArtistPhotoModalComponent,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule
      ],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ArtistPhotoModalComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with correct data', () => {
    fixture.detectChanges();
    expect(component.data).toEqual(mockData);
  });

  it('should display loading spinner initially', () => {
    fixture.detectChanges();
    
    const spinner = fixture.debugElement.query(By.css('mat-spinner'));
    expect(spinner).toBeTruthy();
    expect(component.isLoading()).toBe(true);
  });

  it('should hide loading spinner when image loads successfully', () => {
    fixture.detectChanges();
    
    const imgElement = fixture.debugElement.query(By.css('img'));
    expect(imgElement).toBeTruthy();
    
    // Simulate image load event
    imgElement.nativeElement.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    
    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(false);
    
    const spinner = fixture.debugElement.query(By.css('mat-spinner'));
    expect(spinner).toBeFalsy();
  });

  it('should show error state when image fails to load', () => {
    fixture.detectChanges();
    
    const imgElement = fixture.debugElement.query(By.css('img'));
    expect(imgElement).toBeTruthy();
    
    // Simulate image error event
    imgElement.nativeElement.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    
    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(true);
    
    const errorMessage = fixture.debugElement.query(By.css('.error-state'));
    expect(errorMessage).toBeTruthy();
  });

  it('should display image with correct src and alt attributes', () => {
    fixture.detectChanges();
    
    const imgElement = fixture.debugElement.query(By.css('img'));
    expect(imgElement).toBeTruthy();
    expect(imgElement.nativeElement.src).toBe(mockData.imageUri);
    expect(imgElement.nativeElement.alt).toBe(mockData.altText);
  });

  it('should close modal when close button is clicked', () => {
    fixture.detectChanges();
    
    const closeButton = fixture.debugElement.query(By.css('.close-button'));
    expect(closeButton).toBeTruthy();
    
    closeButton.nativeElement.click();
    
    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should close modal when ESC key is pressed', () => {
    fixture.detectChanges();
    
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escEvent);
    
    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should not close modal for other key presses', () => {
    fixture.detectChanges();
    
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    document.dispatchEvent(enterEvent);
    
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should apply correct CSS classes for responsive image', () => {
    fixture.detectChanges();
    
    const imgElement = fixture.debugElement.query(By.css('img'));
    expect(imgElement).toBeTruthy();
    expect(imgElement.nativeElement.classList).toContain('modal-image');
  });

  it('should handle missing optional data gracefully', () => {
    const minimalData: ArtistPhotoModalData = {
      imageUri: 'https://example.com/test.jpg'
    };

    // Reset TestBed for this specific test
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        ArtistPhotoModalComponent,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule
      ],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: minimalData }
      ]
    });

    const minimalFixture = TestBed.createComponent(ArtistPhotoModalComponent);
    const minimalComponent = minimalFixture.componentInstance;
    minimalFixture.detectChanges();

    expect(minimalComponent).toBeTruthy();
    expect(minimalComponent.data).toEqual(minimalData);
    
    const imgElement = minimalFixture.debugElement.query(By.css('img'));
    expect(imgElement.nativeElement.src).toBe(minimalData.imageUri);
  });
});