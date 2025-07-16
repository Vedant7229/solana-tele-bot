require('dotenv').config();
const ADMIN_USERNAMES = ['BeastBurner']; // replace with your real one

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const { transferSOL, getBotPublicKey } = require('./solana');
const axios = require('axios'); // make sure it's installed

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const USERS_FILE = 'user.json';

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    const data = fs.readFileSync(USERS_FILE);
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading users:', err);
    return {};
  }
}

function saveUsers(data) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

bot.on('message', (msg) => {
  console.log('General message received:', msg.text, 'from', msg.from ? msg.from.username : 'unknown');
});

bot.onText(/\/start/, (msg) => {
  console.log('Received /start command from', msg.from.username);
  const chatId = msg.chat.id;
  const welcomeMessage = `🏓 *Hey there!* I'm alive and ready to help you! 🎉

Here are some commands to get you started:
1️⃣ /register - Register your Phantom wallet address
2️⃣ /deposit - Deposit SOL to your Phantom wallet
3️⃣ /withdraw - Withdraw SOL from your Phantom wallet
4️⃣ /balance - Check your Phantom wallet balance
5️⃣ /help - Get help
6️⃣ /admin - Admin commands (if you have access)

_Type a command to get started!_`;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/register/, (msg) => {
  console.log('Received /register command from', msg.from.username);
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!username) {
    console.log('No username found for user trying to register');
    return bot.sendMessage(chatId, '❌ You need a Telegram username to register.');
  }

  const users = loadUsers();
  if (users[username]) {
    return bot.sendMessage(chatId, '⚠️ *You are already registered.*', { parse_mode: 'Markdown' });
  }

  users[username] = { wallet: null, balance: 0, chatId };
  saveUsers(users);
  bot.sendMessage(chatId, '✅ *Registered!* Now send your Phantom wallet address.', { parse_mode: 'Markdown' });
});

bot.on('message', (msg) => {
  console.log('Received message:', msg.text, 'from', msg.from.username);
  const chatId = msg.chat.id;
  const username = msg.from.username;
  const text = msg.text;

  if (!username || text.startsWith('/')) return;

  const users = loadUsers();
  if (users[username] && !users[username].wallet) {
    users[username].wallet = text.trim();
    saveUsers(users);
    return bot.sendMessage(chatId, `✅ Wallet address saved: ${text}`);
  }
});

const { connection } = require('./solana');
const web3 = require('@solana/web3.js');

bot.onText(/\/balance/, async (msg) => {
  const username = msg.from.username;
  console.log(`Received /balance command from user: ${username}`);
  const users = loadUsers();
  const user = users[username];
  console.log(`Loaded user data: ${JSON.stringify(user)}`);

  if (!user) {
    console.log(`User ${username} not found in user.json`);
    return bot.sendMessage(msg.chat.id, '❌ You are not registered.');
  }
  if (!user.wallet) {
    console.log(`User ${username} has no wallet set`);
    return bot.sendMessage(msg.chat.id, '❌ Wallet address not set.');
  }

  try {
    console.log(`Fetching balance for wallet: ${user.wallet}`);
    const balanceLamports = await connection.getBalance(new web3.PublicKey(user.wallet));
    const balanceSol = balanceLamports / web3.LAMPORTS_PER_SOL;
    console.log(`Balance for user ${username}: ${balanceSol} SOL`);
    bot.sendMessage(msg.chat.id, `💰 Balance: ${balanceSol.toFixed(4)} SOL`);
  } catch (error) {
    console.error('Error fetching balance:', error);
    bot.sendMessage(msg.chat.id, '❌ Failed to fetch balance.');
  }
});

bot.onText(/\/deposit/, (msg) => {
  bot.sendMessage(msg.chat.id, `📥 Send SOL to this address:\n\`${getBotPublicKey()}\`\n\nUse \`/balance\` to check your balance after deposit (manual update for now).`, { parse_mode: 'Markdown' });
});

bot.onText(/\/withdraw (.+)/, async (msg, match) => {
  const username = msg.from.username;
  const amount = parseFloat(match[1]);
  const users = loadUsers();
  const user = users[username];

  if (!user || !user.wallet) return bot.sendMessage(msg.chat.id, '❌ *You are not registered or wallet not set.*', { parse_mode: 'Markdown' });
  if (user.balance < amount) return bot.sendMessage(msg.chat.id, '❌ *Insufficient balance.*', { parse_mode: 'Markdown' });

  try {
    const sig = await transferSOL(user.wallet, amount);
    user.balance -= amount;
    saveUsers(users);
    bot.sendMessage(msg.chat.id, `✅ *Sent ${amount} SOL to your wallet.*\n🔗 [View Transaction](https://explorer.solana.com/tx/${sig}?cluster=devnet)`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(err);
    bot.sendMessage(msg.chat.id, '❌ *Withdrawal failed.*', { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/send @(\w+) ([\d.]+)/, (msg, match) => {
  const fromUser = msg.from.username;
  const toUser = match[1];
  const amount = parseFloat(match[2]);

  const users = loadUsers();
  if (!users[fromUser] || users[fromUser].balance < amount) {
    return bot.sendMessage(msg.chat.id, '❌ Insufficient balance or not registered.');
  }
  if (!users[toUser]) {
    return bot.sendMessage(msg.chat.id, `❌ User @${toUser} not found.`);
  }

  users[fromUser].balance -= amount;
  users[toUser].balance += amount;
  saveUsers(users);

  bot.sendMessage(msg.chat.id, `✅ Sent ${amount} SOL to @${toUser}`);
  bot.sendMessage(users[toUser].chatId, `📩 You received ${amount} SOL from @${fromUser}`);
});

// claim
bot.onText(/\/claim/, async (msg) => {
  const username = msg.from.username;
  console.log(`Claim requested by user: ${username}`);
  const users = loadUsers();
  const user = users[username];
  console.log(`User data: ${JSON.stringify(user)}`);

  if (!user || !user.wallet) {
    console.log('User not registered or wallet not set');
    return bot.sendMessage(msg.chat.id, '❌ You must register and set a wallet first.');
  }

  const botPubKey = getBotPublicKey();
  console.log(`Bot public key: ${botPubKey}`);

  const sigs = await connection.getSignaturesForAddress(
    new web3.PublicKey(botPubKey), { limit: 100 }
  );
  console.log(`Signatures fetched: ${sigs.length}`);
  console.log('Signatures:', sigs.map(s => s.signature));

  for (const sig of sigs) {
    const tx = await connection.getTransaction(sig.signature, { commitment: "confirmed" });
    console.log(`Transaction fetched: ${sig.signature}`);

    if (!tx?.meta?.postBalances || !tx.transaction?.message?.accountKeys) {
      console.log('Transaction missing postBalances or accountKeys');
      continue;
    }

    const sender = tx.transaction.message.accountKeys[0].toBase58();
    const receiver = tx.transaction.message.accountKeys[1].toBase58();
    console.log(`Sender: ${sender}, Receiver: ${receiver}`);

    // If user sent funds to bot
    if (sender === user.wallet && receiver === botPubKey) {
      const lamportsReceived = tx.meta.postBalances[1] - tx.meta.preBalances[1];
      const sol = lamportsReceived / web3.LAMPORTS_PER_SOL;
      console.log(`Lamports received: ${lamportsReceived}, SOL: ${sol}`);

      if (sol > 0) {
        user.balance += sol;
        saveUsers(users);
        return bot.sendMessage(msg.chat.id, `✅ Claimed ${sol.toFixed(4)} SOL!`);
      }
    }
  }

  bot.sendMessage(msg.chat.id, `⚠️ No deposit found to claim.`);
});

bot.onText(/\/menu/, (msg) => {
  console.log('Received /menu command from', msg.from.username);
  const chatId = msg.chat.id;
  const menuMessage = `📋 *Main Menu*

Here are the commands you can use:
🔹 /register - Register your Phantom wallet address
🔹 /deposit - Deposit SOL to your Phantom wallet
🔹 /withdraw - Withdraw SOL from your Phantom wallet
🔹 /balance - Check your Phantom wallet balance
🔹 /help - Get help
🔹 /admin - Admin commands (if you have access)

_Type a command to proceed._`;

  bot.sendMessage(chatId, menuMessage, { parse_mode: 'Markdown' });
});

// Added new /help command
bot.onText(/\/help/, (msg) => {
  console.log('Received /help command from', msg.from.username);
  const chatId = msg.chat.id;
  const helpMessage = `🆘 *Help Menu*

Here are the commands you can use:
🔹 /start - Start the bot and see welcome message
🔹 /register - Register your Phantom wallet address
🔹 /deposit - Deposit SOL to your Phantom wallet
🔹 /withdraw - Withdraw SOL from your Phantom wallet
🔹 /balance - Check your Phantom wallet balance
🔹 /send @username amount - Send SOL to another user
🔹 /claim - Claim your deposited SOL
🔹 /swap - Swap 1 SOL to another token
🔹 /menu - Show the main menu
🔹 /admin - Admin commands (if you have access)

_Type a command to proceed._`;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});
//swap
bot.onText(/\/swap/, async (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, '🔁 Enter token symbol to swap 1 SOL into (e.g., USDC, BONK):');

  bot.once('message', async (reply) => {
    const symbol = reply.text.trim().toUpperCase();
    const tokenList = await axios.get('https://token.jup.ag/all');
    const token = tokenList.data.find(t => t.symbol === symbol);

    if (!token) {
      return bot.sendMessage(chatId, `❌ Token "${symbol}" not found.`);
    }

    const quote = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: token.address,
        amount: 1_000_000_000, // 1 SOL
        slippage: 1,
      }
    });

    const outAmount = quote.data.outAmount / (10 ** token.decimals);
    bot.sendMessage(chatId, `💱 1 SOL ≈ ${outAmount.toFixed(4)} ${symbol}`);
  });
});

bot.onText(/\/admin (.+)/, (msg, match) => {
  const username = msg.from.username;
  const command = match[1];

  if (!ADMIN_USERNAMES.includes(username)) {
    return bot.sendMessage(msg.chat.id, '🚫 *Unauthorized.*', { parse_mode: 'Markdown' });
  }

  const users = loadUsers();
  if (command === 'users') {
    const list = Object.entries(users).map(
      ([u, d]) => `@${u} — ${d.balance} SOL`
    ).join('\n');
    return bot.sendMessage(msg.chat.id, `👥 *Registered Users:*\n${list}`, { parse_mode: 'Markdown' });
  }

  bot.sendMessage(msg.chat.id, '❓ *Unknown admin command.*', { parse_mode: 'Markdown' });
});

bot.onText(/\/mywallet/, (msg) => {
  console.log('Received /mywallet command');
  const username = msg.from.username;
  console.log(`Username: ${username}`);
  const users = loadUsers();
  const user = users[username];
  console.log(`User data: ${JSON.stringify(user)}`);

  if (!user) {
    console.log('User not found');
    return bot.sendMessage(msg.chat.id, '❌ You are not registered.');
  }
  if (!user.wallet) {
    console.log('Wallet not set');
    return bot.sendMessage(msg.chat.id, '❌ Wallet address not set.');
  }

  bot.sendMessage(msg.chat.id, `🔑 Your registered wallet address is:\n${user.wallet}`);
});
