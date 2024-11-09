const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); 
const { fetchInventory, updateInventory } = require('./database/database');

module.exports = {
    name: 'event',
    description: 'Displays the current Halloween event details and allows candy redemption.',
    run: async (message) => {
        const userId = message.author.id;
        const inventory = await fetchInventory(userId);
        const candyCount = inventory ? inventory.candy || 0 : 0;

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

        const buttons = new ActionRowBuilder();

        if (candyCount >= 20) {
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
        
        if (candyCount >= 40) {
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId('scratch')
                    .setLabel('🎟️ Halloween Scratch')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        await message.channel.send({ embeds: [halloweenEmbed], components: buttons.components.length > 0 ? [buttons] : [] });

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
                const updatedCandies = candyCount - candiesToDeduct;
                
                // Reducer para actualizar el inventario
                const inventoryReducer = (inventory, rewardType) => {
                    const currentArray = inventory[rewardType] || [];
                    return [currentArray[0] ? currentArray[0] + 1 : 1, ...currentArray.slice(1)];
                };

                // Actualizar inventario con el reducer
                const updatedInventory = {
                    candy: updatedCandies,
                    [rewardType]: inventoryReducer(inventory, rewardType)
                };
                
                await updateInventory(userId, updatedInventory);

                await interaction.reply(`You have redeemed **${reward}**! 🎉 You now have ${updatedCandies} candies left.`);
            } else {
                await interaction.reply('You do not have enough candies to redeem this reward.', { ephemeral: true });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) message.channel.send('The Halloween event redemption timed out.');
        });
    }
};
