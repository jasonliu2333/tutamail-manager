import { SymmetricCipherVersion } from "./SymmetricCipherVersion.js";
import { AesKey } from "./SymmetricCipherUtils.js";
import { SymmetricKeyDeriver } from "./SymmetricKeyDeriver.js";
/**
 * This facade provides the implementation for both encryption and decryption of AES in CBC mode. Supports 128 and 256-bit keys.
 * Depending on the cipher version the encryption is authenticated with HMAC-SHA-256.
 * SymmetricCipherFacade is responsible for handling parameters for encryption/decryption.
 */
export declare class AesCbcFacade {
    private readonly symmetricKeyDeriver;
    constructor(symmetricKeyDeriver: SymmetricKeyDeriver);
    /**
     * This should not be called directly! Use SymmetricCipherFacade instead
     */
    encrypt(key: AesKey, plainText: Uint8Array, mustPrependIv: boolean, iv: Uint8Array, padding: boolean, cipherVersion: SymmetricCipherVersion, skipAuthenticationEnforcement?: boolean): Uint8Array;
    /**
     * This should not be called directly! Use SymmetricCipherFacade instead
     */
    decrypt(key: AesKey, cipherText: Uint8Array, ivIsPrepended: boolean, padding: boolean, cipherVersion: SymmetricCipherVersion, skipAuthenticationEnforcement?: boolean): Uint8Array;
    decryptAsync(key: AesKey, cipherText: Uint8Array, ivIsPrepended: boolean, cipherVersion: SymmetricCipherVersion, skipAuthenticationEnforcement?: boolean): Promise<Uint8Array>;
    private extractMacAndCipherText;
    private getIvAndCipherText;
    private tryToEnforceAuthentication;
}
export declare const AES_CBC_FACADE: AesCbcFacade;
