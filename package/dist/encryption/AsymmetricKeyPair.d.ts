import { RsaX25519KeyPair, RsaX25519PublicKey, RsaKeyPair, RsaPublicKey } from "./RsaKeyPair.js";
import { PQKeyPairs, PQPublicKeys } from "./PQKeyPairs.js";
import { Versioned } from "@tutao/tutanota-utils";
export declare enum KeyPairType {
    RSA = 0,
    RSA_AND_X25519 = 1,
    TUTA_CRYPT = 2
}
export type AsymmetricKeyPair = RsaKeyPair | RsaX25519KeyPair | PQKeyPairs;
export type AbstractKeyPair = {
    keyPairType: KeyPairType;
};
export type PublicKey = RsaPublicKey | RsaX25519PublicKey | PQPublicKeys;
export type AbstractPublicKey = {
    keyPairType: KeyPairType;
};
export declare function isPqKeyPairs(keyPair: AbstractKeyPair): keyPair is PQKeyPairs;
export declare function isRsaOrRsaX25519KeyPair(keyPair: AbstractKeyPair): keyPair is RsaKeyPair;
export declare function isRsaX25519KeyPair(keyPair: AbstractKeyPair): keyPair is RsaX25519KeyPair;
export declare function isPqPublicKey(publicKey: AbstractPublicKey): publicKey is PQPublicKeys;
export declare function isVersionedPqPublicKey(versionedPublicKey: Versioned<PublicKey>): versionedPublicKey is Versioned<PQPublicKeys>;
export declare function isRsaPublicKey(publicKey: AbstractPublicKey): publicKey is RsaPublicKey;
export declare function isVersionedRsaPublicKey(versionedPublicKey: Versioned<PublicKey>): versionedPublicKey is Versioned<RsaPublicKey>;
export declare function isRsaX25519PublicKey(publicKey: AbstractPublicKey): publicKey is RsaX25519PublicKey;
export declare function isVersionedRsaX25519PublicKey(versionedPublicKey: Versioned<PublicKey>): versionedPublicKey is Versioned<RsaX25519PublicKey>;
export declare function isVersionedRsaOrRsaX25519PublicKey(versionedPublicKey: Versioned<PublicKey>): versionedPublicKey is Versioned<RsaPublicKey>;
