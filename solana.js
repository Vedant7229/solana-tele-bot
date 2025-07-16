const fs = require('fs');
const web3 = require('@solana/web3.js');

const secret = JSON.parse(fs.readFileSync('bot-wallet.json'));
const botKeypair = web3.Keypair.fromSecretKey(Uint8Array.from(secret));
const connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'confirmed');

const getBotPublicKey = () => botKeypair.publicKey.toBase58();

async function transferSOL(destination, amountInSol) {
  const lamports = amountInSol * web3.LAMPORTS_PER_SOL;

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.transfer({
      fromPubkey: botKeypair.publicKey,
      toPubkey: new web3.PublicKey(destination),
      lamports,
    })
  );

  const signature = await web3.sendAndConfirmTransaction(connection, transaction, [botKeypair]);
  return signature;
}

module.exports = {
  connection,
  transferSOL,
  getBotPublicKey,
};
