const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateStellarDust, AnimeCharacter } = require('./database/database');

module.exports = {
    name: 'multiburn',
    description: 'Burn multiple cards from your inventory in exchange for rewards.',
    options: [
        {
            name: 'filter',
            description: 'TagName to filter cards or "all" to burn all cards.',
            type: 3, // STRING type
            required: false
        }
    ],
    async run(message, args) {
        const userId = message.author.id;
        const filter = args[0]?.toLowerCase().trim(); // Normalize filter to lowercase and remove extra spaces

        try {
            // Fetch user's inventory
            const inventory = await fetchInventory(userId);

            // Filter cards based on the provided TagName
            let selectedCards = [];
            if (filter && filter !== 'all') {
                selectedCards = inventory.cards.filter(card => 
                    card.tags && card.tags.some(tag => tag.toLowerCase().includes(filter)) && card.code !== undefined
                );
            } else {
                selectedCards = inventory.cards.filter(card => card.code !== undefined); // Burn all cards except those with undefined codes
            }

            if (selectedCards.length === 0) {
                return message.reply({ content: `No cards found with the filter: "${filter}".`, ephemeral: true });
            }

            // Calculate total rewards
            let totalGold = 0;
            let totalStellarDust = 0;
            let totalWitchDust = 0;

            selectedCards.forEach(card => {
                const goldReward = Math.floor(Math.random() * (200 - 90 + 1)) + 90; // Random gold between 90 and 200
                const stellarDustReward = card.rarity === 'Legendary' || card.rarity === 'Perfect' ? 2 : 1;
                const witchDust = card.event === 'Halloween 2024' ? 1 : 0;

                totalGold += goldReward;
                totalStellarDust += stellarDustReward;
                totalWitchDust += witchDust;
            });

            // Create the default embed (gray color)
            const embed = new EmbedBuilder()
                .setTitle('Confirm Multi Burn')
                .setDescription(
                    `You are about to burn the following cards:\n\n${selectedCards
                        .slice(0, 5)
                        .map(card => `**${card.name}** (Code: ${card.code})`)
                        .join('\n')}${selectedCards.length > 5 ? '\n...and more!' : ''}`
                )
                .setColor(0x808080) // Gray color by default
                .setFooter({ text: `Total Cards: ${selectedCards.length}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            // Add fields with emojis if values are not undefined
            if (totalGold !== undefined) {
                embed.addFields({ name: 'Total Gold 🪙', value: `${totalGold} Gold`, inline: true });
            }
            if (totalStellarDust !== undefined) {
                embed.addFields({ name: 'Total Stellar Dust ✨', value: `${totalStellarDust} Stellar Dust`, inline: true });
            }
            if (totalWitchDust !== undefined && totalWitchDust > 0) {
                embed.addFields({ name: 'Total Witch Dust 🧹', value: `${totalWitchDust} Witch Dust`, inline: true });
            }

            // Buttons for confirmation and cancellation
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_multiburn')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_multiburn')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            const sentMessage = await message.reply({ embeds: [embed], components: [row], ephemeral: true });

            // Button interaction handling
            const filterInteraction = i => i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter: filterInteraction, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'confirm_multiburn') {
                    try {
                        // Remove cards from inventory
                        selectedCards.forEach(card => {
                            const index = inventory.cards.findIndex(c => c.code === card.code);
                            if (index !== -1) inventory.cards.splice(index, 1);
                        });

                        // Update rewards in the database
                        await updateStellarDust(userId, totalStellarDust, totalGold, totalWitchDust);

                        // Update burn count for anime characters
                        for (const card of selectedCards) {
                            const animeCharacter = await AnimeCharacter.findOne({ name: card.name });
                            if (animeCharacter) {
                                animeCharacter.burned = (animeCharacter.burned || 0) + 1;
                                await animeCharacter.save();
                            }
                        }

                        // Save updated inventory
                        await inventory.save();

                        embed.setColor(0x00FF00); // Green for success
                        await i.update({
                            embeds: [embed],
                            content: `You successfully burned ${selectedCards.length} cards and received:\n- ${totalGold} Gold 🪙\n- ${totalStellarDust} Stellar Dust ✨${totalWitchDust > 0 ? `\n- ${totalWitchDust} Witch Dust 🧹` : ''}`,
                            components: [],
                            ephemeral: true
                        });
                    } catch (error) {
                        console.error('Error during multi-burn operation:', error);
                        await i.update({ content: 'An error occurred. Please try again later.', components: [], ephemeral: true });
                    }
                } else if (i.customId === 'cancel_multiburn') {
                    embed.setColor(0xFF0000); // Red for cancellation
                    await i.update({ content: 'Multi-burn operation canceled.', embeds: [embed], components: [], ephemeral: true });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    sentMessage.edit({ content: 'Multi-burn operation timed out.', components: [] });
                }
            });
        } catch (error) {
            console.error('Error in multi-burn command:', error.message);
            message.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
};
