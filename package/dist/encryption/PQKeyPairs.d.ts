import { X25519KeyPair, X25519PublicKey } from "./X25519.js";
import { KyberKeyPair, KyberPublicKey } from "./Liboqs/KyberKeyPair.js";
import { AbstractKeyPair, AbstractPublicKey } from "./AsymmetricKeyPair.js";
export type PQKeyPairs = AbstractKeyPair & {
    x25519KeyPair: X25519KeyPair;
    kyberKeyPair: KyberKeyPair;
};
export type PQPublicKeys = AbstractPublicKey & {
    x25519PublicKey: X25519PublicKey;
    kyberPublicKey: KyberPublicKey;
};
export declare function pqKeyPairsToPublicKeys(keyPairs: PQKeyPairs): PQPublicKeys;
