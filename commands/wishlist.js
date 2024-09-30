const { EmbedBuilder } = require('discord.js');
const { fetchInventory, AnimeCharacter } = require('./database/database');

module.exports = {
    name: 'wishlist',
    description: 'Displays the list of characters in your wishlist with pagination.',
    run: async (message) => {
        try {
            // Get the user's inventory
            const userInventory = await fetchInventory(message.author.id);

            // If the user has no wishlist or it's empty
            if (!userInventory || !userInventory.wishlist || userInventory.wishlist.length === 0) {
                return message.channel.send('Your wishlist is empty.');
            }

            const wishlistLimit = userInventory.limited || 10; // Default to 10 if not set
            const remainingSlots = wishlistLimit - userInventory.wishlist.length;
            const itemsPerPage = 10;
            let currentPage = 0;

            // Fetch and format the wishlist items
            const wishlistItems = await Promise.all(userInventory.wishlist.map(async item => {
                const { name, series } = item;
                const character = await AnimeCharacter.findOne({ name, series });
                const wishlistCount = character ? character.wishlist : 'Not specified';
                return `❤️ ${wishlistCount} • ${name.padEnd(20, ' ')} - ${series.padEnd(15, ' ')}`;
            }));

            // Helper function to generate the embed for a specific page
            const generateEmbed = (page) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const currentItems = wishlistItems.slice(start, end);

                const description = currentItems.join('\n');
                const embedDescription = description.length > 2048 ? description.slice(0, 2048) + '...' : description;

                return new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Your Wishlist (Page ${page + 1} of ${Math.ceil(wishlistItems.length / itemsPerPage)})`)
                    .setDescription(`\`\`\`${embedDescription}\`\`\``)
                    .setFooter({
                        text: `Wishlist slots: ${userInventory.wishlist.length}/${wishlistLimit} (${remainingSlots} slots remaining)`,
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setTimestamp();
            };

            // Send the initial embed message
            const embedMessage = await message.channel.send({ embeds: [generateEmbed(currentPage)] });

            // React with pagination controls
            await embedMessage.react('◀️');
            await embedMessage.react('▶️');

            // Create a filter to only allow the message author to control the reactions
            const filter = (reaction, user) => ['◀️', '▶️'].includes(reaction.emoji.name) && user.id === message.author.id;

            // Create a reaction collector to handle pagination
            const collector = embedMessage.createReactionCollector({ filter, time: 60000 });

            collector.on('collect', async (reaction) => {
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

                // Remove the user's reaction to avoid clutter
                await reaction.users.remove(message.author.id);
            });

            collector.on('end', () => {
                embedMessage.reactions.removeAll(); // Remove reactions when the collector ends
            });

        } catch (error) {
            console.error('Error displaying wishlist:', error);
            await message.channel.send('There was an error displaying your wishlist. Please try again later.');
        }
    },
};
