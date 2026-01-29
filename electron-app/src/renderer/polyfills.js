/**
 * Polyfills for Node.js globals in browser environment
 */

// Define global if it doesn't exist
if (typeof global === 'undefined') {
  window.global = window;
}

// Note: process is handled by webpack's ProvidePlugin
console.log('✓ Polyfills loaded - global defined');
