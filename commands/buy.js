const { fetchInventory, Frame, updateInventory, addFrameToInventory } = require('./database/database');
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'buy',
    description: 'Purchase items or frames from the shop.',
    run: async (message, args) => {
        let quantity = 1;
        let itemName;

        if (!isNaN(args[0])) {
            quantity = parseInt(args[0], 10);
            itemName = args.slice(1).join(' ').toLowerCase();
        } else {
            itemName = args.join(' ').toLowerCase();
        }

        if (isNaN(quantity) || quantity <= 0) {
            return message.channel.send('Invalid quantity specified. Please provide a positive number.');
        }

        const items = {
            'extra grab': { cost: 1, type: 'extra_grab', currency: 'shines' },
            'extra drop': { cost: 1, type: 'extra_drop', currency: 'shines' },
            'banner box': { cost: 1000, type: 'Box_banner', currency: 'gold' },
            'titles box': { cost: 1000, type: 'Box_title', currency: 'gold' },
            'divinity absolute': { cost: 600, type: 'DivinityAbsolute', currency: 'moons' },
            'fast hands': { cost: 100, type: 'FastHands', currency: 'moons' },
            'glows': { cost: 50, type: 'Glows', currency: 'moons' },
            'god of evasion': { cost: 400, type: 'GodofEvasion', currency: 'moons' },
            'speed of reaction': { cost: 200, type: 'SpeedOfReaction', currency: 'moons' }
        };

        const frames = await Frame.find();
        const frame = frames.find(f => f.name.toLowerCase() === itemName);

        if (frame) {
            const frameCost = 800; // Fixed cost per frame
            const totalCost = frameCost * quantity;
            const currencyEmoji = ':crescent_moon:';

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`Confirm Purchase: ${frame.name}`)
                .setDescription(`You are about to buy **${quantity} ${frame.name}(s)**.`)
                .addFields(
                    { name: 'Total Cost', value: `${currencyEmoji} ${totalCost}`, inline: true }
                )
                .setFooter({ text: 'React with ✅ to confirm or ❌ to cancel.' });

            const sentMessage = await message.channel.send({
                embeds: [embed],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('confirm_frame')
                                .setLabel('Confirm')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('cancel_frame')
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Danger)
                        )
                ]
            });

            const filter = i => i.message.id === sentMessage.id && (i.customId === 'confirm_frame' || i.customId === 'cancel_frame');
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 45000 });

            collector.on('collect', async i => {
                if (i.customId === 'confirm_frame') {
                    const userId = message.author.id;
                    const inventory = await fetchInventory(userId);

                    if (!inventory) {
                        return i.reply('Your inventory could not be found. Please try again later.');
                    }

                    const currentMoons = Number(inventory.moons) || 0;
                    if (currentMoons < totalCost) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('Purchase Failed')
                            .setDescription(`You do not have enough ${currencyEmoji} to buy **${quantity} ${frame.name}(s)**.`)
                            .addFields(
                                { name: 'Required', value: `${currencyEmoji} ${totalCost}`, inline: true },
                                { name: 'Current Balance', value: `${currencyEmoji} ${currentMoons}`, inline: true }
                            )
                            .setFooter({ text: 'Please acquire more resources and try again.' });

                        await i.reply({ embeds: [errorEmbed] });
                        return;
                    }

                    try {
                        await addFrameToInventory(userId, frame.name, quantity);

                        // Deduct the cost from the user's moons
                        inventory.moons = currentMoons - totalCost;
                        await inventory.save();

                        // Create and send the success embed
                        const successEmbed = new EmbedBuilder()
                            .setColor('#00FF00') // Green color for success
                            .setTitle('Purchase Successful!')
                            .setDescription(`You have successfully purchased **${quantity} ${frame.name}(s)**.`);

                        await i.update({ embeds: [successEmbed], components: [] }); // Update the message with success embed
                    } catch (err) {
                        console.error('Error updating inventory:', err);
                        await i.reply('There was an error processing your purchase.');
                    }
                } else if (i.customId === 'cancel_frame') {
                    await i.reply('Purchase canceled.');
                }
            });

            collector.on('end', () => {
                sentMessage.edit({
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('confirm_frame')
                                    .setLabel('Confirm')
                                    .setStyle(ButtonStyle.Success)
                                    .setDisabled(true),
                                new ButtonBuilder()
                                    .setCustomId('cancel_frame')
                                    .setLabel('Cancel')
                                    .setStyle(ButtonStyle.Danger)
                                    .setDisabled(true)
                            )
                    ]
                });
            });
        } else if (items[itemName]) {
            // Logic for other items
            const item = items[itemName];
            const totalCost = item.cost * quantity;
            const currencyEmoji = item.currency === 'shines' ? '✨' : item.currency === 'moons' ? ':crescent_moon:' : '💰';

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`Confirm Purchase: ${itemName.charAt(0).toUpperCase() + itemName.slice(1)}`)
                .setDescription(`You are about to buy **${quantity} ${itemName}(s)**.`)
                .addFields(
                    { name: 'Total Cost', value: `${currencyEmoji} ${totalCost}`, inline: true }
                )
                .setFooter({ text: 'React with ✅ to confirm or ❌ to cancel.' });

            const sentMessage = await message.channel.send({
                embeds: [embed],
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('confirm_item')
                                .setLabel('Confirm')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('cancel_item')
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Danger)
                        )
                ]
            });

            const filter = i => i.message.id === sentMessage.id && (i.customId === 'confirm_item' || i.customId === 'cancel_item');
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 45000 });

            collector.on('collect', async i => {
                if (i.customId === 'confirm_item') {
                    const userId = message.author.id;
                    const inventory = await fetchInventory(userId);

                    if (!inventory) {
                        return i.reply('Your inventory could not be found. Please try again later.');
                    }

                    const userCurrency = item.currency === 'shines' ? (inventory.shines || 0) :
                        item.currency === 'moons' ? (inventory.moons || 0) :
                        (inventory.gold || 0);

                    if (userCurrency < totalCost) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('Purchase Failed')
                            .setDescription(`You do not have enough ${currencyEmoji} to buy **${quantity} ${itemName}(s)**.`)
                            .addFields(
                                { name: 'Required', value: `${currencyEmoji} ${totalCost}`, inline: true },
                                { name: 'Current Balance', value: `${currencyEmoji} ${userCurrency}`, inline: true }
                            )
                            .setFooter({ text: 'Please acquire more resources and try again.' });

                        await i.reply({ embeds: [errorEmbed] });
                        return;
                    }

                    try {
                        if (!inventory[item.type]) {
                            inventory[item.type] = 0;
                        }
                        inventory[item.type] = Number(inventory[item.type]) + quantity;

                        // Deduct from the user's currency based on the item type
                        if (item.currency === 'shines') {
                            inventory.shines = Number(inventory.shines) - totalCost;
                        } else if (item.currency === 'moons') {
                            inventory.moons = Number(inventory.moons) - totalCost;
                        } else if (item.currency === 'gold') {
                            inventory.gold = Number(inventory.gold) - totalCost;
                        }

                        await updateInventory(userId, inventory);

                        const successEmbed = new EmbedBuilder()
                            .setColor('#00FF00') // Green color for success
                            .setTitle('Purchase Successful!')
                            .setDescription(`You have successfully purchased **${quantity} ${itemName}(s)**.`);

                        await i.update({ embeds: [successEmbed], components: [] }); // Update the message with success embed
                    } catch (err) {
                        console.error('Error updating inventory:', err);
                        await i.reply('There was an error processing your purchase.');
                    }
                } else if (i.customId === 'cancel_item') {
                    await i.reply('Purchase canceled.');
                }
            });

            collector.on('end', () => {
                sentMessage.edit({
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('confirm_item')
                                    .setLabel('Confirm')
                                    .setStyle(ButtonStyle.Success)
                                    .setDisabled(true),
                                new ButtonBuilder()
                                    .setCustomId('cancel_item')
                                    .setLabel('Cancel')
                                    .setStyle(ButtonStyle.Danger)
                                    .setDisabled(true)
                            )
                    ]
                });
            });
        } else {
            return message.channel.send('Item not found in the shop. Please check your spelling and try again.');
        }
    }
};
