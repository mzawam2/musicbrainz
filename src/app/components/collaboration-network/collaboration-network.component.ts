import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

import { CollaborationInfo } from '../../models/musicbrainz.models';

@Component({
  selector: 'app-collaboration-network',
  imports: [],
  templateUrl: './collaboration-network.component.html',
  styleUrl: './collaboration-network.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollaborationNetworkComponent {
  // Input signals
  collaborations = input<CollaborationInfo[]>([]);
  artistName = input('');

  // Computed values
  topCollaborators = computed(() => this.collaborations().slice(0, 8));
  totalCollaborations = computed(() => 
    this.collaborations().reduce((sum, collab) => sum + collab.releaseCount, 0)
  );
  maxReleases = computed(() => 
    Math.max(...this.collaborations().map(c => c.releaseCount), 1)
  );
  
  // Make Math available in template
  Math = Math;


  getCollaborationPercentage(collaboration: CollaborationInfo): number {
    const total = this.totalCollaborations();
    if (total === 0) return 0;
    return Math.round((collaboration.releaseCount / total) * 100);
  }

  getCollaborationBarWidth(collaboration: CollaborationInfo): string {
    const maxReleases = this.maxReleases();
    const percentage = (collaboration.releaseCount / maxReleases) * 100;
    return `${Math.max(percentage, 5)}%`; // Minimum 5% for visibility
  }
}