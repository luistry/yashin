const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'shop',
    description: 'View the shop and purchase items.',
    run: async (message) => {
        // Page 1 - Basic Items
        const page1Embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('Shop - Page 1')
            .setDescription('Welcome to the shop! Choose an option below to purchase.')
            .addFields(
                { name: '1. Extra Grab', value: 'Cost: 1 ✨', inline: false },
                { name: '2. Extra Drop', value: 'Cost: 1 ✨', inline: false },
                { name: '3. Box Banner', value: 'Cost: 1000 :coin:', inline: false },
                { name: '4. Box Titles', value: 'Cost: 1000 :coin:', inline: false }
            )
            .setFooter({ text: 'Use the buttons below to navigate between pages.' });

        // Page 2 - Divinity Items
        const page2Embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('Shop - Page 2')
            .setDescription('Here are the powerful Divinity items available for purchase.')
            .addFields(
                { name: 'Divinity Absolute', value: 'Cost: 600 🌙\nReach a divine state and drop 4 cards every day for a month.', inline: false },
                { name: 'God of Evasion', value: 'Cost: 400 🌙\nYou have a 30% chance to ignore the active cooldown and grab a card.', inline: false },
                { name: 'Fast Hands', value: 'Cost: 100 🌙\nReduce Grab cooldown to half for 1 month.', inline: false },
                { name: 'Speed Of Reaction', value: 'Cost: 200 🌙\nReduce Drop cooldown to half for 1 month.', inline: false }
            )
            .setFooter({ text: 'Use the buttons below to navigate between pages.' });

        // Buttons for pagination
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('page1')
                    .setLabel('Page 1')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true), // Start disabled on page 1
                new ButtonBuilder()
                    .setCustomId('page2')
                    .setLabel('Page 2')
                    .setStyle(ButtonStyle.Primary)
            );

        // Send initial message with page 1
        const sentMessage = await message.channel.send({ 
            embeds: [page1Embed], 
            components: [actionRow] 
        });

        // Create button interaction filter
        const filter = i => i.user.id === message.author.id;

        // Create button collector
        const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'page1') {
                // Switch back to Page 1
                await i.update({
                    embeds: [page1Embed],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('page1')
                                    .setLabel('Page 1')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(true), // Disable this button since we're on Page 1
                                new ButtonBuilder()
                                    .setCustomId('page2')
                                    .setLabel('Page 2')
                                    .setStyle(ButtonStyle.Primary)
                            )
                    ]
                });
            } else if (i.customId === 'page2') {
                // Switch to Page 2
                await i.update({
                    embeds: [page2Embed],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('page1')
                                    .setLabel('Page 1')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId('page2')
                                    .setLabel('Page 2')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(true) // Disable this button since we're on Page 2
                            )
                    ]
                });
            }
        });

        collector.on('end', () => {
            // Disable all buttons after the collector ends
            sentMessage.edit({
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('page1')
                                .setLabel('Page 1')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('page2')
                                .setLabel('Page 2')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true)
                        )
                ]
            });
        });
    }
};
