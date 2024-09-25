const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database'); // Ensure the path is correct

module.exports = {
    name: 'collection=tag',
    description: 'Displays the cards in the collection filtered by tag.',
    async run(message) {
        const userId = message.author.id;
        
        // Extract the tag name from the command
        const tagName = message.content.replace(/^y!collection=tag\s*/i, '').trim().toLowerCase();

        try {
            // Fetch the user's inventory
            const inventory = await fetchInventory(userId);
            let cards = inventory.cards;

            if (!cards || cards.length === 0) {
                return message.channel.send('You don\'t have any cards in your collection.');
            }

            // Filter the cards by the specified tag (case insensitive)
            cards = cards.filter(card => 
                card.tagName && 
                (card.tagName.toLowerCase().includes(tagName) || tagName === card.tagName.replace(/.*?(\S+)$/, '$1').toLowerCase())
            );

            if (cards.length === 0) {
                return message.channel.send(`No cards found for the tag "${tagName}".`);
            }

            // Sort the cards by name alphabetically
            cards.sort((a, b) => a.name.localeCompare(b.name));

            const itemsPerPage = 8;
            let currentPage = 0;
            let sentMessage;

            const generateEmbed = (pageCards) => {
                const embed = new EmbedBuilder()
                    .setTitle(`${message.author.username}'s Collection`)
                    .setDescription(`Here are your cards tagged with: **${tagName}**`)
                    .setColor('#6e6e6e')
                    .setFooter({
                        text: `Page ${currentPage + 1} of ${Math.ceil(cards.length / itemsPerPage)} | Total cards: ${cards.length}`,
                    });

                // Create the description for the cards
                const cardDescriptions = pageCards.map(card => {
                    // Tag prefix, or '⬛' if no tag
                    const tagPrefix = card.tagName ? String.fromCodePoint(card.tagName.codePointAt(0)) : '⬛';

                    // Initial rarity
                    const rarityInitial = card.rarity ? card.rarity.charAt(0).toUpperCase() : 'Unknown Rarity';

                    // Construct the card line
                    return `${tagPrefix} \`${card.code}\` • \`${card.name}\` • \`${card.series}\` • #${card.__v} • ${rarityInitial}`;
                }).join('\n'); // Join cards without extra space

                embed.setDescription(cardDescriptions);
                return embed;
            };

            const sendPage = async (page) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
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
                    try {
                        await i.deferUpdate();

                        if (i.customId === 'first') {
                            currentPage = 0;
                            await sendPage(currentPage);
                        } else if (i.customId === 'previous') {
                            if (currentPage > 0) {
                                currentPage--;
                                await sendPage(currentPage);
                            }
                        } else if (i.customId === 'next') {
                            if (end < cards.length) {
                                currentPage++;
                                await sendPage(currentPage);
                            }
                        } else if (i.customId === 'last') {
                            currentPage = Math.ceil(cards.length / itemsPerPage) - 1;
                            await sendPage(currentPage);
                        }
                    } catch (error) {
                        console.error('Error handling button interaction:', error);
                    }
                });
            };

            await sendPage(currentPage);

        } catch (error) {
            console.error('Error fetching the inventory:', error);
            message.channel.send('An error occurred while trying to display your collection.');
        }
    }
};
