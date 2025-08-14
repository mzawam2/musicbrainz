import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SpotifyService, PlaylistCreationRequest, SpotifyPlaylist } from '../../services/spotify.service';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { LabelWithReleaseCount, MusicBrainzRelease } from '../../models/musicbrainz.models';

interface ReleaseSelection {
  release: MusicBrainzRelease;
  artistName: string;
  trackCount: number;
  maxTracks: number;
}

@Component({
  selector: 'app-spotify-playlist-creator',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="spotify-playlist-creator">
      @if (!spotifyService.isAuthenticated()) {
        <div class="auth-required">
          <div class="auth-card">
            <h3>Connect to Spotify</h3>
            <p>To create playlists from {{ labelName() }} releases, please connect your Spotify account.</p>
            <button 
              class="spotify-auth-btn"
              (click)="spotifyService.initiateAuth()"
              type="button">
              <span class="spotify-icon">♪</span>
              Connect Spotify
            </button>
          </div>
        </div>
      } @else {
        <div class="playlist-creator">
          <div class="creator-header">
            <h3>Create Spotify Playlist</h3>
            <p>Create a playlist from <strong>{{ labelName() }}</strong> releases</p>
            @if (spotifyService.currentUser(); as user) {
              <p class="user-info">Logged in as {{ user.display_name }}</p>
            }
          </div>

          @if (isLoading()) {
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading releases...</p>
            </div>
          } @else if (error()) {
            <div class="error-state">
              <p>{{ error() }}</p>
              <button (click)="loadReleases()" type="button">Try Again</button>
            </div>
          } @else if (releaseSelections().length > 0) {
            <form [formGroup]="playlistForm" (ngSubmit)="createPlaylist()">
              <div class="form-section">
                <label for="playlistName">Playlist Name</label>
                <input 
                  id="playlistName"
                  type="text" 
                  formControlName="playlistName"
                  placeholder="Enter playlist name...">
              </div>

              <div class="releases-section">
                <h4>Select Songs from Releases</h4>
                <p class="section-description">Choose how many songs to include from each release:</p>
                
                <div class="releases-list">
                  @for (selection of releaseSelections(); track selection.release.id) {
                    <div class="release-item">
                      <div class="release-info">
                        <h5>{{ selection.release.title }}</h5>
                        <p class="artist-name">by {{ selection.artistName }}</p>
                        <p class="track-info">{{ selection.maxTracks }} tracks available</p>
                      </div>
                      
                      <div class="track-selector">
                        <label [for]="'tracks-' + selection.release.id">Songs to include:</label>
                        <input 
                          [id]="'tracks-' + selection.release.id"
                          type="number" 
                          [value]="selection.trackCount"
                          [min]="0" 
                          [max]="selection.maxTracks"
                          (input)="updateTrackCount(selection.release.id, $event)"
                          class="track-count-input">
                        <span class="max-tracks">/ {{ selection.maxTracks }}</span>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="playlist-summary">
                <p><strong>Total songs:</strong> {{ totalSelectedTracks() }}</p>
                <p><strong>From releases:</strong> {{ selectedReleaseCount() }}</p>
              </div>

              <div class="form-actions">
                <button 
                  type="submit" 
                  [disabled]="!playlistForm.valid || isCreating() || totalSelectedTracks() === 0"
                  class="create-btn">
                  @if (isCreating()) {
                    <span class="spinner small"></span>
                    Creating...
                  } @else {
                    Create Playlist
                  }
                </button>
                
                <button type="button" (click)="onCancel.emit()" class="cancel-btn">
                  Cancel
                </button>
              </div>
            </form>
          } @else {
            <div class="no-releases">
              <p>No releases found for this label.</p>
            </div>
          }

          @if (createdPlaylist()) {
            <div class="success-state">
              <h4>✓ Playlist Created Successfully!</h4>
              <p><strong>{{ createdPlaylist()?.name }}</strong></p>
              <p>{{ createdPlaylist()?.tracks?.total || 0 }} songs added</p>
              <a 
                [href]="createdPlaylist()?.external_urls?.spotify" 
                target="_blank" 
                class="open-spotify-btn">
                Open in Spotify
              </a>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .spotify-playlist-creator {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    .auth-required {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
    }

    .auth-card {
      background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
      color: white;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 8px 25px rgba(29, 185, 84, 0.3);
    }

    .auth-card h3 {
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
    }

    .spotify-auth-btn {
      background: #000;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 24px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 1rem auto 0;
      transition: all 0.2s ease;
    }

    .spotify-auth-btn:hover {
      background: #333;
      transform: translateY(-1px);
    }

    .spotify-icon {
      font-size: 1.2rem;
    }

    .playlist-creator {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .creator-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }

    .creator-header h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.8rem;
    }

    .user-info {
      margin: 1rem 0 0 0;
      opacity: 0.9;
      font-size: 0.9rem;
    }

    .loading-state, .error-state, .no-releases {
      padding: 3rem;
      text-align: center;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    .spinner.small {
      width: 16px;
      height: 16px;
      border-width: 2px;
      margin: 0;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    form {
      padding: 2rem;
    }

    .form-section {
      margin-bottom: 2rem;
    }

    .form-section label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #333;
    }

    .form-section input[type="text"] {
      width: 100%;
      padding: 12px;
      border: 2px solid #e1e5e9;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s ease;
    }

    .form-section input[type="text"]:focus {
      outline: none;
      border-color: #667eea;
    }

    .releases-section h4 {
      color: #333;
      margin-bottom: 0.5rem;
    }

    .section-description {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .releases-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .release-item {
      border: 2px solid #e1e5e9;
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: border-color 0.2s ease;
    }

    .release-item:hover {
      border-color: #667eea;
    }

    .release-info h5 {
      margin: 0 0 0.25rem 0;
      color: #333;
      font-size: 1rem;
    }

    .artist-name {
      margin: 0 0 0.25rem 0;
      color: #667eea;
      font-weight: 500;
    }

    .track-info {
      margin: 0;
      color: #666;
      font-size: 0.85rem;
    }

    .track-selector {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .track-selector label {
      font-size: 0.9rem;
      color: #666;
    }

    .track-count-input {
      width: 60px;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      text-align: center;
    }

    .max-tracks {
      color: #666;
      font-size: 0.9rem;
    }

    .playlist-summary {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      margin: 2rem 0;
    }

    .playlist-summary p {
      margin: 0.25rem 0;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }

    .create-btn {
      background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .create-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(29, 185, 84, 0.3);
    }

    .create-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .cancel-btn {
      background: transparent;
      color: #666;
      border: 2px solid #ddd;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .cancel-btn:hover {
      border-color: #999;
      color: #333;
    }

    .success-state {
      background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
      color: white;
      padding: 2rem;
      text-align: center;
      margin-top: 2rem;
    }

    .success-state h4 {
      margin: 0 0 1rem 0;
      font-size: 1.3rem;
    }

    .open-spotify-btn {
      display: inline-block;
      background: #000;
      color: white;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 20px;
      font-weight: 600;
      margin-top: 1rem;
      transition: all 0.2s ease;
    }

    .open-spotify-btn:hover {
      background: #333;
      transform: translateY(-1px);
    }

    .error-state button {
      background: #dc3545;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 1rem;
    }

    @media (max-width: 768px) {
      .release-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .form-actions {
        flex-direction: column;
      }
    }
  `]
})
export class SpotifyPlaylistCreatorComponent implements OnInit {
  // Inputs
  labelData = input.required<LabelWithReleaseCount>();
  allArtistsReleases = input<Array<{
    artistName: string, 
    releaseIds: string[], 
    releaseDetails?: Array<{id: string, title: string, date?: string, primaryType?: string}>,
    labelName: string
  }>>([]);
  
  // Outputs
  onCancel = output<void>();
  onPlaylistCreated = output<SpotifyPlaylist>();

  // Services
  private fb = inject(FormBuilder);
  public spotifyService = inject(SpotifyService);
  private musicBrainzService = inject(MusicBrainzService);

  // Signals
  releases = signal<MusicBrainzRelease[]>([]);
  releaseSelections = signal<ReleaseSelection[]>([]);
  isLoading = signal(true);
  isCreating = signal(false);
  error = signal<string | null>(null);
  createdPlaylist = signal<SpotifyPlaylist | null>(null);

  // Computed values
  labelName = computed(() => {
    try {
      const data = this.labelData();
      return data?.label?.name || '';
    } catch {
      return '';
    }
  });
  
  totalSelectedTracks = computed(() => 
    this.releaseSelections().reduce((sum, selection) => sum + selection.trackCount, 0)
  );
  
  selectedReleaseCount = computed(() => 
    this.releaseSelections().filter(selection => selection.trackCount > 0).length
  );

  // Form
  playlistForm: FormGroup;

  constructor() {
    this.playlistForm = this.fb.group({
      playlistName: ['Label Playlist', Validators.required]
    });
  }

  ngOnInit() {
    // Load releases when component initializes and labelData is available
    try {
      const labelData = this.labelData();
      const cachedData = this.allArtistsReleases();
      
      if (labelData) {
        // If we have cached data, use it immediately
        if (cachedData && cachedData.length > 0) {
          console.log('Initializing with cached artist release data');
        }
        
        this.loadReleases();
        
        // Update playlist name with actual label name
        this.playlistForm.patchValue({
          playlistName: `${labelData.label.name} - Label Playlist`
        });
      }
    } catch (error) {
      console.error('Error initializing Spotify playlist creator:', error);
      this.error.set('Failed to initialize component');
    }
  }

  /**
   * Load releases for the label
   */
  async loadReleases(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    const labelData = this.labelData();
    const cachedArtistData = this.allArtistsReleases();
    
    if (!labelData) {
      this.error.set('Label data not available');
      this.isLoading.set(false);
      return;
    }

    try {
      // Use cached data if available (from family tree)
      if (cachedArtistData && cachedArtistData.length > 0) {
        console.log('Using cached artist release data - no API calls needed');
        const selections: ReleaseSelection[] = [];
        
        // Process cached artist data
        for (const artistData of cachedArtistData.slice(0, 10)) {
          if (artistData.releaseDetails && artistData.releaseDetails.length > 0) {
            // Filter for Albums and EPs and create selections
            const artistReleases = artistData.releaseDetails
              .filter(release => release.primaryType === 'Album' || release.primaryType === 'EP')
              .slice(0, 5) // Limit releases per artist
              .map(release => ({
                release: {
                  id: release.id,
                  title: release.title,
                  date: release.date,
                  'release-group': {
                    'primary-type': release.primaryType
                  }
                } as MusicBrainzRelease,
                artistName: artistData.artistName,
                trackCount: 5, // Default to 5 tracks
                maxTracks: 10 // Default max tracks
              }));
            
            selections.push(...artistReleases);
          }
        }
        
        this.releaseSelections.set(selections);
        this.isLoading.set(false);
        return;
      }

      // Fallback to API calls if no cached data available
      console.log('No cached data available, making API calls...');
      const artists = await this.musicBrainzService.getLabelArtists(labelData.label.id).toPromise();
      
      if (!artists || artists.length === 0) {
        this.error.set('No artists found for this label');
        return;
      }

      // Get releases for each artist
      const allReleases: MusicBrainzRelease[] = [];
      
      for (const artistEntry of artists.slice(0, 10)) { // Limit to first 10 artists to avoid overwhelming
        try {
          const artistReleases = await this.musicBrainzService.getArtistReleases(artistEntry.artist.id).toPromise();
          if (artistReleases) {
            // Add artist name to releases and filter for albums/EPs
            const labelReleases = artistReleases
              .filter(release => release['release-group']?.['primary-type'] === 'Album' || 
                               release['release-group']?.['primary-type'] === 'EP')
              .slice(0, 5) // Limit releases per artist
              .map(release => ({
                ...release,
                artistName: artistEntry.artist.name
              }));
            
            allReleases.push(...labelReleases);
          }
        } catch (error) {
          console.warn(`Failed to load releases for artist ${artistEntry.artist.name}:`, error);
        }
      }

      this.releases.set(allReleases);
      
      // Create initial selections
      const selections: ReleaseSelection[] = allReleases.map(release => ({
        release,
        artistName: (release as any).artistName,
        trackCount: Math.min(5, 10), // Default to 5 tracks
        maxTracks: 10 // Default to 10 max tracks since we don't have track count in the interface
      }));
      
      this.releaseSelections.set(selections);
      
    } catch (error) {
      console.error('Failed to load releases:', error);
      this.error.set('Failed to load label releases. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Update track count for a release
   */
  updateTrackCount(releaseId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const newCount = parseInt(target.value) || 0;
    
    const updatedSelections = this.releaseSelections().map(selection => 
      selection.release.id === releaseId 
        ? { ...selection, trackCount: Math.max(0, Math.min(newCount, selection.maxTracks)) }
        : selection
    );
    
    this.releaseSelections.set(updatedSelections);
  }

  /**
   * Create the Spotify playlist
   */
  async createPlaylist(): Promise<void> {
    if (!this.playlistForm.valid || this.totalSelectedTracks() === 0) {
      return;
    }

    this.isCreating.set(true);
    
    try {
      const request: PlaylistCreationRequest = {
        labelName: this.labelName(),
        releases: this.releaseSelections()
          .filter(selection => selection.trackCount > 0)
          .map(selection => ({
            artistName: selection.artistName,
            releaseName: selection.release.title,
            trackCount: selection.trackCount
          }))
      };

      const playlist = await this.spotifyService.createPlaylistFromLabelReleases(request).toPromise();
      
      if (playlist) {
        this.createdPlaylist.set(playlist);
        this.onPlaylistCreated.emit(playlist);
      } else {
        this.error.set('Failed to create playlist. Please try again.');
      }
      
    } catch (error) {
      console.error('Failed to create playlist:', error);
      this.error.set('Failed to create playlist. Please try again.');
    } finally {
      this.isCreating.set(false);
    }
  }
}