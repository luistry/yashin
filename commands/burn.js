const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateStellarDust, AnimeCharacter } = require('./database/database');

module.exports = {
    name: 'burn',
    description: 'Burn a card from your inventory in exchange for gold and stellar dust.',
    options: [
        {
            name: 'cardcode',
            description: 'The code of the card you want to burn. If not provided, the last card in your inventory will be burned.',
            type: 3, // STRING type
            required: false
        }
    ],
    async run(message, args) {
        const userId = message.author.id;
        const cardCode = args[0]; // Assuming the card code is passed as the first argument

        try {
            // Fetch the user's inventory
            const inventory = await fetchInventory(userId);

            // Determine the card to burn
            let cardIndex;
            let card;

            if (cardCode) {
                // Find the card in the user's inventory based on the provided code
                cardIndex = inventory.cards.findIndex(c => c.code === cardCode);
                card = inventory.cards[cardIndex];
            } else {
                // If no card code is provided, select the last card in the inventory
                cardIndex = inventory.cards.length - 1;
                card = inventory.cards[cardIndex];
            }

            // Validate the card
            if (cardIndex === -1 || !card.name) {
                return message.reply({ content: 'You don\'t have a card with that code in your inventory or the card name is undefined. Please check the card code and try again.', ephemeral: true });
            }

            // Check if the rewards are already calculated and stored in the card
            let calculatedGoldReward = card.calculatedGoldReward;
            let calculatedStellarDustReward = card.calculatedStellarDustReward;

            // If the rewards are not stored, calculate and store them
            if (!calculatedGoldReward || !calculatedStellarDustReward) {
                calculatedGoldReward = Math.floor(Math.random() * (200 - 90 + 1)) + 90; // Gold between 90 and 200
                calculatedStellarDustReward = 1;

                if (card.rarity === 'Legendary' || card.rarity === 'Perfect') {
                    calculatedStellarDustReward = 2;
                }

                // Store the calculated rewards in the card object
                card.calculatedGoldReward = calculatedGoldReward;
                card.calculatedStellarDustReward = calculatedStellarDustReward;
            }

            // Determine if the card is part of the Halloween 2024 event
            const witchDust = card.event === 'Halloween 2024' ? 1 : 0;

            // Create embed with card information and reward details
            const embed = new EmbedBuilder()
                .setTitle('Are you sure you want to burn this card?')
                .setDescription(`You are about to burn the card **${card.name}** with the code **${card.code}**. You will receive:\n\n**${calculatedGoldReward}** Gold\n**${calculatedStellarDustReward}** Stellar Dust`)
                .setColor(0xff0000)
                .setThumbnail(card.img_url);  // Set the thumbnail to the card image URL

            // Create confirmation buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_burn')
                        .setLabel('Yes, burn it')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('cancel_burn')
                        .setLabel('No, cancel')
                        .setStyle(ButtonStyle.Secondary),
                );

            const sentMessage = await message.reply({ embeds: [embed], components: [row], ephemeral: true });

            // Create a collector to handle button interactions
            const filter = i => i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'confirm_burn') {
                    try {
                        // Remove the card from the inventory
                        inventory.cards.splice(cardIndex, 1);

                        // Update the user's stellar dust and gold using the pre-calculated values, including witchDust
                        await updateStellarDust(userId, calculatedStellarDustReward, calculatedGoldReward, witchDust);

                        // Find the anime character by name and update its burned count
                        const animeCharacter = await AnimeCharacter.findOne({ name: card.name });
                        if (animeCharacter) {
                            animeCharacter.burned = (animeCharacter.burned || 0) + 1;
                            await animeCharacter.save();
                        }

                        // Save the updated inventory back to the database
                        await inventory.save();

                        // Update the embed to green to indicate success
                        embed.setColor(0x00ff00); // Set color to green
                        await i.update({ embeds: [embed], content: `You burned the card **${card.name}**. You received **${calculatedGoldReward}** Gold and **${calculatedStellarDustReward}** Stellar Dust.`, components: [], ephemeral: true });
                    } catch (error) {
                        console.error('Error during burn operation:', error.message);
                        await i.update({ content: 'There was an error burning the card. Please try again later.', components: [], ephemeral: true });
                    }
                } else if (i.customId === 'cancel_burn') {
                    // Cancel the card burn
                    await i.update({ content: 'The card burn has been canceled.', components: [], ephemeral: true });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    sentMessage.edit({ content: 'The time to burn the card has expired.', components: [] });
                }
            });
        } catch (error) {
            console.error('Error in burn command:', error.message);
            message.reply({ content: 'There was an error processing your request. Please try again later.', ephemeral: true });
        }
    },
};
