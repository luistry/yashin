const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateInventory, updateDailyBuffs } = require('./database/database');

module.exports = {
    name: 'info',
    description: 'Displays information about the user, including cards dropped, cards grabbed, frames applied, votes made, and shines spent.',
    async run(message) {
        const mentionedUser = message.mentions.users.first();
        const userId = mentionedUser ? mentionedUser.id : message.author.id;
        const username = mentionedUser ? mentionedUser.username : message.author.username;

        try {
            // Actualizar buffs diarios para el usuario específico
            await updateDailyBuffs(userId);

            const inventory = await fetchInventory(userId);

            let dropsCount = inventory?.info[0]?.dropsCount || '0';
            let grabsCount = inventory?.info[0]?.grabsCount || '0';
            let votesCount = inventory?.info[0]?.votesCount || '0';
            let shinesSpent = inventory?.info[0]?.shinesSpent || '0';
            const shinesOriginal = inventory?.info[0]?.shines?.[0] || inventory?.shines?.[0] || 0;

            let lastDropInfo = inventory?.info[0]?.last_drop || null;
            let lastGrabInfo = inventory?.info[0]?.last_grab || null;
            let lastVoteInfo = inventory?.info[0]?.last_vote || null;

            const lastDrop = inventory?.last_drop || null;
            const lastGrab = inventory?.last_grab || null;
            const lastVote = inventory?.last_vote || null;

            const currentShines = inventory?.shines?.[0] || 0;

            let shinesSpentDelta = shinesOriginal - currentShines;
            shinesSpent = (parseInt(shinesSpent) + shinesSpentDelta).toString();

            let updateNeeded = false;

            const isDivinityActive = inventory?.Buffs?.some(buff => buff.name === 'Divinity Absolute' && buff.days_remaining > 0);

            if (lastDrop && (!lastDropInfo || new Date(lastDrop).getTime() !== new Date(lastDropInfo).getTime())) {
                dropsCount = (parseInt(dropsCount) + (isDivinityActive ? 4 : 3)).toString();
                lastDropInfo = lastDrop;
                updateNeeded = true;
            }

            if (lastGrab && (!lastGrabInfo || new Date(lastGrab).getTime() !== new Date(lastGrabInfo).getTime())) {
                grabsCount = (parseInt(grabsCount) + 1).toString();
                lastGrabInfo = lastGrab;
                updateNeeded = true;
            }

            if (lastVote && (!lastVoteInfo || new Date(lastVote).getTime() !== new Date(lastVoteInfo).getTime())) {
                votesCount = (parseInt(votesCount) + 1).toString();
                lastVoteInfo = lastVote;
                updateNeeded = true;
            }

            if (updateNeeded || shinesSpentDelta !== 0) {
                await updateInventory(userId, {
                    info: [ {
                        dropsCount,
                        grabsCount,
                        votesCount,
                        shinesSpent,
                        last_drop: lastDropInfo,
                        last_grab: lastGrabInfo,
                        last_vote: lastVoteInfo,
                        shines: [currentShines]
                    } ],
                    shines: [currentShines]
                });
            }

            const framesApplied = inventory?.Frames?.length || 0;

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('toggleBuffs')
                        .setLabel('Show Buffs')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setCustomId('backToInfo')
                        .setLabel('Back to Info')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔙')
                        .setDisabled(true)
                );

            const embed = new EmbedBuilder()
                .setTitle(`${username}'s Info`)
                .setDescription('Here is the information about the user:')
                .setColor(0x808080)
                .addFields(
                    { name: 'Cards Dropped', value: dropsCount, inline: false },
                    { name: 'Cards Grabbed', value: grabsCount, inline: false },
                    { name: 'Frames Applied', value: `${framesApplied}`, inline: false },
                    { name: 'Votes Made', value: votesCount, inline: false },
                    { name: 'Shines Spent', value: shinesSpent, inline: false },
                )
                .setTimestamp()
                .setFooter({ text: 'Bot Information' });

            const replyMessage = await message.reply({ embeds: [embed], components: [row], ephemeral: false });

            const filter = i => i.user.id === message.author.id;
            const collector = replyMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'toggleBuffs') {
                    const buffsEmbed = new EmbedBuilder()
                        .setTitle('Buffs:')
                        .setColor(0x808080)
                        .setTimestamp();

                    if (inventory?.Buffs && inventory.Buffs.length > 0) {
                        const buffsDescription = inventory.Buffs.map(buff => {
                            let description;
                            switch (buff.name) {
                                case 'Divinity Absolute':
                                    description = 'Reach a divine state and drop 4 cards every day for a month.';
                                    break;
                                case 'God of Evasion':
                                    description = 'You have a 30% chance to ignore the active cooldown and grab a card.';
                                    break;
                                case 'Fast Hands':
                                    description = 'Reduce Grab cooldown to half for 1 month.';
                                    break;
                                case 'Speed Of Reaction':
                                    description = 'Reduce Drop cooldown to half for 1 month.';
                                    break;
                                default:
                                    description = 'No description available.';
                                    break;
                            }
                            return `**${buff.name}**: ${description}\n**Active For ${buff.days_remaining} Days**`;
                        }).join('\n\n');

                        buffsEmbed.setDescription(buffsDescription);
                    } else {
                        buffsEmbed.setDescription('No active buffs.');
                    }

                    row.components[1].setDisabled(false);

                    await i.update({ embeds: [buffsEmbed], components: [row] });
                } else if (i.customId === 'backToInfo') {
                    await i.update({ embeds: [embed], components: [row] });
                }
            });

        } catch (error) {
            console.error('Error fetching user info:', error);
            await message.reply({ content: 'An error occurred while fetching information.', ephemeral: true });
        }
    },
};
