require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
console.log("✅ Using bot token:", token);

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ Bot is alive!");
});

bot.on("polling_error", (err) => console.error("Polling error:", err));

