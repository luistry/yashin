const { EmbedBuilder, Colors } = require("discord.js");
const mongoose = require('mongoose'); // Asegúrate de importar mongoose para acceder a la conexión

module.exports = {
    description: "Checks the bot's latency and database connection.",
    run: async (message) => {
        // Record the time before sending the message
        const sentMessage = await message.reply('Pinging...');

        // Calculate the round-trip time for bot latency
        const botLatency = sentMessage.createdTimestamp - message.createdTimestamp;

        // Measure API latency
        const apiLatency = Math.round(message.client.ws.ping);

        // Measure database latency
        const dbPingStart = Date.now();
        try {
            await mongoose.connection.db.command({ ping: 1 }); // Command to ping the database
            const dbPingEnd = Date.now();
            const dbLatency = dbPingEnd - dbPingStart;

            // Create an embed message
            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('🏓 Pong!')
                .setDescription(`Bot latency: **${botLatency}ms**\nAPI latency: **${apiLatency}ms**\nDatabase latency: **${dbLatency}ms**`)
                .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            // Edit the original message with the embed
            await sentMessage.edit({ content: null, embeds: [embed] });
        } catch (error) {
            console.error('Error pinging the database:', error);
            const embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('🏓 Pong!')
                .setDescription(`Bot latency: **${botLatency}ms**\nAPI latency: **${apiLatency}ms**\nDatabase connection error!`)
                .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            // Edit the original message with the embed
            await sentMessage.edit({ content: null, embeds: [embed] });
        }
    }
};
