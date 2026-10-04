const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// 技の定義（HP5基準のダメージ量）
const COMMANDS = {
  attack: { label: '💨 吹きとばし', style: ButtonStyle.Primary, damage: 1 },
  break: { label: '🔨 必殺技！かち割り', style: ButtonStyle.Danger, damage: 2 },
  guard: { label: '🛡️ ふわふわガード', style: ButtonStyle.Success, damage: 0 },
  heal: { label: '🍓 あめちゃん', style: ButtonStyle.Secondary, damage: -1 }, // 1回復
};

// プレイヤーのHPデータ（最大HP: 5）
const playerHP = new Map();

client.on('ready', () => {
  console.log(`こっとんバトロワBotが起動したよ！: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!help' || message.content === '!ヘルプ') {
    await message.reply(
      '🌸 **【こっとんチームバトロワ】** 🌸\n' +
      '・`!battle` : チーム対抗バトロワを開始します！（初期HP: 5）\n' +
      '・`💨 吹きとばし` : 相手チームに 1 ダメージ！\n' +
      '・`🔨 必殺技！` : 相手チームに 2 ダメージ！\n' +
      '・`🛡️ ガード` : 攻撃を防ぐ！\n' +
      '・`🍓 あめちゃん` : HPを 1 回復！'
    );
    return;
  }

  if (message.content === '!battle') {
    const row = new ActionRowBuilder().addComponents(
      Object.keys(COMMANDS).map((id) =>
        new ButtonBuilder()
          .setCustomId(id)
          .setLabel(COMMANDS[id].label)
          .setStyle(COMMANDS[id].style)
      )
    );

    const gameMsg = await message.channel.send({
      content: '🌸 **【こっとんチームバトロワ開幕！】** 🌸\n参戦する人は下のボタンから技を選んでね！（制限時間：30秒）',
      components: [row]
    });

    const choices = new Map();
    const collector = gameMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000
    });

    collector.on('collect', async (interaction) => {
      // 初期HP設定 (HP 5)
      if (!playerHP.has(interaction.user.id)) {
        playerHP.set(interaction.user.id, 5);
      }

      choices.set(interaction.user.id, {
        name: interaction.user.username,
        choice: interaction.customId
      });

      await interaction.reply({
        content: `「${COMMANDS[interaction.customId].label}」を選択したよ！`,
        ephemeral: true
      });
    });

    collector.on('end', () => {
      if (choices.size === 0) {
        gameMsg.edit({
          content: '誰も参戦しなかったのでおしまい！(；；)',
          components: []
        });
        return;
      }

      // 参加者をランダムに「チーム紅 (A)」と「チーム白 (B)」に分ける
      const teamRed = [];
      const teamWhite = [];
      let index = 0;

      choices.forEach((data, userId) => {
        const playerInfo = { userId, ...data };
        if (index % 2 === 0) {
          teamRed.push(playerInfo);
        } else {
          teamWhite.push(playerInfo);
        }
        index++;
      });

      // ダメージ計算用のチーム別合計攻撃力
      let redDamage = 0;
      let whiteDamage = 0;

      // 各技を集計
      teamRed.forEach(p => {
        const move = COMMANDS[p.choice];
        if (move.damage > 0) redDamage += move.damage;
      });

      teamWhite.forEach(p => {
        const move = COMMANDS[p.choice];
        if (move.damage > 0) whiteDamage += move.damage;
      });

      let resultText = '⚔️ **【チーム対抗戦 結果発表！】** ⚔️\n\n';

      // チーム構成の表示
      resultText += `🔴 **【チーム紅】**: ${teamRed.map(p => p.name).join(', ') || 'なし'}\n`;
      resultText += `⚪ **【チーム白】**: ${teamWhite.map(p => p.name).join(', ') || 'なし'}\n\n`;
      resultText += '───────────────────\n';

      // チーム紅の行動とHP計算
      resultText += '🔴 **＜チーム紅の行動＞**\n';
      teamRed.forEach(p => {
        const move = COMMANDS[p.choice];
        let hp = playerHP.get(p.userId);

        if (move.damage === -1) { // 回復
          hp = Math.min(5, hp + 1);
          resultText += `・**${p.name}** は【${move.label}】でHPが1回復！\n`;
        } else if (move.damage === 0) { // ガード
          const actualDamage = Math.max(0, whiteDamage - 1); // ガードで1軽減
          hp = Math.max(0, hp - actualDamage);
          resultText += `・**${p.name}** は【${move.label}】でガード！\n`;
        } else { // 攻撃
          hp = Math.max(0, hp - whiteDamage);
          resultText += `・**${p.name}** は【${move.label}】を繰り出した！\n`;
        }
        playerHP.set(p.userId, hp);
      });

      resultText += '\n⚪ **＜チーム白の行動＞**\n';
      // チーム白の行動とHP計算
      teamWhite.forEach(p => {
        const move = COMMANDS[p.choice];
        let hp = playerHP.get(p.userId);

        if (move.damage === -1) { // 回復
          hp = Math.min(5, hp + 1);
          resultText += `・**${p.name}** は【${move.label}】でHPが1回復！\n`;
        } else if (move.damage === 0) { // ガード
          const actualDamage = Math.max(0, redDamage - 1);
          hp = Math.max(0, hp - actualDamage);
          resultText += `・**${p.name}** は【${move.label}】でガード！\n`;
        } else { // 攻撃
          hp = Math.max(0, hp - redDamage);
          resultText += `・**${p.name}** は【${move.label}】を繰り出した！\n`;
        }
        playerHP.set(p.userId, hp);
      });

      resultText += '\n📊 **＜現在の残りHP＞**\n';
      choices.forEach((p, userId) => {
        const hp = playerHP.get(userId);
        const heart = hp > 0 ? '❤️'.repeat(hp) : '💀 ダウン！';
        resultText += `・**${p.name}**: HP ${hp}/5 [${heart}]\n`;
      });

      gameMsg.edit({ content: resultText, components: [] });
    });
  }
});

client.login(process.env.DISCORD_TOKEN);


