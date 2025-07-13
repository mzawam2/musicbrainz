import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyLibBComponent } from './my-lib-b.component';

describe('MyLibBComponent', () => {
  let component: MyLibBComponent;
  let fixture: ComponentFixture<MyLibBComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyLibBComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyLibBComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
