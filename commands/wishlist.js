const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, AnimeCharacter } = require('./database/database');

module.exports = {
    name: 'wishlist',
    description: 'Displays the wishlist of a user and compares it with the inventory of another.',
    run: async (message) => {
        try {
            const targetUser = message.mentions.users.first() || message.author;
            const targetInventory = await fetchInventory(targetUser.id);

            if (!targetInventory || !targetInventory.wishlist || targetInventory.wishlist.length === 0) {
                return message.channel.send(`${targetUser.username}'s wishlist is empty.`);
            }

            const userInventory = await fetchInventory(message.author.id);

            const wishlistLimit = targetInventory.limited || 10;
            const remainingSlots = wishlistLimit - targetInventory.wishlist.length;
            const itemsPerPage = 10;
            let currentPage = 0;

            const wishlistItems = await Promise.all(targetInventory.wishlist.map(async item => {
                const { name, series } = item;
                const character = await AnimeCharacter.findOne({ name, series });
                const wishlistCount = character ? character.wishlist : 'Not specified';
                return { name, series, wishlistCount };
            }));

            const matchingItems = wishlistItems
                .map(item => {
                    const matchingCard = userInventory.cards.find(card =>
                        card.name.toLowerCase() === item.name.toLowerCase() &&
                        card.series.toLowerCase() === item.series.toLowerCase()
                    );
                    if (matchingCard) {
                        return {
                            name: matchingCard.name,
                            series: matchingCard.series,
                            code: matchingCard.code
                        };
                    }
                    return null;
                })
                .filter(item => item !== null);

            const generateEmbed = (page) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const currentItems = wishlistItems.slice(start, end);

                const description = currentItems.map(item => `❤️ ${item.wishlistCount} • ${item.name} - ${item.series}`).join('\n');
                const embedDescription = description.length > 2048 ? description.slice(0, 2048) + '...' : description;

                return new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`${targetUser.username}'s Wishlist (Page ${page + 1} of ${Math.ceil(wishlistItems.length / itemsPerPage)})`)
                    .setDescription(`\`\`\`${embedDescription}\`\`\``)
                    .setFooter({
                        text: `Wishlist slots: ${targetInventory.wishlist.length}/${wishlistLimit} (${remainingSlots} slots remaining)`,
                        iconURL: targetUser.displayAvatarURL(),
                    })
                    .setTimestamp();
            };

            const generateMatchingMenu = () => {
                const menuOptions = matchingItems.map(item =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${item.name} - ${item.series}`)
                        .setValue(`${item.name}_${item.series}`)
                );

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_matching')
                    .setPlaceholder('Select a matching character')
                    .addOptions(menuOptions);

                return new ActionRowBuilder().addComponents(selectMenu);
            };

            const generateCopyButton = () => {
                const button = new ButtonBuilder()
                    .setCustomId('copy_codes')
                    .setLabel('Copy Codes')
                    .setStyle(ButtonStyle.Primary);

                return new ActionRowBuilder().addComponents(button);
            };

            const embedMessage = await message.channel.send({
                embeds: [generateEmbed(currentPage)],
                components: matchingItems.length > 0 ? [generateMatchingMenu(), generateCopyButton()] : []
            });

            await embedMessage.react('◀️');
            await embedMessage.react('▶️');

            const filter = (interaction) => interaction.user.id === message.author.id;

            const reactionCollector = embedMessage.createReactionCollector({ filter, time: 60000 });
            const componentCollector = embedMessage.createMessageComponentCollector({ filter, time: 60000 });

            reactionCollector.on('collect', async (reaction) => {
                if (reaction.emoji.name === '▶️') {
                    if (currentPage < Math.ceil(wishlistItems.length / itemsPerPage) - 1) {
                        currentPage++;
                        await embedMessage.edit({ embeds: [generateEmbed(currentPage)] });
                    }
                } else if (reaction.emoji.name === '◀️') {
                    if (currentPage > 0) {
                        currentPage--;
                        await embedMessage.edit({ embeds: [generateEmbed(currentPage)] });
                    }
                }
                await reaction.users.remove(message.author.id);
            });

            componentCollector.on('collect', async interaction => {
                if (interaction.customId === 'select_matching') {
                    const [name, series] = interaction.values[0].split('_');
                    const selectedCard = matchingItems.find(item => item.name === name && item.series === series);
                    await interaction.reply({ content: `You selected **${selectedCard.name}** from **${selectedCard.series}** with code \`${selectedCard.code}\`.`, ephemeral: true });
                } else if (interaction.customId === 'copy_codes') {
                    const codes = matchingItems.map(item => `${item.name} - ${item.series} (Code: ${item.code})`).join('\n');
                    await interaction.reply({ content: `Copied codes:\n\`\`\`${codes}\`\`\``, ephemeral: false });

                    // Disable the button after it has been pressed once
                    const updatedComponents = embedMessage.components.map(row => {
                        return new ActionRowBuilder().addComponents(
                            row.components.map(component => {
                                if (component.customId === 'copy_codes') {
                                    return ButtonBuilder.from(component).setDisabled(true);
                                }
                                return component;
                            })
                        );
                    });

                    await embedMessage.edit({ components: updatedComponents });
                }
            });

            reactionCollector.on('end', () => {
                embedMessage.reactions.removeAll();
            });

        } catch (error) {
            console.error('Error displaying wishlist:', error);
            await message.channel.send('There was an error displaying the wishlist. Please try again later.');
        }
    },
};
