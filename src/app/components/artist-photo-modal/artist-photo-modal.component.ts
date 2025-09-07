import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { DiscogsService } from '../../services/discogs.service';

import { ArtistPhotoModalData, CarouselItem } from './artist-photo-modal-data.interface';

@Component({
  selector: 'app-artist-photo-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './artist-photo-modal.component.html',
  styleUrls: ['./artist-photo-modal.component.scss']
})
export class ArtistPhotoModalComponent implements OnInit, OnDestroy {
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);
  currentIndex = signal<number>(0);
  currentItem = signal<CarouselItem | null>(null);
  currentImageUri = signal<string>('');

  public dialogRef = inject(MatDialogRef<ArtistPhotoModalComponent>);
  public data = inject<ArtistPhotoModalData>(MAT_DIALOG_DATA);
  private discogsService = inject(DiscogsService);

  private keydownListener?: (event: KeyboardEvent) => void;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Initialize with the provided image URI (which is already high-res for the first item)
    this.currentImageUri.set(this.data.imageUri);
    
    // Initialize carousel data if available
    if (this.data.carouselData) {
      this.currentIndex.set(this.data.carouselData.currentIndex);
      this.updateCurrentItem();
    }

    this.keydownListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.close();
      } else if (event.key === 'ArrowLeft') {
        this.previousImage();
      } else if (event.key === 'ArrowRight') {
        this.nextImage();
      }
    };
    document.addEventListener('keydown', this.keydownListener);
  }

  ngOnDestroy(): void {
    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onImageLoad(): void {
    this.isLoading.set(false);
    this.hasError.set(false);
  }

  onImageError(): void {
    this.isLoading.set(false);
    this.hasError.set(true);
  }

  close(): void {
    this.dialogRef.close();
  }

  // Carousel navigation methods
  hasCarouselData(): boolean {
    return !!this.data.carouselData && this.data.carouselData.items.length > 1;
  }

  canNavigatePrevious(): boolean {
    return this.hasCarouselData() && this.currentIndex() > 0;
  }

  canNavigateNext(): boolean {
    return this.hasCarouselData() && 
           this.currentIndex() < (this.data.carouselData!.totalCount - 1);
  }

  previousImage(): void {
    if (this.canNavigatePrevious()) {
      this.currentIndex.update(index => index - 1);
      this.updateCurrentItem();
      this.loadHighResolutionImage();
    }
  }

  nextImage(): void {
    if (this.canNavigateNext()) {
      this.currentIndex.update(index => index + 1);
      this.updateCurrentItem();
      this.loadHighResolutionImage();
    }
  }

  private updateCurrentItem(): void {
    if (this.data.carouselData) {
      const item = this.data.carouselData.items[this.currentIndex()];
      this.currentItem.set(item);
    }
  }

  private resetLoadingState(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
  }

  private loadHighResolutionImage(): void {
    this.resetLoadingState();
    const currentItem = this.currentItem();
    
    if (!currentItem) {
      return;
    }

    // If we have a Discogs resource URL, fetch the full-size image
    if (currentItem.resourceUrl) {
      this.discogsService.makeDirectUrlRequest<any>(currentItem.resourceUrl)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (releaseItem) => {
            let imageUri = currentItem.imageUri; // fallback to thumbnail
            
            // Try to get the best image from the release/master
            if (releaseItem && releaseItem.images && releaseItem.images.length > 0) {
              // Find primary image or use first available
              const primaryImage = releaseItem.images.find((img: any) => img.type === 'primary') || releaseItem.images[0];
              imageUri = primaryImage.uri;
              console.log(`🎵 🖼️ Modal navigation: Using full-resolution image from Discogs API: ${imageUri}`);
            } else {
              console.log(`🎵 🖼️ Modal navigation: No full-resolution images found, using thumbnail: ${imageUri}`);
            }

            this.currentImageUri.set(imageUri);
          },
          error: (error) => {
            console.error(`🎵 Modal navigation: Error fetching full-size image from Discogs:`, error);
            // Fallback to thumbnail on error
            this.currentImageUri.set(currentItem.imageUri);
          }
        });
    } else {
      // No resource URL, use thumbnail directly
      console.log(`🎵 🖼️ Modal navigation: No resource URL available, using thumbnail: ${currentItem.imageUri}`);
      this.currentImageUri.set(currentItem.imageUri);
    }
  }

  getCurrentImageUri(): string {
    return this.currentImageUri();
  }

  getCurrentAltText(): string {
    const item = this.currentItem();
    if (item) {
      return `Album cover for ${item.title}`;
    }
    return this.data.altText || 'Artist photo';
  }

  getPositionText(): string {
    if (this.hasCarouselData()) {
      return `${this.currentIndex() + 1} of ${this.data.carouselData!.totalCount}`;
    }
    return '';
  }
}