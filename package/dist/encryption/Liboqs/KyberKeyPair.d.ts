export type KyberKeyPair = {
    publicKey: KyberPublicKey;
    privateKey: KyberPrivateKey;
};
/**
 * Kyber private key in raw format as used by liboqs
 *
 * Use below functions to convert to/from our serialization format
 */
export type KyberPrivateKey = {
    raw: Uint8Array;
};
/**
 * Kyber public key in raw format as used by liboqs
 *
 * Use below functions to convert to/from our serialization format
 */
export type KyberPublicKey = {
    raw: Uint8Array;
};
export type KyberEncapsulation = {
    ciphertext: Uint8Array;
    sharedSecret: Uint8Array;
};
/**
 * Encodes the kyber private key into a byte array in the following format.
 * | length (2 Byte) | privateKey.S (n Byte)   |
 * | length (2 Byte) | privateKey.HPK (n Byte) |
 * | length (2 Byte) | privateKey.Nonce (n Byte) |
 * | length (2 Byte) | privateKey.T (n Byte) |
 * | length (2 Byte) | privateKey.Rho (n Byte) |
 */
export declare function kyberPrivateKeyToBytes(key: KyberPrivateKey): Uint8Array;
/**
 * Encodes the kyber public key into a byte array in the following format.
 * | length (2 Byte) | publicKey.T (n Byte)  |
 * | length (2 Byte) | publicKey.Rho (n Byte) |
 */
export declare function kyberPublicKeyToBytes(key: KyberPublicKey): Uint8Array;
/**
 * Inverse of publicKeyToBytes
 */
export declare function bytesToKyberPublicKey(encodedPublicKey: Uint8Array): KyberPublicKey;
/**
 * Inverse of privateKeyToBytes
 */
export declare function bytesToKyberPrivateKey(encodedPrivateKey: Uint8Array): KyberPrivateKey;
export declare function extractKyberPublicKeyFromKyberPrivateKey(kyberPrivateKey: KyberPrivateKey): KyberPublicKey;
