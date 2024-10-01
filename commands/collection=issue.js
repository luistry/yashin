const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database');

module.exports = {
    name: 'collection=issue',
    description: 'Show the cards in the collection sorted by issue.',
    async run(message) {
        const userId = message.author.id;

        try {
            // Fetch the user's inventory
            const inventory = await fetchInventory(userId);
            let cards = inventory.cards || []; // Ensure cards is initialized as an array

            if (cards.length === 0) {
                return message.channel.send('You don\'t have any cards in your collection.');
            }

            // Filter out cards without name or series
            cards = cards.filter(card => card.name && card.series);

            // Sort cards by __v in ascending order
            cards.sort((a, b) => (a.__v || 0) - (b.__v || 0));

            const itemsPerPage = 8;
            let currentPage = 0;
            let sentMessage;

            // Generate the embed for the given page of cards
            const generateEmbed = (pageCards) => {
                const embed = new EmbedBuilder()
                    .setTitle(`${message.author.username}'s Collection Sorted by Issue`)
                    .setColor('#6e6e6e')
                    .setFooter({
                        text: `Page ${currentPage + 1} of ${Math.ceil(cards.length / itemsPerPage)} | Total cards: ${cards.length}`,
                    });

                const cardDescriptions = pageCards.map(card => {
                    if (!card.name) return '';

                    const code = card.code || 'Unknown Code';
                    const name = card.name || 'Unknown Name';
                    const series = card.series || 'Unknown Series';
                    const __v = card.__v !== undefined ? card.__v : 'Unknown';
                    const rarityInitial = card.rarity ? card.rarity.charAt(0).toUpperCase() : 'Unknown';

                    // Use the first character of tagName as an emoji or :black_large_square:
                    const tagSymbol = card.tagName ? card.tagName.charAt(0) : ':black_large_square:';

                    if (name === 'Unknown Name') {
                        return ''; // Skip this card
                    }

                    return `${tagSymbol} \`${code}\` • \`${name}\` • \`${series}\` • #${__v} • ${rarityInitial}`;
                }).filter(description => description !== '').join('\n'); // No line separator

                embed.setDescription(cardDescriptions);

                return embed;
            };

            const sendPage = async (page) => {
                const start = page * itemsPerPage;
                const end = Math.min(start + itemsPerPage, cards.length); // Ensure end does not exceed the total number of cards
                const pageCards = cards.slice(start, end);

                let embed = generateEmbed(pageCards);

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('first')
                            .setLabel('⏮️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setLabel('←')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('→')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(end >= cards.length),
                        new ButtonBuilder()
                            .setCustomId('last')
                            .setLabel('⏭️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(end >= cards.length)
                    );

                if (sentMessage) {
                    await sentMessage.edit({ embeds: [embed], components: [row] });
                } else {
                    sentMessage = await message.channel.send({ embeds: [embed], components: [row] });
                }

                const filter = i => i.user.id === message.author.id;
                const collector = sentMessage.createMessageComponentCollector({ filter });

                collector.on('collect', async i => {
                    // Acknowledge the interaction immediately
                    await i.deferUpdate();

                    try {
                        if (i.customId === 'first') {
                            currentPage = 0;
                            await sendPage(currentPage);
                        } else if (i.customId === 'previous') {
                            if (currentPage > 0) {
                                currentPage--;
                                await sendPage(currentPage);
                            }
                        } else if (i.customId === 'next') {
                            if (currentPage < Math.ceil(cards.length / itemsPerPage) - 1) {
                                currentPage++;
                                await sendPage(currentPage);
                            }
                        } else if (i.customId === 'last') {
                            currentPage = Math.ceil(cards.length / itemsPerPage) - 1;
                            await sendPage(currentPage);
                        }
                    } catch (error) {
                        // Ignore "unknown interaction" errors
                        if (error.message !== 'Unknown interaction') {
                            console.error('Error handling button interaction:', error);
                        }
                    }
                });
            };

            await sendPage(currentPage);

        } catch (error) {
            console.error('Error fetching inventory:', error);
            message.channel.send('An error occurred while trying to show your collection.');
        }
    }
};
