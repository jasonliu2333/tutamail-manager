import type { RsaKeyPair, RsaPrivateKey, RsaX25519KeyPair } from "./RsaKeyPair.js";
import { KyberPrivateKey } from "./Liboqs/KyberKeyPair.js";
import { X25519PrivateKey } from "./X25519.js";
import { AsymmetricKeyPair } from "./AsymmetricKeyPair.js";
import type { PQKeyPairs } from "./PQKeyPairs.js";
import { Aes256Key, AesKey } from "./symmetric/SymmetricCipherUtils.js";
export type EncryptedKeyPairs = EncryptedPqKeyPairs | EncryptedRsaKeyPairs | EncryptedRsaX25519KeyPairs;
export type AbstractEncryptedKeyPair = {
    pubEccKey: null | Uint8Array;
    pubKyberKey: null | Uint8Array;
    pubRsaKey: null | Uint8Array;
    symEncPrivEccKey: null | Uint8Array;
    symEncPrivKyberKey: null | Uint8Array;
    symEncPrivRsaKey: null | Uint8Array;
    signature: null | object;
};
export type EncryptedPqKeyPairs = {
    pubEccKey: Uint8Array;
    pubKyberKey: Uint8Array;
    pubRsaKey: null;
    symEncPrivEccKey: Uint8Array;
    symEncPrivKyberKey: Uint8Array;
    symEncPrivRsaKey: null;
    signature: null | object;
};
export type EncryptedRsaKeyPairs = {
    pubEccKey: null;
    pubKyberKey: null;
    pubRsaKey: Uint8Array;
    symEncPrivEccKey: null;
    symEncPrivKyberKey: null;
    symEncPrivRsaKey: Uint8Array;
    signature: null | object;
};
export type EncryptedRsaX25519KeyPairs = {
    pubEccKey: Uint8Array;
    pubKyberKey: null;
    pubRsaKey: Uint8Array;
    symEncPrivEccKey: Uint8Array;
    symEncPrivKyberKey: null;
    symEncPrivRsaKey: Uint8Array;
    signature: null | object;
};
export declare function isEncryptedPqKeyPairs(keyPair: AbstractEncryptedKeyPair): keyPair is EncryptedPqKeyPairs;
export declare function encryptKey(encryptionKey: AesKey, keyToBeEncrypted: AesKey): Uint8Array;
export declare function decryptKey(encryptionKey: AesKey, keyToBeDecrypted: Uint8Array): AesKey;
/**
 * @deprecated
 */
export declare function decryptKeyUnauthenticatedWithDeviceKeyChain(key: Aes256Key, encryptedBytes: Uint8Array): AesKey;
export declare function aes256DecryptWithRecoveryKey(encryptionKey: Aes256Key, keyToBeDecrypted: Uint8Array): Aes256Key;
export declare function encryptRsaKey(encryptionKey: AesKey, privateKey: RsaPrivateKey): Uint8Array;
export declare function encryptX25519Key(encryptionKey: AesKey, privateKey: X25519PrivateKey): Uint8Array;
export declare function encryptKyberKey(encryptionKey: AesKey, privateKey: KyberPrivateKey): Uint8Array;
export declare function decryptRsaKey(encryptionKey: AesKey, encryptedPrivateKey: Uint8Array): RsaPrivateKey;
export declare function decryptKeyPair(encryptionKey: AesKey, keyPair: EncryptedPqKeyPairs): PQKeyPairs;
export declare function decryptKeyPair(encryptionKey: AesKey, keyPair: EncryptedRsaKeyPairs): RsaKeyPair;
export declare function decryptKeyPair(encryptionKey: AesKey, keyPair: EncryptedRsaX25519KeyPairs): RsaX25519KeyPair;
export declare function decryptKeyPair(encryptionKey: AesKey, keyPair: EncryptedKeyPairs): AsymmetricKeyPair;
