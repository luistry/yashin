const { addTagToInventory, fetchInventory } = require('./database/database'); // Ensure fetchInventory function

module.exports = {
    name: 'tagcreate',
    description: 'Create a new tag with an emoji and add it to your inventory.',
    async run(message, args) {
        // Ensure the user provided both an emoji and a tag name
        const [emoji, ...tagParts] = args;
        const tagName = tagParts.join(' ').trim();

        // Check if the first character is an emoji
        if (!emoji.match(/^\p{Emoji}/u)) {
            return message.reply('The first character must be an emoji.');
        }

        if (!tagName) {
            return message.reply('Please provide a name for the tag.');
        }

        try {
            // Fetch existing tags for the user
            const inventory = await fetchInventory(message.author.id);
            const userTags = inventory ? inventory.tags || [] : [];

            // Check if the tag already exists
            const tagWithEmoji = `${emoji} ${tagName}`;
            if (userTags.includes(tagWithEmoji)) {
                return message.reply('This tag already exists in your inventory.');
            }

            // Add the tag with emoji to the user's inventory
            const result = await addTagToInventory(message.author.id, tagName, emoji);

            // Send the appropriate response based on the result
            await message.channel.send(result.message);
        } catch (error) {
            console.error('Error in tagcreate command:', error);
            await message.reply('An error occurred while creating the tag.');
        }
    }
};
