const { EmbedBuilder } = require('discord.js');
const { fetchAllInventories } = require('./database/database');

module.exports = {
    name: 'ci',
    description: 'Get information about a specific card by its code',
    async run(message, args) {
        if (args.length === 0) {
            return message.channel.send('❗ **Please provide a card code.**');
        }

        const cardCode = args[0];

        try {
            // Fetch all inventories to search for the card across all users
            const allInventories = await fetchAllInventories();
            
            let card = null;
            let cardOwner = null;

            // Search through all inventories to find the card by its code
            for (const inventory of allInventories) {
                card = inventory.cards.find(c => c.code === cardCode);
                if (card) {
                    cardOwner = inventory._id;  // Save the owner's ID
                    break;
                }
            }

            if (!card) {
                return message.channel.send('⚠️ **Card not found in any inventory.**');
            }

            const { _id, name, series, img_url, rarity, code, dropped_on, grabbed_by, channel_id, guild_id } = card;

            // Format the date with hours and minutes
            const dropDate = dropped_on ? new Date(dropped_on).toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: '2-digit', minute: '2-digit', second: '2-digit' 
            }) : 'Unknown';

            // Create the embed with card details
            const embed = new EmbedBuilder()
                .setTitle(`✨ Card Information: **${name}**`)
                .setThumbnail(img_url)
                .setColor('#FFD700') // Golden color
                .addFields(
                    { name: '🆔 ID', value: `\`${_id.toString()}\``, inline: true },
                    { name: '📚 Series', value: series || 'Unknown', inline: true },
                    { name: '🏆 Rarity', value: rarity || 'Unknown', inline: true },
                    { name: '🔑 Code', value: `\`${code || 'Unknown'}\``, inline: true },
                    { name: '📅 Dropped On', value: dropDate, inline: false },
                    { name: '🙋 Grabbed By', value: grabbed_by ? `<@${grabbed_by}>` : 'Unknown', inline: true },
                    { name: '🔢 Channel ID', value: channel_id || 'Unknown', inline: true },
                    { name: '🌐 Guild ID', value: guild_id || 'Unknown', inline: true },
                    { name: '👤 Card Owner', value: `<@${cardOwner}>`, inline: true } // Shows the card owner
                )
                .setFooter({ text: 'Use this card wisely!', iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching card info:', error);
            message.channel.send('❌ An error occurred while fetching the card info.');
        }
    }
};
