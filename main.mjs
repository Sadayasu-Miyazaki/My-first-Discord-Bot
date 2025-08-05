// main.mjs
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

// 環境変数
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // アプリケーションID
const GUILD_ID = process.env.GUILD_ID;   // サーバー（ギルド）ID

// クライアント設定
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// スラッシュコマンド定義
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botが応答します！'),
].map(command => command.toJSON());

// コマンド登録
const rest = new REST({ version: '10' }).setToken(TOKEN);
try {
  console.log('🛠️ スラッシュコマンドを登録中...');
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands },
  );
  console.log('✅ コマンド登録完了');
} catch (error) {
  console.error('❌ コマンド登録失敗:', error);
}

// コマンドの応答処理
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓');
  }
});

// Bot起動
client.once('ready', () => {
  console.log(`🤖 ログイン完了: ${client.user.tag}`);
});
client.login(TOKEN);
