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
            content: '🌸 **【こっとんチームバトロワ 参加者募集中！】** 🌸\n参戦する人は「参加する！」を押してね！みんな集まったら「バトル開始！」を押してスタート！\n\n**現在の参加者:**\n' + names
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

      let teamInfoText = '⚔️ **【チーム決定＆行動選択！】** ⚔️\n\n';
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

      battleCollector.on('collect', async (interaction) => {
        if (!participants.has(interaction.user.id)) {
          await interaction.reply({ content: '今回は参加していないメンバーだよ！次の試合を待ってね！', ephemeral: true });
          return;
        }

        const uid = interaction.user.id;
        if (!playerHP.has(uid)) playerHP.set(uid, 5);
        if (!playerCharge.has(uid)) playerCharge.set(uid, 0);

        const currentCharge = playerCharge.get(uid);
        const myTeam = playerTeamMap.get(uid);
        const enemyTeam = myTeam === 'red' ? teamWhite : teamRed;

        if (interaction.customId === 'special' && currentCharge < 2) {
          await interaction.reply({
            content: '⚠️ チャージが足りません！（現在のチャージ: ' + currentCharge + '/2）\n他の技を選ぶか、まずは『⚡ チャージ』をしてね！',
            ephemeral: true
          });
          return;
        }

        if (interaction.customId === 'attack' || interaction.customId === 'special') {
          if (enemyTeam.length === 0) {
            choices.set(uid, { name: interaction.user.username, choice: interaction.customId, targetId: null });
            await interaction.reply({ content: '「' + COMMANDS[interaction.customId].label + '」を選択したよ！（攻撃相手がいません）', ephemeral: true });
            return;
          }

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_target_' + interaction.customId)
            .setPlaceholder('攻撃したい相手を選択してね！')
            .addOptions(
              enemyTeam.map(enemy => ({
                label: enemy.name,
                value: enemy.userId
              }))
            );

          const selectRow = new ActionRowBuilder().addComponents(selectMenu);

          const targetReply = await interaction.reply({
            content: '「' + COMMANDS[interaction.customId].label + '」を選んだよ！攻撃する相手を選択してね：',
            components: [selectRow],
            ephemeral: true,
            fetchReply: true
          });

          try {
            const selectInteraction = await targetReply.awaitMessageComponent({
              componentType: ComponentType.StringSelect,
              time: 20000
            });

            const selectedTargetId = selectInteraction.values[0];
            const targetUser = enemyTeam.find(e => e.userId === selectedTargetId);

            choices.set(uid, {
              name: interaction.user.username,
              choice: interaction.customId,
              targetId: selectedTargetId
            });

            const targetName = targetUser ? targetUser.name : '相手';
            await selectInteraction.reply({
              content: '🎯 **' + targetName + '** をターゲットに「' + COMMANDS[interaction.customId].label + '」をセットしたよ！',
              ephemeral: true
            });
          } catch (e) {
            const randomTarget = enemyTeam[Math.floor(Math.random() * enemyTeam.length)];
            choices.set(uid, {
              name: interaction.user.username,
              choice: interaction.customId,
              targetId: randomTarget.userId
            });
          }
        } else {
          choices.set(uid, {
            name: interaction.user.username,
            choice: interaction.customId,
            targetId: null
          });

          await interaction.reply({ content: '「' + COMMANDS[interaction.customId].label + '」を選択したよ！', ephemeral: true });
        }
      });

      battleCollector.on('end', () => {
        if (choices.size === 0) {
          recruitMsg.edit({ content: '誰も技を選ばなかったのでバトル中止になったよ！(；；)', components: [] });
          return;
        }

        let resultText = '⚔️ **【チーム対抗戦 結果発表！】** ⚔️\n\n';
        resultText += '🔴 **【チーム紅】**: ' + redNames + '\n';
        resultText += '⚪ **【チーム白】**: ' + whiteNames + '\n\n';
        resultText += '───────────────────\n';

        const processPlayerAction = (player, myTeam, enemyTeam) => {
          let hp = playerHP.get(player.userId);
          let charge = playerCharge.get(player.userId);
          let log = '';

          const playerChoice = choices.get(player.userId);
          const choice = playerChoice ? playerChoice.choice : 'guard';
          const targetId = playerChoice ? playerChoice.targetId : null;

          if (choice === 'charge') {
            charge += 1;
            log = '・**' + player.name + '** は【⚡ チャージ】！ (チャージ: **' + charge + '**)\n';
          } else if (choice === 'heal') {
            hp = Math.min(5, hp + 1);
            log = '・**' + player.name + '** は【🍓 回復】！ HPが1回復した！\n';
          } else if (choice === 'guard') {
            log = '・**' + player.name + '** は【🛡️ ガード】をかまえている！\n';
          } else if (choice === 'attack') {
            let target = enemyTeam.find(e => e.userId === targetId);
            if (!target && enemyTeam.length > 0) {
              target = enemyTeam[Math.floor(Math.random() * enemyTeam.length)];
            }

            if (target) {
              const targetChoice = choices.get(target.userId) ? choices.get(target.userId).choice : null;
              if (targetChoice === 'guard') {
                log = '・**' + player.name + '** の【⚔️ 通常攻撃】 ➔ **' + target.name + '** はガードした！(ダメージ0)\n';
              } else {
                let targetHp =
