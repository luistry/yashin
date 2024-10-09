const { fetchInventory, updateInventory } = require('./database/database');

module.exports = {
    name: 'tag',
    description: 'Assign a tag to multiple cards by their codes',
    async run(message, args) {
        if (args.length < 2) {
            return message.reply('Usage: !tag <code1,code2,...> <tag name>');
        }

        const [codesInput, ...tagParts] = args;
        const tagNameInput = tagParts.join(' ').trim();

        if (!codesInput || !tagNameInput) {
            return message.reply('Please provide both the card codes and a tag name.');
        }

        try {
            // Split the codes by comma and remove any extra whitespace
            const codes = codesInput.split(',').map(code => code.trim());

            // Fetch the user's inventory
            const inventory = await fetchInventory(message.author.id);
            if (!inventory) {
                return message.reply('Your inventory could not be found.');
            }

            // Search for a matching tag in the user's inventory
            const matchingTag = inventory.tags.find(tag => {
                const tagWithoutEmoji = tag.replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();
                return tagWithoutEmoji === tagNameInput.toLowerCase();
            });

            if (!matchingTag) {
                return message.reply('No matching tag found in your tags list.');
            }

            let taggedCards = [];

            // Iterate over the codes and assign the tag to each card if it exists
            codes.forEach(code => {
                const card = inventory.cards.find(card => card.code === code);
                if (card) {
                    card.tagName = matchingTag; // Assign the full tag, including emoji
                    taggedCards.push(card);
                }
            });

            if (taggedCards.length > 0) {
                await updateInventory(message.author.id, inventory);
                message.reply(`The tag "${matchingTag}" has been successfully assigned to the following card(s): ${taggedCards.map(card => card.code).join(', ')}`);
            } else {
                message.reply('No matching cards found in your inventory for the provided codes.');
            }

        } catch (error) {
            console.error(error);
            message.reply('An error occurred while trying to tag the cards.');
        }
    },
};
