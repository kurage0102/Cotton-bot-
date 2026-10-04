const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const COMMANDS = {
  attack: { label: '💨 吹きとばし', style: ButtonStyle.Primary },
  guard: { label: '🛡️ ふわふわガード', style: ButtonStyle.Success },
  break: { label: '🔨 かち割り', style: ButtonStyle.Danger },
  charge: { label: '⚡ パワーチャージ', style: ButtonStyle.Secondary },
  heal: { label: '🍓 あめちゃん', style: ButtonStyle.Secondary },
};

client.on('ready', () => {
  console.log(`こっとんバトロワBotが起動したよ！: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

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
      content: '🌸 **【こっとんバトロワ】** 🌸\n下のボタンから行動を1つ選んでね！（制限時間：30秒）',
      components: [row]
    });

    const choices = new Map();
    const collector = gameMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000
    });

    collector.on('collect', async (interaction) => {
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
          content: '誰も選択しなかったのでおしまい！(；；)',
          components: []
        });
        return;
      }

      let resultText = '✨ **【ターン結果発表〜！】** ✨\n\n';
      choices.forEach((data) => {
        resultText += `・**${data.name}** ➔ 【${COMMANDS[data.choice].label}】\n`;
      });

      gameMsg.edit({ content: resultText, components: [] });
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
