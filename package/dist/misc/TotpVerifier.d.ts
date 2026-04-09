export declare let DIGITS: number;
export type Base32 = string;
export type TotpSecret = {
    key: Uint8Array;
    readableKey: Base32;
};
export declare class TotpVerifier {
    _digits: number;
    constructor(digits?: number);
    generateSecret(): TotpSecret;
    /**
     * This method generates a TOTP value for the given
     * set of parameters.
     *
     * @param time : a value that reflects a time
     * @param key  :  the shared secret. It is generated if it does not exist
     * @return: the key and a numeric String in base 10 that includes truncationDigits digits
     */
    generateTotp(time: number, key: Uint8Array): number;
    hmac_sha(key: Uint8Array, text: Uint8Array): Uint8Array;
    static readableKey(key: Uint8Array): Base32;
}
