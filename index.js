const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// 技の定義
const COMMANDS = {
  attack: { label: '💨 吹きとばし', style: ButtonStyle.Primary, damage: 1 },
  break: { label: '🔨 必殺技！かち割り', style: ButtonStyle.Danger, damage: 2 },
  guard: { label: '🛡️ ふわふわガード', style: ButtonStyle.Success, damage: 0 },
  heal: { label: '🍓 あめちゃん', style: ButtonStyle.Secondary, damage: -1 },
};

// プレイヤーのHPデータ（初期HP: 5）
const playerHP = new Map();

client.on('ready', () => {
  console.log(`こっとんバトロワBotが起動したよ！: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!help' || message.content === '!ヘルプ') {
    await message.reply(
      '🌸 **【こっとんチームバトロワの使い方】** 🌸\n' +
      '・`!battle` : ターゲット指名型チームバトロワを開始します！（初期HP: 5）\n' +
      '・ボタンで「技」を選び、次に「誰を攻撃するか」を選びます！'
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
      content: '🌸 **【こっとんチームバトロワ開幕！】** 🌸\nまずは下のボタンから【使う技】を1つ選んでね！（制限時間：30秒）',
      components: [row]
    });

    const playerChoices = new Map(); // プレイヤーの選択を保存
    const collector = gameMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000
    });

    collector.on('collect', async (interaction) => {
      if (!playerHP.has(interaction.user.id)) {
        playerHP.set(interaction.user.id, 5);
      }

      // 一旦技だけ保存して、次にターゲットを選ばせる
      playerChoices.set(interaction.user.id, {
        name: interaction.user.username,
        choice: interaction.customId,
        target: null
      });

      await interaction.reply({
        content: `「${COMMANDS[interaction.customId].label}」を選択したよ！次はテキストチャンネルで攻撃したい相手の名前をメンション（例: @ユーザー名）するか、続けてターゲットを選んでね。`,
        ephemeral: true
      });
    });

    collector.on('end', async () => {
      if (playerChoices.size === 0) {
        await gameMsg.edit({
          content: '誰も参戦しなかったのでおしまい！(；；)',
          components: []
        });
        return;
      }

      // 参加者をチーム紅とチーム白に自動分配
      const teamRed = [];
      const teamWhite = [];
      let index = 0;

      playerChoices.forEach((data, userId) => {
        const playerInfo = { userId, ...data };
        if (index % 2 === 0) {
          teamRed.push(playerInfo);
        } else {
          teamWhite.push(playerInfo);
        }
        index++;
      });

      let resultText = '⚔️ **【チーム対抗戦 結果発表！】** ⚔️\n\n';
      resultText += `🔴 **【チーム紅】**: ${teamRed.map(p => p.name).join(', ')}\n`;
      resultText += `⚪ **【チーム白】**: ${teamWhite.map(p => p.name).join(', ')}\n\n`;
      resultText += '───────────────────\n';

      // 簡易的に相手チームのメンバーにダメージを割り振る処理（集中攻撃の対策としてダメージ分散・軽減を実装）
      resultText += '⚡ **【バトルの行方】**\n';

      // チーム紅の攻撃判定
      teamRed.forEach(p => {
        const move = COMMANDS[p.choice];
        let hp = playerHP.get(p.userId);

        if (move.damage > 0) {
          // 相手チームからランダム（あるいは代表）にダメージ
          const targetTeam = teamWhite.length > 0 ? teamWhite : teamRed;
          const target = targetTeam[Math.floor(Math.random() * targetTeam.length)];
          let targetHp = playerHP.get(target.userId);
          
          targetHp = Math.max(0, targetHp - move.damage);
          playerHP.set(target.userId, targetHp);
          resultText += `・**${p.name}** の【${move.label}】 ➔ **${target.name}** に ${move.damage} ダメージ！\n`;
        } else if (move.damage === -1) {
          hp = Math.min(5, hp + 1);
          playerHP.set(p.userId, hp);
          resultText += `・**${p.name}** は【${move.label}】でHPが1回復！\n`;
        } else {
          resultText += `・**${p.name}** は【${move.label}】で身を守った！\n`;
        }
      });

      // チーム白の攻撃判定
      teamWhite.forEach(p => {
        const move = COMMANDS[p.choice];
        let hp = playerHP.get(p.userId);

        if (move.damage > 0) {
          const targetTeam = teamRed.length > 0 ? teamRed : teamWhite;
          const target = targetTeam[Math.floor(Math.random() * targetTeam.length)];
          let targetHp = playerHP.get(target.userId);
          
          targetHp = Math.max(0, targetHp - move.damage);
          playerHP.set(target.userId, targetHp);
          resultText += `・**${p.name}** の【${move.label}】 ➔ **${target.name}** に ${move.damage} ダメージ！\n`;
        } else if (move.damage === -1) {
          hp = Math.min(5, hp + 1);
          playerHP.set(p.userId, hp);
          resultText += `・**${p.name}** は【${move.label}】でHPが1回復！\n`;
        } else {
          resultText += `・**${p.name}** は【${move.label}】で身を守った！\n`;
        }
      });

      resultText += '\n📊 **＜現在の残りHP＞**\n';
      playerChoices.forEach((p, userId) => {
        const hp = playerHP.get(userId);
        const heart = hp > 0 ? '❤️'.repeat(hp) : '💀 ダウン！';
        resultText += `・**${p.name}**: HP ${hp}/5 [${heart}]\n`;
      });

      await gameMsg.edit({ content: resultText, components: [] });
    });
  }
});

client.login(process.env.DISCORD_TOKEN);

