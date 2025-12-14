/**
 * Secure Logger - Safe logging utility that prevents information leakage
 * @module utils/secureLogger
 * 
 * Provides secure logging that:
 * - Only logs in development mode
 * - Never logs sensitive data (passwords, keys, tokens)
 * - Sanitizes error messages
 * - Prevents stack trace leakage in production
 */

/**
 * Sensitive patterns that should never be logged
 */
const SENSITIVE_PATTERNS = [
    /password/gi,
    /key/gi,
    /token/gi,
    /secret/gi,
    /credential/gi,
    /auth/gi,
    /derived.*key/gi,
    /hmac/gi,
    /ciphertext/gi,
    /iv/gi,
];

/**
 * Check if a string contains sensitive information
 */
function containsSensitiveData(message: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Sanitize error message to remove sensitive data
 */
function sanitizeMessage(message: string): string {
    if (containsSensitiveData(message)) {
        return '[Sensitive data redacted]';
    }
    return message;
}

/**
 * Sanitize error object
 */
function sanitizeError(error: unknown): string {
    if (error instanceof Error) {
        const message = sanitizeMessage(error.message);
        // Don't include stack traces in production
        if (__DEV__) {
            return `${message}\n${error.stack}`;
        }
        return message;
    }
    return String(error);
}

/**
 * Secure logger that only logs in development and sanitizes sensitive data
 */
export const secureLogger = {
    /**
     * Log info message (dev only)
     */
    info: (message: string, ...args: unknown[]): void => {
        if (!__DEV__) return;
        
        const sanitized = sanitizeMessage(message);
        const sanitizedArgs = args.map(arg => {
            if (typeof arg === 'string') {
                return sanitizeMessage(arg);
            }
            if (arg instanceof Error) {
                return sanitizeError(arg);
            }
            return arg;
        });
        
        console.log(`[INFO] ${sanitized}`, ...sanitizedArgs);
    },

    /**
     * Log error (dev only, sanitized)
     */
    error: (message: string, error?: unknown): void => {
        if (!__DEV__) return;
        
        const sanitized = sanitizeMessage(message);
        if (error) {
            const sanitizedError = sanitizeError(error);
            console.error(`[ERROR] ${sanitized}`, sanitizedError);
        } else {
            console.error(`[ERROR] ${sanitized}`);
        }
    },

    /**
     * Log warning (dev only)
     */
    warn: (message: string, ...args: unknown[]): void => {
        if (!__DEV__) return;
        
        const sanitized = sanitizeMessage(message);
        console.warn(`[WARN] ${sanitized}`, ...args);
    },

    /**
     * Log debug message (dev only)
     */
    debug: (message: string, ...args: unknown[]): void => {
        if (!__DEV__) return;
        
        const sanitized = sanitizeMessage(message);
        console.log(`[DEBUG] ${sanitized}`, ...args);
    },
};

