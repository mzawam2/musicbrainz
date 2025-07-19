import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy } from '@angular/core';
import { LabelTreeNode } from '../../../models/musicbrainz.models';

@Component({
  selector: 'app-tree-node',
  imports: [CommonModule],
  templateUrl: './tree-node.component.html',
  styleUrls: ['./tree-node.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreeNodeComponent {
  // Input signals
  node = input.required<LabelTreeNode>();
  
  // Output events
  nodeSelected = output<LabelTreeNode>();
  
  // Internal state
  isExpanded = signal(false);
  
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
}