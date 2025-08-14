# Spotify Integration Guide

This document explains how to set up and use the Spotify playlist creation feature in the MusicBrainz application.

## ✅ **IMPLEMENTATION COMPLETE**

The Spotify integration has been successfully implemented and is now available in the **Label Family Trees** component!

## Overview

The Spotify integration allows users to create Spotify playlists directly from record label releases. Users can select how many songs to include from each release, and the application will automatically search for and add matching tracks to a new playlist.

## Features

- **Spotify OAuth Authentication**: Secure login using Spotify's OAuth 2.0 flow
- **Label-Based Playlists**: Create playlists from all releases of a specific record label
- **Track Selection Control**: Choose how many songs to include from each release (1-10 tracks per release)
- **Automatic Track Matching**: Smart search to find tracks on Spotify that match MusicBrainz release data
- **Real-time Progress**: Loading states and progress feedback during playlist creation
- **Direct Spotify Integration**: Open created playlists directly in Spotify

## Setup Instructions

### 1. Create a Spotify App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app details:
   - **App Name**: MusicBrainz Playlist Creator (or your preferred name)
   - **App Description**: Create Spotify playlists from MusicBrainz label data
   - **Website**: Your application URL
   - **Redirect URI**: `http://localhost:4200/spotify-callback` (for development)

### 2. Configure Environment Variables

Update the environment files with your Spotify app credentials:

**src/environments/environment.ts** (Development):
```typescript
export const environment = {
  production: false,
  musicBrainzApiUrl: 'https://musicbrainz.org/ws/2',
  spotify: {
    clientId: 'YOUR_SPOTIFY_CLIENT_ID', // Replace with your actual client ID
    clientSecret: 'YOUR_SPOTIFY_CLIENT_SECRET', // Replace with your actual client secret
    redirectUri: `${window.location.origin}/spotify-callback`
  }
};
```

**src/environments/environment.prod.ts** (Production):
```typescript
export const environment = {
  production: true,
  musicBrainzApiUrl: 'https://musicbrainz.org/ws/2',
  spotify: {
    clientId: 'YOUR_SPOTIFY_CLIENT_ID', // Replace with your actual client ID
    clientSecret: 'YOUR_SPOTIFY_CLIENT_SECRET', // Replace with your actual client secret
    redirectUri: `${window.location.origin}/spotify-callback`
  }
};
```

### 3. Update Spotify App Settings

In your Spotify app settings, add the redirect URIs:
- Development: `http://localhost:4200/spotify-callback`
- Production: `https://yourdomain.com/spotify-callback`

## How to Use

### 1. Navigate to Label Family Trees

1. Go to the "Label Family Trees" section of the application
2. Search for and select a record label

### 2. Create a Spotify Playlist

1. Once a label family tree is loaded, you'll see a green "Create Playlist" button (♪ icon) in the header
2. If not authenticated, clicking will redirect you to Spotify OAuth
3. Click "Connect Spotify" and authorize the application
4. After authentication, return to the Label Family Trees page

### 3. Automatic Playlist Creation

1. **Smart Selection**: The system automatically selects up to 10 artists from the label
2. **Release Filtering**: Chooses Albums and EPs (up to 3 releases per artist)
3. **Track Limiting**: Includes 5 songs per release by default
4. **Playlist Naming**: Names the playlist "{Label Name} - Label Playlist"

### 4. Playlist Creation Process

1. Click "Create Playlist" to start the process
2. The application searches Spotify for tracks matching MusicBrainz releases
3. Progress is shown with a loading spinner
4. Success notification appears with a direct link to open in Spotify

## Technical Architecture

### Components

- **SpotifyService**: Handles OAuth authentication and API calls
- **SpotifyPlaylistCreatorComponent**: Main playlist creation interface
- **SpotifyCallbackComponent**: Handles OAuth callback and token exchange
- **LabelCardComponent**: Enhanced with Spotify playlist creation button

### API Integration

- **Authentication**: Uses Spotify's Authorization Code Flow
- **Playlist Creation**: Creates playlists via Spotify Web API
- **Track Search**: Searches Spotify's catalog using artist and album names from MusicBrainz
- **Rate Limiting**: Implements delays between API calls to respect Spotify's rate limits

### Data Flow

1. User selects a label and clicks "Create Playlist"
2. If not authenticated, redirect to Spotify OAuth
3. Load label's artists and their releases from MusicBrainz
4. Present release selection interface
5. Search Spotify for matching tracks
6. Create playlist and add found tracks
7. Display success and link to playlist

## Troubleshooting

### Common Issues

1. **"Authentication Failed"**
   - Check that your Spotify app credentials are correct
   - Verify the redirect URI matches your app settings
   - Ensure your Spotify app is not in development mode restrictions

2. **"No tracks found"**
   - Some releases may not be available on Spotify
   - Track matching is based on artist and album names, which may not always match exactly
   - Try adjusting the number of tracks requested per release

3. **"Rate limit exceeded"**
   - The application includes built-in rate limiting, but high-volume usage may still hit limits
   - Wait a few minutes before creating another playlist

### Environment Issues

- Ensure environment variables are properly set
- Check that the redirect URI in your environment matches your Spotify app settings
- Verify that the client secret is not exposed in client-side code (use secure server-side configuration for production)

## Security Considerations

- **Client Secret**: In production, the client secret should be handled server-side, not in the client application
- **Token Storage**: Access tokens are stored in localStorage and should be secured
- **HTTPS**: Always use HTTPS in production for OAuth flows
- **Scopes**: The application only requests necessary permissions (playlist modification)

## Future Enhancements

- **Track Preview**: Add ability to preview tracks before adding to playlist
- **Playlist Templates**: Save common track selection patterns
- **Collaborative Playlists**: Option to create collaborative playlists
- **Artist-Specific Playlists**: Create playlists from individual artists instead of entire labels
- **Playlist Management**: Edit or update existing playlists

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Spotify app configuration
3. Ensure all environment variables are correctly set
4. Test with a simple label that has well-known releases on Spotify