import { AesKey } from "./SymmetricCipherUtils.js";
import { AesCbcFacade } from "./AesCbcFacade.js";
/**
 * This facade contains all methods for encryption/ decryption for symmetric encryption incl. AES-128 and AES-256 in CBC mode or AEAD.
 *
 * Depending on the symmetric cipher version it adds an HMAC tag (Encrypt-then-Mac), in which case two different keys for encryption and authentication are
 * derived from the provided secret key.
 *
 * In case of AEAD, there is additional associated data. Needed both for encryption and decryption, but it is not part of the created ciphertext.
 */
export declare class SymmetricCipherFacade {
    private readonly aesCbcFacade;
    /** whether we can use SubtleCrypto for big chunks of data (we use JS impl for most encryption) */
    private readonly subtleCryptoAvailable;
    constructor(aesCbcFacade: AesCbcFacade);
    /**
     * Encrypts a byte array with AES in CBC mode.
     *
     * @param key   The key to use for the encryption.
     * @param bytes The data to encrypt.
     * @return The encrypted bytes.
     */
    encryptBytes(key: AesKey, bytes: Uint8Array): Uint8Array;
    /**
     * Encrypts a byte array with AES in CBC mode.
     *
     * Forces encryption without authentication. Only use in backward compatibility tests.
     *
     * @deprecated
     */
    encryptBytesDeprecatedUnauthenticated(key: AesKey, bytes: Uint8Array): Uint8Array;
    /**
     * Encrypts a byte array with AES in CBC mode with a custom IV.
     *
     * @deprecated use encryptBytes instead
     */
    encryptBytesDeprecatedCustomIv(key: AesKey, bytes: Uint8Array, iv: Uint8Array): Uint8Array;
    /**
     * Encrypts a byte array with AES in CBC mode with a custom IV.
     *
     * Forces encryption without authentication. The custom IV is prepended to the returned CBC ciphertext.
     *
     * @deprecated use encryptBytes instead.
     */
    encryptBytesDeprecatedUnauthenticatedCustomIv(key: AesKey, bytes: Uint8Array, iv: Uint8Array): Uint8Array;
    /**
     * Decrypts byte array with AES in CBC mode.
     *
     * @param key   The key to use for the decryption.
     * @param bytes A byte array that was encrypted with the same key before.
     * @return The decrypted bytes.
     */
    decryptBytes(key: AesKey, bytes: Uint8Array): Uint8Array;
    asyncDecryptBytes(key: AesKey, bytes: Uint8Array): Promise<Uint8Array>;
    /**
     * Decrypts byte array without enforcing authentication.
     *
     * ONLY USE FOR LEGACY data!
     *
     * @deprecated
     */
    decryptBytesDeprecatedUnauthenticated(key: AesKey, bytes: Uint8Array): Uint8Array;
    /**
     * Decrypts a key without enforcing authentication.
     * Must include an iv in the ciphertext.
     *
     * ONLY USE FOR LEGACY data!
     *
     * @deprecated
     */
    decryptKeyDeprecatedUnauthenticated(key: AesKey, bytes: Uint8Array): AesKey;
    /**
     * Decrypts a key without enforcing authentication.
     * The fixed IV will be used and must not be included in the ciphertext.
     *
     * ONLY USE FOR LEGACY data!
     *
     * @deprecated
     */
    decryptKeyDeprecatedUnauthenticatedFixedIv(key: AesKey, bytes: Uint8Array): AesKey;
    /**
     * Encrypts a hex coded key with AES in CBC mode.
     *
     * @param key          The key to use for the encryption.
     * @param keyToEncrypt The key that shall be encrypted.
     * @return The encrypted key.
     */
    encryptKey(key: AesKey, keyToEncrypt: AesKey): Uint8Array;
    /**
     * Decrypts a key with AES in CBC mode.
     *
     * @param key   The key to use for the decryption.
     * @param bytes The key that shall be decrypted.
     * @return The decrypted key.
     */
    decryptKey(key: AesKey, bytes: Uint8Array): AesKey;
    private encrypt;
    private decrypt;
    private decryptAsync;
    private generateIV;
}
export declare const SYMMETRIC_CIPHER_FACADE: SymmetricCipherFacade;
