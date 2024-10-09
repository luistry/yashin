const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database'); // Adjust the path accordingly

module.exports = {
    name: 'use',
    description: 'Use an item from your inventory, such as applying a buff to your character.',
    async run(message, args) {
        try {
            const itemName = args.join(' ').trim().toLowerCase(); // The item name to use

            if (!itemName) {
                return await message.channel.send('Please provide the name of the item you want to use.');
            }

            // Fetch user inventory
            const inventory = await fetchInventory(message.author.id);
            if (!inventory) {
                return await message.channel.send('Failed to fetch inventory.');
            }

            // Destructure inventory elements
            const {
                SpeedOfReaction,
                GodofEvasion,
                FastHands,
                DivinityAbsolute,
                Buffs // Include the Buffs array
            } = inventory;

            // Valid item details
            const itemDetails = {
                'divinity absolute': {
                    array: 'DivinityAbsolute',
                    description: 'Reach a divine state and drop 4 cards every day for a month.',
                    displayName: 'Divinity Absolute'
                },
                'fast hands': {
                    array: 'FastHands',
                    description: 'Reduce Grab cooldown to half for 1 month.',
                    displayName: 'Fast Hands'
                },
                'god of evasion': {
                    array: 'GodofEvasion',
                    description: 'You have a 30% chance to ignore the active cooldown and grab a card.',
                    displayName: 'God of Evasion'
                },
                'speed of reaction': {
                    array: 'SpeedOfReaction',
                    description: 'Reduce Drop cooldown to half for 1 month.',
                    displayName: 'Speed of Reaction'
                },
                'glow': {
                    array: null,
                    description: 'Generate a random glow and apply it to your profile.',
                    displayName: 'Glow'
                }
            };

            const item = itemDetails[itemName];
            if (!item) {
                return await message.channel.send(`"${args.join(' ')}" is not a valid item.`); // Show original name
            }

            const itemArray = inventory[item.array];
            if (!itemArray || itemArray.length === 0) {
                return await message.channel.send(`You don't have any "${args.join(' ')}" in your inventory.`);
            }

            // Confirm with buttons
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_use')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_use')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            const confirmationMessage = await message.channel.send({
                content: `Are you sure you want to use the item "${item.displayName}"?\n\n${item.description}`,
                components: [row]
            });

            const filter = i => i.user.id === message.author.id;
            const collector = confirmationMessage.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async i => {
                if (i.customId === 'cancel_use') {
                    await i.update({ content: 'Action cancelled.', components: [] });
                    return;
                }

                if (i.customId === 'confirm_use') {
                    // Reduce item quantity
                    itemArray[0] -= 1; // Decrease the first item's quantity

                    // Remove item from array if quantity is zero
                    if (itemArray[0] <= 0) {
                        itemArray.shift(); // Remove item if quantity is zero or negative
                    }

                    // Add the buff to the Buffs array
                    let buff = Buffs.find(b => b.name.toLowerCase() === item.displayName.toLowerCase());
                    if (!buff) {
                        Buffs.push({
                            name: item.displayName, // Use display name here
                            description: item.description,
                            days_remaining: 30,
                            applied_on: new Date(), // Add applied_on property
                            active: true
                        });
                    } else {
                        buff.days_remaining += 30; // Add 30 days to existing duration
                        buff.applied_on = new Date(); // Update applied_on date
                    }

                    // Save the updated inventory
                    await inventory.save();

                    // Inform the user with an embed
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00') // Green for success
                        .setTitle('Buff Applied')
                        .setDescription(`The buff "${item.displayName}" has been successfully applied.`)
                        .setTimestamp();

                    await i.update({ embeds: [embed], components: [] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    confirmationMessage.edit({ content: 'You took too long to respond.', components: [] });
                }
            });

        } catch (err) {
            console.error('Error executing use command:', err);
            await message.channel.send('There was an error processing your request.');
        }
    }
};
