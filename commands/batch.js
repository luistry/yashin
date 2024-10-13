const { EmbedBuilder } = require('discord.js');

// Assuming you have a function to get the upcoming series
const getUpcomingSeries = async () => {
    // Placeholder for the actual logic to get series; using a fixed array for simplicity.
    return [
        'Sound Euphonium',
        'Solo Leveling',
        'My Dress-Up Darling',
        'Guilty Gear',
        'Eleceed ',
        'Overlord',
        'BanG Dream!',
        'Cyberpunk ',
        ' Wuthering Waves',
        'Love live!',
    ];
};
//batch

module.exports = {
    name: 'batch',
    description: 'Displays the next 10 series of cards in the upcoming batch.',
    run: async (message) => {
        try {
            const seriesList = await getUpcomingSeries();

            const seriesEmbed = new EmbedBuilder()
                .setColor('#00FF7F')
                .setTitle('🎉 Upcoming Card Series')
                .setDescription('Here are the 10 series that will be added in the upcoming batch:')
                .addFields(seriesList.map((serie, index) => ({
                    name: `**Series ${index + 1}**`,
                    value: `📜 **${serie}**`,
                    inline: true,
                })))
                .setFooter({ text: 'Stay tuned for more updates!' })
                .setTimestamp();

            await message.channel.send({ embeds: [seriesEmbed] });
        } catch (error) {
            console.error('Error in the series command:', error);
            message.channel.send('There was an error fetching the series. Please try again later.');
        }
    },
};
