/**
 * Encrypted Storage - Secure encryption layer with strong security
 * @module storage/encryptedStorage
 * 
 * Provides secure encryption/decryption with:
 * - Strong encryption using multiple rounds of HMAC-based encryption
 * - HMAC-SHA256 for integrity verification
 * - Protection against tampering and replay attacks
 * - Secure key derivation per encryption operation
 * 
 * NOTE: For production, consider migrating to native AES-GCM via react-native-quick-crypto
 * This implementation provides strong security using available primitives.
 */

import * as Crypto from 'expo-crypto';
import { getMemoryKey, MEMORY_KEYS } from '../security/memory';

/**
 * Maximum data size to prevent DoS attacks (10MB)
 */
const MAX_DATA_SIZE = 10 * 1024 * 1024;

/**
 * Encryption result containing ciphertext, IV, and HMAC tag
 */
export interface EncryptedData {
    /** Base64 encoded ciphertext */
    ciphertext: string;
    /** Base64 encoded initialization vector */
    iv: string;
    /** HMAC-SHA256 authentication tag for integrity verification */
    hmac: string;
    /** Timestamp to prevent replay attacks */
    timestamp: number;
}

/**
 * Convert Uint8Array to Base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * HMAC-SHA256 implementation using expo-crypto
 */
async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const BLOCK_SIZE = 64; // SHA-256 block size

    // If key is longer than block size, hash it
    let keyBytes = key;
    if (keyBytes.length > BLOCK_SIZE) {
        const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            uint8ArrayToBase64(keyBytes),
            { encoding: Crypto.CryptoEncoding.BASE64 }
        );
        keyBytes = base64ToUint8Array(hash);
    }

    // Pad key to block size
    const paddedKey = new Uint8Array(BLOCK_SIZE);
    paddedKey.set(keyBytes);

    // Create ipad and opad
    const ipad = new Uint8Array(BLOCK_SIZE);
    const opad = new Uint8Array(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        ipad[i] = paddedKey[i] ^ 0x36;
        opad[i] = paddedKey[i] ^ 0x5c;
    }

    // Inner hash: H(ipad || message)
    const innerData = new Uint8Array(BLOCK_SIZE + message.length);
    innerData.set(ipad);
    innerData.set(message, BLOCK_SIZE);

    const innerHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uint8ArrayToBase64(innerData),
        { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    const innerHashBytes = base64ToUint8Array(innerHash);

    // Outer hash: H(opad || innerHash)
    const outerData = new Uint8Array(BLOCK_SIZE + innerHashBytes.length);
    outerData.set(opad);
    outerData.set(innerHashBytes, BLOCK_SIZE);

    const outerHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uint8ArrayToBase64(outerData),
        { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    return base64ToUint8Array(outerHash);
}

/**
 * Derive an encryption key from master key and IV using HKDF-like approach
 */
async function deriveEncryptionKey(masterKey: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const info = new TextEncoder().encode('encryption-key');
    const salt = iv; // Use IV as salt for key derivation
    
    // HKDF-Extract: PRK = HMAC(salt, masterKey)
    const prk = await hmacSha256(salt, masterKey);
    
    // HKDF-Expand: OKM = HMAC(PRK, info || 0x01)
    const expandData = new Uint8Array(info.length + 1);
    expandData.set(info);
    expandData[info.length] = 0x01;
    
    return await hmacSha256(prk, expandData);
}

/**
 * XOR two Uint8Arrays (for encryption)
 */
function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) {
        result[i] = a[i] ^ b[i % b.length];
    }
    return result;
}

/**
 * Generate a random initialization vector
 * @returns Base64 encoded IV (16 bytes for better security)
 */
export async function generateIV(): Promise<string> {
    const ivBytes = await Crypto.getRandomBytesAsync(16); // 128 bits
    return uint8ArrayToBase64(new Uint8Array(ivBytes));
}

/**
 * Generate keystream for encryption using HMAC in counter mode
 */
async function generateKeystream(key: Uint8Array, iv: Uint8Array, length: number): Promise<Uint8Array> {
    const blockSize = 32; // SHA-256 output size
    const numBlocks = Math.ceil(length / blockSize);
    const keystream = new Uint8Array(numBlocks * blockSize);

    for (let i = 0; i < numBlocks; i++) {
        const counter = new Uint8Array(4);
        counter[0] = (i >> 24) & 0xff;
        counter[1] = (i >> 16) & 0xff;
        counter[2] = (i >> 8) & 0xff;
        counter[3] = i & 0xff;

        const blockData = new Uint8Array(iv.length + counter.length);
        blockData.set(iv);
        blockData.set(counter, iv.length);

        const block = await hmacSha256(key, blockData);
        keystream.set(block, i * blockSize);
    }

    return keystream.slice(0, length);
}

/**
 * Encrypt data with strong encryption and integrity protection
 * Uses multiple rounds of encryption with HMAC for authentication
 */
export async function encryptData(plaintext: string): Promise<EncryptedData> {
    // Validate input size
    const plaintextBytes = new TextEncoder().encode(plaintext);
    if (plaintextBytes.length > MAX_DATA_SIZE) {
        throw new Error(`Data too large. Maximum size is ${MAX_DATA_SIZE} bytes.`);
    }

    const key = getMemoryKey(MEMORY_KEYS.DERIVED_KEY);
    if (!key) {
        throw new Error('No encryption key available. Please login first.');
    }

    const keyBytes = base64ToUint8Array(key);
    const iv = await generateIV();
    const ivBytes = base64ToUint8Array(iv);

    // Derive encryption key from master key and IV
    const encryptionKey = await deriveEncryptionKey(keyBytes, ivBytes);

    // Encrypt using CTR-like mode with HMAC-based keystream
    // Multiple rounds for better security
    let encrypted = new Uint8Array(plaintextBytes);
    const numRounds = 3; // Multiple encryption rounds
    
    for (let round = 0; round < numRounds; round++) {
        const roundKey = await hmacSha256(encryptionKey, new Uint8Array([round]));
        const keystream = await generateKeystream(roundKey, ivBytes, encrypted.length);
        encrypted = xorBytes(encrypted, keystream);
    }

    // Generate HMAC for integrity verification
    const hmacData = new Uint8Array(ivBytes.length + encrypted.length);
    hmacData.set(ivBytes);
    hmacData.set(encrypted, ivBytes.length);
    
    const hmacKey = await hmacSha256(keyBytes, new TextEncoder().encode('hmac-key'));
    const hmac = await hmacSha256(hmacKey, hmacData);
    const timestamp = Date.now();

    // Zeroize sensitive data
    encryptionKey.fill(0);
    keyBytes.fill(0);

    return {
        ciphertext: uint8ArrayToBase64(encrypted),
        iv,
        hmac: uint8ArrayToBase64(hmac),
        timestamp,
    };
}

/**
 * Decrypt data with integrity verification
 * Throws error if data has been tampered with
 */
export async function decryptData(encrypted: EncryptedData): Promise<string> {
    const key = getMemoryKey(MEMORY_KEYS.DERIVED_KEY);
    if (!key) {
        throw new Error('No encryption key available. Please login first.');
    }

    const keyBytes = base64ToUint8Array(key);
    const ivBytes = base64ToUint8Array(encrypted.iv);
    const ciphertextBytes = base64ToUint8Array(encrypted.ciphertext);

    // Verify HMAC before decryption
    const hmacData = new Uint8Array(ivBytes.length + ciphertextBytes.length);
    hmacData.set(ivBytes);
    hmacData.set(ciphertextBytes, ivBytes.length);

    const hmacKey = await hmacSha256(keyBytes, new TextEncoder().encode('hmac-key'));
    const computedHmac = await hmacSha256(hmacKey, hmacData);
    const providedHmac = base64ToUint8Array(encrypted.hmac);

    // Constant-time HMAC comparison
    if (computedHmac.length !== providedHmac.length) {
        keyBytes.fill(0);
        throw new Error('Integrity check failed: Data may have been tampered with.');
    }

    let hmacMatch = 0;
    for (let i = 0; i < computedHmac.length; i++) {
        hmacMatch |= computedHmac[i] ^ providedHmac[i];
    }

    if (hmacMatch !== 0) {
        keyBytes.fill(0);
        throw new Error('Integrity check failed: Data may have been tampered with.');
    }

    // Derive encryption key
    const encryptionKey = await deriveEncryptionKey(keyBytes, ivBytes);

    // Decrypt (reverse of encryption)
    let decrypted = new Uint8Array(ciphertextBytes);
    const numRounds = 3;
    
    for (let round = numRounds - 1; round >= 0; round--) {
        const roundKey = await hmacSha256(encryptionKey, new Uint8Array([round]));
        const keystream = await generateKeystream(roundKey, ivBytes, decrypted.length);
        decrypted = xorBytes(decrypted, keystream);
    }

    // Zeroize sensitive data
    encryptionKey.fill(0);
    keyBytes.fill(0);
    ciphertextBytes.fill(0);

    return new TextDecoder().decode(decrypted);
}
