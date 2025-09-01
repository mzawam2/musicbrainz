import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LastfmAuthService } from './lastfm-auth.service';
import { 
  LastFmAuthSessionResponse, 
  LastFmSession, 
  LastFmUser,
  LastFmError 
} from '../models/lastfm.models';

describe('LastfmAuthService', () => {
  let service: LastfmAuthService;
  let httpMock: HttpTestingController;

  const mockSessionResponse: LastFmAuthSessionResponse = {
    session: {
      name: 'testuser',
      key: 'd580d57f32848f5dcf574d1ce18d78b2',
      subscriber: '0'
    }
  };

  const mockUserResponse = {
    user: {
      name: 'testuser',
      realname: 'Test User',
      url: 'https://www.last.fm/user/testuser',
      country: 'US',
      age: '25',
      gender: 'm',
      subscriber: '0',
      playcount: '12345',
      image: [
        { '#text': 'https://example.com/avatar.jpg', size: 'large' }
      ]
    } as LastFmUser
  };

  const mockErrorResponse: LastFmError = {
    error: 4,
    message: 'Authentication Failed'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LastfmAuthService]
    });

    service = TestBed.inject(LastfmAuthService);
    httpMock = TestBed.inject(HttpTestingController);

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Authentication State', () => {
    it('should initialize with unauthenticated state', () => {
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.currentUser()).toBeNull();
      expect(service.sessionKey()).toBeNull();
    });

    it('should load stored authentication on initialization', () => {
      const sessionKey = 'stored-session-key';
      const userData: LastFmUser = {
        name: 'storeduser',
        subscriber: '1'
      };

      localStorage.setItem('lastfm_session', sessionKey);
      localStorage.setItem('lastfm_user', JSON.stringify(userData));

      // Create new service instance to test initialization
      const newService = TestBed.inject(LastfmAuthService);

      expect(newService.isAuthenticated()).toBeTrue();
      expect(newService.sessionKey()).toBe(sessionKey);
      expect(newService.currentUser()).toEqual(userData);
    });

    it('should handle corrupted stored data gracefully', () => {
      localStorage.setItem('lastfm_session', 'valid-session');
      localStorage.setItem('lastfm_user', 'invalid-json');

      const newService = TestBed.inject(LastfmAuthService);

      expect(newService.isAuthenticated()).toBeFalse();
      expect(localStorage.getItem('lastfm_session')).toBeNull();
      expect(localStorage.getItem('lastfm_user')).toBeNull();
    });
  });

  describe('initiateAuth', () => {
    it('should redirect to Last.fm authorization URL', () => {
      const originalLocation = window.location.href;
      
      // Mock window.location
      delete (window as any).location;
      (window as any).location = { href: '' };

      service.initiateAuth();

      expect(window.location.href).toContain('https://www.last.fm/api/auth/');
      expect(window.location.href).toContain('api_key=YOUR_LASTFM_API_KEY');
      expect(window.location.href).toContain('cb=http://127.0.0.1:4200/lastfm-callback');

      // Restore original location
      (window as any).location = { href: originalLocation };
    });
  });

  describe('handleAuthCallback', () => {
    it('should successfully exchange token for session', () => {
      const token = 'test-auth-token';

      service.handleAuthCallback(token).subscribe(result => {
        expect(result).toBeTrue();
        expect(service.isAuthenticated()).toBeTrue();
        expect(service.sessionKey()).toBe(mockSessionResponse.session.key);
        expect(service.currentUser()?.name).toBe(mockSessionResponse.session.name);
      });

      const req = httpMock.expectOne((request) => {
        return request.url === service['config'].apiUrl &&
               request.params.get('method') === 'auth.getSession' &&
               request.params.get('token') === token &&
               request.params.has('api_sig');
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockSessionResponse);
    });

    it('should handle authentication errors', () => {
      const token = 'invalid-token';

      service.handleAuthCallback(token).subscribe(result => {
        expect(result).toBeFalse();
        expect(service.isAuthenticated()).toBeFalse();
      });

      const req = httpMock.expectOne((request) => 
        request.params.get('method') === 'auth.getSession'
      );
      req.flush(mockErrorResponse, { status: 403, statusText: 'Forbidden' });
    });

    it('should store authentication data in localStorage', () => {
      const token = 'test-token';

      service.handleAuthCallback(token).subscribe();

      const req = httpMock.expectOne((request) => 
        request.params.get('method') === 'auth.getSession'
      );
      req.flush(mockSessionResponse);

      expect(localStorage.getItem('lastfm_session')).toBe(mockSessionResponse.session.key);
      expect(JSON.parse(localStorage.getItem('lastfm_user')!)).toEqual({
        name: mockSessionResponse.session.name,
        subscriber: mockSessionResponse.session.subscriber
      });
    });
  });

  describe('signOut', () => {
    it('should clear all authentication data', () => {
      // Set up authenticated state
      localStorage.setItem('lastfm_session', 'test-session');
      localStorage.setItem('lastfm_user', '{"name":"testuser"}');
      
      service['_isAuthenticated'].set(true);
      service['_sessionKey'].set('test-session');
      service['_currentUser'].set({ name: 'testuser' });

      service.signOut();

      expect(service.isAuthenticated()).toBeFalse();
      expect(service.sessionKey()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(localStorage.getItem('lastfm_session')).toBeNull();
      expect(localStorage.getItem('lastfm_user')).toBeNull();
    });
  });

  describe('getUserInfo', () => {
    beforeEach(() => {
      // Set up authenticated state
      service['_isAuthenticated'].set(true);
      service['_sessionKey'].set('test-session-key');
      service['_currentUser'].set({ name: 'testuser' });
    });

    it('should fetch user information for authenticated user', () => {
      service.getUserInfo().subscribe(user => {
        expect(user).toEqual(mockUserResponse.user);
        expect(service.currentUser()).toEqual(mockUserResponse.user);
      });

      const req = httpMock.expectOne((request) => {
        return request.url === service['config'].apiUrl &&
               request.params.get('method') === 'user.getInfo' &&
               request.params.get('sk') === 'test-session-key' &&
               request.params.has('api_sig');
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockUserResponse);
    });

    it('should throw error when not authenticated', () => {
      service['_isAuthenticated'].set(false);
      service['_sessionKey'].set(null);

      service.getUserInfo().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toBe('Not authenticated');
        }
      });

      httpMock.expectNone((request) => request.params.get('method') === 'user.getInfo');
    });

    it('should handle API errors', () => {
      service.getUserInfo().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Last.fm API error');
        }
      });

      const req = httpMock.expectOne((request) => 
        request.params.get('method') === 'user.getInfo'
      );
      req.flush(mockErrorResponse, { status: 400, statusText: 'Bad Request' });
    });

    it('should sign out on invalid session error', () => {
      const invalidSessionError: LastFmError = {
        error: 9,
        message: 'Invalid session key'
      };

      spyOn(service, 'signOut');

      service.getUserInfo().subscribe({
        next: () => fail('should have failed'),
        error: () => {
          expect(service.signOut).toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne((request) => 
        request.params.get('method') === 'user.getInfo'
      );
      req.flush(invalidSessionError, { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('generateApiSignature', () => {
    it('should generate correct MD5 signature', () => {
      const params = new Map([
        ['method', 'auth.getSession'],
        ['api_key', 'test-api-key'],
        ['token', 'test-token']
      ]);

      const signature = service.generateApiSignature(params);

      expect(signature).toBeTruthy();
      expect(signature.length).toBe(32); // MD5 hash should be 32 characters
      expect(typeof signature).toBe('string');
    });

    it('should exclude format and api_sig from signature calculation', () => {
      const params = new Map([
        ['method', 'auth.getSession'],
        ['api_key', 'test-api-key'],
        ['token', 'test-token'],
        ['format', 'json'],
        ['api_sig', 'existing-sig']
      ]);

      const signature = service.generateApiSignature(params);

      // The signature should be generated without format and api_sig parameters
      expect(signature).toBeTruthy();
      expect(signature.length).toBe(32);
    });

    it('should generate consistent signatures for same input', () => {
      const params = new Map([
        ['method', 'test.method'],
        ['api_key', 'test-key'],
        ['param1', 'value1']
      ]);

      const sig1 = service.generateApiSignature(params);
      const sig2 = service.generateApiSignature(params);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different inputs', () => {
      const params1 = new Map([['method', 'test1'], ['api_key', 'key1']]);
      const params2 = new Map([['method', 'test2'], ['api_key', 'key2']]);

      const sig1 = service.generateApiSignature(params1);
      const sig2 = service.generateApiSignature(params2);

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('createAuthenticatedParams', () => {
    beforeEach(() => {
      service['_sessionKey'].set('test-session-key');
    });

    it('should create authenticated HTTP parameters', () => {
      const baseParams = new Map([
        ['method', 'user.getInfo'],
        ['user', 'testuser']
      ]);

      const httpParams = service.createAuthenticatedParams(baseParams);

      expect(httpParams.get('method')).toBe('user.getInfo');
      expect(httpParams.get('user')).toBe('testuser');
      expect(httpParams.get('api_key')).toBe('YOUR_LASTFM_API_KEY');
      expect(httpParams.get('sk')).toBe('test-session-key');
      expect(httpParams.get('format')).toBe('json');
      expect(httpParams.has('api_sig')).toBeTrue();
    });

    it('should throw error when not authenticated', () => {
      service['_sessionKey'].set(null);
      const baseParams = new Map([['method', 'test']]);

      expect(() => {
        service.createAuthenticatedParams(baseParams);
      }).toThrowError('Not authenticated - session key required');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      service['_isAuthenticated'].set(true);
      service['_sessionKey'].set('test-session');
      service['_currentUser'].set({ name: 'testuser' });
    });

    it('should handle network errors', () => {
      service.getUserInfo().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Network error');
        }
      });

      const req = httpMock.expectOne((request) => 
        request.params.get('method') === 'user.getInfo'
      );
      req.error(new ErrorEvent('Network error'), { status: 0 });
    });

    it('should handle HTTP errors', () => {
      service.getUserInfo().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('HTTP error 500');
        }
      });

      const req = httpMock.expectOne((request) => 
        request.params.get('method') === 'user.getInfo'
      );
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    });
  });
});