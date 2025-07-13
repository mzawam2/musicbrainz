import { Component, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { MusicBrainzArtist, LabelWithReleaseCount } from '../../models/musicbrainz.models';
import { LabelGridComponent } from '../label-grid/label-grid.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, ReactiveFormsModule, LabelGridComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  searchControl = new FormControl('');
  artists: MusicBrainzArtist[] = [];
  loading = false;
  error: string | null = null;
  selectedArtist: MusicBrainzArtist | null = null;
  currentSearchTerm = '';
  
  // Label-related properties
  labels: LabelWithReleaseCount[] = [];
  labelsLoading = false;
  labelsError: string | null = null;

  constructor(private musicBrainzService: MusicBrainzService) {}

  ngOnInit() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => {
          if (!query || query.length < 2) {
            this.artists = [];
            this.error = null;
            this.currentSearchTerm = '';
            return of([]);
          }
          
          this.loading = true;
          this.error = null;
          this.currentSearchTerm = query;
          
          return this.musicBrainzService.searchArtists(query).pipe(
            catchError(err => {
              this.error = err.message || 'Failed to search artists';
              this.loading = false;
              return of([]);
            })
          );
        })
      )
      .subscribe(artists => {
        this.artists = artists;
        this.loading = false;
      });
  }

  selectArtist(artist: MusicBrainzArtist) {
    this.selectedArtist = artist;
    this.searchControl.setValue(artist.name);
    this.artists = [];
    this.loadArtistLabels(artist.id);
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.selectedArtist = null;
    this.artists = [];
    this.error = null;
    this.labels = [];
    this.labelsError = null;
    this.currentSearchTerm = '';
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
    this.labelsLoading = true;
    this.labelsError = null;
    this.labels = [];

    this.musicBrainzService.getArtistLabels(artistId).subscribe({
      next: (labels) => {
        this.labels = labels;
        this.labelsLoading = false;
      },
      error: (error) => {
        this.labelsError = error.message || 'Failed to load labels';
        this.labelsLoading = false;
      }
    });
  }
}
