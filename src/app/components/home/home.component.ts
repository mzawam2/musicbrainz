import { Component, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { MusicBrainzArtist } from '../../models/musicbrainz.models';

@Component({
  selector: 'app-home',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  searchControl = new FormControl('');
  artists: MusicBrainzArtist[] = [];
  loading = false;
  error: string | null = null;
  selectedArtist: MusicBrainzArtist | null = null;

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
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.selectedArtist = null;
    this.artists = [];
    this.error = null;
  }
}
