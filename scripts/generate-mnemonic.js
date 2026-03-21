/**
 * scripts/generate-mnemonic.js
 *
 * Generates a new BIP-39 wallet seed phrase and prints it.
 * Run with: node scripts/generate-mnemonic.js
 *
 * WDK API (per docs):
 *   WalletManagerEvm.getRandomSeedPhrase()         → 12-word phrase (string)
 *   WalletManagerEvm.getRandomSeedPhrase(24)        → 24-word phrase (string)
 *   WalletManagerEvm.isValidSeedPhrase(phrase)      → boolean
 */

'use strict';

const WalletManagerEvm = require('@tetherto/wdk-wallet-evm');

// Docs: static method — returns a random 12-word BIP-39 mnemonic
const seedPhrase = WalletManagerEvm.getRandomSeedPhrase();

// Validate it (docs: static boolean check)
const isValid = WalletManagerEvm.isValidSeedPhrase(seedPhrase);

console.log('\n🔑  Your new 12-word wallet seed phrase:');
console.log('   ', seedPhrase);
console.log('\n✅  Valid BIP-39 phrase:', isValid);
console.log('\n📋  Add this to your .env.local:');
console.log(`   WALLET_MNEMONIC=${seedPhrase}`);
console.log('\n⚠️   KEEP THIS SECRET. Anyone with this phrase controls your funds.\n');
