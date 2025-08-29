import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';

import { ArtistPhotoModalData } from './artist-photo-modal-data.interface';

@Component({
  selector: 'app-artist-photo-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './artist-photo-modal.component.html',
  styleUrls: ['./artist-photo-modal.component.scss']
})
export class ArtistPhotoModalComponent implements OnInit, OnDestroy {
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);

  public dialogRef = inject(MatDialogRef<ArtistPhotoModalComponent>);
  public data = inject<ArtistPhotoModalData>(MAT_DIALOG_DATA);

  private keydownListener?: (event: KeyboardEvent) => void;

  ngOnInit(): void {
    this.keydownListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.keydownListener);
  }

  ngOnDestroy(): void {
    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener);
    }
  }

  onImageLoad(): void {
    this.isLoading.set(false);
    this.hasError.set(false);
  }

  onImageError(): void {
    this.isLoading.set(false);
    this.hasError.set(true);
  }

  close(): void {
    this.dialogRef.close();
  }
}