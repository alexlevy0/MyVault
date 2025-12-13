/**
 * Security Types - Type definitions for the security layer
 * @module security/security.types
 */

/**
 * Derived key information stored in SecureStore
 * Contains the salt and hash for PBKDF2 verification
 */
export interface DerivedKeyInfo {
  /** Base64 encoded salt (16 bytes) */
  salt: string;
  /** Base64 encoded derived key hash for verification */
  hash: string;
  /** Number of PBKDF2 iterations used */
  iterations: number;
  /** Timestamp when the password was set */
  createdAt: number;
}

/**
 * Security context state
 */
export interface SecurityState {
  /** Whether security context is fully initialized */
  isInitialized: boolean;
  /** Whether user is currently authenticated */
  isLoggedIn: boolean;
  /** Whether an account (password) has been set up */
  hasAccount: boolean;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Security context actions
 */
export interface SecurityActions {
  /** Set up initial password - creates derived key and stores hash */
  setupAction: (password: string) => Promise<boolean>;
  /** Login with password - verifies against stored hash */
  loginAction: (password: string) => Promise<boolean>;
  /** Logout - clears session but keeps account */
  logoutAction: () => void;
  /** Reset app - clears all data including account */
  resetAppAction: () => Promise<void>;
  /** Lock the app (same as logout but for auto-lock) */
  lockAction: () => void;
}

/**
 * Combined security context value
 */
export interface SecurityContextValue extends SecurityState, SecurityActions {}

/**
 * PBKDF2 configuration
 */
export interface PBKDF2Config {
  /** Number of iterations (minimum 150,000 recommended) */
  iterations: number;
  /** Salt length in bytes */
  saltLength: number;
  /** Derived key length in bytes */
  keyLength: number;
  /** Hash algorithm */
  algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512';
}

/**
 * Default PBKDF2 configuration
 * Following OWASP recommendations for password hashing
 */
export const DEFAULT_PBKDF2_CONFIG: PBKDF2Config = {
  iterations: 150000,
  saltLength: 16,
  keyLength: 32,
  algorithm: 'SHA-256',
};
