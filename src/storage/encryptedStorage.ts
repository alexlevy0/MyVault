/**
 * Encrypted Storage - Abstraction layer for encrypted storage operations
 * @module storage/encryptedStorage
 * 
 * Provides an interface for encrypting/decrypting data before storage.
 * This is an abstraction layer that can be extended for different backends.
 */

import * as Crypto from 'expo-crypto';
import { getMemoryKey, MEMORY_KEYS } from '../security/memory';

/**
 * Encryption result containing ciphertext and IV
 */
export interface EncryptedData {
    /** Base64 encoded ciphertext */
    ciphertext: string;
    /** Base64 encoded initialization vector */
    iv: string;
    /** Authentication tag for AES-GCM (optional) */
    tag?: string;
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
 * Generate a random initialization vector
 * @returns Base64 encoded IV
 */
export async function generateIV(): Promise<string> {
    const ivBytes = await Crypto.getRandomBytesAsync(12); // 96 bits for AES-GCM
    return uint8ArrayToBase64(new Uint8Array(ivBytes));
}

/**
 * Simple XOR-based encryption for demo purposes
 * NOTE: In production, use proper AES-GCM via a native module
 * This is a placeholder that demonstrates the API
 */
export async function encryptData(plaintext: string): Promise<EncryptedData> {
    const key = getMemoryKey(MEMORY_KEYS.DERIVED_KEY);
    if (!key) {
        throw new Error('No encryption key available. Please login first.');
    }

    const iv = await generateIV();
    const ivBytes = base64ToUint8Array(iv);
    const keyBytes = base64ToUint8Array(key);
    const plaintextBytes = new TextEncoder().encode(plaintext);

    // Simple XOR encryption (placeholder - use proper AES in production)
    const encrypted = new Uint8Array(plaintextBytes.length);
    for (let i = 0; i < plaintextBytes.length; i++) {
        encrypted[i] = plaintextBytes[i] ^ keyBytes[i % keyBytes.length] ^ ivBytes[i % ivBytes.length];
    }

    return {
        ciphertext: uint8ArrayToBase64(encrypted),
        iv,
    };
}

/**
 * Simple XOR-based decryption for demo purposes
 * NOTE: In production, use proper AES-GCM via a native module
 */
export async function decryptData(encrypted: EncryptedData): Promise<string> {
    const key = getMemoryKey(MEMORY_KEYS.DERIVED_KEY);
    if (!key) {
        throw new Error('No encryption key available. Please login first.');
    }

    const ivBytes = base64ToUint8Array(encrypted.iv);
    const keyBytes = base64ToUint8Array(key);
    const ciphertextBytes = base64ToUint8Array(encrypted.ciphertext);

    // Simple XOR decryption (placeholder - use proper AES in production)
    const decrypted = new Uint8Array(ciphertextBytes.length);
    for (let i = 0; i < ciphertextBytes.length; i++) {
        decrypted[i] = ciphertextBytes[i] ^ keyBytes[i % keyBytes.length] ^ ivBytes[i % ivBytes.length];
    }

    return new TextDecoder().decode(decrypted);
}
