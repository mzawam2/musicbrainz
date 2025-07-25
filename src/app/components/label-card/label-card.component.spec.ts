import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabelCardComponent } from './label-card.component';

describe('LabelCardComponent', () => {
  let component: LabelCardComponent;
  let fixture: ComponentFixture<LabelCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabelCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
