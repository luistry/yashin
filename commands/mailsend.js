const { EmbedBuilder } = require('discord.js');
const { fetchAllInventories, updateInventory } = require('./database/database');

// Command: y!mailsend
module.exports = {
    name: 'mailsend',
    description: 'Send an email with rewards to all users.',
    async run(message, args) {
        const userId = message.author.id;

        // Restrict the command to a specific user (ID: 346799501878755342)
        if (userId !== '346799501878755342') {
            return message.reply('You do not have permission to use this command.');
        }

        // Create the email content
        const mailName = '300 players';
        const mailDescription = `
      Moshi moshi! Yashin here!

We're excited to announce that we are officially celebrating reaching 300 players! 🎉 Your support and enthusiasm have made this milestone possible, and we couldn't have done it without each and every one of you.

We didn’t expect such a tremendous growth in our community, and it’s truly amazing to see so many of you enjoying the game together. To show our gratitude, we’ll be rolling out some special features and rewards soon, so stay tuned!

Thank you for being part of this journey. Let’s keep growing and having fun together!
            
            **Your Rewards:**
            - 15 Shines ✨ 
        `;

        // Fetch all user inventories
        let allInventories;
        try {
            allInventories = await fetchAllInventories();
        } catch (error) {
            console.error('Error fetching inventories:', error);
            return message.reply('Could not fetch users\' inventories at this time. Please try again later.');
        }

        // Send mail to all users
        let failedSends = 0;
        let successSends = 0;
        for (const recipientInventory of allInventories) {
            // Verify and create the mails array if it does not exist
            if (!recipientInventory.mails) {
                recipientInventory.mails = [];
            }

            // Create the new mail object
            const newMail = {
                name: mailName,
                description: mailDescription,
                Readed: false, // Mark as unread
                rewards: {
                   shines: 15
                }
            };

            // Add the new mail to the recipient's inventory
            recipientInventory.mails.push(newMail);

            // Update the recipient's inventory in the database (without granting rewards yet)
            try {
                await updateInventory(recipientInventory._id, { mails: recipientInventory.mails });
                successSends++; // Count successful sends
            } catch (error) {
                console.error(`Error updating inventory for user ${recipientInventory._id}:`, error);
                failedSends++; // Count failed sends
            }
        }

        // Final message
        message.reply(`Mail sent successfully to ${successSends} users! Failed to send to ${failedSends} users.`);
    },
};
