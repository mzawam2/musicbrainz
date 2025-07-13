import { Component, input, output, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { EnhancedReleaseGroup, DetailedRelease, CoverArtInfo } from '../../../models/musicbrainz.models';
import { MusicBrainzService } from '../../../services/musicbrainz.service';

@Component({
  selector: 'app-release-card',
  imports: [CommonModule],
  templateUrl: './release-card.component.html',
  styleUrl: './release-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReleaseCardComponent implements OnInit, OnDestroy {
  // Input and output functions
  releaseGroup = input.required<EnhancedReleaseGroup>();
  expand = output<string>();
  collapse = output<string>();

  // Injected services
  private musicBrainzService = inject(MusicBrainzService);

  // State signals
  detailedReleases = signal<DetailedRelease[]>([]);
  coverArt = signal<CoverArtInfo | null>(null);
  loadingDetails = signal(false);
  loadingCoverArt = signal(false);
  error = signal<string | null>(null);
  isExpanded = signal(false);

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

  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Initialize expanded state from input if needed
    const releaseGroup = this.releaseGroup();
    if (releaseGroup.expanded) {
      this.isExpanded.set(true);
    }
    // Load cover art when we have releases - we'll fetch them first
    // this.loadCoverArtForReleaseGroup();
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
      console.log('Releases already loaded');
      return;
    }

    this.loadingDetails.set(true);
    this.error.set(null);

    console.log('Loading releases for release group:', this.releaseGroup().id);

    // First, get the releases for this release group
    this.musicBrainzService.getReleaseGroupReleases(this.releaseGroup().id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (releases) => {
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
        },
        error: (error) => {
          console.error('Failed to load releases for release group:', error);
          this.error.set('Failed to load releases for this release group');
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