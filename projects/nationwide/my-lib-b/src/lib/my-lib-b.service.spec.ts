import { TestBed } from '@angular/core/testing';

import { MyLibBService } from './my-lib-b.service';

describe('MyLibBService', () => {
  let service: MyLibBService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MyLibBService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
