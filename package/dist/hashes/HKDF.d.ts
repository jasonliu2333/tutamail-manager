/**
 * Derives a key of a defined length from salt, inputKeyMaterial and info.
 *@param  salt – the salt to use, may be null for a salt for hashLen zeros
 * @return the derived salt
 */
export declare function hkdf(salt: Uint8Array | null, inputKeyMaterial: Uint8Array, info: Uint8Array, lengthInBytes: number): Uint8Array;
