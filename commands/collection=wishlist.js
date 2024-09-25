const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, AnimeCharacter } = require('./database/database'); // Asegúrate de que la ruta sea correcta

module.exports = {
    name: 'collection=wishlist',
    description: 'Displays cards in the collection sorted by wishlist numbers.',
    async run(message) {
        const userId = message.author.id;

        try {
            // Fetch the user's inventory
            const inventory = await fetchInventory(userId);
            let cards = inventory.cards;

            if (!cards || cards.length === 0) {
                return message.channel.send('You have no cards in your collection.');
            }

            // Filter cards that have a name and series
            cards = cards.filter(card => card.name && card.series);

            // Get wishlist numbers from AnimeCharacter
            const wishlistData = await Promise.all(cards.map(async card => {
                const animeCharacter = await AnimeCharacter.findOne({
                    name: card.name,
                    series: card.series
                });

                let wishlist = 0; // Default wishlist is 0 if the character is not found
                if (animeCharacter) {
                    if (typeof animeCharacter.wishlist === 'string') {
                        wishlist = Number(animeCharacter.wishlist.trim()); // Convert to a number if it's a string
                    } else if (typeof animeCharacter.wishlist === 'number') {
                        wishlist = animeCharacter.wishlist; // Use directly if it's a number
                    }
                }

                return {
                    ...card,
                    wishlist: isNaN(wishlist) ? 0 : wishlist // Ensure wishlist is a valid number
                };
            }));

            // Sort cards by wishlist number in descending order
            wishlistData.sort((a, b) => b.wishlist - a.wishlist);

            const itemsPerPage = 8;
            let currentPage = 0;
            let sentMessage;

            const generateEmbed = (pageCards) => {
                const embed = new EmbedBuilder()
                    .setTitle(`${message.author.username}'s Collection`)
                    .setColor('#6e6e6e')
                    .setFooter({
                        text: `Page ${currentPage + 1} of ${Math.ceil(wishlistData.length / itemsPerPage)} | Total cards: ${wishlistData.length}`,
                    });

                // Build the description for the embed
                const cardDescriptions = pageCards
                    .map(card => {
                        if (card.name === 'Unknown Name') {
                            return ''; // Skip this card
                        }

                        const rarityInitial = card.rarity ? card.rarity.charAt(0).toUpperCase() : 'Unknown';
                        const wishlist = `💖 ${card.wishlist || 0}`;
                        return `${wishlist} • \`${card.code}\` • \`${card.name}\` • \`${card.series}\` • #${card.__v} • ${rarityInitial}`;
                    })
                    .filter(description => description !== '')
                    .join('\n'); // Join descriptions with new lines

                embed.setDescription(cardDescriptions);

                return embed;
            };

            const sendPage = async (page) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const pageCards = wishlistData.slice(start, end);

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
                            .setDisabled(end >= wishlistData.length),
                        new ButtonBuilder()
                            .setCustomId('last')
                            .setLabel('⏭️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(end >= wishlistData.length)
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
                            if (end < wishlistData.length) {
                                currentPage++;
                                await sendPage(currentPage);
                            }
                        } else if (i.customId === 'last') {
                            currentPage = Math.ceil(wishlistData.length / itemsPerPage) - 1;
                            await sendPage(currentPage);
                        }
                    } catch (error) {
                        console.error('Error handling button interaction:', error);
                    }
                });
            };

            await sendPage(currentPage);

        } catch (error) {
            console.error('Error fetching inventory:', error);
            message.channel.send('There was an error trying to display your collection.');
        }
    }
};
