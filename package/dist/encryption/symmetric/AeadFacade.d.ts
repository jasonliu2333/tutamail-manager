import { AeadSubKeys } from "./SymmetricKeyDeriver.js";
/**
 * This facade contains all methods for encryption/ decryption for Authenticated Encryption with Associated Data (AEAD).
 *
 * We use AES-CTR then BLAKE3, where the tag is computed over: version byte, nonce, ciphertext and associated data.
 * @deprecated DO NOT USE THIS YET - EXPORTED ONLY FOR COMPATIBILITY TESTS!
 */
export declare class AeadFacade {
    encrypt(key: AeadSubKeys, plainText: Uint8Array, associatedData: Uint8Array): Uint8Array;
    decrypt(key: AeadSubKeys, cipherText: Uint8Array, associatedData: Uint8Array): Uint8Array;
    private validateKeyLength;
}
