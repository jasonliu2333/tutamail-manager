import { Aes256Key, AesKey } from "./symmetric/SymmetricCipherUtils.js";
/**
 * Encrypts bytes with AES128 or AES256 in CBC mode.
 * @param key The key to use for the encryption.
 * @param bytes The plain text.
 * @return The encrypted bytes
 */
export declare function aesEncrypt(key: AesKey, bytes: Uint8Array): Uint8Array<ArrayBufferLike>;
/**
 * @deprecated use aesEncrypt instead
 */
export declare function aesEncryptConfigurationDatabaseItem(key: AesKey, bytes: Uint8Array, iv: Uint8Array): Uint8Array;
/**
 * Encrypts bytes with AES 256 in CBC mode without mac. This is legacy code and should be removed once the index has been migrated.
 * @deprecated
 */
export declare function aes256EncryptSearchIndexEntry(key: Aes256Key, bytes: Uint8Array): Uint8Array;
/**
 *@deprecated
 */
export declare function aes256EncryptSearchIndexEntryWithIV(key: Aes256Key, bytes: Uint8Array, iv: Uint8Array): Uint8Array;
/**
 * Decrypts the given words with AES-128/256 in CBC mode (with HMAC-SHA-256 as mac). The mac is enforced for AES-256 but optional for AES-128.
 * @param key The key to use for the decryption.
 * @param encryptedBytes The ciphertext encoded as bytes.
 * @return The decrypted bytes.
 */
export declare function aesDecrypt(key: AesKey, encryptedBytes: Uint8Array): Uint8Array;
export declare function asyncDecryptBytes(key: AesKey, bytes: Uint8Array): Promise<Uint8Array>;
/**
 * Decrypts the given words with AES-128/256 in CBC mode. Does not enforce a mac.
 * We always must enforce macs. This only exists for backward compatibility in some exceptional cases like search index entry encryption.
 *
 * @param key The key to use for the decryption.
 * @param encryptedBytes The ciphertext encoded as bytes.
 * @return The decrypted bytes.
 * @deprecated
 */
export declare function aesDecryptUnauthenticated(key: Aes256Key, encryptedBytes: Uint8Array): Uint8Array;
