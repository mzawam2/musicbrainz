import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/discography',
    pathMatch: 'full'
  },
  {
    path: 'similar-artists',
    loadComponent: () => import('./components/similar-artists/similar-artists.component').then(m => m.SimilarArtistsComponent)
  },
  {
    path: 'discography',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'label-family-trees',
    loadComponent: () => import('./components/label-family-tree/label-family-tree.component').then(m => m.LabelFamilyTreeComponent)
  },
  {
    path: 'spotify-callback',
    loadComponent: () => import('./components/spotify-callback/spotify-callback.component').then(m => m.SpotifyCallbackComponent)
  },
  {
    path: 'lastfm-callback',
    loadComponent: () => import('./components/lastfm-callback/lastfm-callback.component').then(m => m.LastfmCallbackComponent)
  }
];
