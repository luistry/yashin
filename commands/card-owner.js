const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchAllInventories, AnimeCharacter } = require('./database/database'); // Function to fetch all inventories and AnimeCharacter model

module.exports = {
    name: 'card-owner',
    description: 'Displays the owners of a card based on the character name.',
    async run(message, args) {
        if (args.length === 0) {
            return message.channel.send('❗ **You need to provide the character\'s name.**');
        }

        const characterName = args.join(' ').toLowerCase();

        try {
            // Fetch the character details from the AnimeCharacter collection to find the max __v
            const characterData = await AnimeCharacter.findOne({ name: { $regex: new RegExp(`^${characterName}$`, 'i') } });

            if (!characterData) {
                return message.channel.send(`⚠️ **Character "${characterName}" not found in the database.**`);
            }

            // Get the maximum version from the character data
            const maxVersion = characterData.__v;

            // Fetch all inventories
            const allInventories = await fetchAllInventories();

            // Filter inventories to find the cards that match the character name
            const cards = allInventories.flatMap(inventory =>
                inventory.cards?.filter(card => card?.name?.toLowerCase() === characterName)
                    .map(card => ({ card, owner: inventory._id })) || [] // Ensure cards exist, otherwise return an empty array
            );

            // Create an array from 0 to maxVersion and map each version to either a card or "Despawned"
            const completeCardList = Array.from({ length: maxVersion + 1 }, (_, version) => {
                const entry = cards.find(cardEntry => cardEntry.card.__v === version);

                if (entry) {
                    const ownerTag = `<@${entry.owner}>`;
                    return { card: entry.card, ownerTag };
                } else if (version === 0 && maxVersion === 0) {
                    // Handle case where the card has not spawned yet (__v is 0 and hasn't appeared)
                    return { card: { name: characterName, __v: 0 }, ownerTag: 'No Spawned' };
                } else {
                    return { card: { name: characterName, __v: version }, ownerTag: 'Despawned' };
                }
            });

            // Divide the owners into pages of 8
            const ownersPerPage = 8;
            const pages = [];
            for (let i = 0; i < completeCardList.length; i += ownersPerPage) {
                const currentPage = completeCardList.slice(i, i + ownersPerPage).map((entry, index) => {
                    return `${i + index + 1} • ${entry.card.name} [v${entry.card.__v}] • Owner: ${entry.ownerTag}`;
                });
                pages.push(currentPage);
            }

            // Function to create the embed
            const createEmbed = (pageIndex) => {
                const pageContent = pages[pageIndex].join('\n');
                return new EmbedBuilder()
                    .setTitle(`✨ Owners of "${characterName}"`)
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
            const sentMessage = await message.channel.send({ embeds: [createEmbed(currentPageIndex)], components: [createActionRow(currentPageIndex)] });

            // Create a button collector
            const filter = i => i.user.id === message.author.id; // Only the message author can interact
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'next_page') {
                    currentPageIndex = Math.min(currentPageIndex + 1, pages.length - 1);
                } else if (i.customId === 'previous_page') {
                    currentPageIndex = Math.max(currentPageIndex - 1, 0);
                }

                // Update the embed and buttons
                await i.update({ embeds: [createEmbed(currentPageIndex)], components: [createActionRow(currentPageIndex)] });
            });

            collector.on('end', () => {
                // Disable buttons after the collector ends
                const disabledActionRow = createActionRow(currentPageIndex);
                disabledActionRow.components.forEach(button => button.setDisabled(true));
                sentMessage.edit({ components: [disabledActionRow] });
            });

        } catch (error) {
            console.error('Error fetching card owners:', error);
            message.channel.send('❌ An error occurred while searching for the card owners.');
        }
    }
};
