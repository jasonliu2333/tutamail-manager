import { AesKey } from "./SymmetricCipherUtils.js";
export declare enum AesKeyLength {
    Aes128 = 128,
    Aes256 = 256
}
export declare function getKeyLengthInBytes(keyLength: AesKeyLength): number;
export declare function getAndVerifyAesKeyLength(key: AesKey, acceptedBitLengths?: AesKeyLength[]): AesKeyLength;
