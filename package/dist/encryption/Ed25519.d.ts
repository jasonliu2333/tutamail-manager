import { Ed25519PrivateKey, Ed25519PublicKey, Ed25519Signature } from "./ed25519wasm/crypto_primitives.js";
export { ed25519_generate_keypair as generateEd25519KeyPair, ed25519_sign as signWithEd25519, ed25519_verify as verifyEd25519Signature, Ed25519PrivateKey, Ed25519PublicKey, Ed25519KeyPair, Ed25519Signature, } from "./ed25519wasm/crypto_primitives.js";
export declare function initEd25519(webAssemblySrc: BufferSource | string): Promise<void>;
export declare function bytesToEd25519PublicKey(publicKey: Uint8Array): Ed25519PublicKey;
export declare function ed25519PublicKeyToBytes(publicKey: Ed25519PublicKey): Uint8Array;
export declare function bytesToEd25519PrivateKey(privateKey: Uint8Array): Ed25519PrivateKey;
export declare function ed25519PrivateKeyToBytes(privateKey: Ed25519PrivateKey): Uint8Array;
export declare function bytesToEd25519Signature(signature: Uint8Array): Ed25519Signature;
export declare function ed25519SignatureToBytes(signature: Ed25519Signature): Uint8Array;
