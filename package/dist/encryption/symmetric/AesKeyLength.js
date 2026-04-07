import { CryptoError } from "../../misc/CryptoError.js";
export var AesKeyLength;
(function (AesKeyLength) {
    AesKeyLength[AesKeyLength["Aes128"] = 128] = "Aes128";
    AesKeyLength[AesKeyLength["Aes256"] = 256] = "Aes256";
})(AesKeyLength || (AesKeyLength = {}));
const ACCEPTED_BIT_LENGTHS = Object.keys(AesKeyLength).map((key) => {
    // @ts-ignore
    return AesKeyLength[key];
});
export function getKeyLengthInBytes(keyLength) {
    return keyLength / 8;
}
export function getAndVerifyAesKeyLength(key, acceptedBitLengths = ACCEPTED_BIT_LENGTHS) {
    // AesKey is an array of 4 byte numbers. therefore converting the length to bits means 4*8
    const keyLength = key.length * 4 * 8;
    if (acceptedBitLengths.includes(keyLength)) {
        return keyLength;
    }
    else {
        throw new CryptoError(`Illegal key length: ${keyLength} (expected: ${acceptedBitLengths})`);
    }
}
