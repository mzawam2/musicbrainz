import { Component, inject, signal, computed, effect, ElementRef, ViewChild, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, takeUntil, filter } from 'rxjs';
import { MusicBrainzService } from '../../services/musicbrainz.service';
import { TreeNodeComponent } from './tree-node/tree-node.component';
import { 
  MusicBrainzLabel, 
  LabelFamilyTree, 
 
  LabelTreeNode 
} from '../../models/musicbrainz.models';

interface LabelFamilyTreeComponentState {
  selectedLabel: MusicBrainzLabel | null;
  searchTerm: string;
  familyTree: LabelFamilyTree | null;
  timestamp: number;
}

@Component({
  selector: 'app-label-family-tree',
  imports: [CommonModule, ReactiveFormsModule, TreeNodeComponent],
  templateUrl: './label-family-tree.component.html',
  styleUrls: ['./label-family-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabelFamilyTreeComponent implements OnInit, OnDestroy {
  private musicBrainzService = inject(MusicBrainzService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // State persistence constants
  private readonly STATE_STORAGE_KEY = 'labelFamilyTreeComponent_state';
  private readonly STATE_EXPIRY_HOURS = 24;
  private isRestoringFromCache = false;
  private pendingAutoSelectLabel: MusicBrainzLabel | null = null;

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

    // Visual loading indicators replace form control disable/enable to prevent focus loss

    // Listen for navigation events to capture state
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Check for navigation state after navigation completes
        this.checkNavigationState();
      });
  }

  ngOnInit() {
    console.log('🔄 LabelFamilyTreeComponent ngOnInit - starting initialization');
    
    // Try to check navigation state immediately
    this.checkNavigationState();
    
    // If no navigation state was found, restore from cache
    if (!this.pendingAutoSelectLabel) {
      console.log('🔄 No navigation state, attempting to restore from cache');
      this.restoreState();
    }
  }

  ngOnDestroy(): void {
    console.log('🔄 LabelFamilyTreeComponent ngOnDestroy - saving state before destruction');
    this.saveState();
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
        
        // Check if we need to auto-select a label from navigation
        if (this.pendingAutoSelectLabel) {
          const matchingLabel = labels.find(label => label.id === this.pendingAutoSelectLabel!.id);
          if (matchingLabel) {
            console.log('🔄 Auto-selecting label from navigation:', matchingLabel.name);
            // Small delay to let the search results render first
            setTimeout(() => {
              this.selectLabel(matchingLabel);
              this.pendingAutoSelectLabel = null;
            }, 100);
          } else {
            console.log('🔄 Label not found in search results, selecting directly');
            // If the exact label isn't in search results, select it directly
            this.selectLabel(this.pendingAutoSelectLabel);
            this.pendingAutoSelectLabel = null;
          }
        }
      },
      error: (error) => {
        console.error('Search error:', error);
        this.error.set(error.message || 'Search failed');
        this.isSearching.set(false);
        this.searchResults.set([]);
        
        // If search fails but we have a pending label, select it directly
        if (this.pendingAutoSelectLabel) {
          console.log('🔄 Search failed, selecting label directly');
          this.selectLabel(this.pendingAutoSelectLabel);
          this.pendingAutoSelectLabel = null;
        }
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
    // Clear persisted state when user manually clears search
    this.clearPersistedState();
  }


  exportTree(format: 'json' | 'csv'): void {
    const tree = this.familyTree();
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

  private saveState(): void {
    try {
      const state: LabelFamilyTreeComponentState = {
        selectedLabel: this.selectedLabel(),
        searchTerm: this.searchControl.value || '',
        familyTree: this.familyTree(),
        timestamp: Date.now()
      };

      sessionStorage.setItem(this.STATE_STORAGE_KEY, JSON.stringify(state));
      console.log('🔄 Saved label family tree component state:', {
        hasSelectedLabel: !!state.selectedLabel,
        searchTerm: state.searchTerm,
        hasFamilyTree: !!state.familyTree
      });
    } catch (error) {
      console.error('Failed to save label family tree component state:', error);
    }
  }

  private restoreState(): void {
    try {
      const savedState = sessionStorage.getItem(this.STATE_STORAGE_KEY);
      if (!savedState) {
        console.log('🔄 No saved state found');
        // Ensure clean state for fresh component load
        this.isSearching.set(false);
        this.isActivelySearching.set(false);
        this.searchResults.set([]);
        return;
      }

      const state: LabelFamilyTreeComponentState = JSON.parse(savedState);
      const now = Date.now();
      const stateAge = now - state.timestamp;
      const maxAge = this.STATE_EXPIRY_HOURS * 60 * 60 * 1000;

      if (stateAge > maxAge) {
        console.log('🔄 Saved state expired, clearing storage');
        sessionStorage.removeItem(this.STATE_STORAGE_KEY);
        // Ensure clean state when cache expires
        this.isSearching.set(false);
        this.isActivelySearching.set(false);
        this.searchResults.set([]);
        return;
      }

      console.log('🔄 Restoring label family tree component state:', {
        hasSelectedLabel: !!state.selectedLabel,
        searchTerm: state.searchTerm,
        hasFamilyTree: !!state.familyTree,
        ageMinutes: Math.round(stateAge / (1000 * 60))
      });

      // Restore the state
      if (state.selectedLabel) {
        this.selectedLabel.set(state.selectedLabel);
        this.searchControl.setValue(state.searchTerm, { emitEvent: false });
        // Clear search results and searching state when restoring selected label
        this.searchResults.set([]);
        this.isActivelySearching.set(false);
        this.isSearching.set(false); // Ensure search loading state is false
      }

      if (state.familyTree) {
        this.familyTree.set(state.familyTree);
      }


    } catch (error) {
      console.error('Failed to restore label family tree component state:', error);
      sessionStorage.removeItem(this.STATE_STORAGE_KEY);
      // Ensure clean state on restoration error
      this.isSearching.set(false);
      this.isActivelySearching.set(false);
      this.searchResults.set([]);
    }
  }

  private clearPersistedState(): void {
    sessionStorage.removeItem(this.STATE_STORAGE_KEY);
  }

  private checkNavigationState(): void {
    // Try multiple ways to get navigation state
    const navigation = this.router.getCurrentNavigation();
    const navigationState = navigation?.extras?.state;
    const historyState = window.history.state;
    
    console.log('🔄 Checking navigation state:', { 
      hasNavigation: !!navigation, 
      hasNavigationState: !!navigationState,
      navigationState: navigationState,
      historyState: historyState
    });
    
    // Check navigation state first
    if (navigationState?.['selectedLabel'] && navigationState?.['fromLabelCard']) {
      console.log('🔄 Found navigation state with label:', navigationState['selectedLabel'].name);
      this.initializeWithLabel(navigationState['selectedLabel']);
      return;
    }
    
    // Fallback to history state
    if (historyState?.selectedLabel && historyState?.fromLabelCard) {
      console.log('🔄 Found history state with label:', historyState.selectedLabel.name);
      this.initializeWithLabel(historyState.selectedLabel);
      return;
    }
    
    console.log('🔄 No valid navigation state found');
  }

  private initializeWithLabel(label: MusicBrainzLabel): void {
    console.log('🔄 Initializing with label from navigation:', label.name);
    
    // Populate search box and trigger search to show the label in results
    this.searchControl.setValue(label.name, { emitEvent: true });
    
    // Clear error states
    this.error.set(null);
    
    // Note: The search will populate searchResults, then we'll auto-select
    // We need to wait for the search to complete before selecting
    // This will be handled by the search subscription, but we need to 
    // mark this label for auto-selection
    this.pendingAutoSelectLabel = label;
  }
}