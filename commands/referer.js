const { fetchInventory, updateInventory, fetchAllInventories } = require('./database/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'referer',
    description: 'Give 50 moons to the mentioned user and 25 moons to the referrer.',
    async run(message, args) {
        try {
            const guildId = '1272302731528376350'; // ID of the allowed server
            if (message.guild.id !== guildId) {
                return message.channel.send('This command can only be used on the allowed server.');
            }

            // Get the mentioned user
            const mentionedUser = message.mentions.users.first();
            if (!mentionedUser) {
                return message.channel.send('You need to mention a user.');
            }

            const referer = message.author;
            const refererId = referer.id;
            const mentionedUserId = mentionedUser.id;

            if (refererId === mentionedUserId) {
    return message.channel.send('You cannot refer yourself.');
}

            // Check if accounts are more than 1 year old
            const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
            if (referer.createdTimestamp > oneYearAgo || mentionedUser.createdTimestamp > oneYearAgo) {
                return message.channel.send('Both accounts must be over 1 year old to use this command.');
            }

            // Fetch inventories
            const refererInventory = await fetchInventory(refererId);
            const mentionedUserInventory = await fetchInventory(mentionedUserId);

            if (!refererInventory || !mentionedUserInventory) {
                return message.channel.send('Both users must have valid inventories.');
            }

            // Check if the referer has already used the command
            const usedReferer = await checkIfUsed(refererId);

            if (usedReferer) {
                return message.channel.send('You have already used this command and cannot use it again.');
            }

            // Check if the referer has already referred someone
            if (refererInventory.user_referer && refererInventory.user_referer.length > 0) {
                return message.channel.send('You have already referred someone, you cannot refer another user.');
            }

            // Check if mentionedUser has already been referred by the referer
            if (mentionedUserInventory.referers && mentionedUserInventory.referers.includes(refererId)) {
                return message.channel.send(`${mentionedUser.username} has already been referred by you.`);
            }

            // Add 50 moons to the mentioned user's inventory
            if (!mentionedUserInventory.moons) mentionedUserInventory.moons = [0];
            mentionedUserInventory.moons[0] = (mentionedUserInventory.moons[0] || 0) + 50;
            if (!mentionedUserInventory.referers) mentionedUserInventory.referers = [];
            mentionedUserInventory.referers.push(refererId); // Add the referer's ID to mentionedUser's referers array

            // Add 25 moons to the referer's inventory
            if (!refererInventory.moons) refererInventory.moons = [0];
            refererInventory.moons[0] = (refererInventory.moons[0] || 0) + 25;
            if (!refererInventory.user_referer) refererInventory.user_referer = [];
            refererInventory.user_referer.push(mentionedUserId); // Add the mentioned user's ID to referer's user_referer array

            // Update inventories
            await updateInventory(mentionedUserId, {
                moons: mentionedUserInventory.moons,
                referers: mentionedUserInventory.referers
            });

            await updateInventory(refererId, {
                moons: refererInventory.moons,
                user_referer: refererInventory.user_referer
            });

            // Send a confirmation message with a nice design
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setDescription(`${mentionedUser.username} received **50 moons** :crescent_moon:, and you received **25 moons** :crescent_moon: !`);

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            message.channel.send('An error occurred while processing the referral.');
        }
    }
};

// Function to check if the user has already used the command
async function checkIfUsed(userId) {
    const allInventories = await fetchAllInventories();
    for (const inventory of allInventories) {
        if (inventory.referers && inventory.referers.includes(userId)) {
            return true;
        }
    }
    return false;
}
