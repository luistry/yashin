const { EmbedBuilder } = require('discord.js');
const { fetchInventory } = require('./database/database'); // Asegúrate de que la función fetchInventory esté correctamente importada

module.exports = {
    name: 'event',
    description: 'Displays the current Halloween event details.',
    run: async (message) => {
        // Fetch the user's inventory to get the candy count
        const userId = message.author.id;
        const inventory = await fetchInventory(userId); // Busca el inventario del usuario
        const candyCount = inventory ? inventory.candy || 0 : 0; // Asume que los caramelos están almacenados bajo 'candies'

        const halloweenEmbed = new EmbedBuilder()
            .setColor('#FF7518') // Dark orange for Halloween theme
            .setTitle('🎃 Halloween Event - Trick or Treat! 🎃')
            .setDescription('Welcome to the spookiest event of the year! 🎃\nDuring this Halloween event, you can collect **candies** by participating in special drops and earn exclusive Halloween-themed rewards. Gather 20 candies to unlock your treat!')
            .addFields(
                { name: '🗓 Event Start Date', value: 'October 31, 2024', inline: true },
                { name: '🗓 Event End Date', value: 'December 1, 2024', inline: true },
                { name: '🍬 Collect Candies', value: 'Collect 20 candies to receive a special Halloween reward! Every card drop may contain a candy.' },
                { name: '🎁 Special Rewards', value: 'Unlock exclusive Halloween-themed cards, titles, and banners by gathering enough candies during the event!' },
                { name: '🍬 Your Current Candies', value: `You currently have **${candyCount}** candies. Keep collecting to reach 20!`, inline: true },
            )
            .setFooter({ text: 'Don\'t miss out on the Halloween fun! 🎃' });

        await message.channel.send({ embeds: [halloweenEmbed] });
    }
};
