const { exec } = require('child_process');

// Only these users are authorized to restart the bot
const authorizedUserIds = ['346799501878755342', '339869018439548938'];

module.exports = {
    name: 'restart',
    description: 'Restarts the bot using PM2',
    run: async (message) => {
        try {
            // Check if the user is authorized
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            // Execute the PM2 restart command
            exec('pm2 restart Yashin', (error, stdout, stderr) => { // Replace 'Yashin' with the process name or ID in PM2
                if (error) {
                    console.error('Error restarting the bot:', error);
                    return message.channel.send('There was an error restarting the bot.');
                }

                console.log('Bot restarted:', stdout);
                message.channel.send('Bot is restarting...');
            });
        } catch (err) {
            console.error('Error executing restart command:', err);
            await message.channel.send('There was an error executing the restart command.');
        }
    }
};
