/**
 * The version of the symmetric cipher.
 * Must fit into 1 byte, so 255 is the maximum allowed enum value.
 */
export var SymmetricCipherVersion;
(function (SymmetricCipherVersion) {
    SymmetricCipherVersion[SymmetricCipherVersion["UnusedReservedUnauthenticated"] = 0] = "UnusedReservedUnauthenticated";
    SymmetricCipherVersion[SymmetricCipherVersion["AesCbcThenHmac"] = 1] = "AesCbcThenHmac";
    SymmetricCipherVersion[SymmetricCipherVersion["Aead"] = 2] = "Aead";
})(SymmetricCipherVersion || (SymmetricCipherVersion = {}));
/**
 * Get the SymmetricCipherVersion from either the version byte or the full ciphertext
 */
export function getSymmetricCipherVersion(ciphertext) {
    // we always have an even number of bytes because the block size and the mac tag size are even
    // we prepend an additional version byte of one byte if we have a mac
    // therefore we will only have an odd number of bytes if there is a mac
    if (ciphertext.length % 2 === 1) {
        const versionByte = ciphertext[0];
        if (Object.values(SymmetricCipherVersion).includes(versionByte)) {
            return versionByte;
        }
        throw new Error("invalid cipher version");
    }
    else {
        return SymmetricCipherVersion.UnusedReservedUnauthenticated;
    }
}
/**
 * Get a byte array of length 1 that holds the provided version byte.
 */
export function symmetricCipherVersionToUint8Array(version) {
    return Uint8Array.from([version.valueOf()]);
}
