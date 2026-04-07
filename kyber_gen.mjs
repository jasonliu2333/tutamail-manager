import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  generateKeyPairKyber,
  random,
} from "./package/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const bytesToB64 = (value) => Buffer.from(value).toString("base64");

const run = async () => {
  const wasmPath = resolve(__dirname, "liboqs.wasm");
  const wasmBytes = await readFile(wasmPath);
  const wasm = (await WebAssembly.instantiate(wasmBytes)).instance.exports;

  random.addStaticEntropy(randomBytes(256));
  const keyPair = generateKeyPairKyber(wasm, random);
  const pub = keyPair?.publicKey?.raw;
  const priv = keyPair?.privateKey?.raw;

  if (!(pub instanceof Uint8Array) || !(priv instanceof Uint8Array)) {
    throw new Error("generateKeyPairKyber returned invalid key pair");
  }
  if (pub.length !== 1568 || priv.length !== 3168) {
    throw new Error(`Kyber key length mismatch pub=${pub.length} priv=${priv.length}`);
  }

  process.stdout.write(
    JSON.stringify({
      pub: bytesToB64(pub),
      priv: bytesToB64(priv),
    }),
  );
};

run().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
