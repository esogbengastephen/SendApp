/**
 * Workaround for Turbopack module resolution issue with @scure/bip39/wordlists/english
 * This file re-exports the wordlist to help with module resolution
 */

// Re-export the english wordlist to help with module resolution
export { wordlist } from '@scure/bip39/wordlists/english.js';
