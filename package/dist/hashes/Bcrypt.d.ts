import { KeyLength } from "../misc/Constants.js";
import { AesKey } from "../encryption/symmetric/SymmetricCipherUtils.js";
export type SignedBytes = number[];
/**
 * Create a 128 bit random _salt value.
 * return _salt 128 bit of random data, encoded as a hex string.
 */
export declare function generateRandomSalt(): Uint8Array;
/**
 * Create a 128 bit symmetric key from the given passphrase.
 * @param passphrase The passphrase to use for key generation as utf8 string.
 * @param salt 16 bytes of random data
 * @param keyLengthType Defines the length of the key that shall be generated.
 * @return resolved with the key
 */
export declare function generateKeyFromPassphrase(passphrase: string, salt: Uint8Array, keyLengthType: KeyLength): AesKey;
