export default bCrypt;
declare function bCrypt(): void;
declare class bCrypt {
    GENSALT_DEFAULT_LOG2_ROUNDS: number;
    BCRYPT_SALT_LEN: number;
    BLOWFISH_NUM_ROUNDS: number;
    MAX_EXECUTION_TIME: number;
    P_orig: number[];
    S_orig: number[];
    bf_crypt_ciphertext: number[];
    base64_code: string[];
    index_64: number[];
    getByte(c: any): any;
    encode_base64(d: any, len: any): string;
    char64(x: any): number;
    decode_base64(s: any, maxolen: any): any[];
    encipher(lr: any, off: any): void;
    streamtoword(data: any, offp: any): number;
    offp: any;
    init_key(): void;
    P: number[] | undefined;
    S: number[] | undefined;
    key(key: any): void;
    ekskey(data: any, key: any): void;
    crypt_raw(password: any, salt: any, log_rounds: any): any;
}
