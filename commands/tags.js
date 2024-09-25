const { fetchInventory } = require('./database/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'tags',
    description: 'Display all tags in your inventory with the number of cards for each tag and show remaining slots if limited.',
    async run(message) {
        try {
            // Fetch the user's inventory
            const inventory = await fetchInventory(message.author.id);
            const tags = inventory ? inventory.tags || [] : [];
            const cards = inventory ? inventory.cards || [] : [];

            // Check if the user has any tags
            if (tags.length === 0) {
                return message.reply('You have no tags in your inventory.');
            }

            // Create a map to count the number of cards for each tag
            const tagCounts = new Map();

            // Initialize the counts for each tag
            tags.forEach(tag => {
                tagCounts.set(tag, 0);
            });

            // Count the number of cards for each tag
            cards.forEach(card => {
                if (card.tagName) {
                    tags.forEach(tag => {
                        if (card.tagName.includes(tag)) {
                            tagCounts.set(tag, tagCounts.get(tag) + 1);
                        }
                    });
                }
            });

            // Calculate remaining slots
            const maxTags = 10; // Adjust this if the limit changes
            const remainingSlots = maxTags - tags.length;

            // Create a message listing all tags with card counts
            const tagList = tags.map((tag, index) => {
                const count = tagCounts.get(tag) || 0;
                return `${index + 1}. ${tag} (${count} cards)`;
            }).join('\n');

            // Create the embed
            const embed = new EmbedBuilder()
                .setColor(0x7289DA) // You can choose a color you prefer
                .setTitle('Your Tags')
                .setDescription(tagList)
                .setFooter({ text: `You have ${tags.length} tag(s) out of ${maxTags}. ${remainingSlots} slot(s) remaining.` });

            // Send the embed to the channel
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error in tags command:', error);
            await message.channel.send('An error occurred while fetching your tags.');
        }
    }
};
