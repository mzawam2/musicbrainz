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
      label: {
        id: '123',
        name: 'Test Label',
        'sort-name': 'Test Label',
        type: 'Original Production',
        'type-id': '7aaa37fe-2def-4476-b0c9-48d50b6a5e1a',
        country: 'US',
        'label-code': 12345,
        'life-span': {
          begin: '1990',
          end: null,
          ended: false
        },
        disambiguation: '',
        area: {
          id: '456',
          name: 'United States',
          'sort-name': 'United States',
          'type-id': null,
          'iso-3166-1-codes': ['US'],
          disambiguation: '',
          type: null
        },
        aliases: [],
        rating: { value: 5, 'votes-count': 1 },
        tags: [],
        isnis: [],
        ipis: []
      },
      releaseCount: 10,
      releases: []
    };
    
    fixture.componentRef.setInput('labelData', mockLabelData);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
