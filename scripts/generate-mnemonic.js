import WDK from '@tetherto/wdk';

// Generate a random seed phrase
const seedPhrase = WDK.getRandomSeedPhrase();
console.log('Your new wallet mnemonic:');
console.log(seedPhrase);
console.log('\nAdd this to your .env.local file as:');
console.log(`WALLET_MNEMONIC=${seedPhrase}`);