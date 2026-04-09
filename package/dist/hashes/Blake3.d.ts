import { Aes256Key } from "../encryption/symmetric/SymmetricCipherUtils.js";
import { MacTag } from "../misc/Constants.js";
export declare const DEFAULT_BLAKE3_OUTPUT_LENGTH_BYTES = 32;
/**
 * Compute a 32 byte BLAKE3 hash.
 */
export declare function blake3Hash(data: Uint8Array): any;
/**
 * Create a 32 byte BLAKE3 tag over the given data using the given key.
 */
export declare function blake3Mac(key: Aes256Key, data: Uint8Array): MacTag;
/**
 * Verify a BLAKE3 tag against the given data and key.
 * @throws CryptoError if the tag does not match the data and key.
 */
export declare function blake3MacVerify(key: Aes256Key, data: Uint8Array, tag: MacTag): void;
/**
 * Derive key bytes from the given input key material and context
 * @param inputKeyMaterial Input Key Material
 * @param context
 * @param desiredLengthBytes
 */
export declare function blake3Kdf(inputKeyMaterial: Uint8Array, context: string, desiredLengthBytes: number): Uint8Array;
