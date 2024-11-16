const { ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'Moons',
    description: 'View the Moons shop and purchase items.',
    run: async (message) => {
        // Embed de la tienda Moons con bonus aumentados y nota para abrir ticket
        const shopEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🛒 Moons Shop')
            .setDescription('Welcome to the Moons Shop! Items range from **$1** to **$100** with increased bonuses.\n\nTo complete a purchase, please open a ticket in the **Main Server**.')
            .addFields(
                { name: '[$1.00]', value: 'Cost: $1\nEquivalent: 100 Moons', inline: false },
                { name: '[$5.00]', value: 'Cost: $5\nEquivalent: 620 Moons (500 + 120 Moons Bonus)', inline: false },
                { name: '[$10.00]', value: 'Cost: $10\nEquivalent: 1,400 Moons (1000 Moons + 400 Bonus)', inline: false },
                { name: '[$25.00]', value: 'Cost: $25\nEquivalent: 3,750 Moons (2600 Moons + 1150 Bonus)', inline: false },
                { name: '[$50.00]', value: 'Cost: $50\nEquivalent: 9,000 Moons (7000 Moons + 2,000 Bonus)', inline: false },
                { name: '[$100.00]', value: 'Cost: $100\nEquivalent: 17,000 Moons (12000 Moons + 5,000 Bonus)', inline: false }
            )
            .setFooter({ text: 'To purchase items, please open a ticket in the Main Server.' });

        // Enviar el embed al canal
        await message.channel.send({ embeds: [shopEmbed] });
    }
};
