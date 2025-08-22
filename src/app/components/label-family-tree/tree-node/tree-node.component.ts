import { Component, input, output, signal, computed, OnInit } from '@angular/core';

import { ChangeDetectionStrategy } from '@angular/core';
import { LabelTreeNode } from '../../../models/musicbrainz.models';
import { ArtistRosterComponent } from '../artist-roster/artist-roster.component';

@Component({
  selector: 'app-tree-node',
  imports: [ArtistRosterComponent],
  templateUrl: './tree-node.component.html',
  styleUrls: ['./tree-node.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreeNodeComponent implements OnInit {
  // Input signals
  node = input.required<LabelTreeNode>();
  
  // Output events
  nodeSelected = output<LabelTreeNode>();
  
  // Internal state
  isExpanded = signal(false);
  
  // Bio-related signals
  labelBio = signal<string | null>(null);
  isLoadingLabelBio = signal(false);
  labelBioError = signal<string | null>(null);
  
  // Computed values
  hasChildren = computed(() => this.node().children.length > 0);
  artistCount = computed(() => this.node().artistRoster?.length || 0);
  relationshipText = computed(() => {
    const relationship = this.node().relationship;
    if (!relationship) return 'Root Label';
    
    const type = relationship.type.replace('-', ' ');
    return type.charAt(0).toUpperCase() + type.slice(1);
  });
  
  depthClass = computed(() => `depth-${Math.min(this.node().depth, 5)}`);
  
  relationshipAttributes = computed(() => this.node().relationship?.attributes || []);
  hasAttributes = computed(() => this.relationshipAttributes().length > 0);
  
  ngOnInit(): void {
    // Set initial expanded state based on node properties
    this.isExpanded.set(this.node().expanded || false);
    
    // Load label biography
    this.loadLabelBio(this.node().label.name);
  }
  
  toggleExpansion(): void {
    if (this.hasChildren()) {
      this.isExpanded.update(expanded => !expanded);
    }
  }
  
  selectNode(): void {
    this.nodeSelected.emit(this.node());
  }
  
  onChildNodeSelected(childNode: LabelTreeNode): void {
    // Bubble up the event to parent
    this.nodeSelected.emit(childNode);
  }
  
  getConnectionLineClass(): string {
    const classes = ['connection-line'];
    
    if (this.node().depth > 0) {
      classes.push('has-parent');
    }
    
    if (this.hasChildren()) {
      classes.push('has-children');
    }
    
    return classes.join(' ');
  }
  
  formatDateRange(): string {
    const relationship = this.node().relationship;
    if (!relationship) return '';
    
    const begin = relationship.begin;
    const end = relationship.end;
    
    if (begin && end) {
      return `${begin} - ${end}`;
    } else if (begin) {
      return `${begin} - present`;
    } else if (end) {
      return `Until ${end}`;
    }
    
    return '';
  }
  
  getLabelTypeIcon(): string {
    const type = this.node().label.type?.toLowerCase();
    
    switch (type) {
      case 'production':
        return '🏭';
      case 'original production':
        return '🎵';
      case 'holding':
        return '🏢';
      case 'reissue':
        return '🔄';
      case 'bootleg production':
        return '⚠️';
      case 'distributor':
        return '📦';
      default:
        return '🏷️';
    }
  }

  private loadLabelBio(labelName: string) {
    // Simple Wikipedia API call to get label summary
    this.isLoadingLabelBio.set(true);
    this.labelBioError.set(null);
    this.labelBio.set(null);

    // Try with different search terms with label-specific suffixes
    const searchTerms = [
      `${labelName} (record label)`,
      `${labelName} Records`,
      `${labelName} (label)`,
      `${labelName} Music`,
      labelName
    ];

    this.tryLabelWikipediaSearch(searchTerms, 0);
  }

  private tryLabelWikipediaSearch(searchTerms: string[], index: number) {
    if (index >= searchTerms.length) {
      this.labelBioError.set('Biography not available');
      this.isLoadingLabelBio.set(false);
      return;
    }

    // Use the Wikipedia API to get the full intro section
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(searchTerms[index])}&prop=extracts&exintro=1&explaintext=1&origin=*`;
    
    fetch(searchUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Biography not found');
        }
        return response.json();
      })
      .then(data => {
        if (data.query && data.query.pages) {
          const pages = data.query.pages;
          const pageId = Object.keys(pages)[0];
          const page = pages[pageId];
          
          if (page.extract && page.extract.trim() && !page.missing) {
            // Found a valid biography
            let extract = page.extract;
            // Keep more content for labels but still limit for card space
            if (extract.length > 600) {
              extract = extract.substring(0, 600) + '...';
            }
            this.labelBio.set(extract);
            this.isLoadingLabelBio.set(false);
          } else {
            // Try next search term
            this.tryLabelWikipediaSearch(searchTerms, index + 1);
          }
        } else {
          // Try next search term
          this.tryLabelWikipediaSearch(searchTerms, index + 1);
        }
      })
      .catch(error => {
        // Try next search term on error
        this.tryLabelWikipediaSearch(searchTerms, index + 1);
      });
  }
}