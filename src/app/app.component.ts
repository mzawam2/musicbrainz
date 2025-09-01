import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { LastfmAuthService } from './services/lastfm-auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'angularPlayground';
  
  private readonly lastfmAuth = inject(LastfmAuthService);

  ngOnInit(): void {
    // Check if user is already authenticated
    if (!this.lastfmAuth.isAuthenticated()) {
      // Only auto-authenticate if user hasn't explicitly declined before
      const hasDeclinedAuth = localStorage.getItem('lastfm_auth_declined');
      
      if (!hasDeclinedAuth) {
        console.log('🎵 Auto-initiating Last.fm authentication on app start...');
        // Small delay to let the app initialize fully
        setTimeout(() => {
          this.lastfmAuth.initiateAuth();
        }, 1000);
      } else {
        console.log('🎵 Last.fm authentication declined by user previously');
      }
    } else {
      console.log('🎵 User already authenticated with Last.fm:', this.lastfmAuth.currentUser()?.name);
    }
  }
}
