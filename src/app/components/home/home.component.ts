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
            return of([]);
          }
          
          this.loading = true;
          this.error = null;
          
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
