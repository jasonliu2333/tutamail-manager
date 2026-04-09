/**
 * @returns {Ed25519KeyPair}
 */
export function ed25519_generate_keypair(): Ed25519KeyPair;
/**
 * @param {Ed25519PrivateKey} private_key
 * @param {Uint8Array} message
 * @returns {Ed25519Signature}
 */
export function ed25519_sign(private_key: Ed25519PrivateKey, message: Uint8Array): Ed25519Signature;
/**
 * @param {Ed25519PublicKey} public_key
 * @param {Uint8Array} message
 * @param {Ed25519Signature} signature
 * @returns {boolean}
 */
export function ed25519_verify(public_key: Ed25519PublicKey, message: Uint8Array, signature: Ed25519Signature): boolean;
export default __wbg_init;
export function initSync(module: any): any;
declare function __wbg_init(module_or_path: any): Promise<any>;
