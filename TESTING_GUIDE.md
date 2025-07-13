# Testing Guide: Artist Discography Explorer

## How to Test the "Show Details" Feature

### Prerequisites
1. Start the development server: `npm start`
2. Open browser to `http://localhost:4200`
3. Open browser dev tools (F12) to see console logs

### Testing Steps

1. **Search for an Artist**
   - Type an artist name in the search box (e.g., "Radiohead", "The Beatles", "Coldplay")
   - Select an artist from the dropdown

2. **Wait for Discography to Load**
   - The discography section should appear below the labels
   - You should see release cards with cover art (if available)

3. **Test Show Details Button**
   - Look for the "Show Details" button at the bottom of each release card
   - Click the "Show Details" button
   - Check the browser console for debug logs

### What Should Happen

#### Expected Console Logs:
```
Raw API response for release groups: {...}
Processed release groups: [...]
Release group [Album Name] has X releases: [...]
Loading detailed releases for: [release-id-1, release-id-2, ...]
Received detailed releases: [...]
```

#### Expected UI Behavior:
1. Button should change from "Show Details ▼" to "Hide Details ▲"
2. Loading spinner should appear briefly
3. Expanded section should show:
   - Release information (title, date, country, label)
   - Track listings with numbers, titles, and durations
   - Multiple releases if available

### Debugging Issues

#### If "Show Details" doesn't work:

1. **Check Console for Errors**
   - Look for API errors or network issues
   - Check if release groups have releases property

2. **Check Network Tab**
   - Verify API calls are being made to MusicBrainz
   - Check if proxy is working correctly

3. **Common Issues & Solutions**

   **Issue**: No releases in release groups
   ```
   Release group [Album Name] has 0 releases: undefined
   ```
   **Solution**: The MusicBrainz API might not be including releases. Check the API call includes `inc=releases`.

   **Issue**: CORS errors
   ```
   Access to fetch at 'https://musicbrainz.org/...' has been blocked by CORS policy
   ```
   **Solution**: Ensure the proxy configuration is working and restart the dev server.

   **Issue**: Network errors
   ```
   Failed to load release details: HttpErrorResponse {...}
   ```
   **Solution**: Check internet connection and MusicBrainz API availability.

### Testing Different Artists

Try these artists for better testing results:

1. **Radiohead** - Well-documented discography with detailed releases
2. **The Beatles** - Extensive catalog with many releases per album
3. **Coldplay** - Modern artist with good API coverage
4. **Nirvana** - Smaller discography, good for quick testing

### Expected API Endpoints

When testing, you should see these API calls in the Network tab:

1. **Release Groups**: `/api/release-group?artist={id}&inc=releases&limit=100&fmt=json`
2. **Release Details**: `/api/release/{id}?inc=recordings+media+artist-credits&fmt=json`
3. **Cover Art**: `https://coverartarchive.org/release/{id}` (external API)

### Troubleshooting Proxy Issues

If API calls are failing:

1. **Restart Development Server**
   ```bash
   npm start
   ```

2. **Check Proxy Configuration** (`proxy.conf.json`)
   - Verify target URL is correct
   - Ensure headers are set properly

3. **Test Direct API Access**
   - Try accessing `http://localhost:4200/api/artist?query=radiohead&limit=1&fmt=json` directly
   - Should return MusicBrainz data

### Known Limitations

1. **Rate Limiting**: MusicBrainz allows 1 request per second
2. **API Coverage**: Not all releases have detailed track information
3. **Cover Art**: Not all releases have cover art available
4. **CORS**: Direct access to MusicBrainz API requires proxy

---

**Note**: If you're still having issues, check the browser console logs and share them for further debugging assistance.