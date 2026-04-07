import { aesDecrypt, aesEncrypt } from "./Aes.js";
import { assertNotNull, hexToUint8Array, uint8ArrayToHex } from "@tutao/tutanota-utils";
import { hexToRsaPrivateKey, hexToRsaPublicKey, rsaPrivateKeyToHex } from "./Rsa.js";
import { bytesToKyberPrivateKey, bytesToKyberPublicKey, kyberPrivateKeyToBytes } from "./Liboqs/KyberKeyPair.js";
import { KeyPairType } from "./AsymmetricKeyPair.js";
import { AesKeyLength, getKeyLengthInBytes } from "./symmetric/AesKeyLength.js";
import { SYMMETRIC_CIPHER_FACADE } from "./symmetric/SymmetricCipherFacade.js";
export function isEncryptedPqKeyPairs(keyPair) {
    return (keyPair.pubEccKey != null &&
        keyPair.pubKyberKey != null &&
        keyPair.symEncPrivEccKey != null &&
        keyPair.symEncPrivKyberKey != null &&
        keyPair.pubRsaKey == null &&
        keyPair.symEncPrivRsaKey == null);
}
export function encryptKey(encryptionKey, keyToBeEncrypted) {
    return SYMMETRIC_CIPHER_FACADE.encryptKey(encryptionKey, keyToBeEncrypted);
}
export function decryptKey(encryptionKey, keyToBeDecrypted) {
    return SYMMETRIC_CIPHER_FACADE.decryptKey(encryptionKey, keyToBeDecrypted);
}
/**
 * @deprecated
 */
export function decryptKeyUnauthenticatedWithDeviceKeyChain(key, encryptedBytes) {
    return SYMMETRIC_CIPHER_FACADE.decryptKeyDeprecatedUnauthenticated(key, encryptedBytes);
}
export function aes256DecryptWithRecoveryKey(encryptionKey, keyToBeDecrypted) {
    // legacy case: recovery code with fixed IV and without mac
    if (keyToBeDecrypted.length === getKeyLengthInBytes(AesKeyLength.Aes128)) {
        return SYMMETRIC_CIPHER_FACADE.decryptKeyDeprecatedUnauthenticatedFixedIv(encryptionKey, keyToBeDecrypted);
    }
    else {
        return decryptKey(encryptionKey, keyToBeDecrypted);
    }
}
export function encryptRsaKey(encryptionKey, privateKey) {
    return aesEncrypt(encryptionKey, hexToUint8Array(rsaPrivateKeyToHex(privateKey)));
}
export function encryptX25519Key(encryptionKey, privateKey) {
    return aesEncrypt(encryptionKey, privateKey); // passing IV as undefined here is fine, as it will generate a new one for each encryption
}
export function encryptKyberKey(encryptionKey, privateKey) {
    return aesEncrypt(encryptionKey, kyberPrivateKeyToBytes(privateKey)); // passing IV as undefined here is fine, as it will generate a new one for each encryption
}
export function decryptRsaKey(encryptionKey, encryptedPrivateKey) {
    return hexToRsaPrivateKey(uint8ArrayToHex(aesDecrypt(encryptionKey, encryptedPrivateKey)));
}
export function decryptKeyPair(encryptionKey, keyPair) {
    if (keyPair.symEncPrivRsaKey) {
        return decryptRsaOrRsaX25519KeyPair(encryptionKey, keyPair);
    }
    else {
        return decryptPQKeyPair(encryptionKey, keyPair);
    }
}
function decryptRsaOrRsaX25519KeyPair(encryptionKey, keyPair) {
    const publicKey = hexToRsaPublicKey(uint8ArrayToHex(assertNotNull(keyPair.pubRsaKey)));
    const privateKey = hexToRsaPrivateKey(uint8ArrayToHex(aesDecrypt(encryptionKey, keyPair.symEncPrivRsaKey)));
    if (keyPair.symEncPrivEccKey) {
        const publicEccKey = assertNotNull(keyPair.pubEccKey);
        const privateEccKey = aesDecrypt(encryptionKey, assertNotNull(keyPair.symEncPrivEccKey));
        return {
            keyPairType: KeyPairType.RSA_AND_X25519,
            publicKey,
            privateKey,
            publicEccKey,
            privateEccKey,
        };
    }
    else {
        return { keyPairType: KeyPairType.RSA, publicKey, privateKey };
    }
}
function decryptPQKeyPair(encryptionKey, keyPair) {
    const eccPublicKey = assertNotNull(keyPair.pubEccKey, "expected pub ecc key for PQ keypair");
    const eccPrivateKey = aesDecrypt(encryptionKey, assertNotNull(keyPair.symEncPrivEccKey, "expected priv ecc key for PQ keypair"));
    const kyberPublicKey = bytesToKyberPublicKey(assertNotNull(keyPair.pubKyberKey, "expected pub kyber key for PQ keypair"));
    const kyberPrivateKey = bytesToKyberPrivateKey(aesDecrypt(encryptionKey, assertNotNull(keyPair.symEncPrivKyberKey, "expected enc priv kyber key for PQ keypair")));
    return {
        keyPairType: KeyPairType.TUTA_CRYPT,
        x25519KeyPair: {
            publicKey: eccPublicKey,
            privateKey: eccPrivateKey,
        },
        kyberKeyPair: {
            publicKey: kyberPublicKey,
            privateKey: kyberPrivateKey,
        },
    };
}
