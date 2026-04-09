import { AesKey } from "./symmetric/SymmetricCipherUtils.js";
export type MacTag = Uint8Array & {
    __brand: "macTag";
};
/**
 * Create an HMAC-SHA-256 tag over the given data using the given key.
 */
export declare function hmacSha256(key: AesKey, data: Uint8Array): MacTag;
/**
 * Verify an HMAC-SHA-256 tag against the given data and key.
 * @throws CryptoError if the tag does not match the data and key.
 */
export declare function verifyHmacSha256(key: AesKey, data: Uint8Array, tag: MacTag): void;
/**
 * Create an HMAC-SHA-256 tag over the given data using the given key.
 */
export declare function hmacSha256Async(key: AesKey, data: Uint8Array): Promise<MacTag>;
/**
 * Import and verify an HMAC-SHA-256 tag for subtle crypto against the given data and key.
 * @throws CryptoError if the tag does not match the data and key.
 */
export declare function verifyHmacSha256Async(key: AesKey, data: Uint8Array, tag: MacTag): Promise<void>;
