import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { EnhancedReleaseGroup, DetailedRelease, CoverArtInfo } from '../../../models/musicbrainz.models';
import { MusicBrainzService } from '../../../services/musicbrainz.service';

@Component({
  selector: 'app-release-card',
  imports: [CommonModule],
  templateUrl: './release-card.component.html',
  styleUrl: './release-card.component.scss'
})
export class ReleaseCardComponent implements OnInit, OnDestroy {
  @Input() releaseGroup!: EnhancedReleaseGroup;
  @Output() expand = new EventEmitter<string>();
  @Output() collapse = new EventEmitter<string>();

  detailedReleases: DetailedRelease[] = [];
  coverArt: CoverArtInfo | null = null;
  loadingDetails = false;
  loadingCoverArt = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private musicBrainzService: MusicBrainzService) {}

  ngOnInit() {
    // Load cover art when we have releases - we'll fetch them first
    // this.loadCoverArtForReleaseGroup();
  }

  private loadCoverArtForReleaseGroup() {
    // Get releases for this release group to find cover art
    this.musicBrainzService.getReleaseGroupReleases(this.releaseGroup.id)
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
    if (this.releaseGroup.expanded) {
      this.releaseGroup.expanded = false;
      this.collapse.emit(this.releaseGroup.id);
    } else {
      this.releaseGroup.expanded = true;
      this.expand.emit(this.releaseGroup.id);
      this.loadDetailedReleases();
    }
  }

  private loadDetailedReleases() {
    if (this.detailedReleases.length > 0) {
      console.log('Releases already loaded');
      return;
    }

    this.loadingDetails = true;
    this.error = null;

    console.log('Loading releases for release group:', this.releaseGroup.id);

    // First, get the releases for this release group
    this.musicBrainzService.getReleaseGroupReleases(this.releaseGroup.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (releases) => {
          console.log('Found releases for release group:', releases);
          
          if (releases.length === 0) {
            this.error = 'No releases found for this release group';
            this.loadingDetails = false;
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
                this.detailedReleases = detailedReleases.filter(r => r) as DetailedRelease[];
                this.loadingDetails = false;
              },
              error: (error) => {
                console.error('Failed to load release details:', error);
                this.error = 'Failed to load release details';
                this.loadingDetails = false;
              }
            });
        },
        error: (error) => {
          console.error('Failed to load releases for release group:', error);
          this.error = 'Failed to load releases for this release group';
          this.loadingDetails = false;
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCoverArt(releaseId: string) {
    this.loadingCoverArt = true;
    
    this.musicBrainzService.getCoverArt(releaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (coverArt) => {
          this.coverArt = coverArt;
          this.loadingCoverArt = false;
        },
        error: () => {
          this.loadingCoverArt = false;
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

  get releaseYear(): string {
    if (!this.releaseGroup['first-release-date']) {
      return 'Unknown';
    }
    return this.releaseGroup['first-release-date'].split('-')[0];
  }

  get releaseDate(): string {
    if (!this.releaseGroup['first-release-date']) {
      return 'Unknown date';
    }
    
    const date = new Date(this.releaseGroup['first-release-date']);
    if (isNaN(date.getTime())) {
      return this.releaseGroup['first-release-date'];
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  get primaryType(): string {
    return this.releaseGroup['primary-type'] || 'Other';
  }

  get secondaryTypes(): string {
    return this.releaseGroup['secondary-types']?.join(', ') || '';
  }

  get artistCredit(): string {
    if (!this.releaseGroup['artist-credit'] || this.releaseGroup['artist-credit'].length === 0) {
      return '';
    }
    
    return this.releaseGroup['artist-credit']
      .map(credit => credit.name + (credit.joinphrase || ''))
      .join('');
  }

  getTrackArtists(track: any): string {
    if (!track.recording['artist-credit'] || track.recording['artist-credit'].length === 0) {
      return '';
    }
    return track.recording['artist-credit'].map((c: any) => c.name).join(', ');
  }
}