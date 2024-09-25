const { fetchInventory, updateInventory } = require('./database/database');

module.exports = {
    name: 'tag',
    description: 'Assign a tag to a card by its code',
    async run(message, args) {
        if (args.length < 2) {
            return message.reply('Usage: !tag <code> <tag name>');
        }

        const [code, ...tagParts] = args;
        const tagNameInput = tagParts.join(' ').trim();

        if (!code || !tagNameInput) {
            return message.reply('Please provide both the card code and a tag name.');
        }

        try {
            // Fetch the user's inventory
            const inventory = await fetchInventory(message.author.id);
            if (!inventory) {
                return message.reply('Your inventory could not be found.');
            }

            // Check if the card with the provided code is in the user's inventory
            const card = inventory.cards.find(card => card.code === code);
            if (!card) {
                return message.reply('You do not own a card with the provided code.');
            }

            // Search for a matching tag in the user's inventory
            const matchingTag = inventory.tags.find(tag => {
                // Remove all non-alphanumeric characters from the start of the tag and compare
                const tagWithoutEmoji = tag.replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();
                return tagWithoutEmoji === tagNameInput.toLowerCase();
            });

            if (matchingTag) {
                card.tagName = matchingTag; // Assign the full tag, including emoji
                await updateInventory(message.author.id, inventory);
                message.reply(`The tag "${matchingTag}" has been successfully assigned to the card with code "${code}".`);
            } else {
                message.reply('No matching tag found in your tags list.');
            }

        } catch (error) {
            console.error(error);
            message.reply('An error occurred while trying to tag the card.');
        }
    },
};
