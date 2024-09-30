const { EmbedBuilder } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database'); // Ensure paths are correct

module.exports = {
    name: 'wishlistchannel',
    description: 'Sets or renames the wishlist channel.',
    run: async (message, args) => {
        try {
            // Get the channel ID where the command was executed
            const channelId = message.channel.id;

            // Check if there is a rename argument
            const newChannelName = args.join(' ');

            // Fetch the user's inventory
            const userInventory = await fetchInventory(message.author.id);
            if (!userInventory) {
                return message.channel.send('You do not have an inventory.');
            }

            // Update or set the wishlist channel in the user's inventory
            const updatedData = {
                wishlist_channel: newChannelName ? newChannelName : `#${message.channel.name}`
            };

            await updateInventory(message.author.id, updatedData);

            const detailEmbed = new EmbedBuilder()
                .setColor('#ffcc00') // Gold color for a vibrant look
                .setTitle('🎉 Wishlist Channel Updated!')
                .setDescription(`Your wishlist channel has been set to: **${newChannelName ? newChannelName : `#${message.channel.name}`}**`)
                .addFields(
                    { name: '🔔 Notifications', value: `You will receive notifications for wishlist spawns in this channel!` }
                )
                .setFooter({ text: 'Channel for wishlist notifications', iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            await message.channel.send({ embeds: [detailEmbed] });

        } catch (error) {
            console.error('Error setting wishlist channel:', error);
            return message.channel.send('There was an error setting the wishlist channel. Please try again later.');
        }
    },
};
