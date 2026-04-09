/**
 * The version of the symmetric cipher.
 * Must fit into 1 byte, so 255 is the maximum allowed enum value.
 */
export declare enum SymmetricCipherVersion {
    UnusedReservedUnauthenticated = 0,// 0: Un(!)authenticated encryption. DO NOT USE THIS to write a version byte! In theory, this could be the original version (AES-128-CBC without MAC), but this version does not have a version byte nor a version explicitly declared.
    AesCbcThenHmac = 1,// 1: Authenticated encryption Aes-128/256 (depending on the key length) AES-CBC-then-HMAC
    Aead = 2
}
/**
 * Get the SymmetricCipherVersion from either the version byte or the full ciphertext
 */
export declare function getSymmetricCipherVersion(ciphertext: Uint8Array): SymmetricCipherVersion;
/**
 * Get a byte array of length 1 that holds the provided version byte.
 */
export declare function symmetricCipherVersionToUint8Array(version: SymmetricCipherVersion): Uint8Array;
