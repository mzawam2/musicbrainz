import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { LastfmAuthService } from '../../services/lastfm-auth.service';

@Component({
  selector: 'app-lastfm-callback',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lastfm-callback">
      <div class="callback-container">
        @if (isProcessing()) {
          <div class="processing-state">
            <div class="spinner"></div>
            <h2>Connecting to Last.fm...</h2>
            <p>Please wait while we complete the authentication process.</p>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <div class="error-icon">⚠️</div>
            <h2>Authentication Failed</h2>
            <p>{{ error() }}</p>
            <button (click)="goHome()" class="retry-btn">
              Return to App
            </button>
          </div>
        } @else {
          <div class="success-state">
            <div class="success-icon">✅</div>
            <h2>Successfully Connected!</h2>
            <p>Your Last.fm account has been connected. You can now access personalized music discovery features.</p>
            <button (click)="goHome()" class="continue-btn">
              Continue to App
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .lastfm-callback {
      min-height: 100vh;
      background: linear-gradient(135deg, #d51007 0%, #ff5722 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .callback-container {
      background: white;
      border-radius: 12px;
      padding: 3rem;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
    }

    .processing-state,
    .error-state,
    .success-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #d51007;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-icon,
    .success-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }

    h2 {
      margin: 0;
      color: #333;
      font-size: 1.5rem;
    }

    p {
      margin: 0;
      color: #666;
      line-height: 1.5;
    }

    .retry-btn,
    .continue-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 1rem;
    }

    .retry-btn {
      background: #dc3545;
      color: white;
    }

    .retry-btn:hover {
      background: #c82333;
    }

    .continue-btn {
      background: #d51007;
      color: white;
    }

    .continue-btn:hover {
      background: #b71c1c;
    }

    @media (max-width: 768px) {
      .callback-container {
        padding: 2rem;
        margin: 1rem;
      }

      h2 {
        font-size: 1.3rem;
      }
    }
  `]
})
export class LastfmCallbackComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lastfmAuthService = inject(LastfmAuthService);

  // Signals
  isProcessing = signal(true);
  error = signal<string | null>(null);

  constructor() {
    this.handleCallback();
  }

  /**
   * Handle the OAuth callback
   */
  private handleCallback(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const error = params['error'];

      if (error) {
        this.handleAuthError(error);
        return;
      }

      if (!token) {
        this.handleAuthError('No authentication token received');
        return;
      }

      // Process the authentication token
      this.lastfmAuthService.handleAuthCallback(token).subscribe({
        next: (success) => {
          this.isProcessing.set(false);
          if (success) {
            // Wait a moment to show success message before redirecting
            setTimeout(() => {
              this.goHome();
            }, 2000);
          } else {
            this.error.set('Failed to authenticate with Last.fm');
          }
        },
        error: (err) => {
          console.error('Auth callback error:', err);
          this.isProcessing.set(false);
          this.error.set('Authentication failed. Please try again.');
        }
      });
    });
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(errorMessage: string): void {
    this.isProcessing.set(false);
    
    const errorMessages: { [key: string]: string } = {
      'access_denied': 'You cancelled the Last.fm authorization.',
      'invalid_request': 'Invalid request. Please try again.',
      'unauthorized_client': 'App not authorized by Last.fm.',
      'unsupported_response_type': 'Configuration error. Please contact support.',
      'invalid_scope': 'Invalid permissions requested.',
      'server_error': 'Last.fm server error. Please try again later.',
      'temporarily_unavailable': 'Last.fm is temporarily unavailable. Please try again later.'
    };

    this.error.set(errorMessages[errorMessage] || `Authentication error: ${errorMessage}`);
  }

  /**
   * Navigate back to the main app
   */
  goHome(): void {
    this.router.navigate(['/']);
  }
}