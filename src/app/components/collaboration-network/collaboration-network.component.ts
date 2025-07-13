import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollaborationInfo } from '../../models/musicbrainz.models';

@Component({
  selector: 'app-collaboration-network',
  imports: [CommonModule],
  templateUrl: './collaboration-network.component.html',
  styleUrl: './collaboration-network.component.scss'
})
export class CollaborationNetworkComponent implements OnChanges {
  @Input() collaborations: CollaborationInfo[] = [];
  @Input() artistName = '';

  topCollaborators: CollaborationInfo[] = [];
  totalCollaborations = 0;
  
  // Make Math available in template
  Math = Math;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['collaborations']) {
      this.processCollaborations();
    }
  }

  private processCollaborations() {
    this.topCollaborators = this.collaborations.slice(0, 8); // Top 8 collaborators
    this.totalCollaborations = this.collaborations.reduce((sum, collab) => sum + collab.releaseCount, 0);
  }

  getCollaborationPercentage(collaboration: CollaborationInfo): number {
    if (this.totalCollaborations === 0) return 0;
    return Math.round((collaboration.releaseCount / this.totalCollaborations) * 100);
  }

  getCollaborationBarWidth(collaboration: CollaborationInfo): string {
    const maxReleases = Math.max(...this.collaborations.map(c => c.releaseCount));
    const percentage = (collaboration.releaseCount / maxReleases) * 100;
    return `${Math.max(percentage, 5)}%`; // Minimum 5% for visibility
  }
}