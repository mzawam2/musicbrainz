import { Component, input, output, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';

import { Subject, takeUntil, forkJoin } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { EnhancedReleaseGroup, DetailedRelease, CoverArtInfo } from '../../../models/musicbrainz.models';
import { MusicBrainzService } from '../../../services/musicbrainz.service';
import { CoverArtArchiveService } from '../../../services/cover-art-archive.service';
import { ArtistPhotoModalComponent } from '../../artist-photo-modal/artist-photo-modal.component';
import { ArtistPhotoModalData, CarouselItem } from '../../artist-photo-modal/artist-photo-modal-data.interface';

@Component({
  selector: 'app-release-card',
  imports: [RouterLink],
  templateUrl: './release-card.component.html',
  styleUrl: './release-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReleaseCardComponent implements OnInit, OnDestroy {
  // Input and output functions
  releaseGroup = input.required<EnhancedReleaseGroup>();
  discogsAlbumArt = input<string | null>(null);
  discogsResourceUrl = input<string | null>(null);
  allReleaseGroups = input<EnhancedReleaseGroup[]>([]);
  currentReleaseIndex = input<number>(0);
  artistName = input<string>('');
  expand = output<string>();
  collapse = output<string>();

  // Injected services
  private musicBrainzService = inject(MusicBrainzService);
  private coverArtService = inject(CoverArtArchiveService);
  private dialog = inject(MatDialog);

  // State signals
  detailedReleases = signal<DetailedRelease[]>([]);
  coverArt = signal<CoverArtInfo | null>(null);
  loadingDetails = signal(false);
  loadingCoverArt = signal(false);
  error = signal<string | null>(null);
  isExpanded = signal(false);

  // Album art fallback state
  private caaFailed = signal(false);
  private discogsFailed = signal(false);

  // Computed values
  primaryType = computed(() => this.releaseGroup()['primary-type'] || 'Other');
  secondaryTypes = computed(() => this.releaseGroup()['secondary-types']?.join(', ') || '');
  releaseYear = computed(() => {
    const firstReleaseDate = this.releaseGroup()['first-release-date'];
    return firstReleaseDate ? firstReleaseDate.split('-')[0] : 'Unknown';
  });
  releaseDate = computed(() => {
    const firstReleaseDate = this.releaseGroup()['first-release-date'];
    if (!firstReleaseDate) return 'Unknown date';

    const date = new Date(firstReleaseDate);
    if (isNaN(date.getTime())) return firstReleaseDate;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });
  artistCredit = computed(() => {
    const artistCredit = this.releaseGroup()['artist-credit'];
    if (!artistCredit || artistCredit.length === 0) return '';

    return artistCredit
      .map(credit => credit.name + (credit.joinphrase || ''))
      .join('');
  });

  // Primary album art URL (Cover Art Archive)
  primaryAlbumArtUrl = computed(() => {
    const rg = this.releaseGroup();
    return this.coverArtService.getReleaseGroupThumbnailUrl(rg.id);
  });

  // Reactive image URL that handles the CAA -> Discogs fallback chain.
  // When the Discogs thumb arrives after the CAA image has already failed,
  // this computed recalculates and provides the new URL to the template.
  displayImageUrl = computed(() => {
    if (!this.caaFailed()) {
      return this.primaryAlbumArtUrl();
    }

    // CAA failed — try Discogs fallback
    const rg = this.releaseGroup();
    const discogsFallback = this.discogsAlbumArt() || rg.thumb;
    if (discogsFallback && !this.discogsFailed()) {
      return discogsFallback;
    }

    return null;
  });

  imageVisible = computed(() => this.displayImageUrl() !== null);


  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Initialize expanded state from input if needed
    const releaseGroup = this.releaseGroup();
    if (releaseGroup.expanded) {
      this.isExpanded.set(true);
    }
    
    // Debug album art input
    console.log(`🎵 🎨 Release card for "${releaseGroup.title}" - Album art: ${this.discogsAlbumArt() || 'NONE'}`);
  }


  private loadCoverArtForReleaseGroup() {
    // Get releases for this release group to find cover art
    this.musicBrainzService.getReleaseGroupReleases(this.releaseGroup().id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (releases) => {
          if (releases.length > 0) {
            // Load cover art for the first release
            this.loadCoverArt(releases[0].id);
          }
        },
        error: (error) => {
          console.log('Could not load releases for cover art:', error);
          // Don't show error for cover art loading issues
        }
      });
  }

  toggleExpanded() {
    const releaseGroup = this.releaseGroup();
    const currentExpanded = this.isExpanded();
    
    if (currentExpanded) {
      this.isExpanded.set(false);
      this.collapse.emit(releaseGroup.id);
    } else {
      this.isExpanded.set(true);
      this.expand.emit(releaseGroup.id);
      this.loadDetailedReleases();
    }
  }

  private loadDetailedReleases() {
    if (this.detailedReleases().length > 0) {
      console.log('Detailed releases already loaded');
      return;
    }

    this.loadingDetails.set(true);
    this.error.set(null);

    console.log('Loading detailed releases for release group:', this.releaseGroup().id);
    
    // Check if we already have release data in the release group
    const releaseGroup = this.releaseGroup();
    if (releaseGroup.releases && releaseGroup.releases.length > 0) {
      console.log('Using existing release data from release group:', releaseGroup.releases);
      this.loadDetailedReleasesFromBasic(releaseGroup.releases);
    } else {
      // Fallback to API call if no release data exists
      console.log('No release data in release group, fetching from API');
      this.musicBrainzService.getReleaseGroupReleases(this.releaseGroup().id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (releases) => {
            this.loadDetailedReleasesFromBasic(releases);
          },
          error: (error) => {
            console.error('Error loading releases:', error);
            this.error.set(error.message || 'Failed to load releases');
            this.loadingDetails.set(false);
          }
        });
    }
  }

  private loadDetailedReleasesFromBasic(releases: any[]) {
    console.log('Found releases for release group:', releases);
    
    if (releases.length === 0) {
      this.error.set('No releases found for this release group');
      this.loadingDetails.set(false);
      return;
    }

    // Load details for first few releases (limit to avoid too many API calls)
    const releasesToLoad = releases.slice(0, 3);
    console.log('Loading detailed releases for:', releasesToLoad.map(r => r.id));
    
    // Use forkJoin to load all release details in parallel
    const releaseDetailRequests = releasesToLoad.map(release => 
      this.musicBrainzService.getReleaseDetails(release.id)
    );

    forkJoin(releaseDetailRequests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detailedReleases) => {
          console.log('Received detailed releases:', detailedReleases);
          this.detailedReleases.set(detailedReleases.filter(r => r) as DetailedRelease[]);
          this.loadingDetails.set(false);
        },
        error: (error) => {
          console.error('Failed to load release details:', error);
          this.error.set('Failed to load release details');
          this.loadingDetails.set(false);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCoverArt(releaseId: string) {
    this.loadingCoverArt.set(true);
    
    this.musicBrainzService.getCoverArt(releaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (coverArt) => {
          this.coverArt.set(coverArt);
          this.loadingCoverArt.set(false);
        },
        error: () => {
          this.loadingCoverArt.set(false);
          // Don't show error for missing cover art as it's common
        }
      });
  }

  onAlbumArtError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const rg = this.releaseGroup();

    if (img.src.includes('coverartarchive.org')) {
      console.log(`Cover Art Archive not found for "${rg.title}", will use Discogs fallback if available`);
      this.caaFailed.set(true);
    } else {
      console.log(`Discogs fallback also failed for "${rg.title}"`);
      this.discogsFailed.set(true);
    }
  }


  openAlbumArtModal() {
    const releaseGroup = this.releaseGroup();

    // Try Cover Art Archive high-res first (1200px)
    const highResUrl = this.coverArtService.getReleaseGroupFrontCoverUrl(releaseGroup.id, 1200);
    const altText = `Album art for ${releaseGroup.title}`;

    // Open modal with high-res image
    this.openModalWithImage(highResUrl, releaseGroup.title, altText);
  }

  private openModalWithImage(imageUri: string, title: string, altText: string) {
    const allReleases = this.allReleaseGroups();
    const artistName = this.artistName();
    const carouselReleases = this.getCarouselEligibleReleaseGroups(allReleases);

    console.log('[DiscographyCarousel] openModalWithImage', {
      clickedTitle: title,
      clickedReleaseId: this.releaseGroup().id,
      totalVisibleReleases: allReleases.length,
      eligibleCarouselReleases: carouselReleases.length
    });
    
    // If there are multiple albums, provide carousel navigation
    if (carouselReleases.length > 1) {
      this.openAlbumModalWithCarousel(imageUri, title, altText);
    } else {
      // Single album - use simple modal
      const modalData: ArtistPhotoModalData = {
        imageUri: imageUri,
        artistName: artistName || title,
        altText: altText
      };

      this.dialog.open(ArtistPhotoModalComponent, {
        data: modalData,
        panelClass: 'artist-photo-modal',
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        disableClose: false
      });
    }
  }

  /**
   * Open album modal with carousel navigation through all albums
   */
  private openAlbumModalWithCarousel(imageUri: string, title: string, altText: string): void {
    const allReleases = this.allReleaseGroups();
    const artistName = this.artistName();
    const clickedRelease = this.releaseGroup();
    const currentIndex = this.currentReleaseIndex();
    const carouselReleases = this.getCarouselEligibleReleaseGroups(allReleases);

    const excludedReleases = allReleases
      .filter(release => !release.id)
      .map(release => ({ id: release.id, title: release.title, hasId: !!release.id }));

    // Convert artwork-eligible release groups to carousel items with Cover Art Archive high-res URLs
    const carouselItems: CarouselItem[] = carouselReleases
      .map(release => ({
        imageUri: this.coverArtService.getReleaseGroupFrontCoverUrl(release.id, 1200),
        // Fallback should be non-CAA artwork only, otherwise CAA URLs can bounce in error handling loops.
        fallbackImageUri: release.thumb || undefined,
        discogsResourceUrl: release.discogsResourceUrl,
        title: release.title,
        releaseGroupId: release.id
      }));

    // Always anchor to the clicked card release ID (not list index).
    const adjustedIndex = carouselItems.findIndex(item =>
      item.releaseGroupId === clickedRelease.id
    );

    console.log('[DiscographyCarousel] openAlbumModalWithCarousel', {
      currentIndex,
      currentReleaseId: clickedRelease.id,
      currentReleaseTitle: clickedRelease.title,
      carouselItemCount: carouselItems.length,
      adjustedIndex,
      carouselItems: carouselItems.map(item => ({
        releaseGroupId: item.releaseGroupId,
        title: item.title,
        hasFallback: !!item.fallbackImageUri
      })),
      excludedNoThumbReleases: excludedReleases
    });

    const modalData: ArtistPhotoModalData = {
      carouselItems: carouselItems,
      currentIndex: Math.max(0, adjustedIndex >= 0 ? adjustedIndex : 0),
      imageType: 'album-art',
      artistName: artistName || 'Unknown Artist',
      altText: altText
    };

    this.dialog.open(ArtistPhotoModalComponent, {
      data: modalData,
      panelClass: 'artist-photo-modal',
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100vw',
      height: '100vh',
      hasBackdrop: true,
      disableClose: false
    });
  }

  /**
   * Build the album-art carousel source list:
   * - include all releases with IDs (matching top carousel behavior)
   */
  private getCarouselEligibleReleaseGroups(releases: EnhancedReleaseGroup[]): EnhancedReleaseGroup[] {
    const eligible = releases.filter(release =>
      !!release.id
    );

    console.log('[DiscographyCarousel] getCarouselEligibleReleaseGroups', {
      totalReleases: releases.length,
      eligibleCount: eligible.length,
      ineligibleCount: releases.length - eligible.length
    });

    return eligible;
  }

  formatDuration(milliseconds: number): string {
    if (!milliseconds) return '';
    
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }


  getTrackArtists(track: any): string {
    if (!track.recording['artist-credit'] || track.recording['artist-credit'].length === 0) {
      return '';
    }
    return track.recording['artist-credit'].map((c: any) => c.name).join(', ');
  }
}
