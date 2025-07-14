require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, 'Welcome! Click below to buy SOL using card 💳', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Buy SOL (via Mercuryo)',
            url: 'https://widget.mercuryo.io/?wallet=Fhtx2HLz4CFmXoWZ3Lm4B51QVDVULmqTrPfVSPoAQBLo&crypto=SOL'
          }
        ]
      ]
    }
  });
});
