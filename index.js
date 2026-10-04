const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const COMMANDS = {
  attack: { label: '⚔️ 通常攻撃', style: ButtonStyle.Primary },
  guard: { label: '🛡️ ガード', style: ButtonStyle.Success },
  charge: { label: '⚡ チャージ', style: ButtonStyle.Secondary },
  special: { label: '💥 必殺技(要2チャージ)', style: ButtonStyle.Danger },
  heal: { label: '🍓 回復', style: ButtonStyle.Success },
};

client.on('ready', () => {
  console.log('こっとんバトロワBotが起動したよ！');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!help' || message.content === '!ヘルプ') {
    await message.reply(
      '🌸 **【こっとんチームバトロワの使い方】** 🌸\n' +
      '・`!battle` : バトル開始！\n\n' +
      '🛡️ **ガードの裏ワザ**: 相手の【💥 必殺技】をガードすると、防いだ上に**相手に3ダメージのカウンター**を返すよ！'
    );
    return;
  }

  if (message.content === '!battle') {
    const joinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('join_battle').setLabel('✋ 参加する！').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('start_battle').setLabel('⚔️ バトル開始！').setStyle(ButtonStyle.Danger)
    );

    const recruitMsg = await message.channel.send({
      content: '🌸 **【こっとんチームバトロワ 参加者募集中！】** 🌸\n参加する人はボタンを押してね！\n\n**現在の参加者:** なし',
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
          participants.set(interaction.user.id, { userId: interaction.user.id, name: interaction.user.username });
          const names = Array.from(participants.values()).map(p => '・' + p.name).join('\n');
          await recruitMsg.edit({
            content: '🌸 **【こっとんチームバトロワ 参加者募集中！】** 🌸\n\n**現在の参加者:**\n' + names
          });
          await interaction.reply({ content: '参加登録したよ！', ephemeral: true });
        } else {
          await interaction.reply({ content: 'もう参加登録してるよ！', ephemeral: true });
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
        await recruitMsg.edit({ content: '募集が終了しました…(；；)', components: [] });
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

      const playerHP = new Map();
      const playerCharge = new Map();
      participants.forEach((p) => {
        playerHP.set(p.userId, 5);
        playerCharge.set(p.userId, 0);
      });

      const redNames = teamRed.map(p => p.name).join(', ') || 'なし';
      const whiteNames = teamWhite.map(p => p.name).join(', ') || 'なし';

      let currentTurn = 1;

      // ターンを自動で回す関数
      const runTurn = async () => {
        // 生きているメンバーがいるかチェック
        const aliveRed = teamRed.filter(p => playerHP.get(p.userId) > 0);
        const aliveWhite = teamWhite.filter(p => playerHP.get(p.userId) > 0);

        if (aliveRed.length === 0 || aliveWhite.length === 0) {
          let winnerText = '🎉 **【ゲーム決着！】** 🎉\n\n';
          if (aliveRed.length > 0) winnerText += '🔴 **チーム紅の勝利！！** 🎊\n';
          else if (aliveWhite.length > 0) winnerText += '⚪ **チーム白の勝利！！** 🎊\n';
          else winnerText += '引き分け！\n';

          winaliveStatus(winnnerText, playerHP, playerCharge, participants, recruitMsg);
          return;
        }
        let turnText = `⚔️ **【ターン ${currentTurn}：行動選択】** ⚔️\n\n`;
        turnText += '🔴 **【チーム紅】**: ' + teamRed.map(p => `${p.name}(HP:${playerHP.get(p.userId)})`).join(', ') + '\n';
        turnText += '⚪ **【チーム白】**: ' + teamWhite.map(p => `${p.name}(HP:${playerHP.get(p.userId)})`).join(', ') + '\n\n';
        turnText += '下のボタンから自分の【行動】を選んでね！（制限時間：30秒）';

        const actionRow = new ActionRowBuilder().addComponents(
          Object.keys(COMMANDS).map((id) =>
            new ButtonBuilder().setCustomId(id).setLabel(COMMANDS[id].label).setStyle(COMMANDS[id].style)
          )
        );

        await recruitMsg.edit({ content: turnText, components: [actionRow] });

        const choices = new Map();
        const battleCollector = recruitMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000
        });

        battleCollector.on('collect', async (interaction) => {
          if (!participants.has(interaction.user.id) || playerHP.get(interaction.user.id) <= 0) {
            await interaction.reply({ content: '参加していないか、すでにダウンしているよ！', ephemeral: true });
            return;
          }

          const uid = interaction.user.id;
          const currentCharge = playerCharge.get(uid);
          const myTeam = playerTeamMap.get(uid);
          const enemyTeam = (myTeam === 'red' ? teamWhite : teamRed).filter(p => playerHP.get(p.userId) > 0);

          if (interaction.customId === 'special' && currentCharge < 2) {
            await interaction.reply({ content: `⚠️ チャージが足りません！（現在: ${currentCharge}/2）`, ephemeral: true });
            return;
          }

          if (interaction.customId === 'attack' || interaction.customId === 'special') {
            if (enemyTeam.length === 0) {
              choices.set(uid, { name: interaction.user.username, choice: interaction.customId, targetId: null });
              await interaction.reply({ content: '攻撃相手がいません！', ephemeral: true });
              return;
            }

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId('select_target_' + Math.random())
              .setPlaceholder('攻撃する相手を選んでね！')
              .addOptions(enemyTeam.map(enemy => ({ label: enemy.name, value: enemy.userId })));

            const selectRow = new ActionRowBuilder().addComponents(selectMenu);
            const targetReply = await interaction.reply({
              content: 'ターゲットを選んでね：',
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
              choices.set(uid, { name: interaction.user.username, choice: interaction.customId, targetId: selectedTargetId });
              await selectInteraction.reply({ content: 'ターゲットをセットしたよ！', ephemeral: true });
            } catch (e) {
              const randomTarget = enemyTeam[Math.floor(Math.random() * enemyTeam.length)];
              choices.set(uid, { name: interaction.user.username, choice: interaction.customId, targetId: randomTarget.userId });
            }
          } else {
            choices.set(uid, { name: interaction.user.username, choice: interaction.customId, targetId: null });
            await interaction.reply({ content: `「${COMMANDS[interaction.customId].label}」を選択したよ！`, ephemeral: true });
          }
        });

        battleCollector.on('end', async () => {
          let resultText = `⚔️ **【ターン ${currentTurn} 結果発表】** ⚔️\n\n`;

          // アクションの処理とカウンター判定
          const pendingActions = [];
          participants.forEach((p, uid) => {
            if (playerHP.get(uid) > 0) {
              const cData = choices.get(uid) || { choice: 'guard', targetId: null };
              pendingActions.push({ userId: uid, player: p, team: playerTeamMap.get(uid), ...cData });
            }
          });

          // チャージ消費とダメージ計算
          pendingActions.forEach(act => {
            if (act.choice === 'charge') {
              playerCharge.set(act.userId, playerCharge.get(act.userId) + 1);
              resultText += `・**${act.player.name}** は【⚡ チャージ】！\n`;
            } else if (act.choice === 'heal') {
              playerHP.set(act.userId, Math.min(5, playerHP.get(act.userId) + 1));
              resultText += `・**${act.player.name}** は【🍓 回復】！ HP回復！\n`;
            } else if (act.choice === 'guard') {
              resultText += `・**${act.player.name}** は【🛡️ ガード】をかまえている！\n`;
            }
          });

          // 攻撃・必殺技の処理（カウンター込み）
          pendingActions.forEach(act => {
            const enemyTeamList = act.team === 'red' ? teamWhite : teamRed;
            let target = enemyTeamList.find(e => e.userId === act.targetId && playerHP.get(e.userId) > 0);
            if (!target && enemyTeamList.filter(e => playerHP.get(e.userId) > 0).length > 0) {
              const aliveEnemies = enemyTeamList.filter(e => playerHP.get(e.userId) > 0);
              target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            }

            if (!target) return;

            const targetChoiceData = choices.get(target.userId) || { choice: 'guard' };

            if (act.choice === 'attack') {
              if (targetChoiceData.choice === 'guard') {
                resultText += `・**${act.player.name}** の【⚔️ 通常攻撃】 ➔ **${target.name}** にガードされた！(ダメージ0)\n`;
              } else {
                let hp = playerHP.get(target.userId) - 1;
                playerHP.set(target.userId, Math.max(0, hp));
                resultText += `・**${act.player.name}** の【⚔️ 通常攻撃】 ➔ **${target.name}** に **1ダメージ**！\n`;
              }
            } else if (act.choice === 'special') {
              playerCharge.set(act.userId, Math.max(0, playerCharge.get(act.userId) - 2));
              
              if (targetChoiceData.choice === 'guard') {
                // カウンター発動！必殺技が防がれ、逆に撃った本人が3ダメージ食らう
                let myHp = playerHP.get(act.userId) - 3;
                playerHP.set(act.userId, Math.max(0, myHp));
                resultText += `・**${act.player.name}** の【💥 必殺技】 ➔ **${target.name}** に**完璧にカウンターされた！！** 逆に **${act.player.name}** が **3ダメージ**を受けた！！💥\n`;
              } else {
                let hp = playerHP.get(target.userId) - 3;
                playerHP.set(target.userId, Math.max(0, hp));
                resultText += `・**${act.player.name}** の【💥 必殺技】炸裂！！ ➔ **${target.name}** に **3ダメージ**の大打撃！！🔥\n`;
              }
            }
          });

          resultText += '\n📊 **【ステータス】**\n';
          participants.forEach((p, uid) => {
            const hp = playerHP.get(uid);
            const charge = playerCharge.get(uid);
            const heart = hp > 0 ? '❤️'.repeat(hp) : '💀 ダウン！';
            resultText += `・**${p.name}**: HP ${hp}/5 [${heart}] ⚡: ${charge}\n`;
          });

          await recruitMsg.edit({ content: resultText, components: [] });

          // 次のターンへ自動で進む
          currentTurn++;
          setTimeout(runTurn, 5000); // 5秒後に次のターンが自動スタート！
        });
      };

      // ステータス表示用のヘルパー
      const winaliveStatus = (text, hpMap, chargeMap, parts, msg) => {
        text += '\n📊 **【最終ステータス】**\n';
        parts.forEach((p, uid) => {
          const hp = hpMap.get(uid);
          const heart = hp > 0 ? '❤️'.repeat(hp) : '💀 ダウン！';
          text += `・**${p.name}**: HP ${hp}/5 [${heart}]\n`;
        });
        msg.edit({ content: text, components: [] });
      };

      // バトル最初のターン呼び出し
      runTurn();
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
