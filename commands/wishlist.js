const { EmbedBuilder } = require('discord.js');
const { fetchInventory, AnimeCharacter } = require('./database/database'); // Ensure the path is correct

module.exports = {
    name: 'wishlist',
    description: 'Displays the list of characters in your wishlist.',
    run: async (message) => {
        try {
            // Get the user's inventory
            const userInventory = await fetchInventory(message.author.id);

            // Remove or comment out the updateWishlistCounts call
            // await updateWishlistCounts(message.author.id);
            // console.log('Wishlist counts updated successfully!');

            if (!userInventory || !userInventory.wishlist || userInventory.wishlist.length === 0) {
                return message.channel.send('Your wishlist is empty.');
            }

            // Build the embed description from the wishlist data
            const wishlistItems = await Promise.all(userInventory.wishlist.map(async item => {
                const { name, series } = item; // Destructuring to get name and series
                
                // Find the character in AnimeCharacter collection
                const character = await AnimeCharacter.findOne({ name, series });
                const wishlistCount = character ? character.wishlist : 'Not specified';

                // Align the items using text formatting
                return `❤️ ${wishlistCount} • ${name.padEnd(20, ' ')} - ${series.padEnd(15, ' ')}`;
            }));

            const description = wishlistItems.join('\n'); // Join all items with new lines

            // Check the text length to comply with Discord's limit
            const embedDescription = description.length > 2048 ? description.slice(0, 2048) + '...' : description;

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Your Wishlist')
                .setDescription(`\`\`\`${embedDescription}\`\`\``) // Use code block formatting for alignment
                .setFooter({ text: 'List of characters in your wishlist', iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error displaying wishlist:', error);
            await message.channel.send('There was an error displaying your wishlist. Please try again later.');
        }
    },
};
