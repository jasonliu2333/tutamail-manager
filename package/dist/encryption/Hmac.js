import sjcl from "../internal/sjcl.js";
import { CryptoError } from "../misc/CryptoError.js";
import { bitArrayToUint8Array, uint8ArrayToBitArray } from "./symmetric/SymmetricCipherUtils.js";
import { getAndVerifyAesKeyLength } from "./symmetric/AesKeyLength.js";
/**
 * Create an HMAC-SHA-256 tag over the given data using the given key.
 */
export function hmacSha256(key, data) {
    const hmac = new sjcl.misc.hmac(key, sjcl.hash.sha256);
    return bitArrayToUint8Array(hmac.encrypt(uint8ArrayToBitArray(data)));
}
/**
 * Verify an HMAC-SHA-256 tag against the given data and key.
 * @throws CryptoError if the tag does not match the data and key.
 */
export function verifyHmacSha256(key, data, tag) {
    const computedTag = hmacSha256(key, data);
    if (!sjcl.bitArray.equal(computedTag, tag)) {
        throw new CryptoError("invalid mac");
    }
}
/**
 * Create an HMAC-SHA-256 tag over the given data using the given key.
 */
export async function hmacSha256Async(key, data) {
    const keyLength = getAndVerifyAesKeyLength(key);
    const subtleAuthenticationKey = await crypto.subtle.importKey("raw", bitArrayToUint8Array(key), { name: "HMAC", hash: "SHA-256", length: keyLength }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", subtleAuthenticationKey, data));
}
/**
 * Import and verify an HMAC-SHA-256 tag for subtle crypto against the given data and key.
 * @throws CryptoError if the tag does not match the data and key.
 */
export async function verifyHmacSha256Async(key, data, tag) {
    // technically re-implementing SubtleCrypto#verify() but doing it this way for easier testing and symmetry.
    const computedTag = await hmacSha256Async(key, data);
    if (!sjcl.bitArray.equal(computedTag, tag)) {
        throw new CryptoError("invalid mac");
    }
}
