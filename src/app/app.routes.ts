import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/discography',
    pathMatch: 'full'
  },
  {
    path: 'discography',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'label-family-trees',
    loadComponent: () => import('./components/label-family-tree/label-family-tree.component').then(m => m.LabelFamilyTreeComponent)
  }
];
