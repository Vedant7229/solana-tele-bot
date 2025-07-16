const fs = require('fs');
const web3 = require('@solana/web3.js');

const secret = JSON.parse(fs.readFileSync('bot-wallet.json'));
const keypair = web3.Keypair.fromSecretKey(Uint8Array.from(secret));
console.log('Bot public key:', keypair.publicKey.toBase58());
