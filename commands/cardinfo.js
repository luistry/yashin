const { EmbedBuilder } = require('discord.js');
const { fetchInventory } = require('./database/database');

module.exports = {
    name: 'cardinfo',
    description: 'Get information about a specific card by its code',
    async run(message, args) {
        if (args.length === 0) {
            return message.channel.send('❗ **Please provide a card code.**');
        }

        const cardCode = args[0];
        try {
            const inventory = await fetchInventory(message.author.id);

            const card = inventory.cards.find(c => c.code === cardCode);

            if (!card) {
                return message.channel.send('⚠️ **Card not found in your inventory.**');
            }

            const { _id, name, series, img_url, rarity, code, dropped_on, grabbed_by, channel_id, guild_id } = card;

            // Formatear la fecha con horas y minutos
            const dropDate = dropped_on ? new Date(dropped_on).toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: '2-digit', minute: '2-digit', second: '2-digit' 
            }) : 'Unknown';

            // Crear el embed con un aspecto más bonito
            const embed = new EmbedBuilder()
                .setTitle(`✨ Card Information: **${name}**`)
                .setThumbnail(img_url)
                .setColor('#FFD700') // Color dorado
                .addFields(
                    { name: '🆔 ID', value: `\`${_id.toString()}\``, inline: true },
                    { name: '📚 Series', value: series || 'Unknown', inline: true },
                    { name: '🏆 Rarity', value: rarity || 'Unknown', inline: true },
                    { name: '🔑 Code', value: `\`${code || 'Unknown'}\``, inline: true },
                    { name: '📅 Dropped On', value: dropDate, inline: false },
                    { name: '🙋 Grabbed By', value: grabbed_by ? `<@${grabbed_by}>` : 'Unknown', inline: true }, // Ping al usuario
                    { name: '🔢 Channel ID', value: channel_id || 'Unknown', inline: true },
                    { name: '🌐 Guild ID', value: guild_id || 'Unknown', inline: true }
                )
                .setFooter({ text: 'Use this card wisely!', iconURL: message.author.displayAvatarURL() })
                .setTimestamp(); // Añadir timestamp

            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching card info:', error);
            message.channel.send('❌ An error occurred while fetching the card info.');
        }
    }
};
