import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel], // DMを受信するために必要
});

client.on('ready', () => {
  console.log(`${client.user.tag} でログインしました`);
});

client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;

  try {
    // DM送信開始
    await member.send('サーバー参加ありがとうございます！いくつか質問させてください。');

    // 名前を聞く
    await member.send('① あなたの名前を教えてください（本名じゃなくてもOK）');
    const nameCollected = await member.dmChannel.awaitMessages({
      filter: m => m.author.id === member.id,
      max: 1,
      time: 60000
    });
    const userName = nameCollected.first()?.content || '未回答';

    // 津賀田中学校の生徒か確認
    await member.send('② あなたは津賀田中学校の生徒ですか？「はい」か「いいえ」で答えてください。');
    const schoolCollected = await member.dmChannel.awaitMessages({
      filter: m => m.author.id === member.id,
      max: 1,
      time: 60000
    });
    const isTsugada = schoolCollected.first()?.content.toLowerCase();

    if (isTsugada !== 'はい') {
      await member.send('申し訳ありませんが、津賀田中学校の生徒のみ参加できます。');
      await member.kick('津賀田中学校の生徒ではないためキック');
      return;
    }

    // クラスを聞く
    await member.send('③ あなたのクラスを教えてください（例：1組, 2組, 3組, 4組）');
    const classCollected = await member.dmChannel.awaitMessages({
      filter: m => m.author.id === member.id,
      max: 1,
      time: 60000
    });
    const classRaw = classCollected.first()?.content || '';
    const classNum = classRaw.replace(/[^0-9]/g, ''); // 数字だけ抽出

    // クラスに応じてロールを付与（ロール名は "1", "2", "3", "4"）
    const role = member.guild.roles.cache.find(r => r.name === classNum);
    if (role) {
      await member.roles.add(role);
    } else {
      await member.send(`指定されたクラス「${classRaw}」に対応するロールが見つかりませんでした。管理者に連絡してください。(ID:taiboku_passent)`);
    }

    // 管理者にアンケート結果を送信
    const adminUser = await client.users.fetch(ADMIN_USER_ID);
    await adminUser.send(
      `新しいメンバーが参加しました：\n` +
      `名前：${userName}\n` +
      `津賀田中学校生：${isTsugada}\n` +
      `クラス：${classRaw}`
    );

    await member.send('登録ありがとうございます！設定が完了しました。');

  } catch (err) {
    console.error('エラー:', err);
    try {
      await member.send('処理中にエラーが発生しました。管理者に連絡してください。(ID:taiboku_passent)');
    } catch (_) {}
  }
});

client.login(DISCORD_TOKEN);
