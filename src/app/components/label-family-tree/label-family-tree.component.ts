import { Component, inject, signal, computed, effect, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { TreeNodeComponent } from './tree-node/tree-node.component';
import { 
  MusicBrainzLabel, 
  LabelFamilyTree, 
  LabelSearchFilters, 
  LabelTreeNode 
} from '../../models/musicbrainz.models';

@Component({
  selector: 'app-label-family-tree',
  imports: [CommonModule, ReactiveFormsModule, TreeNodeComponent],
  templateUrl: './label-family-tree.component.html',
  styleUrls: ['./label-family-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelFamilyTreeComponent implements OnDestroy {
  private musicBrainzService = inject(MusicBrainzService);
  private destroy$ = new Subject<void>();

  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;

  // Form control for search with debouncing
  searchControl = new FormControl('');

  // Signals for state management
  searchResults = signal<MusicBrainzLabel[]>([]);
  selectedLabel = signal<MusicBrainzLabel | null>(null);
  familyTree = signal<LabelFamilyTree | null>(null);
  isSearching = signal(false);
  isLoadingTree = signal(false);
  error = signal<string | null>(null);
  isActivelySearching = signal(false);

  // Filter signals
  filters = signal<LabelSearchFilters>({
    relationshipTypes: ['parent', 'subsidiary', 'imprint'],
    countries: [],
    activeOnly: false,
    hasArtists: false
  });

  // UI state signals
  showFilters = signal(false);

  // Computed values
  filteredTree = computed(() => {
    const tree = this.familyTree();
    if (!tree) return null;
    
    // Apply filters to the tree structure
    return this.applyFiltersToTree(tree);
  });

  hasResults = computed(() => this.searchResults().length > 0);
  hasTree = computed(() => this.familyTree() !== null);

  constructor() {
    // Set up debounced search using FormControl
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        this.isActivelySearching.set(true);
        this.performSearch(query || '');
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private performSearch(query: string): void {
    if (!query) {
      this.searchResults.set([]);
      this.isActivelySearching.set(false);
      return;
    }

    this.isSearching.set(true);
    this.error.set(null);

    this.musicBrainzService.searchLabels(query, 20).subscribe({
      next: (labels) => {
        this.searchResults.set(labels);
        this.isSearching.set(false);
      },
      error: (error) => {
        console.error('Search error:', error);
        this.error.set(error.message || 'Search failed');
        this.isSearching.set(false);
        this.searchResults.set([]);
      }
    });
  }

  selectLabel(label: MusicBrainzLabel): void {
    this.selectedLabel.set(label);
    this.searchResults.set([]);
    this.isActivelySearching.set(false);
    this.searchControl.setValue(label.name, { emitEvent: false }); // Don't trigger search
    this.loadFamilyTree(label.id);
    
    // Restore focus to search input after DOM updates
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 0);
  }

  private loadFamilyTree(labelId: string): void {
    this.isLoadingTree.set(true);
    this.error.set(null);

    this.musicBrainzService.buildLabelFamilyTree(labelId, 3).subscribe({
      next: (tree) => {
        this.familyTree.set(tree);
        this.isLoadingTree.set(false);
      },
      error: (error) => {
        console.error('Tree loading error:', error);
        this.error.set(error.message || 'Failed to load family tree');
        this.isLoadingTree.set(false);
      }
    });
  }

  toggleFilters(): void {
    this.showFilters.set(!this.showFilters());
  }

  updateFilters(newFilters: Partial<LabelSearchFilters>): void {
    this.filters.update(current => ({ ...current, ...newFilters }));
  }

  toggleRelationshipType(type: string): void {
    this.filters.update(current => {
      const types = current.relationshipTypes.includes(type)
        ? current.relationshipTypes.filter(t => t !== type)
        : [...current.relationshipTypes, type];
      return { ...current, relationshipTypes: types };
    });
  }

  selectNode(node: LabelTreeNode): void {
    // Node selection is now handled within tree-node component
  }

  clearSearch(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.searchResults.set([]);
    this.selectedLabel.set(null);
    this.familyTree.set(null);
    this.isActivelySearching.set(false);
    this.error.set(null);
  }

  private applyFiltersToTree(tree: LabelFamilyTree): LabelFamilyTree {
    const filters = this.filters();
    
    // Clone the tree and apply filters
    const filteredTreeNode = this.filterTreeNode(tree.tree, filters);
    
    return {
      ...tree,
      tree: filteredTreeNode
    };
  }

  private filterTreeNode(node: LabelTreeNode, filters: LabelSearchFilters): LabelTreeNode {
    // Apply relationship type filter
    const shouldInclude = !node.relationship || 
      filters.relationshipTypes.includes(node.relationship.type);

    if (!shouldInclude) {
      return { ...node, children: [] };
    }

    // Recursively filter children
    const filteredChildren = node.children
      .map(child => this.filterTreeNode(child, filters))
      .filter(child => child.children.length > 0 || !child.relationship ||
        filters.relationshipTypes.includes(child.relationship.type));

    return {
      ...node,
      children: filteredChildren
    };
  }

  exportTree(format: 'json' | 'csv'): void {
    const tree = this.filteredTree();
    if (!tree) return;

    if (format === 'json') {
      this.exportAsJson(tree);
    } else {
      this.exportAsCsv(tree);
    }
  }

  private exportAsJson(tree: LabelFamilyTree): void {
    const dataStr = JSON.stringify(tree, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-family-tree-${tree.rootLabel.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(tree: LabelFamilyTree): void {
    const csvData = this.convertTreeToCsv(tree.tree);
    const dataBlob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-family-tree-${tree.rootLabel.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  private convertTreeToCsv(node: LabelTreeNode, parentName: string = ''): string {
    let csv = 'Label Name,Type,Country,Relationship Type,Parent Label,Depth,Artist Count\n';
    
    const addNodeToCsv = (n: LabelTreeNode, parent: string) => {
      const artistCount = n.artistRoster?.length || 0;
      const relationshipType = n.relationship?.type || 'root';
      
      csv += `"${n.label.name}","${n.label.type}","${n.label.country}","${relationshipType}","${parent}",${n.depth},${artistCount}\n`;
      
      n.children.forEach(child => addNodeToCsv(child, n.label.name));
    };
    
    addNodeToCsv(node, parentName);
    return csv;
  }
}