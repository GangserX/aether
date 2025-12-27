// ===========================================
// AETHER WORKFLOW ENGINE - Credential Service
// Secure storage and retrieval of credentials
// ===========================================

import { encryption } from '../utils/encryption';
import { logger } from '../utils/logger';
import { CredentialType, CredentialData } from '../types/workflow.types';

// In-memory store (replace with Prisma in production)
const credentialStore: Map<string, { userId: string; encrypted: string; name: string; type: CredentialType }> = new Map();

export const credentialService = {
  /**
   * Store encrypted credentials
   */
  async store(
    userId: string,
    name: string,
    type: CredentialType,
    data: Record<string, any>
  ): Promise<string> {
    const id = `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const encrypted = encryption.encrypt(data);
    
    credentialStore.set(id, {
      userId,
      name,
      type,
      encrypted,
    });

    logger.info(`Credential stored: ${name} (${type})`, { credentialId: id, userId });
    return id;
  },

  /**
   * Get decrypted credentials
   */
  async getDecrypted(credentialId: string, userId: string): Promise<Record<string, any> | null> {
    const stored = credentialStore.get(credentialId);
    
    if (!stored) {
      logger.warn(`Credential not found: ${credentialId}`);
      return null;
    }

    // Verify ownership
    if (stored.userId !== userId) {
      logger.warn(`Unauthorized credential access attempt`, { credentialId, userId });
      return null;
    }

    return encryption.decrypt(stored.encrypted);
  },

  /**
   * List credentials for a user (without sensitive data)
   */
  async list(userId: string): Promise<Array<{ id: string; name: string; type: CredentialType }>> {
    const result: Array<{ id: string; name: string; type: CredentialType }> = [];
    
    credentialStore.forEach((value, key) => {
      if (value.userId === userId) {
        result.push({
          id: key,
          name: value.name,
          type: value.type,
        });
      }
    });

    return result;
  },

  /**
   * Delete a credential
   */
  async delete(credentialId: string, userId: string): Promise<boolean> {
    const stored = credentialStore.get(credentialId);
    
    if (!stored || stored.userId !== userId) {
      return false;
    }

    credentialStore.delete(credentialId);
    logger.info(`Credential deleted: ${credentialId}`);
    return true;
  },

  /**
   * Update credential data
   */
  async update(
    credentialId: string,
    userId: string,
    data: Record<string, any>
  ): Promise<boolean> {
    const stored = credentialStore.get(credentialId);
    
    if (!stored || stored.userId !== userId) {
      return false;
    }

    stored.encrypted = encryption.encrypt(data);
    credentialStore.set(credentialId, stored);
    
    logger.info(`Credential updated: ${credentialId}`);
    return true;
  },
};

export default credentialService;
