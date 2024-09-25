const { fetchInventory, updateInventory } = require('./database/database');

module.exports = {
    name: 'tag delete',
    description: 'Deletes a tag from the user\'s inventory and from the associated cards',
    async run(message, args) {
        // Get the tag name from the arguments
        const tagNameWithEmoji = args.join(' ');

        // Remove the first character if it's an emoji
        const tagName = tagNameWithEmoji.startsWith(' ') ? tagNameWithEmoji.slice(2) : tagNameWithEmoji;

        if (!tagName) {
            return message.reply('Please provide the name of the tag you want to delete.');
        }

        try {
            // Fetch the user's inventory
            const inventory = await fetchInventory(message.author.id);
            if (!inventory) {
                return message.reply('User inventory not found.');
            }

            // Remove the tag from the inventory
            const tagIndex = inventory.tags.findIndex(tag => tag === tagName);
            if (tagIndex === -1) {
                return message.reply(`No tag found with the name "${tagName}".`);
            }

            inventory.tags.splice(tagIndex, 1);

            // Update the user's inventory in the database
            await updateInventory(message.author.id, inventory);

            // Remove the tagName from the cards in the user's inventory
            for (const card of inventory.cards) {
                if (card.tagName === tagName) {
                    delete card.tagName;
                }
            }

            // Save the updated inventory
            await updateInventory(message.author.id, inventory);

            message.reply(`Tag "${tagName}" successfully deleted and removed from cards.`);
        } catch (error) {
            console.error(error);
            message.reply('An error occurred while trying to delete the tag.');
        }
    },
};
