import { KyberEncapsulation, KyberKeyPair, KyberPrivateKey, KyberPublicKey } from "./KyberKeyPair.js";
import { Ptr } from "@tutao/tutanota-utils";
import { Randomizer } from "../../random/Randomizer.js";
import { WASMExports } from "@tutao/tutanota-utils";
/**
 * Number of random bytes required for a Kyber operation
 */
export declare const ML_KEM_RAND_AMOUNT_OF_ENTROPY = 64;
export declare const KYBER_POLYVECBYTES: number;
export declare const KYBER_SYMBYTES = 32;
type KemPtr = Ptr;
export interface LibOQSExports extends WASMExports {
    OQS_KEM_keypair(kem: KemPtr, publicKey: Ptr, secretKey: Ptr): number;
    TUTA_inject_entropy(data: Ptr, size: number): number;
    TUTA_KEM_encaps(kem: KemPtr, ciphertext: Ptr, sharedSecret: Ptr, publicKey: Ptr): number;
    TUTA_KEM_decaps(kem: KemPtr, shared_secret: Ptr, ciphertext: Ptr, secret_key: Ptr): number;
    OQS_KEM_free(kem: KemPtr | null): void;
    OQS_KEM_new(methodName: Ptr): Ptr;
}
/**
 * @returns a new random kyber key pair.
 */
export declare function generateKeyPair(kyberWasm: LibOQSExports, randomizer: Randomizer): KyberKeyPair;
/**
 * @param kyberWasm the WebAssembly/JsFallback module that implements our kyber primitives (liboqs)
 * @param publicKey the public key to encapsulate with
 * @param randomizer our randomizer that is used to the native library with entropy
 * @return the plaintext secret key and the encapsulated key for use with AES or as input to a KDF
 */
export declare function encapsulate(kyberWasm: LibOQSExports, publicKey: KyberPublicKey, randomizer: Randomizer): KyberEncapsulation;
/**
 * @param kyberWasm the WebAssembly/JsFallback module that implements our kyber primitives (liboqs)
 * @param privateKey      the corresponding private key of the public key with which the encapsulatedKey was encapsulated with
 * @param ciphertext the ciphertext output of encapsulate()
 * @return the plaintext secret key
 */
export declare function decapsulate(kyberWasm: LibOQSExports, privateKey: KyberPrivateKey, ciphertext: Uint8Array): Uint8Array;
export {};
