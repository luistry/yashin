const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); 
const { Frame } = require('./database/database');

module.exports = {
    name: 'frameshop',
    description: 'Browse and view frames available for your cards.',
    async run(message) {
        const frames = await Frame.find(); // Retrieve all frames from the database

        if (!frames.length) {
            return message.reply({ content: 'No frames available in the shop at the moment.', ephemeral: true });
        }

        let currentIndex = 0;

        // Generate an embed for the current frame
        const generateEmbed = (index, showFullImage = false) => {
            const frame = frames[index];
            const priceMoons = '800 :crescent_moon:';

            const embed = new EmbedBuilder()
                .setColor('#1E90FF')
                .setFooter({ text: `Frame ${index + 1} of ${frames.length}` });

            if (showFullImage && frame.imagecarousel) {
                embed.setImage(frame.imagecarousel);
            } else {
                embed
                    .setTitle(`🖼️ Frame Shop - ${frame.name || `Unknown Frame ${index + 1}`}`)
                    .setDescription(`✨ **ID:** \`${frame._id}\`\n\n📝 **Description:**\n${frame.description || 'No description available.'}\n\n💰 **Price:**\n\`\`\`• ${priceMoons}\`\`\`\n\n**To purchase:**\n\`y!buy ${frame.name}\``)
                    .setThumbnail(frame.imagecarousel);
            }

            return embed;
        };

        // Initial embed
        let embed = generateEmbed(currentIndex);

        // Buttons for navigation and viewing the full image
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('⬅️ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentIndex === 0),
                new ButtonBuilder()
                    .setCustomId('view_full_image')
                    .setLabel('🔍 View Full Image')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentIndex === frames.length - 1)
            );

        const backButton = new ButtonBuilder()
            .setCustomId('return_to_shop')
            .setLabel('↩️ Back to Shop')
            .setStyle(ButtonStyle.Primary);

        const sentMessage = await message.reply({ embeds: [embed], components: [row], ephemeral: true });

        // Collector to handle button interactions
        const filter = i => i.user.id === message.author.id;
        const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'previous' && currentIndex > 0) {
                currentIndex--;
            } else if (i.customId === 'next' && currentIndex < frames.length - 1) {
                currentIndex++;
            } else if (i.customId === 'view_full_image') {
                // Show the full image
                embed = generateEmbed(currentIndex, true);
                await i.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(backButton)] });
                return;
            } else if (i.customId === 'return_to_shop') {
                // Return to the shop view
                embed = generateEmbed(currentIndex);
                await i.update({ embeds: [embed], components: [row] });
                return;
            }

            // Update embed and button states
            embed = generateEmbed(currentIndex);
            row.components[0].setDisabled(currentIndex === 0);
            row.components[2].setDisabled(currentIndex === frames.length - 1);

            await i.update({ embeds: [embed], components: [row] });
        });

        collector.on('end', () => {
            row.components.forEach(button => button.setDisabled(true));
            sentMessage.edit({ components: [row] });
        });
    },
};
