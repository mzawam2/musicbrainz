import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { MusicBrainzArtist, LabelWithReleaseCount, EnhancedDiscographyData } from '../../models/musicbrainz.models';
import { LabelGridComponent } from '../label-grid/label-grid.component';
import { DiscographyComponent } from '../discography/discography.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, ReactiveFormsModule, LabelGridComponent, DiscographyComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  private musicBrainzService = inject(MusicBrainzService);
  
  searchControl = new FormControl('');
  
  // Signals for reactive state management
  artists = signal<MusicBrainzArtist[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedArtist = signal<MusicBrainzArtist | null>(null);
  currentSearchTerm = signal('');
  
  // Label-related signals
  labels = signal<LabelWithReleaseCount[]>([]);
  labelsLoading = signal(false);
  labelsError = signal<string | null>(null);

  // Discography-related signals
  discographyData = signal<EnhancedDiscographyData | null>(null);
  discographyLoading = signal(false);
  discographyError = signal<string | null>(null);

  // Computed values for derived state
  
  hasSelectedArtist = computed(() => this.selectedArtist() !== null);
  showSearchResults = computed(() => this.artists().length > 0 && this.currentSearchTerm().length >= 2);
  canClearSearch = computed(() => this.hasSelectedArtist() || this.currentSearchTerm().length > 0);
  
  searchState = computed(() => ({
    hasQuery: this.currentSearchTerm().length >= 2,
    hasResults: this.artists().length > 0,
    isLoading: this.loading(),
    hasError: this.error() !== null
  }));

  ngOnInit() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => {
          if (!query || query.length < 2) {
            this.artists.set([]);
            this.error.set(null);
            this.currentSearchTerm.set('');
            return of([]);
          }
          
          this.loading.set(true);
          this.error.set(null);
          this.currentSearchTerm.set(query);
          
          return this.musicBrainzService.searchArtists(query).pipe(
            catchError(err => {
              this.error.set(err.message || 'Failed to search artists');
              this.loading.set(false);
              return of([]);
            })
          );
        })
      )
      .subscribe(artists => {
        this.artists.set(artists);
        this.loading.set(false);
      });
  }

  selectArtist(artist: MusicBrainzArtist) {
    this.selectedArtist.set(artist);
    this.searchControl.setValue(artist.name);
    this.artists.set([]);
    this.loadArtistLabels(artist.id);
    this.loadArtistDiscography(artist.id);
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.selectedArtist.set(null);
    this.artists.set([]);
    this.error.set(null);
    this.labels.set([]);
    this.labelsError.set(null);
    this.discographyData.set(null);
    this.discographyError.set(null);
    this.currentSearchTerm.set('');
  }

  highlightSearchTerm(text: string, searchTerm: string): string {
    if (!searchTerm || !text) {
      return text;
    }
    
    const regex = new RegExp(`(${this.escapeRegExp(searchTerm)})`, 'gi');
    return text.replace(regex, '<mark class="highlight">$1</mark>');
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private loadArtistLabels(artistId: string) {
    this.labelsLoading.set(true);
    this.labelsError.set(null);
    this.labels.set([]);

    this.musicBrainzService.getArtistLabels(artistId).subscribe({
      next: (labels) => {
        this.labels.set(labels);
        this.labelsLoading.set(false);
      },
      error: (error) => {
        this.labelsError.set(error.message || 'Failed to load labels');
        this.labelsLoading.set(false);
      }
    });
  }

  private loadArtistDiscography(artistId: string) {
    this.discographyLoading.set(true);
    this.discographyError.set(null);
    this.discographyData.set(null);

    this.musicBrainzService.getEnhancedArtistDiscography(artistId).subscribe({
      next: (discography) => {
        // Update the artist information in the discography data with the selected artist
        const selectedArtist = this.selectedArtist();
        if (selectedArtist) {
          discography.artist = selectedArtist;
        }
        this.discographyData.set(discography);
        this.discographyLoading.set(false);
      },
      error: (error) => {
        this.discographyError.set(error.message || 'Failed to load discography');
        this.discographyLoading.set(false);
      }
    });
  }
}
