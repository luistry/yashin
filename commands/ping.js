const { EmbedBuilder, Colors } = require("discord.js");

module.exports = {
    description: "Checks the bot's latency.",
    run: async (message) => {
        // Record the time before sending the message
        const sentMessage = await message.reply('Pinging...');

        // Calculate the round-trip time
        const latency = sentMessage.createdTimestamp - message.createdTimestamp;

        // Create an embed message
        const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('🏓 Pong!')
            .setDescription(`Bot latency is ${latency}ms.\nAPI latency is ${Math.round(message.client.ws.ping)}ms.`)
            .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        // Edit the original message with the embed
        await sentMessage.edit({ content: null, embeds: [embed] });
    }
};
