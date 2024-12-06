const fetch = require('node-fetch');
const { fetchInventory, updateInventory } = require('./database/database');
const { EmbedBuilder } = require('discord.js');

const TOPGG_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyNzIzMDE5ODU3ODk2NDA4NTciLCJib3QiOnRydWUsImlhdCI6MTcyNTQwNzkxN30.KSQ8Q7LpuhEsjoZg_MAdrIs07O9cg0omK_R-9Ga3HLo';
const VOTE_COOLDOWN_HOURS = 12;

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
                    .setColor('#FF5733')
                    .setTitle('🌟 Vote for Us on Top.gg! 🌟')
                    .setDescription('We value your support! Cast your vote now and help the bot grow. 🎉')
                    .addFields(
                        { name: 'How to Vote?', value: 'Click the link below to vote for our bot on Top.gg.', inline: false }
                    )
                    .setURL('https://top.gg/bot/1272301985789640857/vote')
                    .setThumbnail('https://cdn.discordapp.com/avatars/1272301985789640857/a8da55ad91ffd5f0cab23311425a368d.webp?size=512')  // Example thumbnail, you can replace it with your own image.
                    .setFooter({ text: 'Your vote means a lot!', iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

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
                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⏳ Cooldown Active')
                    .setDescription(`You can vote again in **${timeLeft} hour(s)**. Set a reminder! ⏰`)
                    .setFooter({ text: 'Thank you for supporting us!', iconURL: message.guild.iconURL() })
                    .setTimestamp();

                return message.channel.send({ embeds: [cooldownEmbed] });
            }

            // Handle monthly vote counting
            const currentMonth = now.getMonth();
            const lastVoteMonth = new Date(userInventory.last_vote || 0).getMonth();
            
            if (currentMonth !== lastVoteMonth) {
                userInventory.monthly_votes = 0; // Reset monthly vote count at the start of a new month
            }

            // Verify if the ID matches and update the last vote date
            if (userInventory._id === userId) {
                const currentShines = userInventory.shines.length > 0 ? userInventory.shines[0] : 0; // Get current shines
                const shineAmount = isWeekend() ? 2 : 1;
                const newShineTotal = currentShines + shineAmount;

                // Update inventory with the new shine total and last vote date
                userInventory.shines[0] = newShineTotal;
                userInventory.last_vote = now;
                userInventory.monthly_votes = (userInventory.monthly_votes || 0) + 1; // Increment monthly vote count

                await updateInventory(userId, userInventory);

                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('🎉 Thanks for Voting! 🎉')
                    .setDescription(`You've received **${shineAmount} shine(s)** for voting! 🌟`)
                    .addFields(
                        { name: 'Total Shines', value: `✨ ${newShineTotal}`, inline: true },
                        { name: 'Monthly Votes', value: `📅 ${userInventory.monthly_votes}`, inline: true },
                        { name: 'Next Vote Available In', value: `⏳ 12 hours`, inline: false }
                    )
                   
                    .setFooter({ text: 'Keep voting for more rewards!', iconURL: message.guild.iconURL() })
                    .setTimestamp();

                return message.channel.send({ embeds: [successEmbed] });
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