const { EmbedBuilder, Colors } = require('discord.js');
const { fetchLastDrop, fetchLastDaily, fetchLastGrab, fetchLastVote, fetchInventory } = require('./database/database'); // Adjust the path if necessary

// Configure cooldown times in milliseconds
const COOLDOWNS = {
    grab: 10 * 60 * 1000, // 10 minutes
    drop: 20 * 60 * 1000, // 20 minutes
    vote: 12 * 60 * 60 * 1000, // 12 hours
    daily: 24 * 60 * 60 * 1000, // 24 hours
};

// Format the remaining cooldown time
async function formatCooldown(cooldownType, lastUsed, userId) {
    const now = Date.now();
    const cooldownAmount = COOLDOWNS[cooldownType];

    // Fetch the user's inventory to check for buffs
    const inventory = await fetchInventory(userId);
    const buffs = inventory.Buffs || [];

    // Check for active buffs that affect cooldowns
    const fastHands = buffs.find(buff => buff.name === 'Fast Hands' && buff.active);
    const speedOfReaction = buffs.find(buff => buff.name === 'Speed of Reaction' && buff.active);

    // If both buffs are active, reduce the drop and grab cooldowns by half
    let adjustedCooldown = cooldownAmount;
    if (cooldownType === 'grab' && fastHands) {
        adjustedCooldown /= 2; // Fast Hands halves grab cooldown
    }
    if (cooldownType === 'drop' && speedOfReaction) {
        adjustedCooldown /= 2; // Speed of Reaction halves drop cooldown
    }

    const timeLeft = adjustedCooldown - (now - lastUsed);

    if (timeLeft > 0) {
        const minutesLeft = Math.floor(timeLeft / (60 * 1000));
        const secondsLeft = Math.floor((timeLeft % (60 * 1000)) / 1000);

        if (minutesLeft > 0) {
            const hoursLeft = Math.floor(minutesLeft / 60);
            return `${hoursLeft > 0 ? hoursLeft + 'h ' : ''}${minutesLeft % 60}m`;
        } else {
            return `${secondsLeft}s`; // Show seconds if less than a minute left
        }
    } else {
        return 'Available'; // Show 'Available' if the command is ready to use
    }
}

module.exports = {
    name: "cd",
    description: "Show cooldowns for commands",
    run: async (message) => {
        const userId = message.author.id;

        // Fetch the last daily, drop, grab, and vote times from the database
        let lastDaily, lastDrop, lastGrab, lastVote;
        try {
            lastDaily = await fetchLastDaily(userId) || 0;
            lastDrop = await fetchLastDrop(userId) || 0;
            lastGrab = await fetchLastGrab(userId) || 0;
            lastVote = await fetchLastVote(userId) || 0;
        } catch (err) {
            console.error('Error fetching cooldowns:', err);
            return message.reply('There was an error checking your cooldowns.');
        }

        // Check the cooldown status for each command
        const cooldownStates = {
            Drop: {
                lastUsed: lastDrop,
                cooldownType: 'drop'
            },
            Grab: {
                lastUsed: lastGrab,
                cooldownType: 'grab'
            },
            Daily: {
                lastUsed: lastDaily,
                cooldownType: 'daily'
            },
            Vote: {
                lastUsed: lastVote,
                cooldownType: 'vote'
            }
        };

        // Create the embed
        const embed = new EmbedBuilder()
            .setColor(Colors.White)
            .setTitle('Cooldowns')
            .setTimestamp();

        // Add the cooldown times to the embed
        for (const [command, { lastUsed, cooldownType }] of Object.entries(cooldownStates)) {
            const statusText = await formatCooldown(cooldownType, lastUsed, userId);
            const statusIcon = statusText === 'Available' ? ':bell:' : ':no_bell:';
            embed.addFields({
                name: command,
                value: `${statusIcon} ${statusText}`,
                inline: false
            });
        }

        // Send the embed to the channel
        message.reply({ embeds: [embed] });
    }
};
