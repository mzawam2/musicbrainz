import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { CoverArtArchiveService } from './cover-art-archive.service';

describe('CoverArtArchiveService', () => {
  let service: CoverArtArchiveService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CoverArtArchiveService]
    });
    service = TestBed.inject(CoverArtArchiveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getReleaseGroupThumbnailUrl', () => {
    it('should construct correct thumbnail URL with 250px size', () => {
      const releaseGroupId = '12345678-1234-1234-1234-123456789abc';
      const expectedUrl = 'https://coverartarchive.org/release-group/12345678-1234-1234-1234-123456789abc/front-250';

      const url = service.getReleaseGroupThumbnailUrl(releaseGroupId);

      expect(url).toBe(expectedUrl);
    });
  });

  describe('getReleaseGroupFrontCoverUrl', () => {
    it('should construct correct URL with default 1200px size', () => {
      const releaseGroupId = '12345678-1234-1234-1234-123456789abc';
      const expectedUrl = 'https://coverartarchive.org/release-group/12345678-1234-1234-1234-123456789abc/front-1200';

      const url = service.getReleaseGroupFrontCoverUrl(releaseGroupId);

      expect(url).toBe(expectedUrl);
    });

    it('should construct correct URL with 250px size', () => {
      const releaseGroupId = '12345678-1234-1234-1234-123456789abc';
      const expectedUrl = 'https://coverartarchive.org/release-group/12345678-1234-1234-1234-123456789abc/front-250';

      const url = service.getReleaseGroupFrontCoverUrl(releaseGroupId, 250);

      expect(url).toBe(expectedUrl);
    });

    it('should construct correct URL with 500px size', () => {
      const releaseGroupId = '12345678-1234-1234-1234-123456789abc';
      const expectedUrl = 'https://coverartarchive.org/release-group/12345678-1234-1234-1234-123456789abc/front-500';

      const url = service.getReleaseGroupFrontCoverUrl(releaseGroupId, 500);

      expect(url).toBe(expectedUrl);
    });

    it('should construct correct URL with 1200px size', () => {
      const releaseGroupId = '12345678-1234-1234-1234-123456789abc';
      const expectedUrl = 'https://coverartarchive.org/release-group/12345678-1234-1234-1234-123456789abc/front-1200';

      const url = service.getReleaseGroupFrontCoverUrl(releaseGroupId, 1200);

      expect(url).toBe(expectedUrl);
    });
  });

  describe('checkArtworkExists', () => {
    it('should return true when artwork exists (200 response)', (done) => {
      const releaseGroupId = '12345678-1234-1234-1234-123456789abc';
      const expectedUrl = 'https://coverartarchive.org/release-group/12345678-1234-1234-1234-123456789abc/front-250';

      service.checkArtworkExists(releaseGroupId).subscribe((exists) => {
        expect(exists).toBe(true);
        done();
      });

      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('HEAD');
      req.flush(null, { status: 200, statusText: 'OK' });
    });

    it('should return false when artwork does not exist (404 response)', (done) => {
      const releaseGroupId = '12345678-1234-1234-1234-123456789abc';
      const expectedUrl = 'https://coverartarchive.org/release-group/12345678-1234-1234-1234-123456789abc/front-250';

      service.checkArtworkExists(releaseGroupId).subscribe((exists) => {
        expect(exists).toBe(false);
        done();
      });

      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('HEAD');
      req.flush(null, { status: 404, statusText: 'Not Found' });
    });

    it('should return false when network error occurs', (done) => {
      const releaseGroupId = '12345678-1234-1234-1234-123456789abc';
      const expectedUrl = 'https://coverartarchive.org/release-group/12345678-1234-1234-1234-123456789abc/front-250';

      service.checkArtworkExists(releaseGroupId).subscribe((exists) => {
        expect(exists).toBe(false);
        done();
      });

      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('HEAD');
      req.error(new ProgressEvent('error'));
    });
  });
});
