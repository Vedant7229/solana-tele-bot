const web3 = require('@solana/web3.js');
const fs = require('fs');

const keypair = web3.Keypair.generate();
fs.writeFileSync('bot-wallet.json', JSON.stringify(Array.from(keypair.secretKey)));
console.log("✅ Bot wallet address:", keypair.publicKey.toBase58());
