import {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS.split(',');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const commands = [
  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('ChatGPTと会話します')
    .addStringOption(option =>
      option.setName('message').setDescription('話しかける内容').setRequired(true)
    ),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`${client.user.tag} でログインしました`);

  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('✅ /chat コマンドを登録しました');
  } catch (error) {
    console.error('❌ コマンド登録に失敗:', error);
  }
});

client.on('messageCreate', async message => {
  if (message.channel.type !== 1) return;
  if (message.author.bot) return;
  if (!ADMIN_USER_IDS.includes(message.author.id)) return;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const announceChannel = guild.channels.cache.find(
      ch => ch.name === '┠📢｜お知らせ' && ch.isTextBased()
    );

    if (announceChannel) {
      await announceChannel.send(`📢 管理者からのお知らせ:\n${message.content}`);
    } else {
      console.error('「┠📢｜お知らせ」チャンネルが見つかりませんでした。');
    }
  } catch (err) {
    console.error('お知らせ送信エラー:', err);
  }
});

client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;

  try {
    const pendingRole = member.guild.roles.cache.find(r => r.name === '審査待ち');
    if (pendingRole) await member.roles.add(pendingRole);

    const welcomeChannel = member.guild.channels.cache.find(
      ch => ch.name === '┠🤗｜ようこそ！' && ch.isTextBased()
    );
    if (welcomeChannel) {
      await welcomeChannel.send(`ようこそ！${member} さんが参加しました！🎉`);
    }

    await member.send('サーバー参加ありがとうございます！いくつか質問させてください。');

    await member.send('① あなたの名前を教えてください（本名じゃなくてもOK）');
    const nameCollected = await member.dmChannel.awaitMessages({
      filter: m => m.author.id === member.id,
      max: 1,
      time: 180000,
    });
    const userName = nameCollected.first()?.content || '未回答';

    await member.send('② あなたは津賀田中学校の生徒ですか？「はい」か「いいえ」で答えてください。');
    const schoolCollected = await member.dmChannel.awaitMessages({
      filter: m => m.author.id === member.id,
      max: 1,
      time: 180000,
    });
    const isTsugada = schoolCollected.first()?.content.toLowerCase();

    if (isTsugada !== 'はい') {
      await member.send('申し訳ありませんが、津賀田中学校の生徒のみ参加できます。');
      await member.kick('津賀田中学校の生徒ではないためキック');
      return;
    }

    await member.send('③ あなたのクラスを選んでください：');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('class_1').setLabel('1組').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('class_2').setLabel('2組').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('class_3').setLabel('3組').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('class_4').setLabel('4組').setStyle(ButtonStyle.Primary),
    );

    const classMsg = await member.send({
      content: '下のボタンからクラスを選んでください。',
      components: [row],
    });

    const collector = classMsg.createMessageComponentCollector({
      filter: interaction => interaction.user.id === member.id,
      time: 180000,
      max: 1,
    });

    collector.on('collect', async interaction => {
      const classNum = interaction.customId.split('_')[1];
      const classRole = member.guild.roles.cache.find(r => r.name === classNum);

      if (classRole) {
        await member.roles.add(classRole);
        await interaction.reply({ content: `${classNum}組のロールを付与しました。`, ephemeral: true });
      } else {
        await interaction.reply({ content: `ロール「${classNum}」が見つかりません。`, ephemeral: true });
      }

      if (pendingRole) await member.roles.remove(pendingRole);

      for (const adminId of ADMIN_USER_IDS) {
        const adminUser = await client.users.fetch(adminId);
        await adminUser.send(
          `新しいメンバーが参加しました：\n` +
          `名前：${userName}\n` +
          `津賀田中学校生：${isTsugada}\n` +
          `クラス：${classNum}組`
        );
      }

      await member.send('登録ありがとうございます！設定が完了しました。');
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        member.send('時間切れのためクラス選択がキャンセルされました。もう一度やり直してください。');
      }
    });
  } catch (err) {
    console.error('エラー:', err);
    try {
      await member.send('エラーが発生しました。管理者に連絡してください。');
    } catch (_) {}
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'chat') return;

  const userMessage = interaction.options.getString('message');
  await interaction.deferReply();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: userMessage }],
    });

    const replyText = response.choices[0].message.content;
    await interaction.editReply(replyText || '（空の返答）');
  } catch (err) {
    console.error('OpenAIエラー:', err);
    await interaction.editReply('ChatGPTとの通信中にエラーが発生しました。');
  }
});

client.login(DISCORD_TOKEN);
