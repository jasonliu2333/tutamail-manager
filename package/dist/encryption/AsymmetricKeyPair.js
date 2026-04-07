export var KeyPairType;
(function (KeyPairType) {
    KeyPairType[KeyPairType["RSA"] = 0] = "RSA";
    KeyPairType[KeyPairType["RSA_AND_X25519"] = 1] = "RSA_AND_X25519";
    KeyPairType[KeyPairType["TUTA_CRYPT"] = 2] = "TUTA_CRYPT";
})(KeyPairType || (KeyPairType = {}));
export function isPqKeyPairs(keyPair) {
    return keyPair.keyPairType === KeyPairType.TUTA_CRYPT;
}
export function isRsaOrRsaX25519KeyPair(keyPair) {
    return keyPair.keyPairType === KeyPairType.RSA || keyPair.keyPairType === KeyPairType.RSA_AND_X25519;
}
export function isRsaX25519KeyPair(keyPair) {
    return keyPair.keyPairType === KeyPairType.RSA_AND_X25519;
}
export function isPqPublicKey(publicKey) {
    return publicKey.keyPairType === KeyPairType.TUTA_CRYPT;
}
export function isVersionedPqPublicKey(versionedPublicKey) {
    return isPqPublicKey(versionedPublicKey.object);
}
export function isRsaPublicKey(publicKey) {
    return publicKey.keyPairType === KeyPairType.RSA;
}
export function isVersionedRsaPublicKey(versionedPublicKey) {
    return isRsaPublicKey(versionedPublicKey.object);
}
export function isRsaX25519PublicKey(publicKey) {
    return publicKey.keyPairType === KeyPairType.RSA_AND_X25519;
}
export function isVersionedRsaX25519PublicKey(versionedPublicKey) {
    return isRsaX25519PublicKey(versionedPublicKey.object);
}
export function isVersionedRsaOrRsaX25519PublicKey(versionedPublicKey) {
    return isVersionedRsaPublicKey(versionedPublicKey) || isVersionedRsaX25519PublicKey(versionedPublicKey);
}
