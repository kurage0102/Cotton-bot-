const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// 技の定義 (5択)
const COMMANDS = {
  attack: { label: '⚔️ 通常攻撃', style: ButtonStyle.Primary },
  guard: { label: '🛡️ ガード', style: ButtonStyle.Success },
  charge: { label: '⚡ チャージ', style: ButtonStyle.Secondary },
  special: { label: '💥 必殺技(要2チャージ)', style: ButtonStyle.Danger },
  heal: { label: '🍓 回復', style: ButtonStyle.Success },
};

// プレイヤーのデータを保持
const playerHP = new Map();     // 初期HP: 5
const playerCharge = new Map(); // チャージ数

client.on('ready', () => {
  console.log(`こっとんバトロワBotが起動したよ！: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!help' || message.content === '!ヘルプ') {
    await message.reply(
      '🌸 **【こっとんチームバトロワの使い方】** 🌸\n' +
      '・`!battle` : 参加者募集を開始します！\n' +
      '・全員参加したら「⚔️ バトル開始！」ボタンを押してね！\n\n' +
      '**【コマンド一覧 (5択)】**\n' +
      '⚔️ **通常攻撃** : 相手に1ダメージ\n' +
      '🛡️ **ガード** : 通常攻撃を防ぐ！\n' +
      '⚡ **チャージ** : チャージを1溜める\n' +
      '💥 **必殺技** : チャージ2消費で3ダメージ！\n' +
      '🍓 **回復** : HPを1回復（最大5）'
    );
    return;
  }

  if (message.content === '!battle') {
    // 1. 「参加」と「開始」の2つのボタンを用意
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

    const participants = new Map(); // 参加者リスト
    const joinCollector = recruitMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000 // 2分間放置されたら自動キャンセル
    });

    joinCollector.on('collect', async (interaction) => {
      // 参加ボタンが押されたとき
      if (interaction.customId === 'join_battle') {
        if (!participants.has(interaction.user.id)) {
          participants.set(interaction.user.id, {
            userId: interaction.user.id,
            name: interaction.user.username
          });

          const names = Array.from(participants.values()).map(p => `・${p.name}`).join('\n');
          await recruitMsg.edit({
            content: `🌸 **【こっとんチームバトロワ 参加者募集中！】** 🌸\n参戦する人は「参加する！」を押してね！みんな集まったら「バトル開始！」を押してスタート！\n\n**現在の参加者:**\n${names}`
          });

          await interaction.reply({ content: 'バトロワに参加登録したよ！', ephemeral: true });
        } else {
          await interaction.reply({ content: 'もうすでに参加登録してるよ！', ephemeral: true });
        }
      }

      // バトル開始ボタンが押されたとき
      if (interaction.customId === 'start_battle') {
        if (participants.size === 0) {
          await interaction.reply({ content: 'まだ誰も参加していないよ！', ephemeral: true });
          return;
        }

        joinCollector.stop('started'); // 募集を終了してバトルへ移行
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

      // 2. 技選択用のボタンを作成
      const actionRow = new ActionRowBuilder().addComponents(
        Object.keys(COMMANDS).map((id) =>
          new ButtonBuilder()
            .setCustomId(id)
            .setLabel(COMMANDS[id].label)
            .setStyle(COMMANDS[id].style)
        )
      );

      const participantNames = Array.from(participants.values()).map(p => p.name).join(', ');
      await recruitMsg.edit({
        content: `⚔️ **【メンバー決定＆バトル開始！】** ⚔️\n参戦者: ${participantNames}\n\n下のボタンから行動を選んでね！（制限時間：30秒）`,
        components: [actionRow]
      });

      const choices = new Map();
      const battleCollector = recruitMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000
      });

      battleCollector.on('collect', async (interaction) => {
        if (!participants.has(interaction.user.id)) {
          await interaction.reply({ content: '今回は参加していないメンバーだよ！次の試合を待ってね！', ephemeral: true });
          return;
        }

        const uid = interaction.user.id;
        if (!playerHP.has(uid)) playerHP.set(uid, 5);
        if (!playerCharge.has(uid)) playerCharge.set(uid, 0);

        const currentCharge = playerCharge.get(uid);

        if (interaction.customId === 'special' && currentCharge < 2) {
          await interaction.reply({
            content: `⚠️ チャージが足りません！（現在のチャージ: ${currentCharge}/2）\n他の技を選ぶか、まずは『⚡ チャージ』をしてね！`,
            ephemeral: true
          });
          return;
        }

        choices.set(uid, {
          name: interaction.user.username,
          choice: interaction.customId
        });

        await interaction.reply({ content: `「${COMMANDS[interaction.customId].label}」を選択したよ！`, ephemeral: true });
      });

      // 3. 結果発表
      battleCollector.on('end', () => {
        if (choices.size === 0) {
          recruitMsg.edit({ content: '誰も技を選ばなかったのでバトル中止になったよ！(；；)', components: [] });
          return;
        }

        const shuffled = Array.from(participants.values()).sort(() => Math.random() - 0.5);
        const teamRed = [];
        const teamWhite = [];

        shuffled.forEach((p, idx) => {
          if (idx % 2 === 0) teamRed.push(p);
          else teamWhite.push(p);
        });

        let resultText = '⚔️ **【チーム対抗戦 結果発表！】** ⚔️\n\n';
        resultText += `🔴 **【チーム紅】**: ${teamRed.map(p => p.name).join(', ') || 'なし'}\n`;
        resultText += `⚪ **【チーム白】**: ${teamWhite.map(p => p.name).join(', ') || 'なし'}\n\n`;
        resultText += '───────────────────\n';

        const processPlayerAction = (player, myTeam, enemyTeam) => {
          let hp = playerHP.get(player.userId);
          let charge = playerCharge.get(player.userId);
          let log = '';

          const choice = choices.get(player.userId)?.choice || 'guard';

          if (choice === 'charge') {
            charge += 1;
            log = `・**${player.name}** は【⚡ チャージ】！ (チャージ: **${charge}**)\n`;
          } else if (choice === 'heal') {
            hp = Math.min(5, hp + 1);
            log = `・**${player.name}** は【🍓 回復】！ HPが1回復した！\n`;
          } else if (choice === 'guard') {
            log = `・**${player.name}** は【🛡️ ガード】をかまえている！\n`;
          } else if (choice === 'attack') {
            if (enemyTeam.length > 0) {
              const target = enemyTeam[Math.floor(Math.random() * enemyTeam.length)];
              const targetChoice = choices.get(target.userId)?.choice;

              if (targetChoice === 'guard') {
                log = `・**${player.name}** の【⚔️ 通常攻撃】 ➔ **${target.name}** はガードした！(ダメージ0)\n`;
              } else {
                let targetHp = playerHP.get(target.userId);
                targetHp = Math.max(0, targetHp - 1);
                playerHP.set(target.userId, targetHp);
                log = `・**${player.name}** の【⚔️ 通常攻撃】 ➔ **${target.name}** に **1ダメージ**！\n`;
              }
            } else {
              log = `・**${player.name}** は【⚔️ 通常攻撃】を出したが攻撃相手がいなかった！\n`;
            }
          } else if (choice === 'special') {
            charge = Math.max(0, charge - 2);
            if (enemyTeam.length > 0) {
              const target = enemyTeam[Math.floor(Math.random() * enemyTeam.length)];
              let targetHp = playerHP.get(target.userId);
              targetHp = Math.max(0, targetHp - 3);
              playerHP.set(target.userId, targetHp);
              log = `・**${player.name}** の【💥 必殺技】発動！！ ➔ **${target.name}** に **3ダメージ**の超大打撃！！\n`;
            } else {
              log = `・**${player.name}** は【💥 必殺技】を放った！\n`;
            }
          }

          playerHP.set(player.userId, hp);
          playerCharge.set(player.userId, charge);
          return log;
        };

        resultText += '🔴 **＜チーム紅の行動＞**\n';
        teamRed.forEach(p => { resultText += processPlayerAction(p, teamRed, teamWhite); });

        resultText += '\n⚪ **＜チーム白の行動＞**\n';
        teamWhite.forEach(p => { resultText += processPlayerAction(p, teamWhite, teamRed); });

        resultText += '\n📊 **＜現在のステータス＞**\n';
        participants.forEach((p, userId) => {
          const hp = playerHP.get(userId);
          const charge = playerCharge.get(userId);
          const heart = hp > 0 ? '❤️'.repeat(hp) : '💀 ダウン！';
          resultText += `・**${p.name}**: HP ${hp}/5 [${heart}] ⚡チャージ: ${charge}\n`;
        });

        recruitMsg.edit({ content: resultText, components: [] });
      });
    });
  }
});

client.login(process.env.DISCORD_TOKEN);


