import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LabelCardComponent } from './label-card.component';
import { LabelWithReleaseCount } from '../../models/musicbrainz.models';

describe('LabelCardComponent', () => {
  let component: LabelCardComponent;
  let fixture: ComponentFixture<LabelCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelCardComponent],
      providers: [
        provideRouter([])
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabelCardComponent);
    component = fixture.componentInstance;
    
    // Provide required input
    const mockLabelData: LabelWithReleaseCount = {
      id: '123',
      name: 'Test Label',
      type: 'Original Production',
      'type-id': '7aaa37fe-2def-4476-b0c9-48d50b6a5e1a',
      country: 'US',
      'life-span': {
        begin: '1990',
        ended: false
      },
      disambiguation: '',
      releaseCount: 10,
      aliases: []
    };
    
    fixture.componentRef.setInput('labelData', mockLabelData);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
