import { Component, input, output, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlaylistCreationService } from '../../services/playlist-creation.service';
import { LastfmService } from '../../services/lastfm.service';
import { 
  PlaylistCreationRequest, 
  PlaylistCreationResult, 
  PlaylistCreationStage,
  PlaylistCreationProgress 
} from '../../models/playlist.models';
import { LastfmTagArtist, LastFmTagInfo } from '../../models/lastfm.models';
import { filter, take } from 'rxjs';

@Component({
  selector: 'app-playlist-creation',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './playlist-creation.component.html',
  styleUrl: './playlist-creation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaylistCreationComponent {
  // Inputs
  readonly tagName = input<string>('');
  readonly artistLimit = input<number>(50);
  readonly tracksPerArtist = input<number>(1);
  readonly autoCreate = input<boolean>(false);

  // Outputs
  readonly playlistCreated = output<PlaylistCreationResult>();
  readonly creationError = output<PlaylistCreationResult>();

  // Services
  private readonly playlistService = inject(PlaylistCreationService);
  private readonly lastfmService = inject(LastfmService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Form
  readonly form = this.formBuilder.group({
    tagName: [this.tagName(), [Validators.required, Validators.maxLength(100)]],
    playlistName: ['', [Validators.maxLength(200)]],
    artistLimit: [this.artistLimit(), [Validators.required, Validators.min(1), Validators.max(100)]],
    tracksPerArtist: [this.tracksPerArtist(), [Validators.required, Validators.min(1), Validators.max(10)]]
  });

  // State
  readonly isCreating = signal<boolean>(false);
  readonly canCancel = signal<boolean>(false);
  readonly completedPlaylist = signal<PlaylistCreationResult | null>(null);
  readonly isSearching = signal<boolean>(false);
  readonly searchResults = signal<LastfmTagArtist[]>([]);
  readonly hasSearched = signal<boolean>(false);
  readonly tagInfo = signal<LastFmTagInfo | null>(null);
  readonly isLoadingTagInfo = signal<boolean>(false);
  
  // Progress from service
  readonly progress = computed(() => this.playlistService.progress());
  
  // Computed values
  readonly isCompleted = computed(() => 
    this.progress().stage === PlaylistCreationStage.COMPLETED
  );
  
  readonly isFailed = computed(() => 
    this.progress().stage === PlaylistCreationStage.FAILED
  );

  readonly isCancelled = computed(() => 
    this.progress().stage === PlaylistCreationStage.CANCELLED
  );

  readonly progressPercentage = computed(() => {
    const p = this.progress();
    return p.totalSteps > 0 ? (p.currentStep / p.totalSteps) * 100 : 0;
  });

  readonly canCreate = computed(() => 
    this.form.valid && !this.isCreating() && this.hasSearched() && this.searchResults().length > 0
  );

  readonly canSearch = computed(() => {
    const tagName = this.form.get('tagName')?.value?.trim();
    return tagName && tagName.length > 0 && !this.isSearching() && !this.isCreating();
  });

  readonly PlaylistCreationStage = PlaylistCreationStage;

  ngOnInit() {
    // Check for tag query parameter first
    const tagFromQuery = this.route.snapshot.queryParams['tag'];
    
    // Pre-fill form - prioritize query parameter over input
    const tagValue = tagFromQuery || this.tagName();
    if (tagValue) {
      this.form.patchValue({ tagName: tagValue });
    }
    
    if (this.artistLimit()) {
      this.form.patchValue({ artistLimit: this.artistLimit() });
    }
    if (this.tracksPerArtist()) {
      this.form.patchValue({ tracksPerArtist: this.tracksPerArtist() });
    }

    // Auto-search if tag came from query parameter
    if (tagFromQuery && tagFromQuery.trim()) {
      // Use setTimeout to ensure form is fully initialized
      setTimeout(() => {
        this.searchArtists();
      });
    }

    // Auto-create if requested
    if (this.autoCreate() && this.form.valid) {
      this.createPlaylist();
    }
  }

  /**
   * Search for artists by tag
   */
  searchArtists(): void {
    const tagName = this.form.get('tagName')?.value?.trim();
    if (!tagName) {
      this.snackBar.open('Please enter a tag name', 'Close', { duration: 3000 });
      return;
    }

    this.isSearching.set(true);
    this.searchResults.set([]);
    this.isLoadingTagInfo.set(true);

    const limit = this.form.get('artistLimit')?.value || 20;

    // Fetch tag info and artists in parallel
    this.lastfmService.getTagInfo(tagName).subscribe({
      next: (info) => {
        this.tagInfo.set(info);
        this.isLoadingTagInfo.set(false);
      },
      error: () => {
        this.isLoadingTagInfo.set(false);
        // Don't show error for tag info - it's optional
      }
    });

    this.lastfmService.getTopArtistsByTag(tagName, limit).subscribe({
      next: (artists) => {
        this.searchResults.set(artists);
        this.hasSearched.set(true);
        this.isSearching.set(false);
        
        if (artists.length === 0) {
          this.snackBar.open(`No artists found for tag "${tagName}"`, 'Close', { duration: 5000 });
        } else {
          this.snackBar.open(`Found ${artists.length} artists for "${tagName}"`, 'Close', { duration: 3000 });
        }
      },
      error: (error) => {
        this.isSearching.set(false);
        this.snackBar.open(`Error searching: ${error.message}`, 'Close', { duration: 5000 });
      }
    });
  }

  /**
   * Create playlist based on form values
   */
  createPlaylist(): void {
    if (!this.form.valid) {
      this.snackBar.open('Please fill in all required fields correctly', 'Close', { duration: 3000 });
      return;
    }

    const formValue = this.form.value;
    const request: PlaylistCreationRequest = {
      tagName: formValue.tagName!,
      playlistName: formValue.playlistName || undefined,
      artistLimit: formValue.artistLimit!,
      tracksPerArtist: formValue.tracksPerArtist!
    };

    this.isCreating.set(true);
    this.canCancel.set(true);

    this.playlistService.createPlaylistFromTag(request).pipe(
      filter(update => 'success' in update), // Only take the final result
      take(1)
    ).subscribe({
      next: (result) => {
        const playlistResult = result as PlaylistCreationResult;
        
        if (playlistResult.success) {
          this.completedPlaylist.set(playlistResult);
          this.playlistCreated.emit(playlistResult);
        } else {
          this.snackBar.open(
            'Failed to create playlist. Please try again.', 
            'Close', 
            { duration: 5000 }
          );
          this.creationError.emit(playlistResult);
        }

        this.isCreating.set(false);
        this.canCancel.set(false);
      },
      error: (error) => {
        this.snackBar.open(
          `Error creating playlist: ${error.message}`, 
          'Close', 
          { duration: 5000 }
        );
        this.isCreating.set(false);
        this.canCancel.set(false);
      }
    });
  }

  /**
   * Cancel ongoing playlist creation
   */
  cancelCreation(): void {
    this.playlistService.cancelCreation().subscribe(() => {
      this.isCreating.set(false);
      this.canCancel.set(false);
      this.snackBar.open('Playlist creation cancelled', 'Close', { duration: 3000 });
    });
  }

  /**
   * Reset the component to initial state
   */
  reset(): void {
    this.form.reset();
    this.form.patchValue({
      tagName: this.tagName(),
      artistLimit: this.artistLimit(),
      tracksPerArtist: this.tracksPerArtist()
    });
    this.isCreating.set(false);
    this.canCancel.set(false);
    this.completedPlaylist.set(null);
    this.isSearching.set(false);
    this.searchResults.set([]);
    this.hasSearched.set(false);
    this.tagInfo.set(null);
    this.isLoadingTagInfo.set(false);
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(): string {
    const progress = this.progress();
    if (progress.errors.length > 0) {
      return progress.errors[0].message;
    }
    return 'An unknown error occurred';
  }

  /**
   * Get progress color based on stage
   */
  getProgressColor(): string {
    const stage = this.progress().stage;
    switch (stage) {
      case PlaylistCreationStage.COMPLETED:
        return 'accent';
      case PlaylistCreationStage.FAILED:
      case PlaylistCreationStage.CANCELLED:
        return 'warn';
      default:
        return 'primary';
    }
  }

  /**
   * Open the created playlist on Spotify
   */
  viewOnSpotify(): void {
    const playlist = this.completedPlaylist();
    if (playlist?.playlist?.external_urls?.spotify) {
      window.open(playlist.playlist.external_urls.spotify, '_blank');
    }
  }

  /**
   * Dismiss the success popup
   */
  dismissSuccess(): void {
    this.completedPlaylist.set(null);
  }

  /**
   * Navigate to discography page with artist pre-filled and searched
   */
  navigateToArtistDiscography(artistName: string): void {
    this.router.navigate(['/discography'], {
      queryParams: { artist: artistName }
    });
  }

  /**
   * Format Last.fm wiki HTML to ensure links are clickable and safe.
   * - Converts http Last.fm links to https
   * - Adds target and rel attributes to anchors if missing
   */
  formatWikiHtml(source?: string | null): string {
    if (!source) return '';
    let html = source;
    // Force HTTPS for Last.fm links
    html = html.replace(/href=["']http:\/\/(www\.)?last\.fm/gi, 'href="https://$1last.fm');
    // Ensure external links open in new tab and are safe
    html = html.replace(/<a\s+([^>]*href=["'][^"']+["'][^>]*)>/gi, (_m, attrs: string) => {
      const hasTarget = /target=/i.test(attrs);
      const hasRel = /rel=/i.test(attrs);
      let newAttrs = attrs;
      if (!hasTarget) newAttrs += ' target="_blank"';
      if (!hasRel) newAttrs += ' rel="noopener noreferrer nofollow"';
      return `<a ${newAttrs}>`;
    });
    return html;
  }

}
