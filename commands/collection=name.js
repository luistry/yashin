const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database');

module.exports = {
    name: 'collection=name',
    description: 'Displays the cards in the collection filtered by character name.',
    async run(message) {
        // Extrae el término de búsqueda quitando "collection=name" del comando completo
        const searchTerm = message.content.replace(/^y!collection=name\s*/i, '').trim().toLowerCase();

        // Verifica si se ha proporcionado un término de búsqueda
        if (!searchTerm) {
            return message.channel.send('Please provide a character name to search for.');
        }

        const userId = message.author.id;

        try {
            // Obtén el inventario del usuario
            const inventory = await fetchInventory(userId);
            let cards = inventory?.cards || [];

            if (cards.length === 0) {
                return message.channel.send('You don\'t have any cards in your collection.');
            }

            // Filtra las cartas cuyo nombre coincida con el término de búsqueda (insensible a mayúsculas)
            cards = cards.filter(card => card.name && card.name.toLowerCase().includes(searchTerm));

            if (cards.length === 0) {
                return message.channel.send(`No characters found with the name containing "${searchTerm}".`);
            }

            // Ordena las cartas por nombre de personaje de forma alfabética
            cards.sort((a, b) => a.name.localeCompare(b.name));

            const itemsPerPage = 8;
            let currentPage = 0;
            let sentMessage;

            const generateEmbed = (pageCards) => {
                const embed = new EmbedBuilder()
                    .setTitle(`${message.author.username}'s Collection`)
                    .setDescription('Here are your cards sorted by character name:')
                    .setColor('#6e6e6e')
                    .setFooter({
                        text: `Page ${currentPage + 1} of ${Math.ceil(cards.length / itemsPerPage)} | Total cards: ${cards.length}`,
                    });

                const cardDescriptions = pageCards.map(card => {
                    const tagPrefix = card.tagName ? String.fromCodePoint(card.tagName.codePointAt(0)) : '⬛';
                    const rarityInitial = card.rarity ? card.rarity.charAt(0).toUpperCase() : 'Unknown Rarity';
                    return `${tagPrefix} \`${card.code}\` • \`${card.name}\` • \`${card.series}\` • #${card.__v} • ${rarityInitial}`;
                }).join('\n');

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
                            if (currentPage < Math.ceil(cards.length / itemsPerPage) - 1) {
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
            console.error('Error fetching inventory:', error);
            message.channel.send('An error occurred while trying to display your collection.');
        }
    }
};
