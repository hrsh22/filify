import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes

class EncryptionService {
    encrypt(text: string): string {
        const iv = crypto.randomBytes(16); // 16 bytes IV for GCM
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    decrypt(encryptedData: string): string {
        const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

        if (!ivHex || !authTagHex || !encrypted) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

export const encryptionService = new EncryptionService();




