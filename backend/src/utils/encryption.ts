// ===========================================
// AETHER WORKFLOW ENGINE - Encryption Utility
// AES-256 encryption for credentials
// ===========================================

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'aether-default-encryption-key-32chars!';

export const encryption = {
  /**
   * Encrypt data using AES-256
   */
  encrypt(data: any): string {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  },

  /**
   * Decrypt data
   */
  decrypt(encryptedData: string): any {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedString);
    } catch (error) {
      throw new Error('Failed to decrypt data');
    }
  },

  /**
   * Hash a value (for API keys, etc.)
   */
  hash(value: string): string {
    return CryptoJS.SHA256(value).toString();
  },

  /**
   * Generate a random token
   */
  generateToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  },
};

export default encryption;
