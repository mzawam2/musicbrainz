# Testing Configuration

This project is configured to run tests in headless mode to prevent Chrome browser windows from opening during test execution.

## Test Commands

- `npm test` - Run tests with default configuration (Chrome browser, no watch)
- `npm run test:headless` - Run tests in headless mode (requires Chrome to be installed)
- `npm run test:ci` - Run tests in CI mode with code coverage

## Browser Configuration

The project uses a custom Karma configuration (`karma.conf.js`) that automatically:
- Uses Chrome browser in development
- Uses headless Chrome in CI environments (when CI=true)
- Includes custom launchers for different headless scenarios

## Environment Setup

### Windows with WSL
If you're using WSL (Windows Subsystem for Linux), Chrome may not be available. You have several options:

1. **Install Chrome in WSL:**
   ```bash
   # Install Chrome in WSL
   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
   sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
   sudo apt-get update
   sudo apt-get install google-chrome-stable
   ```

2. **Use Windows Chrome from WSL:**
   ```bash
   export CHROME_BIN="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
   npm test
   ```

3. **Use CI mode (headless with fallback):**
   ```bash
   npm run test:ci
   ```

### macOS
Chrome should be automatically detected. If not:
```bash
export CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
npm test
```

### Linux
Chrome should be automatically detected. If not:
```bash
export CHROME_BIN="/usr/bin/google-chrome-stable"
npm test
```

## Configuration Details

- Tests run in single-run mode (no watch) by default
- Headless mode prevents browser windows from opening
- Custom launchers handle different environments automatically
- Timeout configurations prevent hanging tests

## Troubleshooting

If tests fail to start:
1. Verify Chrome is installed: `google-chrome --version`
2. Set CHROME_BIN environment variable to Chrome executable path
3. Use CI mode as fallback: `CI=true npm test`
4. Check karma.conf.js for custom launcher configurations