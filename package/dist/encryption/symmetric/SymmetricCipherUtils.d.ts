import { Base64, Base64Url } from "@tutao/tutanota-utils";
export declare const FIXED_IV: Uint8Array<ArrayBufferLike>;
export declare const BLOCK_SIZE_BYTES = 16;
export declare const IV_BYTE_LENGTH = 16;
export declare const SYMMETRIC_CIPHER_VERSION_PREFIX_LENGTH_BYTES = 1;
export declare const SYMMETRIC_AUTHENTICATION_TAG_LENGTH_BYTES = 32;
/**
 * Does not account for padding or the IV, but only the version byte and the authentication tag.
 */
export declare const SYMMETRIC_CIPHER_VERSION_AND_TAG_OVERHEAD_BYTES: number;
export type BitArray = number[];
export type Aes256Key = BitArray;
export type Aes128Key = BitArray;
export type AesKey = Aes128Key | Aes256Key;
/**
 * Creates the auth verifier from the password key.
 * @param passwordKey The key.
 * @returns The auth verifier
 */
export declare function createAuthVerifier(passwordKey: AesKey): Uint8Array;
export declare function createAuthVerifierAsBase64Url(passwordKey: AesKey): Base64Url;
/**
 * Converts the given BitArray (SJCL) to an Uint8Array.
 * @param bits The BitArray.
 * @return The uint8array.
 */
export declare function bitArrayToUint8Array(bits: BitArray): Uint8Array;
/**
 * Converts the given uint8array to a BitArray (SJCL).
 * @param uint8Array The uint8Array key.
 * @return The key.
 */
export declare function uint8ArrayToBitArray(uint8Array: Uint8Array): BitArray;
export declare function keyToBase64(key: AesKey): Base64;
/**
 * Converts the given base64 coded string to a key.
 * @param base64 The base64 coded string representation of the key.
 * @return The key.
 * @throws {CryptoError} If the conversion fails.
 */
export declare function base64ToKey(base64: Base64): AesKey;
export declare function uint8ArrayToKey(array: Uint8Array): AesKey;
export declare function keyToUint8Array(key: BitArray): Uint8Array;
/**
 * Create a random 256-bit symmetric AES key.
 *
 * @return The key.
 */
export declare function aes256RandomKey(): Aes256Key;
export declare function generateIV(): Uint8Array;
