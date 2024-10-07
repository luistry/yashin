const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { fetchAllInventories, AnimeCharacter } = require('./database/database'); // Function to fetch all inventories and AnimeCharacter model

module.exports = {
    name: 'card-owner',
    description: 'Displays the owners of a card based on the character name or series.',
    async run(message, args) {
        if (args.length === 0) {
            return message.channel.send('❗ **You need to provide the character\'s name or part of the series.**');
        }

        const query = args.join(' ').toLowerCase();

        try {
            // Fetch characters that match the query in either name or series
            const characters = await AnimeCharacter.find({
                $or: [
                    { name: { $regex: new RegExp(query, 'i') } },
                    { series: { $regex: new RegExp(query, 'i') } }
                ]
            }).limit(15); // Limit results to avoid flooding

            if (characters.length === 0) {
                return message.channel.send(`⚠️ **No characters or series matching "${query}" found in the database.**`);
            }

            // Create dropdown menu options for matching characters
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_character')
                .setPlaceholder('Select a character or series')
                .addOptions(
                    characters.map(character =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${character.name} (${character.series})`)
                            .setValue(character._id.toString()) // Use the unique ID as the value
                    )
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);
            const sentMessage = await message.channel.send({
                content: 'Select a character to view their card owners:',
                components: [row]
            });

            // Create a filter to capture interactions from the select menu
            const filter = i => i.customId === 'select_character' && i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                const selectedCharacterId = i.values[0];
                const character = await AnimeCharacter.findById(selectedCharacterId);
                
                if (!character) {
                    return i.reply({ content: 'Character not found.', ephemeral: true });
                }

                // Fetch all inventories to find owners of the character's cards
                const allInventories = await fetchAllInventories();

                const cards = allInventories.flatMap(inventory =>
                    inventory.cards?.filter(card => card?.name?.toLowerCase() === character.name.toLowerCase())
                        .map(card => ({ card, owner: inventory._id })) || [] // Ensure cards exist
                );

                // Prepare the card list based on character versions (__v)
                const completeCardList = Array.from({ length: character.__v + 1 }, (_, version) => {
                    const entry = cards.find(cardEntry => cardEntry.card.__v === version);

                    if (entry) {
                        const ownerTag = `<@${entry.owner}>`;
                        return { card: entry.card, ownerTag };
                    } else {
                        return { card: { name: character.name, __v: version }, ownerTag: 'Despawned' };
                    }
                });

                // Divide owners into pages of 8
                const ownersPerPage = 8;
                const pages = [];
                for (let i = 0; i < completeCardList.length; i += ownersPerPage) {
                    const currentPage = completeCardList.slice(i, i + ownersPerPage).map((entry, index) => {
                        return `${i + index + 1} • ${entry.card.name} [v${entry.card.__v}] • Owner: ${entry.ownerTag}`;
                    });
                    pages.push(currentPage);
                }

                // Create embed for character card owners
                const createEmbed = (pageIndex) => {
                    const pageContent = pages[pageIndex].join('\n');
                    return new EmbedBuilder()
                        .setTitle(`✨ Owners of "${character.name}"`)
                        .setDescription(pageContent)
                        .setColor('#FFD700')
                        .setFooter({ text: `Page ${pageIndex + 1} of ${pages.length}`, iconURL: message.author.displayAvatarURL() })
                        .setTimestamp();
                };

                // Create navigation buttons
                const createActionRow = (pageIndex) => {
                    return new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('previous_page')
                                .setLabel('Previous')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(pageIndex === 0), // Disable if it's the first page
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Next')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(pageIndex === pages.length - 1) // Disable if it's the last page
                        );
                };

                let currentPageIndex = 0;
                await i.update({
                    embeds: [createEmbed(currentPageIndex)],
                    components: [createActionRow(currentPageIndex)]
                });

                // Create a button collector
                const buttonFilter = i => i.user.id === message.author.id; // Only the message author can interact
                const buttonCollector = sentMessage.createMessageComponentCollector({ filter: buttonFilter, time: 60000 });

                buttonCollector.on('collect', async i => {
                    if (i.customId === 'next_page') {
                        currentPageIndex = Math.min(currentPageIndex + 1, pages.length - 1);
                    } else if (i.customId === 'previous_page') {
                        currentPageIndex = Math.max(currentPageIndex - 1, 0);
                    }

                    // Update the embed and buttons
                    await i.update({ embeds: [createEmbed(currentPageIndex)], components: [createActionRow(currentPageIndex)] });
                });

                buttonCollector.on('end', () => {
                    // Disable buttons after the collector ends
                    const disabledActionRow = createActionRow(currentPageIndex);
                    disabledActionRow.components.forEach(button => button.setDisabled(true));
                    sentMessage.edit({ components: [disabledActionRow] });
                });
            });

        } catch (error) {
            console.error('Error fetching card owners:', error);
            message.channel.send('❌ An error occurred while searching for the card owners.');
        }
    }
};
