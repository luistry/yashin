const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { AnimeCharacter, fetchInventory, updateWishlist } = require('./database/database');

module.exports = {
    name: 'wishlistadd',
    description: 'Adds a character to your wishlist.',
    run: async (message, args) => {
        try {
            const query = args.join(' ');
            if (!query) {
                return message.channel.send('Please provide a character name to search.');
            }

            // Search characters by name
            const characters = await AnimeCharacter.find(
                { name: new RegExp(query, 'i') },
                'name series wishlist'
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
                    characters.map(character => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${character.name} - ${character.series}`)
                            .setValue(`${character._id}`)
                    )
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

            const filter = i => i.customId === 'select_character' && i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                const selectedCharacterId = i.values[0];

                try {
                    const character = await AnimeCharacter.findById(selectedCharacterId);
                    if (!character) {
                        return i.reply({ content: 'Character not found.', ephemeral: true });
                    }

                    const userInventory = await fetchInventory(message.author.id);
                    if (!userInventory) {
                        return i.reply({ content: 'You do not have an inventory.', ephemeral: true });
                    }

                    const isInWishlist = userInventory.wishlist.some(item => 
                        item.name.toLowerCase() === character.name.toLowerCase() && 
                        item.series.toLowerCase() === character.series.toLowerCase()
                    );

                    if (isInWishlist) {
                        return i.reply({ content: 'This character is already in your wishlist.', ephemeral: true });
                    }

                    const wishlistResult = await updateWishlist(message.author.id, character.name, character.series);
                    if (!wishlistResult.success) {
                        return i.reply({ content: wishlistResult.message, ephemeral: true });
                    }

                    // Ensure 'wishlist' is a number before incrementing
                    if (!character.wishlist || typeof character.wishlist === 'string') {
                        character.wishlist = parseInt(character.wishlist, 10) || 0;
                        await character.save();
                    }

                    // Increment the wishlist count
                    await AnimeCharacter.findByIdAndUpdate(selectedCharacterId, { $inc: { wishlist: 1 } });

                    const detailEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(`${character.name} added to wishlist`)
                        .setDescription(`**Series:** ${character.series}`)
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
