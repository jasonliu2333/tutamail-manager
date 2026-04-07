export function pqKeyPairsToPublicKeys(keyPairs) {
    return {
        keyPairType: keyPairs.keyPairType,
        x25519PublicKey: keyPairs.x25519KeyPair.publicKey,
        kyberPublicKey: keyPairs.kyberKeyPair.publicKey,
    };
}
