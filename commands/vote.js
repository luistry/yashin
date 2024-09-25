const fetch = require('node-fetch');
const { fetchInventory, updateInventory } = require('./database/database');
const { EmbedBuilder } = require('discord.js');

const TOPGG_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyNzIzMDE5ODU3ODk2NDA4NTciLCJib3QiOnRydWUsImlhdCI6MTcyNTQwNzkxN30.KSQ8Q7LpuhEsjoZg_MAdrIs07O9cg0omK_R-9Ga3HLo';
const VOTE_COOLDOWN_HOURS = 12; // 12-hour cooldown for voting

module.exports = {
    name: 'vote',
    description: 'Checks and processes a vote on Top.gg',
    async run(message, args) {
        const userId = message.author.id;

        try {
            // Check if the user has voted
            const voteData = await checkVote(userId);
            if (!voteData.voted) {
                const voteEmbed = new EmbedBuilder()
                    .setColor('#7289DA')
                    .setTitle('You haven\'t voted yet!')
                    .setDescription('Thank you for your interest in voting! Click the link below to vote for our bot on Top.gg.')
                    .setURL('https://top.gg/bot/1272301985789640857/vote')
                    .setFooter({ text: 'Your vote helps us a lot!' });

                return message.channel.send({ embeds: [voteEmbed] });
            }

            // Get user inventory information
            const userInventory = await fetchInventory(userId);
            if (!userInventory) {
                return message.channel.send('Could not find your inventory.');
            }

            const now = new Date();
            const lastVote = new Date(userInventory.last_vote || 0);
            const timeDifference = (now - lastVote) / (1000 * 60 * 60); // Difference in hours

            // Check if the cooldown period has passed
            if (timeDifference < VOTE_COOLDOWN_HOURS) {
                const timeLeft = Math.ceil(VOTE_COOLDOWN_HOURS - timeDifference);
                return message.channel.send(`You can vote again in ${timeLeft} hour(s).`);
            }

            // Verify if the ID matches and update the last vote date
            if (userInventory._id === userId) {
                const currentShines = userInventory.shines.length > 0 ? userInventory.shines[0] : 0; // Get current shines
                const shineAmount = isWeekend() ? 2 : 1;
                const newShineTotal = currentShines + shineAmount;

                // Update inventory with the new shine total and last vote date
                userInventory.shines[0] = newShineTotal;
                userInventory.last_vote = now;

                await updateInventory(userId, userInventory);

                return message.channel.send(`Thank you for voting! You have received ${shineAmount} shine(s).`);
            } else {
                return message.channel.send('User ID does not match.');
            }
        } catch (error) {
            console.error('Error processing the vote:', error);
            return message.channel.send('An error occurred while processing your vote.');
        }
    }
};

// Function to check if the user has voted on Top.gg
async function checkVote(userId) {
    const response = await fetch(`https://top.gg/api/bots/1272301985789640857/check?userId=${userId}`, {
        headers: {
            Authorization: `Bearer ${TOPGG_AUTH_TOKEN}`,
        },
    });
    return response.json();
}

// Function to check if it is the weekend (Friday to Sunday for 2x shines)
function isWeekend() {
    const today = new Date().getDay();
    return today === 5 || today === 6 || today === 0; // 5 is Friday, 6 is Saturday, 0 is Sunday
}
