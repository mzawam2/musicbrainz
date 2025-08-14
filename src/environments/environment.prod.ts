export const environment = {
  production: true,
  musicBrainzApiUrl: 'https://musicbrainz.org/ws/2',
  spotify: {
    clientId: 'YOUR_SPOTIFY_CLIENT_ID', // Replace with your Spotify app client ID
    clientSecret: 'YOUR_SPOTIFY_CLIENT_SECRET', // Replace with your Spotify app client secret
    redirectUri: `${window.location.origin}/spotify-callback`
  }
};