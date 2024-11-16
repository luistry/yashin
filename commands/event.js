const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database');

module.exports = {
    name: 'event',
    description: 'Displays the current Halloween event details and allows candy redemption.',
    run: async (message) => {
        const userId = message.author.id;
        let inventory = await fetchInventory(userId);
        let candyCount = inventory ? parseInt(inventory.candy || '0', 10) : 0; // Aseguramos que candyCount sea un número

        const generateButtons = (candies) => {
            const buttons = new ActionRowBuilder();
            if (candies >= 20) {
                buttons.addComponents(
                    new ButtonBuilder()
                        .setCustomId('halloween_banner_box')
                        .setLabel('🎁 Halloween Banner Box')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('halloween_frame_box')
                        .setLabel('🎁 Halloween Frame Box')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (candies >= 40) {
                buttons.addComponents(
                    new ButtonBuilder()
                        .setCustomId('scratch')
                        .setLabel('🎟️ Halloween Scratch')
                        .setStyle(ButtonStyle.Secondary)
                );
            }
            return buttons.components.length > 0 ? [buttons] : [];
        };

        const sendEmbed = async () => {
            const halloweenEmbed = new EmbedBuilder()
                .setColor('#FF7518')
                .setTitle('🎃 Halloween Event - Trick or Treat! 🎃')
                .setDescription(
                    'Welcome to the spookiest event of the year! 🎃\n' +
                    'Collect **candies** by participating in special drops and earn exclusive Halloween-themed rewards.'
                )
                .addFields(
                    { name: '🗓 Event Start Date', value: 'October 31, 2024', inline: true },
                    { name: '🗓 Event End Date', value: 'December 1, 2024', inline: true },
                    { name: '🍬 Collect Candies', value: 'Collect candies to unlock special Halloween rewards! Each drop may contain a candy.' },
                    { name: '🍬 Your Current Candies', value: `You have **${candyCount}** candies. Keep collecting!`, inline: true }
                )
                .setFooter({ text: 'Don\'t miss out on the Halloween fun! 🎃' });

            await message.channel.send({ embeds: [halloweenEmbed], components: generateButtons(candyCount) });
        };

        await sendEmbed();

        const filter = (interaction) => interaction.user.id === userId;
        const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (interaction) => {
            let candiesToDeduct = 0;
            let reward = '';
            let rewardType = '';

            if (interaction.customId === 'halloween_banner_box') {
                reward = 'Halloween Banner Box';
                candiesToDeduct = 20;
                rewardType = 'Halloween_Box_banner';
            } else if (interaction.customId === 'halloween_frame_box') {
                reward = 'Halloween Frame Box';
                candiesToDeduct = 20;
                rewardType = 'Halloween_frame_box';
            } else if (interaction.customId === 'scratch') {
                reward = 'Halloween Scratch';
                candiesToDeduct = 40;
                rewardType = 'scratch';
            }

            if (candyCount >= candiesToDeduct) {
                // Reducir candies y actualizar inventario
                candyCount -= candiesToDeduct;
                inventory.candy = candyCount;

                // Convertir el campo correspondiente a un array y sumar a la posición 0
                let rewardArray = Array.isArray(inventory[rewardType]) ? inventory[rewardType] : [0];
                rewardArray[0] = parseInt(rewardArray[0] || '0', 10) + 1; // Asegurar suma como número
                inventory[rewardType] = rewardArray;

                await updateInventory(userId, inventory);

                await interaction.reply(`You have redeemed **${reward}**! 🎉 You now have ${candyCount} candies left.`);

                // Reenviar el embed actualizado con los botones correspondientes
                await sendEmbed();
            } else {
                await interaction.reply('You do not have enough candies to redeem this reward.', { ephemeral: true });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) message.channel.send('The Halloween event redemption timed out.');
        });
    }
};
