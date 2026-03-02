import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { CoverArtArchiveService } from '../../services/cover-art-archive.service';
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
  private coverArtService = inject(CoverArtArchiveService);
  private discogsService = inject(DiscogsService);

  private keydownListener?: (event: KeyboardEvent) => void;
  private destroy$ = new Subject<void>();
  private failedIndices = new Set<number>();
  private navigationDirection: 1 | -1 = 1;

  ngOnInit(): void {
    // New carousel format (from home component album carousel)
    if (this.data.carouselItems && this.data.currentIndex !== undefined) {
      this.currentIndex.set(this.data.currentIndex);
      const item = this.data.carouselItems[this.data.currentIndex];
      if (item) {
        this.currentItem.set(item);
        this.currentImageUri.set(item.imageUri);
      }
      console.log('[ArtistPhotoModal] init(new-carousel)', {
        totalItems: this.data.carouselItems.length,
        initialIndex: this.data.currentIndex,
        initialItem: item ? {
          releaseGroupId: item.releaseGroupId,
          title: item.title,
          imageUri: item.imageUri,
          fallbackImageUri: item.fallbackImageUri
        } : null
      });
    }
    // Legacy carousel format (from release cards)
    else if (this.data.carouselData) {
      this.currentIndex.set(this.data.carouselData.currentIndex);
      this.updateCurrentItem();
      const item = this.currentItem();
      if (item) {
        this.currentImageUri.set(item.imageUri);
      }
      console.log('[ArtistPhotoModal] init(legacy-carousel)', {
        totalItems: this.data.carouselData.items.length,
        initialIndex: this.data.carouselData.currentIndex
      });
    }
    // Single image
    else if (this.data.imageUri) {
      this.currentImageUri.set(this.data.imageUri);
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
    this.failedIndices.delete(this.currentIndex());
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const currentItem = this.currentItem();
    const failedSrc = img.src;

    console.warn('[ArtistPhotoModal] image error', {
      currentIndex: this.currentIndex(),
      currentTitle: currentItem?.title,
      releaseGroupId: currentItem?.releaseGroupId,
      failedSrc,
      hasFallback: !!currentItem?.fallbackImageUri,
      hasDiscogsResourceUrl: !!currentItem?.discogsResourceUrl
    });

    // Retry CAA once at 500px, but never bounce back if we already tried the designated fallback URL.
    if (
      img.src.includes('coverartarchive.org') &&
      currentItem?.releaseGroupId &&
      !img.src.includes('front-500') &&
      img.src !== currentItem?.fallbackImageUri
    ) {
      // Try lower resolution (500px instead of 1200px)
      const fallbackUrl = this.coverArtService.getReleaseGroupFrontCoverUrl(
        currentItem.releaseGroupId,
        500
      );

      console.log('[ArtistPhotoModal] retrying lower-res CAA image', {
        currentIndex: this.currentIndex(),
        releaseGroupId: currentItem.releaseGroupId,
        fallbackUrl
      });
      img.src = fallbackUrl;
      return;
    }

    // If CAA failed, try to fetch full-size image from Discogs API
    if (
      currentItem?.discogsResourceUrl &&
      img.src.includes('coverartarchive.org')
    ) {
      console.log('[ArtistPhotoModal] fetching full-size image from Discogs API', {
        currentIndex: this.currentIndex(),
        discogsResourceUrl: currentItem.discogsResourceUrl
      });

      this.fetchDiscogsFullSizeImage(currentItem.discogsResourceUrl, img);
      return;
    }

    // If Discogs API fetch failed, try Discogs thumb fallback when available.
    if (currentItem?.fallbackImageUri && img.src !== currentItem.fallbackImageUri) {
      console.log('[ArtistPhotoModal] switching to Discogs thumbnail fallback', {
        currentIndex: this.currentIndex(),
        title: currentItem.title,
        fallbackImageUri: currentItem.fallbackImageUri
      });
      img.src = currentItem.fallbackImageUri;
      return;
    }

    this.failedIndices.add(this.currentIndex());

    // In carousel mode, skip broken entries instead of showing a hard error.
    if (this.hasCarouselData() && this.skipToNextAvailableImage()) {
      return;
    }

    console.error('[ArtistPhotoModal] no more fallbacks; showing error state', {
      currentIndex: this.currentIndex(),
      currentTitle: currentItem?.title,
      failedIndices: Array.from(this.failedIndices.values())
    });

    // All fallbacks failed - show error state
    this.isLoading.set(false);
    this.hasError.set(true);
  }

  close(): void {
    this.dialogRef.close();
  }

  private fetchDiscogsFullSizeImage(resourceUrl: string, imgElement: HTMLImageElement): void {
    // Parse the resource URL to determine if it's a master or release
    // Example: https://api.discogs.com/masters/757578 or https://api.discogs.com/releases/12345
    const masterMatch = resourceUrl.match(/\/masters\/(\d+)/);
    const releaseMatch = resourceUrl.match(/\/releases\/(\d+)/);

    if (masterMatch) {
      const masterId = parseInt(masterMatch[1], 10);
      console.log('[ArtistPhotoModal] fetching master details', { masterId });

      this.discogsService.getMaster(masterId).subscribe({
        next: (master) => {
          if (master?.images && master.images.length > 0) {
            // Find primary image, or use first image if no primary
            const primaryImage = master.images.find(img => img.type === 'primary') || master.images[0];
            console.log('[ArtistPhotoModal] using full-size Discogs image from master', {
              masterId,
              imageUri: primaryImage.uri
            });
            imgElement.src = primaryImage.uri;
          } else {
            console.warn('[ArtistPhotoModal] no images in master response', { masterId });
            this.fallbackToThumbnail(imgElement);
          }
        },
        error: (error) => {
          console.error('[ArtistPhotoModal] error fetching master details', { masterId, error });
          this.fallbackToThumbnail(imgElement);
        }
      });
    } else if (releaseMatch) {
      const releaseId = parseInt(releaseMatch[1], 10);
      console.log('[ArtistPhotoModal] fetching release details', { releaseId });

      this.discogsService.getRelease(releaseId).subscribe({
        next: (release) => {
          if (release?.images && release.images.length > 0) {
            // Find primary image, or use first image if no primary
            const primaryImage = release.images.find(img => img.type === 'primary') || release.images[0];
            console.log('[ArtistPhotoModal] using full-size Discogs image from release', {
              releaseId,
              imageUri: primaryImage.uri
            });
            imgElement.src = primaryImage.uri;
          } else {
            console.warn('[ArtistPhotoModal] no images in release response', { releaseId });
            this.fallbackToThumbnail(imgElement);
          }
        },
        error: (error) => {
          console.error('[ArtistPhotoModal] error fetching release details', { releaseId, error });
          this.fallbackToThumbnail(imgElement);
        }
      });
    } else {
      console.warn('[ArtistPhotoModal] could not parse Discogs resource URL', { resourceUrl });
      this.fallbackToThumbnail(imgElement);
    }
  }

  private fallbackToThumbnail(imgElement: HTMLImageElement): void {
    const currentItem = this.currentItem();
    if (currentItem?.fallbackImageUri && imgElement.src !== currentItem.fallbackImageUri) {
      console.log('[ArtistPhotoModal] falling back to Discogs thumbnail', {
        fallbackImageUri: currentItem.fallbackImageUri
      });
      imgElement.src = currentItem.fallbackImageUri;
    } else {
      // Mark as failed and skip to next
      this.failedIndices.add(this.currentIndex());
      if (this.hasCarouselData() && this.skipToNextAvailableImage()) {
        return;
      }
      this.isLoading.set(false);
      this.hasError.set(true);
    }
  }

  // Carousel navigation methods
  hasCarouselData(): boolean {
    // New format
    if (this.data.carouselItems) {
      return this.data.carouselItems.length > 1;
    }
    // Legacy format
    return !!this.data.carouselData && this.data.carouselData.items.length > 1;
  }

  canNavigatePrevious(): boolean {
    return this.hasCarouselData() && this.currentIndex() > 0;
  }

  canNavigateNext(): boolean {
    if (this.data.carouselItems) {
      return this.hasCarouselData() && this.currentIndex() < (this.data.carouselItems.length - 1);
    }
    return this.hasCarouselData() &&
           this.currentIndex() < (this.data.carouselData!.totalCount - 1);
  }

  previousImage(): void {
    if (this.canNavigatePrevious()) {
      console.log('[ArtistPhotoModal] previousImage click', {
        fromIndex: this.currentIndex()
      });
      this.navigationDirection = -1;
      // Reset state
      this.hasError.set(false);
      this.isLoading.set(true);

      this.currentIndex.update(index => index - 1);

      // New format
      if (this.data.carouselItems) {
        const item = this.data.carouselItems[this.currentIndex()];
        if (item) {
          this.currentItem.set(item);
          this.currentImageUri.set(item.imageUri);
        }
      }
      // Legacy format
      else {
        this.updateCurrentItem();
        this.loadHighResolutionImage();
      }
    }
  }

  nextImage(): void {
    if (this.canNavigateNext()) {
      console.log('[ArtistPhotoModal] nextImage click', {
        fromIndex: this.currentIndex()
      });
      this.navigationDirection = 1;
      // Reset state
      this.hasError.set(false);
      this.isLoading.set(true);

      this.currentIndex.update(index => index + 1);

      // New format
      if (this.data.carouselItems) {
        const item = this.data.carouselItems[this.currentIndex()];
        if (item) {
          this.currentItem.set(item);
          this.currentImageUri.set(item.imageUri);
        }
      }
      // Legacy format
      else {
        this.updateCurrentItem();
        this.loadHighResolutionImage();
      }
    }
  }

  private updateCurrentItem(): void {
    if (this.data.carouselData) {
      const index = this.currentIndex();
      const items = this.data.carouselData.items;
      
      // Validate index bounds and clamp if necessary
      if (index < 0 || index >= items.length) {
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        this.currentIndex.set(clampedIndex);
        console.warn(`Carousel index ${index} out of bounds, clamped to ${clampedIndex}`);
      }
      
      const item = items[this.currentIndex()];
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

    if (!currentItem) return;

    // We're already using high-res Cover Art Archive URLs from carousel
    // Just set the URI directly
    this.currentImageUri.set(currentItem.imageUri);
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
      // New format
      if (this.data.carouselItems) {
        return `${this.currentIndex() + 1} of ${this.data.carouselItems.length}`;
      }
      // Legacy format
      return `${this.currentIndex() + 1} of ${this.data.carouselData!.totalCount}`;
    }
    return '';
  }

  private skipToNextAvailableImage(): boolean {
    const totalItems = this.getCarouselItemCount();
    if (totalItems <= 1) {
      return false;
    }

    const current = this.currentIndex();
    const primaryDirection = this.navigationDirection;
    const secondaryDirection: 1 | -1 = primaryDirection === 1 ? -1 : 1;

    const nextInPrimaryDirection = this.findNearestUnfailedIndex(current, primaryDirection, totalItems);
    if (nextInPrimaryDirection !== null) {
      console.log('[ArtistPhotoModal] skipToNextAvailableImage -> primary direction', {
        fromIndex: current,
        toIndex: nextInPrimaryDirection,
        direction: primaryDirection
      });
      this.goToCarouselIndex(nextInPrimaryDirection);
      return true;
    }

    const nextInSecondaryDirection = this.findNearestUnfailedIndex(current, secondaryDirection, totalItems);
    if (nextInSecondaryDirection !== null) {
      console.log('[ArtistPhotoModal] skipToNextAvailableImage -> secondary direction', {
        fromIndex: current,
        toIndex: nextInSecondaryDirection,
        direction: secondaryDirection
      });
      this.goToCarouselIndex(nextInSecondaryDirection);
      return true;
    }

    console.warn('[ArtistPhotoModal] skipToNextAvailableImage -> no candidate found', {
      currentIndex: current,
      totalItems,
      failedIndices: Array.from(this.failedIndices.values())
    });
    return false;
  }

  private findNearestUnfailedIndex(
    startIndex: number,
    direction: 1 | -1,
    totalItems: number
  ): number | null {
    for (let i = startIndex + direction; i >= 0 && i < totalItems; i += direction) {
      if (!this.failedIndices.has(i)) {
        return i;
      }
    }
    return null;
  }

  private goToCarouselIndex(index: number): void {
    console.log('[ArtistPhotoModal] goToCarouselIndex', {
      fromIndex: this.currentIndex(),
      toIndex: index
    });
    this.hasError.set(false);
    this.isLoading.set(true);
    this.currentIndex.set(index);

    if (this.data.carouselItems) {
      const item = this.data.carouselItems[index];
      if (item) {
        this.currentItem.set(item);
        this.currentImageUri.set(item.imageUri);
      }
      return;
    }

    this.updateCurrentItem();
    this.loadHighResolutionImage();
  }

  private getCarouselItemCount(): number {
    if (this.data.carouselItems) {
      return this.data.carouselItems.length;
    }
    if (this.data.carouselData) {
      return this.data.carouselData.items.length;
    }
    return 0;
  }
}
