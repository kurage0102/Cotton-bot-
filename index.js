const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// 技の定義 (5択)
const COMMANDS = {
  attack: { label: '⚔ 通常攻撃', style: ButtonStyle.Primary },
  guard: { label: '🛡️ ガード', style: ButtonStyle.Success },
  charge: { label: '⚡ チャージ', style: ButtonStyle.Secondary },
  special: { label: '💥 必殺技(要2チャージ)', style: ButtonStyle.Danger },
  heal: { label: '🍓 回復', style: ButtonStyle.Success },
};

// プレイヤーのデータを保持
const playerHP = new Map();     // 初期HP: 5
const playerCharge = new Map(); // チャージ数

client.on('ready', () => {
  console.log('こっとんバトロワBotが起動したよ！');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!help' || message.content === '!ヘルプ') {
    await message.reply(
      '🌸 **【こっとんチームバトロワの使い方】** 🌸\n' +
      '・`!battle` : 参加者募集を開始します！\n' +
      '・全員参加したら「⚔️ バトル開始！」ボタンを押してね！\n\n' +
      '**【コマンド一覧 (5択)】**\n' +
      '⚔️ **通常攻撃** : 相手を選んで1ダメージ！\n' +
      '🛡️ **ガード** : 通常攻撃を防ぐ！\n' +
      '⚡ **チャージ** : チャージを1溜める\n' +
      '💥 **必殺技** : チャージ2消費で相手を選んで3ダメージ！\n' +
      '🍓 **回復** : HPを1回復（最大5）'
    );
    return;
  }

  if (message.content === '!battle') {
    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_battle')
        .setLabel('✋ 参加する！')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('start_battle')
        .setLabel('⚔️ バトル開始！')
        .setStyle(ButtonStyle.Danger)
    );

    const recruitMsg = await message.channel.send({
      content: '🌸 **【こっとんチームバトロワ 参加者募集中！】** 🌸\n参戦する人は「参加する！」を押してね！みんな集まったら「バトル開始！」を押してスタート！\n\n**現在の参加者:** なし',
      components: [joinRow]
    });

    const participants = new Map();
    const joinCollector = recruitMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000
    });

    joinCollector.on('collect', async (interaction) => {
      if (interaction.customId === 'join_battle') {
        if (!participants.has(interaction.user.id)) {
          participants.set(interaction.user.id, {
            userId: interaction.user.id,
            name: interaction.user.username
          });

          const names = Array.from(participants.values()).map(p => '・' + p.name).join('\n');
          await recruitMsg.edit({
            content: '🌸 **【こっとnチームバトロワ 参加者募集中！】** 🌸\n参戦する人は「参加する！」を押してね！みんな集まったら「バトル開始！」を押してスタート！\n\n**現在の参加者:**\n' + names
          });

          await interaction.reply({ content: 'バトロワに参加登録したよ！', ephemeral: true });
        } else {
          await interaction.reply({ content: 'もうすでに参加登録してるよ！', ephemeral: true });
        }
      }

      if (interaction.customId === 'start_battle') {
        if (participants.size === 0) {
          await interaction.reply({ content: 'まだ誰も参加していないよ！', ephemeral: true });
          return;
        }

        joinCollector.stop('started');
        await interaction.reply({ content: 'バトルを開始します！', ephemeral: true });
      }
    });

    joinCollector.on('end', async (_, reason) => {
      if (reason !== 'started' || participants.size === 0) {
        await recruitMsg.edit({
          content: '誰も参加しなかったか、開始されなかったので募集を終了したよ…(；；)',
          components: []
        });
        return;
      }

      const shuffled = Array.from(participants.values()).sort(() => Math.random() - 0.5);
      const teamRed = [];
      const teamWhite = [];

      shuffled.forEach((p, idx) => {
        if (idx % 2 === 0) teamRed.push(p);
        else teamWhite.push(p);
      });

      const playerTeamMap = new Map();
      teamRed.forEach(p => playerTeamMap.set(p.userId, 'red'));
      teamWhite.forEach(p => playerTeamMap.set(p.userId, 'white'));

      const actionRow = new ActionRowBuilder().addComponents(
        Object.keys(COMMANDS).map((id) =>
          new ButtonBuilder()
            .setCustomId(id)
            .setLabel(COMMANDS[id].label)
            .setStyle(COMMANDS[id].style)
        )
      );

      const redNames = teamRed.map(p => p.name).join(', ') || 'なし';
      const whiteNames = teamWhite.map(p => p.name).join(', ') || 'なし';

      let teamInfoText = '⚔️️ **【チーム決定＆行動選択！】** ⚔️\n\n';
      teamInfoText += '🔴 **【チーム紅】**: ' + redNames + '\n';
      teamInfoText += '⚪ **【チーム白】**: ' + whiteNames + '\n\n';
      teamInfoText += '下のボタンから自分の【行動】を選んでね！（制限時間：30秒）';

      await recruitMsg.edit({
        content: teamInfoText,
        components: [actionRow]
      });

      const choices = new Map();
      const battleCollector = recruitMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000
      });
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// プレイヤーのデータ保持
const playerHP = new Map();
const playerCharge = new Map();

client.on('ready', () => {
  console.log('Botが正常に起動しました！');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!battle') {
    // 参加・開始ボタンの作成
    const btnJoin = new ButtonBuilder()
      .setCustomId('join_battle')
      .setLabel('✋ 参加する！')
      .setStyle(ButtonStyle.Success);

    const btnStart = new ButtonBuilder()
      .setCustomId('start_battle')
      .setLabel('⚔️ バトル開始！')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(btnJoin, btnStart);

    const recruitMsg = await message.channel.send({
      content: '🌸 **【こっとんバトロワ 参加募集！】** 🌸\n「参加する！」を押してエントリーしてね！全員揃ったら「バトル開始！」を押してスタート！\n\n**【現在の参加者】**\nなし',
      components: [row]
    });

    const participants = new Map();
    const collector = recruitMsg.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'join_battle') {
        if (!participants.has(interaction.user.id)) {
          participants.set(interaction.user.id, interaction.user.username);
          
          let pList = '';
          participants.forEach((name) => { pList += '・' + name + '\n'; });

          await recruitMsg.edit({
            content: '🌸 **【こっとんバトロワ 参加募集！】** 🌸\n「参加する！」を押してエントリーしてね！全員揃ったら「バトル開始！」を押してスタート！\n\n**【現在の参加者】**\n' + pList,
            components: [row]
          });

          await interaction.reply({ content: '参加登録したよ！', ephemeral: true });
        } else {
          await interaction.reply({ content: 'もう参加しているよ！', ephemeral: true });
        }
      }

      if (interaction.customId === 'start_battle') {
        if (participants.size === 0) {
          await interaction.reply({ content: 'まだ誰も参加していません！', ephemeral: true });
          return;
        }

        collector.stop('started');

        // バトル開始時のコマンドボタン作成
        const btnAttack = new ButtonBuilder().setCustomId('cmd_attack').setLabel('⚔️ 攻撃').setStyle(ButtonStyle.Primary);
        const btnGuard = new ButtonBuilder().setCustomId('cmd_guard').setLabel('🛡️ ガード').setStyle(ButtonStyle.Success);
        const btnCharge = new ButtonBuilder().setCustomId('cmd_charge').setLabel('⚡ チャージ').setStyle(ButtonStyle.Secondary);
        const btnHeal = new ButtonBuilder().setCustomId('cmd_heal').setLabel('🍓 回復').setStyle(ButtonStyle.Success);

        const battleRow = new ActionRowBuilder().addComponents(btnAttack, btnGuard, btnCharge, btnHeal);

        await recruitMsg.edit({
          content: '⚔️ **【バトルスタート！】** ⚔️\n自分の行動を選んでね！（制限時間: 30秒）',
          components: [battleRow]
        });

        await interaction.reply({ content: 'バトルを開始したよ！', ephemeral: true });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'started') {
        recruitMsg.edit({ content: '募集時間が終了しました！', components: [] });
      }
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
