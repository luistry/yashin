const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Frame } = require('./database/database');

module.exports = {
    name: 'frameshop',
    description: 'Browse and view frames for your cards.',
    async run(message) {
        const frames = await Frame.find(); // Get all frames from the collection

        if (!frames.length) {
            return message.reply({ content: 'No frames available in the shop.', ephemeral: true });
        }

        let currentIndex = 0;
        let variables = {};

        // Function to generate an embed for the current frame
        const generateEmbed = (index, showFullImage = false) => {
            const frame = frames[index];
            variables[`name${index}`] = frame.name || `Unknown Frame ${index + 1}`;
            variables[`description${index}`] = frame.description || `No description available for Frame ${index + 1}`;
            variables[`imagecarousel${index}`] = frame.imagecarousel || null;
            variables[`frameId${index}`] = frame._id || index + 1;

            const priceMoons = '800 :crescent_moon:';

            if (showFullImage && variables[`imagecarousel${index}`]) {
                // Embed to show the full image only
                return new EmbedBuilder()
                    .setImage(variables[`imagecarousel${index}`])
                    .setColor('#F0E68C')
                    .setFooter({ text: `Frame ${variables[`frameId${index}`]} of ${frames.length}` });
            }

            // Embed to display frame details
            return new EmbedBuilder()
                .setTitle(`🖼️ Frame Shop - ${variables[`name${index}`]}`)
                .setDescription(`✨ **ID:** \`${variables[`frameId${index}`]}\`\n\n📝 **Description:**\n${variables[`description${index}`]}\n\n💰 **Price:**\n\`\`\`• ${priceMoons}\`\`\`\n\n**To buy this frame, use:**\n\`y!buy ${variables[`name${index}`]} to purchase\``)
                .setThumbnail(variables[`imagecarousel${index}`]) // Show thumbnail of the frame
                .setFooter({ text: `Frame ${variables[`frameId${index}`]} of ${frames.length}` })
                .setColor('#1E90FF'); // Vibrant blue for a more attractive interface
        };

        // Initial embed
        let embed = generateEmbed(currentIndex);

        // Buttons for navigation and viewing the full image
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('← Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentIndex === 0),
                new ButtonBuilder()
                    .setCustomId('view_full_image')
                    .setLabel('🖼️ View Full Image')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next →')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentIndex === frames.length - 1)
            );

        const returnButton = new ButtonBuilder()
            .setCustomId('return_to_shop')
            .setLabel('Back to Shop')
            .setStyle(ButtonStyle.Primary);

        const sentMessage = await message.reply({ embeds: [embed], components: [row], ephemeral: true });

        // Create a collector to handle button interactions
        const filter = i => i.user.id === message.author.id;
        const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'previous' && currentIndex > 0) {
                currentIndex--;
            } else if (i.customId === 'next' && currentIndex < frames.length - 1) {
                currentIndex++;
            } else if (i.customId === 'view_full_image') {
                // Update the embed to show only the full image
                embed = generateEmbed(currentIndex, true);
                await i.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(returnButton)] });
                return;
            } else if (i.customId === 'return_to_shop') {
                // Return to shop view
                embed = generateEmbed(currentIndex);
                await i.update({ embeds: [embed], components: [row] });
                return;
            }

            // Regenerate the embed with the new frame
            embed = generateEmbed(currentIndex);

            // Update buttons
            row.components[0].setDisabled(currentIndex === 0);
            row.components[2].setDisabled(currentIndex === frames.length - 1);

            await i.update({ embeds: [embed], components: [row] });
        });

        collector.on('end', collected => {
            // Disable buttons after the collector ends
            row.components.forEach(button => button.setDisabled(true));
            sentMessage.edit({ components: [row] });
        });
    },
};
