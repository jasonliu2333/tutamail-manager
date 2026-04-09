import { ConstPtr, Ptr, WASMExports } from "@tutao/tutanota-utils";
import { Aes256Key } from "../../encryption/symmetric/SymmetricCipherUtils.js";
export declare const ARGON2ID_ITERATIONS = 4;
export declare const ARGON2ID_MEMORY_IN_KiB: number;
export declare const ARGON2ID_PARALLELISM = 1;
export declare const ARGON2ID_KEY_LENGTH = 32;
export interface Argon2IDExports extends WASMExports {
    argon2id_hash_raw(t_cost: number, m_cost: number, parallelism: number, pwd: ConstPtr, pwdlen: number, salt: ConstPtr, saltlen: number, hash: Ptr, hashlen: number): number;
}
/**
 * Create a 256-bit symmetric key from the given passphrase.
 * @param argon2 argon2 module exports
 * @param pass The passphrase to use for key generation as utf8 string.
 * @param salt 16 bytes of random data
 * @return resolved with the key
 */
export declare function generateKeyFromPassphrase(argon2: Argon2IDExports, pass: string, salt: Uint8Array): Promise<Aes256Key>;
