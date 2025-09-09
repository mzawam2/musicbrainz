import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LastfmService } from '../../services/lastfm.service';
import { SpotifyService, SpotifyTrack } from '../../services/spotify.service';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

interface SelectableArtist {
  name: string;
  selected: boolean;
}

@Component({
  selector: 'app-similar-artists',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <h1>Similar Artists • Playlist Builder</h1>

      <div class="controls">
        <input
          type="text"
          placeholder="Seed artist (e.g., Radiohead)"
          [value]="seedArtist()"
          (input)="onText(seedArtist, $event)"
          (keyup.enter)="fetchSimilar()"
        />

        <label>
          Similar count
          <input type="number" min="1" max="50" [value]="similarLimit()" (input)="onNumber(similarLimit, $event)" />
        </label>

        <label>
          Tracks per artist
          <input type="number" min="1" max="10" [value]="tracksPerArtist()" (input)="onNumber(tracksPerArtist, $event)" />
        </label>

        <label>
          <input type="checkbox" [checked]="randomizeTrackSelection()" (change)="onCheckbox(randomizeTrackSelection, $event)" />
          Randomize from top 10
        </label>

        <button (click)="fetchSimilar()" [disabled]="loading()">{{ loading() ? 'Loading…' : 'Find Similar' }}</button>
      </div>

      <div class="auth-hint" *ngIf="!spotify.isAuthenticated()">
        <span>Spotify sign-in required to create playlists.</span>
        <button class="link" (click)="spotify.initiateAuth()">Sign in to Spotify</button>
      </div>

      <div class="results" *ngIf="similarArtists().length > 0">
        <h2>{{ similarArtists().length }} similar artists</h2>
        <div class="list">
          <label class="artist" *ngFor="let a of similarArtists(); trackBy: trackByName">
            <input type="checkbox" [checked]="a.selected" (change)="toggle(a)" />
            <span>{{ a.name }}</span>
          </label>
        </div>

        <div class="actions">
          <button (click)="selectAll()">Select all</button>
          <button (click)="clearAll()">Clear</button>
          <button class="primary" (click)="createPlaylist()" [disabled]="!canCreate() || creating()">
            {{ creating() ? 'Creating…' : 'Create Spotify Playlist' }}
          </button>
        </div>

        <div class="status" *ngIf="status()">{{ status() }}</div>
      </div>

      <div class="empty" *ngIf="!loading() && similarArtists().length === 0">
        <p>Enter an artist name and click "Find Similar".</p>
        <a routerLink="/discography">Back to Discography</a>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 1.5rem; max-width: 960px; margin: 0 auto; }
    h1 { margin: 0 0 1rem 0; font-size: 1.5rem; }
    .controls { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
    .controls input[type="text"] { flex: 1; min-width: 260px; padding: .5rem .6rem; }
    .controls label { display: inline-flex; gap: .5rem; align-items: center; }
    .controls input[type="number"] { width: 4.5rem; padding: .35rem .4rem; }
    button { padding: .5rem .8rem; border-radius: 6px; border: 1px solid #ccc; cursor: pointer; }
    button.primary { background: #1DB954; color: #fff; border-color: #169f47; }
    button.link { background: transparent; color: #1DB954; border: none; padding: 0 .25rem; }
    .auth-hint { margin-top: .75rem; color: #555; display: flex; align-items: center; gap: .5rem; }
    .results { margin-top: 1rem; }
    .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .5rem; margin-top: .5rem; }
    .artist { display: flex; gap: .5rem; align-items: center; padding: .5rem; border: 1px solid #eee; border-radius: 6px; }
    .actions { display: flex; gap: .5rem; align-items: center; margin-top: .75rem; }
    .status { margin-top: .75rem; color: #666; }
    .empty { margin-top: 2rem; color: #777; }
  `]
})
export class SimilarArtistsComponent {
  private lastfm = inject(LastfmService);
  public spotify = inject(SpotifyService);
  private route = inject(ActivatedRoute);

  seedArtist = signal('');
  similarLimit = signal(20);
  tracksPerArtist = signal(2);
  randomizeTrackSelection = signal(false);
  loading = signal(false);
  creating = signal(false);
  status = signal('');
  similarArtists = signal<SelectableArtist[]>([]);

  canCreate = computed(() => this.spotify.isAuthenticated() && this.similarArtists().some(a => a.selected));

  trackByName = (_: number, a: SelectableArtist) => a.name;
  onNumber(sig: ReturnType<typeof signal<number>>, ev: Event) {
    const v = parseInt((ev.target as HTMLInputElement).value, 10);
    if (!isNaN(v)) sig.set(v);
  }
  onText(sig: ReturnType<typeof signal<string>>, ev: Event) {
    const v = (ev.target as HTMLInputElement).value ?? '';
    sig.set(v);
  }
  onCheckbox(sig: ReturnType<typeof signal<boolean>>, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    sig.set(checked);
  }

  /**
   * Helper method to randomly select tracks from an array
   */
  private randomlySelectTracks<T>(tracks: T[], count: number): T[] {
    if (!this.randomizeTrackSelection() || tracks.length <= count) {
      return tracks.slice(0, count);
    }
    
    const shuffled = [...tracks];
    const selected: T[] = [];
    
    for (let i = 0; i < count && shuffled.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * shuffled.length);
      selected.push(shuffled.splice(randomIndex, 1)[0]);
    }
    
    return selected;
  }

  toggle(a: SelectableArtist) {
    a.selected = !a.selected;
    this.similarArtists.set([...this.similarArtists()]);
  }
  selectAll() { this.similarArtists.set(this.similarArtists().map(a => ({ ...a, selected: true }))); }
  clearAll() { this.similarArtists.set(this.similarArtists().map(a => ({ ...a, selected: false }))); }

  fetchSimilar() {
    const name = this.seedArtist().trim();
    if (!name) return;
    this.loading.set(true);
    this.status.set('');

    this.lastfm.getSimilarArtists(name, this.similarLimit()).subscribe({
      next: artists => {
        this.similarArtists.set((artists || []).map(a => ({ name: a.name, selected: true })));
        this.loading.set(false);
      },
      error: err => {
        console.error(err);
        this.status.set('Failed to fetch similar artists.');
        this.loading.set(false);
      }
    });
  }

  async createPlaylist() {
    if (!this.spotify.isAuthenticated()) {
      this.status.set('Please sign in to Spotify first.');
      return this.spotify.initiateAuth();
    }

    const seed = this.seedArtist().trim();
    if (!seed) return;
    const selected = this.similarArtists().filter(a => a.selected);
    if (selected.length === 0) return;

    this.creating.set(true);
    this.status.set('Fetching top tracks from Last.fm…');

    try {
      // Gather Last.fm top tracks per selected artist
      const trackTitles: Array<{ artist: string; title: string }> = [];
      for (const a of selected) {
        const tracksToFetch = this.randomizeTrackSelection() ? 10 : this.tracksPerArtist();
        const tracks = await new Promise<import('../../models/lastfm.models').LastFmTrack[]>((resolve, reject) => {
          this.lastfm.getTopTracks(a.name, tracksToFetch).subscribe({
            next: resolve,
            error: reject
          });
        });
        const selectedTracks = this.randomlySelectTracks(tracks, this.tracksPerArtist());
        for (const t of selectedTracks) {
          if (t?.name) trackTitles.push({ artist: a.name, title: t.name });
        }
      }

      this.status.set(`Searching ${trackTitles.length} tracks on Spotify…`);

      // Find Spotify URIs sequentially to be gentle on API
      const uris: string[] = [];
      for (const tt of trackTitles) {
        const q = `track:"${tt.title}" artist:"${tt.artist}"`;
        const results = await new Promise<SpotifyTrack[]>((resolve) => {
          this.spotify.searchTracks(q, 1).subscribe({ next: resolve, error: () => resolve([]) });
        });
        if (results && results[0]?.uri) {
          uris.push(results[0].uri);
        }
      }

      if (uris.length === 0) {
        this.status.set('Could not find any tracks on Spotify.');
        this.creating.set(false);
        return;
      }

      const name = `Similar to ${seed} — Top Tracks`;
      const desc = `Top ${this.tracksPerArtist()} tracks from artists similar to ${seed} via Last.fm`;

      const playlist = await new Promise<import('../../services/spotify.service').SpotifyPlaylist | null>((resolve) => {
        this.spotify.createPlaylist(name, desc, true).subscribe({ next: resolve, error: () => resolve(null) });
      });

      if (!playlist) {
        this.status.set('Failed to create playlist.');
        this.creating.set(false);
        return;
      }

      // Add in batches of 100
      this.status.set(`Adding ${uris.length} tracks to playlist…`);
      const batchSize = 100;
      for (let i = 0; i < uris.length; i += batchSize) {
        const batch = uris.slice(i, i + batchSize);
        const ok = await new Promise<boolean>((resolve) => {
          this.spotify.addTracksToPlaylist(playlist.id, batch).subscribe({ next: resolve, error: () => resolve(false) });
        });
        if (!ok) {
          this.status.set('Some tracks failed to add due to API limits.');
        }
      }

      this.status.set(`Playlist created: ${playlist.name}`);
    } catch (e) {
      console.error(e);
      this.status.set('Unexpected error while creating playlist.');
    } finally {
      this.creating.set(false);
    }
  }

  constructor() {
    // Initialize from query params if provided
    this.route.queryParamMap.subscribe((params) => {
      const seed = params.get('seed');
      const count = params.get('count');
      const tracks = params.get('tracks');

      if (seed) this.seedArtist.set(seed);
      if (count && !isNaN(parseInt(count, 10))) this.similarLimit.set(parseInt(count, 10));
      if (tracks && !isNaN(parseInt(tracks, 10))) this.tracksPerArtist.set(parseInt(tracks, 10));

      if (seed) {
        // auto-fetch when coming from discography page
        this.fetchSimilar();
      }
    });
  }
}
