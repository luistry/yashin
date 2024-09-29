const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database');

module.exports = {
    name: 'c',
    description: 'Show the cards in the collection, optionally of another user.',
    async run(message) {
        const mentionedUser = message.mentions.users.first();
        const providedId = message.content.split(' ')[1];
        const userId = mentionedUser ? mentionedUser.id : providedId || message.author.id;

        const displayName = mentionedUser 
            ? mentionedUser.username 
            : providedId && await message.client.users.fetch(providedId).then(user => user.username).catch(() => null) 
            || message.author.username;

        try {
            const inventory = await fetchInventory(userId);
            let cards = inventory.cards || []; // Use let to allow reassignment after filtering

            if (!Array.isArray(cards) || cards.length === 0) {
                return message.channel.send(`${displayName} doesn't have any cards in their collection.`);
            }

            // Lógica de filtrado
            const searchQuery = message.content.slice(2 + (providedId ? providedId.length : 0)).trim();
            if (searchQuery) {
                // Filtrar por nombre de personaje
                const characterMatch = searchQuery.match(/name:\s*([\w\s]+)/i);
                if (characterMatch) {
                    const characterName = characterMatch[1].toLowerCase().trim();
                    cards = cards.filter(card => card.name && card.name.toLowerCase().includes(characterName));
                }

                // Filtrar por serie
                const seriesMatch = searchQuery.match(/series:\s*([\w\s]+)/i);
                if (seriesMatch) {
                    const seriesName = seriesMatch[1].toLowerCase().trim();
                    cards = cards.filter(card => card.series && card.series.toLowerCase().includes(seriesName));
                }

                // Filtrar por etiqueta (tag)
                const tagMatch = searchQuery.match(/t:\s*([\w\s]+)/i);
                if (tagMatch) {
                    const tagName = tagMatch[1].toLowerCase().trim();
                    cards = cards.filter(card => card.tagName && card.tagName.toLowerCase().includes(tagName));
                }

                // Filtrar por __v (version) de menor a mayor
                const orderMatch = searchQuery.match(/o:p/i);
                if (orderMatch) {
                    cards.sort((a, b) => (a.__v || 0) - (b.__v || 0));
                }
            }

            const itemsPerPage = 8;
            let currentPage = 0;
            let sentMessage;

            const generateEmbed = (pageCards) => {
                const embed = new EmbedBuilder()
                    .setTitle(`${displayName}'s Collection`)
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

                    const tagPrefix = card.tagName ? String.fromCodePoint(card.tagName.codePointAt(0)) : '⬛';

                    return `${tagPrefix} \`${code}\` • \`${name}\` • \`${series}\` • #${__v} • ${rarityInitial}`;
                }).filter(description => description !== '').join('\n');

                embed.setDescription(cardDescriptions);

                return embed;
            };

            const sendPage = async (page) => {
                const start = page * itemsPerPage;
                const end = Math.min(start + itemsPerPage, cards.length);
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
                        } else if (i.customId === 'previous' && currentPage > 0) {
                            currentPage--;
                        } else if (i.customId === 'next' && currentPage < Math.ceil(cards.length / itemsPerPage) - 1) {
                            currentPage++;
                        } else if (i.customId === 'last') {
                            currentPage = Math.ceil(cards.length / itemsPerPage) - 1;
                        }

                        await sendPage(currentPage);
                    } catch (error) {
                        if (error.code === 10062) {
                            console.warn('Ignoring unknown interaction error');
                        } else {
                            console.error('Error handling button interaction:', error);
                        }
                    }
                });
            };

            await sendPage(currentPage);

        } catch (error) {
            console.error('Error fetching inventory:', error);
            message.channel.send('An error occurred while trying to show the collection.');
        }
    }
};
