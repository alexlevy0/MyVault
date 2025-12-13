/**
 * Brute-Force Protection - Rate limiting for login attempts
 * @module security/bruteForce
 * 
 * Provides protection against brute-force attacks:
 * - Tracks failed login attempts with persistence
 * - Implements exponential backoff
 * - Temporary lockout after too many failures
 */

import { getSecureObject, removeSecureItem, setSecureObject } from '../storage/secureStore';

// Storage key for attempt tracking
const ATTEMPTS_STORAGE_KEY = 'vault_login_attempts';

// Configuration
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const ATTEMPT_RESET_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const BACKOFF_BASE_MS = 1000; // 1 second base backoff

/**
 * Login attempt tracking data
 */
interface AttemptData {
    /** Number of consecutive failed attempts */
    count: number;
    /** Timestamp of first failed attempt in current window */
    firstAttemptAt: number;
    /** Timestamp of last failed attempt */
    lastAttemptAt: number;
    /** Timestamp when lockout expires (if locked) */
    lockedUntil: number | null;
}

/**
 * Brute-force check result
 */
export interface BruteForceCheckResult {
    /** Whether login attempt is allowed */
    allowed: boolean;
    /** Remaining attempts before lockout */
    remainingAttempts: number;
    /** Seconds until lockout expires (if locked) */
    lockoutSecondsRemaining: number | null;
    /** Required delay before next attempt (exponential backoff) */
    requiredDelayMs: number;
}

/**
 * Get current attempt data from storage
 */
async function getAttemptData(): Promise<AttemptData | null> {
    return getSecureObject<AttemptData>(ATTEMPTS_STORAGE_KEY);
}

/**
 * Save attempt data to storage
 */
async function saveAttemptData(data: AttemptData): Promise<void> {
    await setSecureObject(ATTEMPTS_STORAGE_KEY, data);
}

/**
 * Clear all attempt data (call on successful login)
 */
export async function clearAttempts(): Promise<void> {
    await removeSecureItem(ATTEMPTS_STORAGE_KEY);
}

/**
 * Calculate exponential backoff delay
 * @param attemptCount - Number of failed attempts
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attemptCount: number): number {
    if (attemptCount <= 1) return 0;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
    const delay = BACKOFF_BASE_MS * Math.pow(2, attemptCount - 2);
    return Math.min(delay, 30000);
}

/**
 * Check if a login attempt is allowed
 * Call this BEFORE attempting login
 * 
 * @returns Check result with allowed status and timing info
 */
export async function checkBruteForce(): Promise<BruteForceCheckResult> {
    const now = Date.now();
    const data = await getAttemptData();

    // No previous attempts
    if (!data) {
        return {
            allowed: true,
            remainingAttempts: MAX_ATTEMPTS_BEFORE_LOCKOUT,
            lockoutSecondsRemaining: null,
            requiredDelayMs: 0,
        };
    }

    // Check if attempt window has expired (reset attempts)
    if (now - data.firstAttemptAt > ATTEMPT_RESET_WINDOW_MS) {
        await clearAttempts();
        return {
            allowed: true,
            remainingAttempts: MAX_ATTEMPTS_BEFORE_LOCKOUT,
            lockoutSecondsRemaining: null,
            requiredDelayMs: 0,
        };
    }

    // Check if currently locked out
    if (data.lockedUntil && now < data.lockedUntil) {
        const lockoutSecondsRemaining = Math.ceil((data.lockedUntil - now) / 1000);
        return {
            allowed: false,
            remainingAttempts: 0,
            lockoutSecondsRemaining,
            requiredDelayMs: data.lockedUntil - now,
        };
    }

    // Lockout expired, reset lockout but keep attempt count
    if (data.lockedUntil && now >= data.lockedUntil) {
        const updatedData: AttemptData = {
            ...data,
            lockedUntil: null,
        };
        await saveAttemptData(updatedData);
    }

    // Calculate backoff delay
    const requiredDelayMs = calculateBackoffDelay(data.count);
    const timeSinceLastAttempt = now - data.lastAttemptAt;
    const remainingDelay = Math.max(0, requiredDelayMs - timeSinceLastAttempt);

    if (remainingDelay > 0) {
        return {
            allowed: false,
            remainingAttempts: Math.max(0, MAX_ATTEMPTS_BEFORE_LOCKOUT - data.count),
            lockoutSecondsRemaining: null,
            requiredDelayMs: remainingDelay,
        };
    }

    return {
        allowed: true,
        remainingAttempts: Math.max(0, MAX_ATTEMPTS_BEFORE_LOCKOUT - data.count),
        lockoutSecondsRemaining: null,
        requiredDelayMs: 0,
    };
}

/**
 * Record a failed login attempt
 * Call this AFTER a failed login
 * 
 * @returns Updated attempt count and lockout status
 */
export async function recordFailedAttempt(): Promise<{
    attemptCount: number;
    isLockedOut: boolean;
    lockoutSecondsRemaining: number | null;
}> {
    const now = Date.now();
    const existingData = await getAttemptData();

    let newData: AttemptData;

    if (!existingData || now - existingData.firstAttemptAt > ATTEMPT_RESET_WINDOW_MS) {
        // First attempt or window expired
        newData = {
            count: 1,
            firstAttemptAt: now,
            lastAttemptAt: now,
            lockedUntil: null,
        };
    } else {
        // Increment existing attempts
        const newCount = existingData.count + 1;
        const isLockedOut = newCount >= MAX_ATTEMPTS_BEFORE_LOCKOUT;

        newData = {
            count: newCount,
            firstAttemptAt: existingData.firstAttemptAt,
            lastAttemptAt: now,
            lockedUntil: isLockedOut ? now + LOCKOUT_DURATION_MS : null,
        };
    }

    await saveAttemptData(newData);

    const isLockedOut = newData.lockedUntil !== null;
    const lockoutSecondsRemaining = isLockedOut
        ? Math.ceil(LOCKOUT_DURATION_MS / 1000)
        : null;

    return {
        attemptCount: newData.count,
        isLockedOut,
        lockoutSecondsRemaining,
    };
}

/**
 * Get current attempt status without modifying anything
 */
export async function getAttemptStatus(): Promise<{
    attemptCount: number;
    remainingAttempts: number;
    isLockedOut: boolean;
    lockoutSecondsRemaining: number | null;
}> {
    const now = Date.now();
    const data = await getAttemptData();

    if (!data) {
        return {
            attemptCount: 0,
            remainingAttempts: MAX_ATTEMPTS_BEFORE_LOCKOUT,
            isLockedOut: false,
            lockoutSecondsRemaining: null,
        };
    }

    // Check if window expired
    if (now - data.firstAttemptAt > ATTEMPT_RESET_WINDOW_MS) {
        return {
            attemptCount: 0,
            remainingAttempts: MAX_ATTEMPTS_BEFORE_LOCKOUT,
            isLockedOut: false,
            lockoutSecondsRemaining: null,
        };
    }

    const isLockedOut = data.lockedUntil !== null && now < data.lockedUntil;
    const lockoutSecondsRemaining = isLockedOut
        ? Math.ceil((data.lockedUntil! - now) / 1000)
        : null;

    return {
        attemptCount: data.count,
        remainingAttempts: Math.max(0, MAX_ATTEMPTS_BEFORE_LOCKOUT - data.count),
        isLockedOut,
        lockoutSecondsRemaining,
    };
}
