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
        const mailName = 'Halloween Event';
        const mailDescription = `
     🎃👻 ¡Moshi moshi! Yashin Here! 👻🎃

Halloween has officially begun! Get ready for a spooktacular season filled with hauntingly fun events, thrilling surprises, and plenty of treats! 🍬🕷️

Join us in celebrating this eerie time of year, and don’t forget to keep an eye out for special Halloween cards and limited-time activities!

Let the ghostly festivities begin! 🦇🕸️
          **Your Rewards:**
            - 10 shines ✨ 
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
