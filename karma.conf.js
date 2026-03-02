// Karma configuration file
module.exports = function (config) {
  config.set({
    // Base configuration (inherited from angular.json)
    basePath: '',
    frameworks: ['jasmine'],
    
    // Browser configuration
    browsers: process.env.CI ? ['ChromeHeadlessCI'] : ['Chrome'],
    
    // Custom browser launchers
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'Chrome',
        flags: [
          '--no-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--headless',
          '--disable-gpu',
          '--remote-debugging-port=9222'
        ]
      },
      ChromeHeadlessLocal: {
        base: 'Chrome',
        flags: [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--remote-debugging-port=9222'
        ]
      }
    },
    
    // Single run in CI environment
    singleRun: !!process.env.CI,
    
    // Watch files in development
    autoWatch: !process.env.CI,
    
    // Concurrency level
    concurrency: Infinity,
    
    // Log level
    logLevel: config.LOG_INFO,
    
    // Test results reporter
    reporters: ['progress'],
    
    // Timeouts
    browserNoActivityTimeout: 60000,
    captureTimeout: 60000
  });
};