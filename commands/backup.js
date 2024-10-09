const fs = require('fs');
const path = require('path');
const { fetchAllInventories } = require('./database/database'); // Update with the correct path to your fetchAllInventories function

// Only these users are authorized
const authorizedUserIds = ['346799501878755342', '123864968461287428', '339869018439548938', '300619060729610258', '270681503665618954'];

module.exports = {
    name: 'backup',
    description: 'Creates a backup of the inventory database',
    run: async (message) => {
        try {
            // Check if the user is authorized
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            // Retrieve all inventories
            const inventories = await fetchAllInventories(); // Fetch all inventories using your function

            if (!inventories || inventories.length === 0) {
                return await message.channel.send('No inventory data found in the database.');
            }

            // Create the backup file
            const backupDir = path.join(__dirname, 'backups'); // Directory for backups
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir); // Create the directory if it doesn't exist
            }
            const filePath = path.join(backupDir, `inventory_backup_${Date.now()}.json`);
            const fileContent = JSON.stringify(inventories, null, 2); // Format data for better readability
            fs.writeFileSync(filePath, fileContent);

            // Send the file to the channel
            await message.channel.send({
                content: 'Here is the backup of the inventory database:',
                files: [filePath]
            });

            // Delete the file after sending it
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('Error creating backup:', err);
            await message.channel.send('There was an error creating the backup.');
        }
    }
};
