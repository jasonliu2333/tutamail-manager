import { BigInteger } from "../internal/crypto-jsbn-2012-08-09_1.js";
import type { Hex } from "@tutao/tutanota-utils";
import type { RawRsaPublicKey, RsaPrivateKey, RsaPublicKey } from "./RsaKeyPair.js";
export declare function rsaEncrypt(publicKey: RsaPublicKey, bytes: Uint8Array, seed: Uint8Array): Uint8Array;
export declare function rsaDecrypt(privateKey: RsaPrivateKey, bytes: Uint8Array): Uint8Array;
/**
 * Adds leading 0's to the given byte array until targeByteLength bytes are reached. Removes leading 0's if byteArray is longer than targetByteLength.
 */
export declare function _padAndUnpadLeadingZeros(targetByteLength: number, byteArray: Uint8Array): Uint8Array;
/********************************* OAEP *********************************/
/**
 * Optimal Asymmetric Encryption Padding (OAEP) / RSA padding
 * @see https://tools.ietf.org/html/rfc3447#section-7.1
 *
 * @param value The byte array to encode.
 * @param keyLength The length of the RSA key in bit.
 * @param seed An array of 32 random bytes.
 * @return The padded byte array.
 */
export declare function oaepPad(value: Uint8Array, keyLength: number, seed: Uint8Array): Uint8Array;
/**
 * @param value The byte array to unpad.
 * @param keyLength The length of the RSA key in bit.
 * @return The unpadded byte array.
 */
export declare function oaepUnpad(value: Uint8Array, keyLength: number): Uint8Array;
/**
 * Provides a block of keyLength / 8 - 1 bytes with the following format:
 * [ zeros ] [ label hash ] [ zeros ] [ 1 ] [ value ]
 *    32           32    keyLen-2*32-2  1  value.length
 * The label is the hash of an empty string like defined in PKCS#1 v2.1
 */
export declare function _getPSBlock(value: Uint8Array, keyLength: number): Uint8Array;
/********************************* PSS *********************************/
/**
 * @param message The byte array to encode.
 * @param keyLength The length of the RSA key in bit.
 * @param salt An array of random bytes.
 * @return The padded byte array.
 */
export declare function encode(message: Uint8Array, keyLength: number, salt: Uint8Array): Uint8Array;
/********************************* RSA utils *********************************/
/**
 * @param seed An array of byte values.
 * @param length The length of the return value in bytes.
 */
export declare function mgf1(seed: Uint8Array, length: number): Uint8Array;
/**
 * converts an integer to a 4 byte array
 */
export declare function i2osp(i: number): Uint8Array;
export declare function _keyArrayToHex(key: BigInteger[]): Hex;
export declare function rsaPrivateKeyToHex(privateKey: RsaPrivateKey): Hex;
export declare function rsaPublicKeyToHex(publicKey: RawRsaPublicKey): Hex;
export declare function rsaPublicKeyToBytes(rsaPublicKey: RawRsaPublicKey): Uint8Array<ArrayBufferLike>;
export declare function hexToRsaPrivateKey(privateKeyHex: Hex): RsaPrivateKey;
export declare function hexToRsaPublicKey(publicKeyHex: Hex): RsaPublicKey;
export declare function extractRawPublicRsaKeyFromPrivateRsaKey(privateRsaKey: RsaPrivateKey): RawRsaPublicKey;
