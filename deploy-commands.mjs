// deploy-commands.mjs
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botの応答速度をチェックします'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log('📡 スラッシュコマンド登録中...');
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.APPLICATION_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );
  console.log('✅ 登録完了！');
} catch (error) {
  console.error('❌ エラー:', error);
}
