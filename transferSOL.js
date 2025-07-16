const web3 = require('@solana/web3.js');
const fs = require('fs');

async function transferSOL(toAddress, amountSol) {
  const secret = JSON.parse(fs.readFileSync('bot-wallet.json'));
  const fromKeypair = web3.Keypair.fromSecretKey(Uint8Array.from(secret));

  // Connect to Solana mainnet or devnet
  const connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'confirmed');

  const toPublicKey = new web3.PublicKey(toAddress);
  const lamports = amountSol * web3.LAMPORTS_PER_SOL;

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports: lamports,
    })
  );

  // Send transaction
  const signature = await web3.sendAndConfirmTransaction(connection, transaction, [fromKeypair]);

  console.log(`✅ Sent ${amountSol} SOL to ${toAddress}`);
  console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  return signature;
}

module.exports = transferSOL;
