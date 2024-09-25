const { fetchInventory } = require('./database/database');
const reminders = new Map(); // Stores reminder timers

module.exports = {
    name: 'reminder',
    description: 'Configure the reminder for cooldowns',
    async run(message, args) {
        const userId = message.author.id;
        const command = args[0];

        if (!['drop', 'grab', 'daily'].includes(command)) {
            return message.reply('Please specify a correct value: drop, grab, or daily.');
        }

        const action = args[1] ? args[1].toLowerCase() : 'enable';

        if (action === 'disable') {
            if (reminders.has(userId) && reminders.get(userId)[command]) {
                clearTimeout(reminders.get(userId)[command]);
                delete reminders.get(userId)[command];
                message.reply(`The reminder for ${command} has been disabled.`);
            } else {
                message.reply(`You do not have an active reminder for ${command}.`);
            }
            return;
        }

        // Fetch the user's inventory
        const inventory = await fetchInventory(userId);

        if (!inventory) {
            return message.reply('Your inventory was not found.');
        }

        // Define cooldown times in milliseconds
        const cooldowns = {
            drop: inventory.last_drop,  // last_drop in the inventory
            grab: inventory.last_grab,  // last_grab in the inventory
            daily: inventory.last_daily // last_daily in the inventory
        };

        // Cooldown durations in milliseconds
        const cooldownDurations = {
            drop: 60000 * 20, // 20 minutes
            grab: 60000 * 10,  // 10 minutes
            daily: 86400000    // 24 hours
        };

        const lastCommandTime = cooldowns[command];
        const cooldownDuration = cooldownDurations[command];
        const currentTime = Date.now();

        // Get active buffs from the user's inventory
        const buffs = inventory.Buffs || [];

        // Check for active buffs
        const fastHands = buffs.find(buff => buff.name === 'Fast Hands' && buff.active);
        const speedOfReaction = buffs.find(buff => buff.name === 'Speed of Reaction' && buff.active);

        // Adjust the cooldown if buffs are active
        let adjustedCooldown = cooldownDuration;

        if (command === 'grab' && fastHands) {
            adjustedCooldown /= 2; // Fast Hands halves grab cooldown
        }
        if (command === 'drop' && speedOfReaction) {
            adjustedCooldown /= 2; // Speed of Reaction halves drop cooldown
        }

        const timeLeft = lastCommandTime ? adjustedCooldown - (currentTime - lastCommandTime) : 0;

        if (timeLeft > 0) {
            // Schedule the reminder
            const timeoutId = setTimeout(() => {
                message.author.send(`You can use ${command} again!`);
                // Remove the reminder after sending
                if (reminders.has(userId)) {
                    delete reminders.get(userId)[command];
                }
            }, timeLeft);

            if (!reminders.has(userId)) {
                reminders.set(userId, {});
            }
            reminders.get(userId)[command] = timeoutId;

            // Convert remaining time to hours and minutes if it's for daily
            if (command === 'daily') {
                const hoursLeft = Math.floor(timeLeft / 3600000); // 1 hour = 3600000 ms
                const minutesLeft = Math.ceil((timeLeft % 3600000) / 60000); // Remaining minutes
                message.reply(`I will remind you in ${hoursLeft} hours and ${minutesLeft} minutes when you can use ${command} again. The reminder will be sent via DM.`);
            } else {
                const timeLeftMinutes = Math.ceil(timeLeft / 60000);
                message.reply(`I will remind you in ${timeLeftMinutes} minutes when you can use ${command} again. The reminder will be sent via DM.`);
            }
        } else {
            message.reply(`It seems you can use ${command} right now.`);
        }
    }
};
