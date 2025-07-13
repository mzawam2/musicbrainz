import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabelGridComponent } from './label-grid.component';

describe('LabelGridComponent', () => {
  let component: LabelGridComponent;
  let fixture: ComponentFixture<LabelGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelGridComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabelGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
