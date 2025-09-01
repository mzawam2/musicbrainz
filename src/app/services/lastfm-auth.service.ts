import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  LastFmAuthConfig, 
  LastFmSession, 
  LastFmAuthSessionResponse,
  LastFmUser,
  LastFmError 
} from '../models/lastfm.models';

@Injectable({
  providedIn: 'root'
})
export class LastfmAuthService {
  private readonly http = inject(HttpClient);
  
  private readonly config: LastFmAuthConfig = {
    apiKey: environment.lastfm.apiKey,
    sharedSecret: environment.lastfm.sharedSecret,
    apiUrl: environment.lastfm.apiUrl,
    authUrl: environment.lastfm.authUrl,
    callbackUrl: environment.lastfm.callbackUrl
  };

  // Authentication state signals
  private readonly _isAuthenticated = signal(false);
  private readonly _currentUser = signal<LastFmUser | null>(null);
  private readonly _sessionKey = signal<string | null>(null);

  // Public readonly signals
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly sessionKey = this._sessionKey.asReadonly();

  private readonly SESSION_STORAGE_KEY = 'lastfm_session';
  private readonly USER_STORAGE_KEY = 'lastfm_user';

  constructor() {
    this.loadStoredAuth();
  }

  /**
   * Initiates the Last.fm OAuth flow by redirecting to Last.fm
   */
  initiateAuth(): void {
    const params = new URLSearchParams({
      api_key: this.config.apiKey,
      cb: this.config.callbackUrl
    });

    window.location.href = `${this.config.authUrl}?${params}`;
  }

  /**
   * Handles the OAuth callback and exchanges token for session key
   */
  handleAuthCallback(token: string): Observable<boolean> {
    const params = new Map([
      ['method', 'auth.getSession'],
      ['api_key', this.config.apiKey],
      ['token', token]
    ]);

    const apiSig = this.generateApiSignature(params);
    params.set('api_sig', apiSig);
    params.set('format', 'json');

    const httpParams = new HttpParams({ fromObject: Object.fromEntries(params) });

    return this.http.get<LastFmAuthSessionResponse>(this.config.apiUrl, { params: httpParams }).pipe(
      map(response => {
        if (response.session) {
          this.setAuthData(response.session);
          return true;
        }
        return false;
      }),
      catchError(error => {
        console.error('Auth callback error:', error);
        return of(false);
      })
    );
  }

  /**
   * Signs out the user and clears stored authentication data
   */
  signOut(): void {
    this._isAuthenticated.set(false);
    this._currentUser.set(null);
    this._sessionKey.set(null);
    
    localStorage.removeItem(this.SESSION_STORAGE_KEY);
    localStorage.removeItem(this.USER_STORAGE_KEY);
  }

  /**
   * Gets user information for the authenticated user
   */
  getUserInfo(): Observable<LastFmUser> {
    const currentSession = this._sessionKey();
    if (!currentSession) {
      return throwError(() => new Error('Not authenticated'));
    }

    const params = new Map([
      ['method', 'user.getInfo'],
      ['api_key', this.config.apiKey],
      ['sk', currentSession],
      ['user', this._currentUser()?.name || '']
    ]);

    const apiSig = this.generateApiSignature(params);
    params.set('api_sig', apiSig);
    params.set('format', 'json');

    const httpParams = new HttpParams({ fromObject: Object.fromEntries(params) });

    return this.http.get<{ user: LastFmUser }>(this.config.apiUrl, { params: httpParams }).pipe(
      map(response => response.user),
      tap(user => this._currentUser.set(user)),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Generates API signature for authenticated requests
   */
  generateApiSignature(params: Map<string, string>): string {
    // Remove format and api_sig if present
    const signatureParams = new Map(params);
    signatureParams.delete('format');
    signatureParams.delete('api_sig');

    // Sort parameters alphabetically by key
    const sortedParams = Array.from(signatureParams.entries()).sort(([a], [b]) => a.localeCompare(b));

    // Create signature string: key1value1key2value2...secret
    const signatureString = sortedParams
      .map(([key, value]) => `${key}${value}`)
      .join('') + this.config.sharedSecret;

    // Generate MD5 hash
    return this.md5(signatureString);
  }

  /**
   * Creates authenticated HTTP parameters with signature
   */
  createAuthenticatedParams(baseParams: Map<string, string>): HttpParams {
    const currentSession = this._sessionKey();
    if (!currentSession) {
      throw new Error('Not authenticated - session key required');
    }

    const params = new Map(baseParams);
    params.set('api_key', this.config.apiKey);
    params.set('sk', currentSession);
    
    const apiSig = this.generateApiSignature(params);
    params.set('api_sig', apiSig);
    params.set('format', 'json');

    return new HttpParams({ fromObject: Object.fromEntries(params) });
  }

  /**
   * Sets authentication data and stores it
   */
  private setAuthData(session: LastFmSession): void {
    this._sessionKey.set(session.key);
    this._isAuthenticated.set(true);
    
    const userData: LastFmUser = {
      name: session.name,
      subscriber: session.subscriber
    };
    this._currentUser.set(userData);

    // Store in localStorage
    localStorage.setItem(this.SESSION_STORAGE_KEY, session.key);
    localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(userData));
  }

  /**
   * Loads stored authentication data on service initialization
   */
  private loadStoredAuth(): void {
    const storedSession = localStorage.getItem(this.SESSION_STORAGE_KEY);
    const storedUser = localStorage.getItem(this.USER_STORAGE_KEY);

    if (storedSession && storedUser) {
      try {
        const userData = JSON.parse(storedUser) as LastFmUser;
        this._sessionKey.set(storedSession);
        this._currentUser.set(userData);
        this._isAuthenticated.set(true);
      } catch (error) {
        console.warn('Failed to parse stored user data, clearing auth');
        this.signOut();
      }
    }
  }

  /**
   * Handles HTTP and API errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Network error: ${error.error.message}`;
    } else {
      if (error.status === 0) {
        errorMessage = 'Network error: Unable to connect to Last.fm API';
      } else if (error.error && typeof error.error === 'object' && 'error' in error.error) {
        const lastfmError = error.error as LastFmError;
        errorMessage = `Last.fm API error ${lastfmError.error}: ${lastfmError.message}`;
        
        // Handle specific auth errors
        if (lastfmError.error === 9) { // Invalid session key
          this.signOut();
          errorMessage = 'Session expired. Please sign in again.';
        }
      } else {
        errorMessage = `HTTP error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * MD5 hash implementation for API signatures
   */
  private md5(input: string): string {
    // Simple MD5 implementation - based on RFC 1321
    function add32(a: number, b: number) {
      return (a + b) & 0xFFFFFFFF;
    }

    function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
      a = add32(add32(a, q), add32(x, t));
      return add32((a << s) | (a >>> (32 - s)), b);
    }

    function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function md5cycle(x: number[], k: number[]) {
      let a = x[0], b = x[1], c = x[2], d = x[3];

      a = ff(a, b, c, d, k[0], 7, -680876936);
      d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819);
      b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897);
      d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341);
      b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416);
      d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063);
      b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682);
      d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290);
      b = ff(b, c, d, a, k[15], 22, 1236535329);

      a = gg(a, b, c, d, k[1], 5, -165796510);
      d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713);
      b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691);
      d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335);
      b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438);
      d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961);
      b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467);
      d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473);
      b = gg(b, c, d, a, k[12], 20, -1926607734);

      a = hh(a, b, c, d, k[5], 4, -378558);
      d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562);
      b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060);
      d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632);
      b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174);
      d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979);
      b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487);
      d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520);
      b = hh(b, c, d, a, k[2], 23, -995338651);

      a = ii(a, b, c, d, k[0], 6, -198630844);
      d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905);
      b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571);
      d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523);
      b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359);
      d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380);
      b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070);
      d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259);
      b = ii(b, c, d, a, k[9], 21, -343485551);

      x[0] = add32(a, x[0]);
      x[1] = add32(b, x[1]);
      x[2] = add32(c, x[2]);
      x[3] = add32(d, x[3]);
    }

    function md51(s: string) {
      const n = s.length;
      const state = [1732584193, -271733879, -1732584194, 271733878];
      let i;
      for (i = 64; i <= s.length; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
      }
      s = s.substring(i - 64);
      const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (i = 0; i < s.length; i++) {
        tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      }
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) {
        md5cycle(state, tail);
        for (i = 0; i < 16; i++) tail[i] = 0;
      }
      tail[14] = n * 8;
      md5cycle(state, tail);
      return state;
    }

    function md5blk(s: string) {
      const md5blks = [];
      for (let i = 0; i < 64; i += 4) {
        md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
      }
      return md5blks;
    }

    function rhex(n: number) {
      let s = '';
      for (let j = 0; j < 4; j++) {
        s += (((n >> (j * 8 + 4)) & 15).toString(16)) + (((n >> (j * 8)) & 15).toString(16));
      }
      return s;
    }

    function hex(x: number[]) {
      const hexArray: string[] = [];
      for (let i = 0; i < x.length; i++) {
        hexArray[i] = rhex(x[i]);
      }
      return hexArray.join('');
    }

    return hex(md51(input));
  }
}