const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { AnimeCharacter, fetchInventory, updateWishlist } = require('./database/database'); // Ensure paths are correct

module.exports = {
    name: 'wishlistadd',
    description: 'Adds a character to your wishlist.',
    run: async (message, args) => {
        try {
            const query = args.join(' ');
            if (!query) {
                return message.channel.send('Please provide a character name to search.');
            }

            // Search for characters by name and select only the fields name and series
            const characters = await AnimeCharacter.find(
                { name: new RegExp(query, 'i') },
                'name series'
            ).limit(15);

            if (characters.length === 0) {
                return message.channel.send('No characters found with that name.');
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Select a Character')
                .setDescription(characters.map((character, index) => 
                    `${index + 1}. **${character.name}** from **${character.series}**`
                ).join('\n'))
                .setFooter({ text: 'Use the menu to select a character.', iconURL: message.author.displayAvatarURL() });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_character')
                .setPlaceholder('Select a character')
                .addOptions(
                    characters.map((character, index) => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${character.name} - ${character.series}`)
                            .setValue(`${index}`) // Use the index as value
                    )
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

            const filter = i => i.customId === 'select_character' && i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                const selectedIndex = parseInt(i.values[0], 10); // Index of the selected character
                console.log('Selected Character Index:', selectedIndex);

                try {
                    const character = characters[selectedIndex]; // Get the selected character
                    console.log('Fetched Character:', character);

                    if (!character) {
                        return i.reply({ content: 'Character not found.', ephemeral: true });
                    }

                    const selectedCharacterName = character.name; // Character's name
                    const selectedCharacterSeries = character.series; // Character's series

                    const userInventory = await fetchInventory(message.author.id);
                    console.log('User Inventory:', userInventory);

                    if (!userInventory) {
                        return i.reply({ content: 'You do not have an inventory.', ephemeral: true });
                    }

                    const wishlist = userInventory.wishlist || [];
                    if (wishlist.some(item => item.name === selectedCharacterName && item.series === selectedCharacterSeries)) {
                        return i.reply({ content: `${selectedCharacterName} is already in your wishlist.`, ephemeral: true });
                    }

                    // Update the wishlist in the user's inventory
                    await updateWishlist(message.author.id, selectedCharacterName, selectedCharacterSeries); 

                    // Increment the wishlist count for the selected character
                    const characterToUpdate = await AnimeCharacter.findOne({ name: selectedCharacterName, series: selectedCharacterSeries });
                    if (characterToUpdate) {
                        const newCount = (parseInt(characterToUpdate.wishlist, 10) || 0) + 1;
                        await AnimeCharacter.updateOne(
                            { name: selectedCharacterName, series: selectedCharacterSeries },
                            { $set: { wishlist: newCount } }
                        );
                    }

                    const detailEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(`${selectedCharacterName} added to wishlist`)
                        .setDescription(`**Series:** ${selectedCharacterSeries}`)
                        .setFooter({ text: 'Character added to wishlist', iconURL: message.author.displayAvatarURL() })
                        .setTimestamp();

                    await i.update({ embeds: [detailEmbed], components: [] });
                } catch (error) {
                    console.error('Error updating wishlist:', error);
                    await i.reply({ content: 'Failed to update wishlist.', ephemeral: true });
                }
            });

            collector.on('end', () => {
                sentMessage.edit({ components: [] });
            });

        } catch (error) {
            console.error('Error adding character to wishlist:', error);
            return message.channel.send('There was an error adding the character to the wishlist. Please try again later.');
        }
    },
};
