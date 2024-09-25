const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateInventory, Inventory, AnimeCharacter } = require('./database/database'); // Ensure the path is correct

module.exports = {
    name: 'wishlistremove',
    description: 'Removes a character from your wishlist.',
    run: async (message, args) => {
        try {
            // Fetch the user's inventory
            const userInventory = await fetchInventory(message.author.id);

            if (!userInventory || !userInventory.wishlist || userInventory.wishlist.length === 0) {
                return message.channel.send('Your wishlist is empty.');
            }

            // Create a dropdown menu with the wishlist characters
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_character')
                .setPlaceholder('Select a character to remove')
                .addOptions(
                    userInventory.wishlist.map(item => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${item.name} - ${item.series}`)
                            .setValue(`${item.name}:${item.series}`) // Value format for identification
                    )
                );

            const row = new ActionRowBuilder()
                .addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Remove Character from Wishlist')
                .setDescription('Please select the character you want to remove from your wishlist.')
                .setFooter({ text: 'Select a character', iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

            // Handle interactions with the dropdown menu
            const filter = i => i.customId === 'select_character' && i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                const [name, series] = i.values[0].split(':');
                const userInventory = await fetchInventory(message.author.id);

                // Check if the character is in the user's wishlist
                const characterIndex = userInventory.wishlist.findIndex(item => 
                    item.name.trim().toLowerCase() === name.trim().toLowerCase() && 
                    item.series.trim().toLowerCase() === series.trim().toLowerCase()
                );

                if (characterIndex === -1) {
                    return i.reply({ content: 'Character not found in your wishlist.', ephemeral: true });
                }

                // Create confirmation buttons
                const confirmButton = new ButtonBuilder()
                    .setCustomId('confirm_remove')
                    .setLabel('Confirm Removal')
                    .setStyle(ButtonStyle.Danger);

                const cancelButton = new ButtonBuilder()
                    .setCustomId('cancel_remove')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary);

                const actionRow = new ActionRowBuilder()
                    .addComponents(confirmButton, cancelButton);

                // Update the message with confirmation buttons
                await i.update({
                    content: `You have selected ${name} - ${series}. Do you want to remove it from your wishlist?`,
                    components: [actionRow]
                });

                // Handle interactions with the confirmation buttons
                const buttonFilter = b => (b.customId === 'confirm_remove' || b.customId === 'cancel_remove') && b.user.id === message.author.id;
                const buttonCollector = sentMessage.createMessageComponentCollector({ filter: buttonFilter, time: 60000 });

                buttonCollector.on('collect', async b => {
                    if (b.customId === 'confirm_remove') {
                        // Remove the character from the user's wishlist
                        userInventory.wishlist.splice(characterIndex, 1);

                        // Update the user's inventory in the database
                        await updateInventory(message.author.id, { wishlist: userInventory.wishlist });

                        // Update the wishlist count in the character database
                        await AnimeCharacter.updateOne(
                            { name: name.trim(), series: series.trim() },
                            { $inc: { wishlist: -1 } } // Decrement the wishlist count
                        );

                        await b.update({ content: `Removed ${name} - ${series} from your wishlist.`, components: [] });

                        // Create an embed to show the updated wishlist
                        const updatedWishlist = userInventory.wishlist.map(item => `:heart: • ${item.name} - ${item.series}`).join('\n\n');
                        const updateEmbed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('Updated Wishlist')
                            .setDescription(updatedWishlist || 'Your wishlist is now empty.')
                            .setFooter({ text: 'List of characters in your wishlist', iconURL: message.author.displayAvatarURL() })
                            .setTimestamp();

                        await message.channel.send({ embeds: [updateEmbed] });
                    } else if (b.customId === 'cancel_remove') {
                        await b.update({ content: 'Character removal cancelled.', components: [] });
                    }
                });

                buttonCollector.on('end', collected => {
                    // Disable the select menu and buttons after the collector ends
                    selectMenu.setDisabled(true);
                    sentMessage.edit({ components: [new ActionRowBuilder().addComponents(selectMenu)] });
                });

            });

            collector.on('end', collected => {
                // Disable the select menu after the collector ends
                selectMenu.setDisabled(true);
                sentMessage.edit({ components: [new ActionRowBuilder().addComponents(selectMenu)] });
            });

        } catch (error) {
            console.error('Error removing character from wishlist:', error);
            await message.channel.send('There was an error removing the character from your wishlist. Please try again later.');
        }
    },
};
