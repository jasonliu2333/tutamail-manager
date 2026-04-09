import type { EntropySource } from "../misc/Constants.js";
/**
 * This Interface provides an abstraction of the random number generator implementation.
 */
export declare class Randomizer {
    random: any;
    constructor();
    /**
     * Adds entropy to the random number generator algorithm
     * @param entropyCache with: number Any number value, entropy The amount of entropy in the number in bit,
     * source The source of the number.
     */
    addEntropy(entropyCache: Array<{
        source: EntropySource;
        entropy: number;
        data: number | Array<number>;
    }>): Promise<void>;
    addStaticEntropy(bytes: Uint8Array): void;
    /**
     * Not used currently because we always have enough entropy using getRandomValues()
     */
    isReady(): boolean;
    /**
     * Generates random data. The function initRandomDataGenerator must have been called prior to the first call to this function.
     * @param nbrOfBytes The number of bytes the random data shall have.
     * @return A hex coded string of random data.
     * @throws {CryptoError} if the randomizer is not seeded (isReady == false)
     */
    generateRandomData(nbrOfBytes: number): Uint8Array;
    /**
     * Generate a number that fits in the range of an n-byte integer
     */
    generateRandomNumber(nbrOfBytes: number): number;
}
export declare const random: Randomizer;
