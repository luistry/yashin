const { fetchAllInventories, updateInventory } = require('./database/database');

// Command: y!deleteallmails
module.exports = {
    name: 'deleteallmail',
    description: 'Delete all mails from all users.',
    async run(message, args) {
        const userId = message.author.id;

        // Restrict the command to a specific user (ID: 346799501878755342)
        if (userId !== '346799501878755342') {
            return message.reply('You do not have permission to use this command.');
        }

        // Fetch all user inventories
        let allInventories;
        try {
            allInventories = await fetchAllInventories();
        } catch (error) {
            console.error('Error fetching inventories:', error);
            return message.reply('Could not fetch users\' inventories at this time. Please try again later.');
        }

        // Delete mails from all users
        let failedDeletes = 0;
        let successDeletes = 0;
        for (const recipientInventory of allInventories) {
            // Check if the user has mails and delete them
            if (recipientInventory.mails && recipientInventory.mails.length > 0) {
                recipientInventory.mails = []; // Clear all mails

                // Update the user's inventory in the database
                try {
                    await updateInventory(recipientInventory._id, { mails: recipientInventory.mails });
                    successDeletes++; // Count successful deletions
                } catch (error) {
                    console.error(`Error updating inventory for user ${recipientInventory._id}:`, error);
                    failedDeletes++; // Count failed deletions
                }
            }
        }

        // Final message
        message.reply(`Mails deleted successfully for ${successDeletes} users! Failed to delete mails for ${failedDeletes} users.`);
    },
};
