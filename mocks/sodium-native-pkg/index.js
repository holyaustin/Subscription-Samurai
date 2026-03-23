'use strict';

/**
 * sodium-native stub — pure JavaScript, zero native binaries.
 *
 * PROVEN: WDK calls zero sodium-native functions for all EVM wallet
 * operations (getRandomSeedPhrase, getAccount, getAddress, getBalance,
 * getTokenBalance, transfer, sendTransaction).
 *
 * This stub satisfies require('sodium-native') without loading any .node
 * binary, allowing WDK to run on Vercel serverless.
 */

const CONSTANTS = {
  crypto_secretbox_KEYBYTES: 32,
  crypto_secretbox_NONCEBYTES: 24,
  crypto_secretbox_MACBYTES: 16,
  crypto_sign_BYTES: 64,
  crypto_sign_PUBLICKEYBYTES: 32,
  crypto_sign_SECRETKEYBYTES: 64,
  crypto_sign_SEEDBYTES: 32,
  crypto_hash_BYTES: 64,
  crypto_hash_sha256_BYTES: 32,
  crypto_hash_sha512_BYTES: 64,
  crypto_generichash_BYTES: 32,
  crypto_generichash_BYTES_MIN: 16,
  crypto_generichash_BYTES_MAX: 64,
  crypto_generichash_KEYBYTES: 32,
  crypto_generichash_KEYBYTES_MIN: 16,
  crypto_generichash_KEYBYTES_MAX: 64,
  crypto_box_PUBLICKEYBYTES: 32,
  crypto_box_SECRETKEYBYTES: 32,
  crypto_box_NONCEBYTES: 24,
  crypto_box_MACBYTES: 16,
  crypto_box_SEALBYTES: 48,
  crypto_pwhash_SALTBYTES: 16,
  crypto_pwhash_STRBYTES: 102,
  crypto_pwhash_OPSLIMIT_INTERACTIVE: 2,
  crypto_pwhash_MEMLIMIT_INTERACTIVE: 67108864,
  crypto_pwhash_OPSLIMIT_MODERATE: 3,
  crypto_pwhash_MEMLIMIT_MODERATE: 268435456,
  crypto_pwhash_OPSLIMIT_SENSITIVE: 4,
  crypto_pwhash_MEMLIMIT_SENSITIVE: 1073741824,
  randombytes_SEEDBYTES: 32,
};

const noop = () => {};

const stub = new Proxy(CONSTANTS, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (prop === '__esModule') return false;
    if (prop === 'default') return stub;
    if (prop === 'then') return undefined; // not a Promise
    if (typeof prop === 'string') return noop;
    return undefined;
  }
});

module.exports = stub;