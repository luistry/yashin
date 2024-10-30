const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Placeholder functions to get series for both batches
const getUpcomingSeries = async () => [
    'Sound Euphonium',
    'Solo Leveling',
    'My Dress-Up Darling',
    'Guilty Gear',
    'Eleceed',
    'Overlord',
    'BanG Dream!',
    'Cyberpunk',
    'Wuthering Waves',
    'Love Live!',
];

const getOldBatchSeries = async () => [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
];

module.exports = {
    name: 'batch',
    description: 'Displays the next 10 series of cards in the upcoming batch or the old batch.',
    run: async (message) => {
        try {
            const newBatch = await getUpcomingSeries();
            const oldBatch = await getOldBatchSeries();

            // Function to generate embed based on the selected batch
            const generateEmbed = (batch, title) => new EmbedBuilder()
                .setColor('#00FF7F')
                .setTitle(title)
                .setDescription('Here are the 10 series that will be added:')
                .addFields(batch.map((serie, index) => ({
                    name: `**Series ${index + 1}**`,
                    value: `📜 **${serie}**`,
                    inline: true,
                })))
                .setFooter({ text: 'Stay tuned for more updates!' })
                .setTimestamp();

            // Initial embed for the new batch
            let embed = generateEmbed(newBatch, '🎉 Upcoming Card Series - New Batch');

            // Action row with buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('new_batch')
                        .setLabel('New Batch')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true), // Initially disabled as it's the default view
                    new ButtonBuilder()
                        .setCustomId('old_batch')
                        .setLabel('Old Batch')
                        .setStyle(ButtonStyle.Secondary)
                );

            const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

            // Collector to handle button interactions
            const filter = i => i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async (i) => {
                if (i.customId === 'new_batch') {
                    embed = generateEmbed(newBatch, '🎉 Upcoming Card Series - New Batch');
                    row.components[0].setDisabled(true);
                    row.components[1].setDisabled(false);
                } else if (i.customId === 'old_batch') {
                    embed = generateEmbed(oldBatch, '🎉 Card Series - Old Batch');
                    row.components[0].setDisabled(false);
                    row.components[1].setDisabled(true);
                }

                await i.update({ embeds: [embed], components: [row] });
            });

            collector.on('end', () => {
                row.components.forEach(button => button.setDisabled(true));
                sentMessage.edit({ components: [row] });
            });
        } catch (error) {
            console.error('Error in the batch command:', error);
            message.channel.send('There was an error fetching the series. Please try again later.');
        }
    },
};
