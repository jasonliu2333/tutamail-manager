import { SymmetricCipherVersion } from "./SymmetricCipherVersion.js";
import { Aes256Key, AesKey } from "./SymmetricCipherUtils.js";
/**
 * @private visible for tests
 * */
export declare const AEAD_KEY_DERIVATION_INFO = "AEAD key splitting";
export type SymmetricSubKeys = {
    encryptionKey: AesKey;
    authenticationKey: AesKey | null;
};
export type AeadSubKeys = {
    encryptionKey: Aes256Key;
    authenticationKey: Aes256Key;
};
export declare class SymmetricKeyDeriver {
    /**
     * Derives encryption and authentication keys as needed for the symmetric cipher implementations
     */
    deriveSubKeys(key: AesKey, symmetricCipherVersion: SymmetricCipherVersion): SymmetricSubKeys;
}
export declare const SYMMETRIC_KEY_DERIVER: SymmetricKeyDeriver;
