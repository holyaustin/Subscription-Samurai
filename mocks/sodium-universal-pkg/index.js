'use strict';

/**
 * sodium-universal stub — pure JavaScript, named exports matching what
 * @tetherto/wdk-wallet-evm/src/memory-safe/signing-key.js imports.
 *
 * WDK imports { sodium_memzero } from 'sodium-universal' for memory cleanup
 * of private keys. It is called as sodium_memzero(buffer) to zero out memory.
 * We replace it with a no-op — the buffer isn't zeroed but no security issue
 * for a demo/hackathon project running on a server you control.
 */

// All function stubs as named exports (ESM named import compatible)
const sodium_memzero       = (buf) => { if (buf && buf.fill) buf.fill(0); };
const sodium_mlock         = () => {};
const sodium_munlock       = () => {};
const sodium_malloc        = (size) => Buffer.alloc(size);
const sodium_free          = () => {};
const randombytes_buf      = (buf) => { if (buf && buf.fill) { const r = require('crypto').randomBytes(buf.length); r.copy(buf); } };
const crypto_sign_seed_keypair = () => {};
const crypto_sign_detached     = () => {};
const crypto_sign_verify_detached = () => false;
const crypto_generichash   = () => {};
const crypto_secretbox_easy = () => {};
const crypto_secretbox_open_easy = () => false;
const crypto_hash_sha256   = () => {};
const crypto_hash_sha512   = () => {};

// Constants
const crypto_sign_BYTES           = 64;
const crypto_sign_PUBLICKEYBYTES  = 32;
const crypto_sign_SECRETKEYBYTES  = 64;
const crypto_sign_SEEDBYTES       = 32;
const crypto_generichash_BYTES    = 32;
const crypto_generichash_KEYBYTES = 32;
const crypto_secretbox_KEYBYTES   = 32;
const crypto_secretbox_NONCEBYTES = 24;
const crypto_secretbox_MACBYTES   = 16;
const crypto_hash_sha256_BYTES    = 32;
const crypto_hash_sha512_BYTES    = 64;
const randombytes_SEEDBYTES       = 32;

module.exports = {
  // Named exports that WDK uses
  sodium_memzero,
  sodium_mlock,
  sodium_munlock,
  sodium_malloc,
  sodium_free,
  randombytes_buf,
  crypto_sign_seed_keypair,
  crypto_sign_detached,
  crypto_sign_verify_detached,
  crypto_generichash,
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  crypto_hash_sha256,
  crypto_hash_sha512,
  // Constants
  crypto_sign_BYTES,
  crypto_sign_PUBLICKEYBYTES,
  crypto_sign_SECRETKEYBYTES,
  crypto_sign_SEEDBYTES,
  crypto_generichash_BYTES,
  crypto_generichash_KEYBYTES,
  crypto_secretbox_KEYBYTES,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_MACBYTES,
  crypto_hash_sha256_BYTES,
  crypto_hash_sha512_BYTES,
  randombytes_SEEDBYTES,
};