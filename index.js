const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  AuditLogEvent
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const prefix = '?';
const logChannels = new Map();

/* ================= READY ================= */
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================= HELPERS ================= */
function getLogChannel(guild) {
  return logChannels.get(guild.id);
}

function carlEmbed({ user, title, channel, before, after, color }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL()
    })
    .setTitle(title)
    .addFields(
      { name: 'Channel', value: `${channel}`, inline: true },
      { name: 'User ID', value: user.id, inline: true }
    )
    .setTimestamp();

  if (before) embed.addFields({ name: 'Before', value: before });
  if (after) embed.addFields({ name: 'After', value: after });

  return embed;
}

/* ================= COMMAND HANDLER ================= */
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  /* ===== SET LOG CHANNEL ===== */
  if (command === 'setlogs') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply('❌ Admin only.');

    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('❌ Mention a channel.');

    logChannels.set(message.guild.id, channel);
    message.reply(`✅ Logs channel set to ${channel}`);
  }

  /* ===== MOD COMMANDS ===== */
  else if (command === 'kick') {
    const m = message.mentions.members.first();
    if (!m) return;
    await m.kick();
  }

  else if (command === 'ban') {
    const m = message.mentions.members.first();
    if (!m) return;
    await m.ban();
  }

  else if (command === 'unban') {
    await message.guild.members.unban(args[0]);
  }

  else if (command === 'mute') {
    const m = message.mentions.members.first();
    if (!m) return;
    await m.timeout(10 * 60 * 1000);
  }

  else if (command === 'unmute') {
    const m = message.mentions.members.first();
    if (!m) return;
    await m.timeout(null);
  }

  else if (command === 'clear') {
    await message.channel.bulkDelete(parseInt(args[0]), true);
  }
});

/* ================= MESSAGE DELETE (WITH WHO) ================= */
client.on('messageDelete', async (msg) => {
  if (!msg.guild || msg.author?.bot) return;

  const log = getLogChannel(msg.guild);
  if (!log) return;

  let deleter = 'Unknown';

  try {
    const audits = await msg.guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 1
    });

    const entry = audits.entries.first();
    if (entry && entry.target.id === msg.author.id)
      deleter = entry.executor.tag;
  } catch {}

  log.send({
    embeds: [
      carlEmbed({
        user: msg.author,
        title: '🗑️ Message Deleted',
        channel: msg.channel,
        before: msg.content || '*No content*',
        after: `Deleted by: **${deleter}**`,
        color: 0xe74c3c
      })
    ]
  });
});

/* ================= MESSAGE EDIT ================= */
client.on('messageUpdate', (oldM, newM) => {
  if (!oldM.guild || oldM.author?.bot) return;
  if (oldM.content === newM.content) return;

  const log = getLogChannel(oldM.guild);
  if (!log) return;

  log.send({
    embeds: [
      carlEmbed({
        user: oldM.author,
        title: '✏️ Message Edited',
        channel: oldM.channel,
        before: oldM.content,
        after: newM.content,
        color: 0x3498db
      })
    ]
  });
});

/* ================= MEMBER LOGS ================= */
client.on('guildMemberAdd', m => {
  const log = getLogChannel(m.guild);
  if (log)
    log.send({
      embeds: [
        carlEmbed({
          user: m.user,
          title: '➕ Member Joined',
          channel: 'Server',
          color: 0x2ecc71
        })
      ]
    });
});

client.on('guildMemberRemove', m => {
  const log = getLogChannel(m.guild);
  if (log)
    log.send({
      embeds: [
        carlEmbed({
          user: m.user,
          title: '➖ Member Left',
          channel: 'Server',
          color: 0xe74c3c
        })
      ]
    });
});

/* ================= BAN / UNBAN ================= */
client.on('guildBanAdd', ban => {
  const log = getLogChannel(ban.guild);
  if (log)
    log.send({
      embeds: [
        carlEmbed({
          user: ban.user,
          title: '🔨 Member Banned',
          channel: 'Server',
          color: 0xc0392b
        })
      ]
    });
});

client.on('guildBanRemove', ban => {
  const log = getLogChannel(ban.guild);
  if (log)
    log.send({
      embeds: [
        carlEmbed({
          user: ban.user,
          title: '♻️ Member Unbanned',
          channel: 'Server',
          color: 0x27ae60
        })
      ]
    });
});

/* ================= VOICE LOGS ================= */
client.on('voiceStateUpdate', (oldS, newS) => {
  const log = getLogChannel(newS.guild);
  if (!log) return;

  const user = newS.member.user;

  if (!oldS.channel && newS.channel)
    log.send({ embeds: [carlEmbed({ user, title: '🎧 VC Joined', channel: newS.channel, color: 0x2ecc71 })] });

  else if (oldS.channel && !newS.channel)
    log.send({ embeds: [carlEmbed({ user, title: '🎧 VC Left', channel: oldS.channel, color: 0xe74c3c })] });

  else if (oldS.channel && newS.channel && oldS.channel.id !== newS.channel.id)
    log.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
          .setTitle('🎧 VC Switched')
          .setDescription(`**From:** ${oldS.channel}\n**To:** ${newS.channel}`)
          .setTimestamp()
      ]
    });
});

/* ===== LOGIN BELOW (YOU ADD IT) ===== */
client.login(process.env.TOKEN);
