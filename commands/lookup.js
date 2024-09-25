const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { AnimeCharacter } = require('./database/database'); // Ensure the path is correct

module.exports = {
    name: 'lookup',
    description: 'Searches for anime characters by name.',
    run: async (message, args) => {
        try {
            const query = args.join(' '); // Assuming the character name is passed as an argument
            if (!query) {
                return message.channel.send('Please provide a character name to search.');
            }

            // Find characters matching the query
            const characters = await AnimeCharacter.find({
                name: new RegExp(query, 'i')
            }).limit(15); // Limit results to 15 per page

            if (characters.length === 0) {
                return message.channel.send('No characters found with that name.');
            }

            // Create embeds for characters
            const pages = [];
            const itemsPerPage = 10;
            for (let i = 0; i < characters.length; i += itemsPerPage) {
                const currentItems = characters.slice(i, i + itemsPerPage);

                const embed = new EmbedBuilder()
                    .setColor('#0099ff') // Choose a color for the embed
                    .setTitle('Character Lookup')
                    .setDescription(currentItems.map((character, index) =>
                        `${i + index + 1} • ❤️${character.wishlist || 0} • ${character.name} • ${character.series}`
                    ).join('\n'))
                    .setFooter({ text: `Page ${Math.ceil(i / itemsPerPage) + 1} of ${Math.ceil(characters.length / itemsPerPage)}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                // Create a dropdown menu with options for the current page, using the unique ID as the value
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_character')
                    .setPlaceholder('Select a character')
                    .addOptions(
                        currentItems.map((character, index) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(`${i + index + 1} • ${character.name}`)
                                .setValue(character._id.toString()) // Use the unique ID as the value
                        )
                    );

                const row = new ActionRowBuilder()
                    .addComponents(selectMenu); // Only the dropdown menu

                // Add navigation buttons if there are multiple pages
                if (characters.length > itemsPerPage) {
                    const navigationRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('previous_page')
                                .setLabel('Previous')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true), // Disable initially until we update the logic
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Next')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(characters.length <= itemsPerPage) // Disable if only one page
                        );

                    pages.push({ embed, row: [row, navigationRow] });
                } else {
                    pages.push({ embed, row: [row] });
                }
            }

            const sentMessage = await message.channel.send({ embeds: [pages[0].embed], components: pages[0].row });

            // Handle interactions with buttons
            const filter = i => i.customId === 'select_character' || i.customId === 'previous_page' || i.customId === 'next_page';
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            let pageIndex = 0;

            // Updates navigation buttons based on the current page
            function updateNavigationButtons() {
                return new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIndex === 0), // Disable if on the first page
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIndex === pages.length - 1) // Disable if on the last page
                    );
            }

            collector.on('collect', async i => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: 'You are not allowed to use these buttons.', ephemeral: true });
                }

                if (i.customId === 'select_character') {
                    const selectedCharacterId = i.values[0]; // Get the selected character ID
                    const character = await AnimeCharacter.findOne({ _id: selectedCharacterId });
                    if (!character) {
                        return i.reply({ content: 'Character not found.', ephemeral: true });
                    }

                    const detailEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(character.name)
                        .setDescription(`**Series:** ${character.series}\n**ID:** ${character._id}\n**Edition:** 1 \n**Wishlist:** ${character.wishlist || '0'}\n**Generated:** ${character.__v || 0}\n**Burned:** ${character.burned}`)
                        .setThumbnail(character.img_url) // Set the thumbnail
                        .setImage(character.img_url) // Show a larger version of the image
                        .setFooter({ text: 'Character Details', iconURL: message.author.displayAvatarURL() })
                        .setTimestamp();

                    await i.update({ embeds: [detailEmbed], components: [] }); // Remove buttons after selection
                } else {
                    if (i.customId === 'next_page') {
                        pageIndex = Math.min(pageIndex + 1, pages.length - 1);
                    } else if (i.customId === 'previous_page') {
                        pageIndex = Math.max(pageIndex - 1, 0);
                    }

                    await i.update({ embeds: [pages[pageIndex].embed], components: [pages[pageIndex].row[0], updateNavigationButtons()] });
                }
            });

            collector.on('end', collected => {
                // Disable buttons after the collector ends
                const disabledRow = updateNavigationButtons();
                disabledRow.components.forEach(button => button.setDisabled(true));
                sentMessage.edit({ components: [pages[pageIndex].row[0], disabledRow] });
            });

        } catch (error) {
            console.error('Error searching for characters:', error);
            return message.channel.send('There was an error searching for the character. Please try again later.');
        }
    },
};
