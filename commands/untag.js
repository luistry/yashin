const { fetchInventory, updateInventory } = require('./database/database');

module.exports = {
    name: 'untag',
    description: 'Remove a tag from multiple cards by their codes',
    async run(message, args) {
        if (args.length < 1) {
            return message.reply('Usage: !untag <code1,code2,...>');
        }

        const codesInput = args[0];
        if (!codesInput) {
            return message.reply('Please provide the card codes to untag.');
        }

        try {
            // Split the codes by comma and remove any extra whitespace
            const codes = codesInput.split(',').map(code => code.trim());

            // Fetch the user's inventory
            const inventory = await fetchInventory(message.author.id);
            if (!inventory) {
                return message.reply('Your inventory could not be found.');
            }

            let untaggedCards = [];

            // Iterate over the codes and remove the tag from each card if it exists
            codes.forEach(code => {
                const card = inventory.cards.find(card => card.code === code);
                if (card && card.tagName) {
                    delete card.tagName; // Remove the tag
                    untaggedCards.push(card);
                }
            });

            if (untaggedCards.length > 0) {
                await updateInventory(message.author.id, inventory);
                message.reply(`The tag has been successfully removed from the following card(s): ${untaggedCards.map(card => card.code).join(', ')}`);
            } else {
                message.reply('No matching tagged cards found in your inventory for the provided codes.');
            }

        } catch (error) {
            console.error(error);
            message.reply('An error occurred while trying to untag the cards.');
        }
    },
};
