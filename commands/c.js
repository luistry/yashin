const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database');

module.exports = {
    name: 'c',
    description: 'Show the cards in the collection, optionally of another user.',
    async run(message) {
        const mentionedUser = message.mentions.users.first();
        const providedId = message.content.split(' ')[1];

        const userId = mentionedUser 
            ? mentionedUser.id 
            : providedId && providedId.match(/^\d{17,19}$/)
                ? providedId 
                : message.author.id;

        const displayName = mentionedUser 
            ? mentionedUser.username 
            : providedId && await message.client.users.fetch(providedId).then(user => user.username).catch(() => null) 
            || message.author.username;

        try {
            console.log(`Fetching inventory for user ID: ${userId}`);

            const inventory = await fetchInventory(userId);
            console.log('Inventory fetched:', inventory);

            if (!inventory || !Array.isArray(inventory.cards) || inventory.cards.length === 0) {
                return message.channel.send(`${displayName} doesn't have any cards in their collection.`);
            }

            let cards = inventory.cards;

            const contentAfterCommand = message.content.slice(message.content.indexOf(' ') + 1).trim();
            const searchQuery = mentionedUser || (providedId && providedId.match(/^\d{17,19}$/)) 
                ? contentAfterCommand.replace(providedId, '').trim()
                : contentAfterCommand;

            if (searchQuery) {
                const characterMatch = searchQuery.match(/name:\s*([\w\s]+)/i);
                if (characterMatch) {
                    const characterName = characterMatch[1].toLowerCase().trim();
                    cards = cards.filter(card => card.name && card.name.toLowerCase().includes(characterName));
                }

                const seriesMatch = searchQuery.match(/series:\s*([\w\s]+)/i);
                if (seriesMatch) {
                    const seriesName = seriesMatch[1].toLowerCase().trim();
                    cards = cards.filter(card => card.series && card.series.toLowerCase().includes(seriesName));
                }

                const tagMatch = searchQuery.match(/t:\s*([\w\s]+)/i);
                if (tagMatch) {
                    const tagName = tagMatch[1].toLowerCase().trim();
                    cards = cards.filter(card => card.tagName && card.tagName.toLowerCase().includes(tagName));
                }

                const orderMatch = searchQuery.match(/o:p/i);
                if (orderMatch) {
                    cards = cards.sort((a, b) => (a.__v || 0) - (b.__v || 0));
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
            };

            const handleInteraction = async (interaction) => {
                try {
                    if (interaction.customId === 'first') {
                        currentPage = 0;
                    } else if (interaction.customId === 'previous' && currentPage > 0) {
                        currentPage--;
                    } else if (interaction.customId === 'next' && currentPage < Math.ceil(cards.length / itemsPerPage) - 1) {
                        currentPage++;
                    } else if (interaction.customId === 'last') {
                        currentPage = Math.ceil(cards.length / itemsPerPage) - 1;
                    }

                    await sendPage(currentPage);

                    // Deferred update with error handling for unknown interaction
                    await interaction.deferUpdate().catch((error) => {
                        if (error.code === 10062) {
                            console.log('Ignoring unknown interaction');
                        } else {
                            console.error('Error handling button interaction:', error);
                        }
                    });
                } catch (error) {
                    console.error('Error handling button interaction:', error);
                }
            };

            await sendPage(currentPage);

            // Preload and handle future interactions without expiration
            const collector = message.channel.createMessageComponentCollector({ time: 3600000 });

            collector.on('collect', async i => {
                await handleInteraction(i);
            });

            collector.on('end', async () => {
                try {
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('first')
                                .setLabel('⏮️')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('previous')
                                .setLabel('←')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('next')
                                .setLabel('→')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('last')
                                .setLabel('⏭️')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true)
                        );
                    await sentMessage.edit({ components: [disabledRow] });
                } catch (error) {
                    console.error('Error disabling buttons after collector end:', error);
                }
            });

        } catch (error) {
            console.error('Error fetching inventory:', error);
            message.channel.send('An error occurred while trying to show the collection.');
        }
    }
};
