const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, AnimeCharacter } = require('./database/database');

module.exports = {
    name: 'wishlist',
    description: 'Displays the wishlist of a user and compares it with the inventory of another.',
    run: async (message) => {
        try {
            console.log('Wishlist command started.');

            const targetUser = message.mentions.users.first() || message.author;
            console.log('Target user:', targetUser.username);

            const targetInventory = await fetchInventory(targetUser.id);
            console.log('Target inventory:', targetInventory);

            if (!targetInventory || !targetInventory.wishlist || targetInventory.wishlist.length === 0) {
                console.warn(`${targetUser.username}'s wishlist is empty.`);
                return message.channel.send(`${targetUser.username}'s wishlist is empty.`);
            }

            const userInventory = await fetchInventory(message.author.id);
            console.log('User inventory:', userInventory);

            const wishlistLimit = targetInventory.limited || 10;
            const remainingSlots = wishlistLimit - targetInventory.wishlist.length;
            const itemsPerPage = 10;
            let currentPage = 0;

            const wishlistItems = await Promise.all(targetInventory.wishlist.map(async item => {
                console.log('Processing wishlist item:', item);

                const { name, series } = item;
                const character = await AnimeCharacter.findOne({ name, series });
                const wishlistCount = character ? character.wishlist : 'Not specified';
                return { name, series, wishlistCount };
            }));
            console.log('Processed wishlist items:', wishlistItems);

            const matchingItems = wishlistItems
                .map(item => {
                    const matchingCard = userInventory.cards.find(card => {
                        if (card.name && card.series) {
                            return card.name.toLowerCase() === item.name.toLowerCase() &&
                                   card.series.toLowerCase() === item.series.toLowerCase();
                        }
                        return false;
                    });
                    
                    if (matchingCard) {
                        console.log('Matching card found:', matchingCard);
                        return {
                            name: matchingCard.name,
                            series: matchingCard.series,
                            code: matchingCard.code
                        };
                    } else {
                        console.log('No matching card found for item:', item);
                    }
                    return null;
                })
                .filter(item => item !== null);

            console.log('Matching items:', matchingItems);

            const filteredMatchingItems = matchingItems.filter(item => 
                targetUser.id !== message.author.id || 
                !wishlistItems.some(wishlistItem => 
                    wishlistItem.name.toLowerCase() === item.name.toLowerCase() &&
                    wishlistItem.series.toLowerCase() === item.series.toLowerCase()
                )
            );

            console.log('Filtered matching items:', filteredMatchingItems);

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
                if (filteredMatchingItems.length === 0) return null; 

                const menuOptions = filteredMatchingItems.map(item =>
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
                components: [
                    generateMatchingMenu(),
                    generateCopyButton()
                ].filter(Boolean)
            });

            console.log('Embed message sent.');

            await embedMessage.react('◀️');
            await embedMessage.react('▶️');

            const filter = (interaction) => interaction.user.id === message.author.id;

            const reactionCollector = embedMessage.createReactionCollector({ filter, time: 60000 });
            const componentCollector = embedMessage.createMessageComponentCollector({ filter, time: 60000 });

            reactionCollector.on('collect', async (reaction) => {
                console.log('Reaction received:', reaction.emoji.name);

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
                console.log('Component interaction received:', interaction.customId);

                if (interaction.customId === 'select_matching') {
                    const [name, series] = interaction.values[0].split('_');
                    const selectedCard = filteredMatchingItems.find(item => item.name === name && item.series === series);
                    await interaction.reply({ content: `You selected **${selectedCard.name}** from **${selectedCard.series}** with code \`${selectedCard.code}\`.`, ephemeral: true });
                } else if (interaction.customId === 'copy_codes') {
                    const codes = filteredMatchingItems.map(item => `${item.name} - ${item.series} (Code: ${item.code})`).join('\n');
                    await interaction.reply({ content: `Copied codes:\n\`\`\`${codes}\`\`\``, ephemeral: true });

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
                console.log('Reaction collector ended.');
            });

        } catch (error) {
            console.error('Error displaying wishlist:', error);
            await message.channel.send('There was an error displaying the wishlist. Please try again later.');
        }
    },
};
