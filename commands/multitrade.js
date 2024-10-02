const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { updateInventory, fetchInventory } = require('./database/database');

module.exports = {
    name: 'multitrade',
    description: 'Trade multiple resources like shines, gold, stellar dust, and more with another player.',
    run: async (message, args) => {
        try {
            const targetUser = message.mentions.users.first();
            if (!targetUser) {
                return message.channel.send('Please mention a user to trade with.');
            }

            // Fetch both inventories
            const [authorInventory, targetInventory] = await Promise.all([
                fetchInventory(message.author.id),
                fetchInventory(targetUser.id),
            ]);

            const tradeData = initializeTradeData(message.author.id, targetUser.id);

            const tradeRequestEmbed = precreateTradeRequestEmbed(message.author.username, targetUser.username);
            const actionRow = createInitialActionRow();

            const sentMessage = await message.channel.send({ embeds: [tradeRequestEmbed], components: [actionRow] });
            const collector = createInitialCollector(sentMessage, targetUser.id, message.author.id);

            // Handle trade acceptance or cancellation
            handleInitialCollector(collector, message, sentMessage, tradeData, targetUser, authorInventory, targetInventory);

        } catch (error) {
            console.error('Error in multitrade command:', error);
            message.channel.send('An error occurred while trying to execute the trade. Please try again.');
        }
    },
};

// Function to create the initial trade request embed
function precreateTradeRequestEmbed(authorUsername, targetUsername) {
    return new EmbedBuilder()
        .setColor('#00FF7F') // Green to indicate a request
        .setTitle('🔄 Trade Request')
        .setDescription(`${authorUsername} wants to trade with you, ${targetUsername}.`)
        .setFooter({ text: 'The trade will be canceled if there is no response in 2 minutes.' })
        .setTimestamp();
}

// Function to create buttons for trade acceptance or cancellation
function createInitialActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('acceptTrade')
                .setLabel('✅ Accept Trade')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancelTrade')
                .setLabel('❌ Cancel Trade')
                .setStyle(ButtonStyle.Danger)
        );
}

// Function to create buttons for checkout and cancel
function createCheckoutActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('checkoutTrade')
                .setLabel('✅ Checkout')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('cancelTrade')
                .setLabel('❌ Cancel Trade')
                .setStyle(ButtonStyle.Danger)
        );
}

// Function to create a collector for the initial trade request
function createInitialCollector(sentMessage, targetUserId, authorUserId) {
    const filter = interaction => interaction.user.id === targetUserId || interaction.user.id === authorUserId;
    return sentMessage.createMessageComponentCollector({ filter, time: 120000 }); // 2 minutes
}

// Function to handle button interactions (accept or cancel)
function handleInitialCollector(collector, message, sentMessage, tradeData, targetUser, authorInventory, targetInventory) {
    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'acceptTrade') {
            await interaction.update({ content: `${interaction.user.username} has accepted the trade!`, components: [] });
            // Create checkout buttons after both users accept the trade
            const checkoutActionRow = createCheckoutActionRow();
            message.channel.send({ content: 'Both players have accepted the trade! Please specify the resources you want to trade.', components: [checkoutActionRow] });
            await setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory, checkoutActionRow);
        } else if (interaction.customId === 'cancelTrade') {
            await interaction.update({ content: `${interaction.user.username} has canceled the trade.`, components: [] });
            sentMessage.delete();
            message.channel.send('Trade canceled.');
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            message.channel.send('Time has expired. The trade has been canceled.');
            sentMessage.delete();
        }
    });
}

// Function to set up the message collector for trade details
async function setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory, checkoutActionRow) {
    const filter = m => m.author.id === message.author.id || m.author.id === targetUser.id;
    const messageCollector = message.channel.createMessageCollector({ filter, time: 300000 });

    message.channel.send('Please specify the resources you want to trade. Example: `2 shines` or `gold 3`');

    messageCollector.on('collect', async (msg) => {
        const tradeInput = parseTradeInput(msg.content);
        if (tradeInput) {
            const userId = msg.author.id;
            const userInventory = userId === message.author.id ? authorInventory : targetInventory;

            if (!hasSufficientResources(userInventory, tradeData[userId], tradeInput)) {
                return msg.reply('Insufficient resources for the trade. Please adjust your offer.');
            }

            updateTradeData(tradeData, userId, tradeInput.resource, tradeInput.amount);

            const updatedEmbed = updateTradeEmbed(tradeData, message.author.username, targetUser.username);
            await msg.channel.send({ embeds: [updatedEmbed] });

            msg.reply(`${msg.author.username}, you have added ${tradeInput.amount} ${tradeInput.resource} to the trade.`);
        } else {
            msg.reply('Invalid input. Make sure you use the correct format. Example: `2 shines`.');
        }
    });

    messageCollector.on('end', () => {
        message.channel.send('Trade setup time has ended.');
        finalizeTrade(tradeData, message.author.id, targetUser.id).catch(err => {
            console.error(err);
            message.channel.send('There was an error finalizing the trade. Please try again later.');
        });
    });

    // Handle checkout and cancellation from the checkout action row
    const checkoutCollector = message.channel.createMessageComponentCollector({ filter: interaction => interaction.customId === 'checkoutTrade' || interaction.customId === 'cancelTrade', time: 300000 });
    checkoutCollector.on('collect', async (interaction) => {
        if (interaction.customId === 'checkoutTrade') {
            await interaction.reply('Trade has been locked! Finalizing trade...');
            await finalizeTrade(tradeData, message.author.id, targetUser.id);
        } else if (interaction.customId === 'cancelTrade') {
            await interaction.reply('Trade has been canceled.');
            messageCollector.stop();
        }
    });

    checkoutCollector.on('end', () => {
        message.channel.send('Checkout time has ended, trade will be canceled.');
        messageCollector.stop();
    });
}

// Function to initialize trade data
function initializeTradeData(authorId, targetId) {
    return {
        [authorId]: { shines: 0, gold: 0, stellarDust: 0, moons: 0, cards: [], frames: [], banners: [], titles: [], buffs: [], divinityAbsolute: [], fastHands: [], glows: [], godOfEvasion: [] },
        [targetId]: { shines: 0, gold: 0, stellarDust: 0, moons: 0, cards: [], frames: [], banners: [], titles: [], buffs: [], divinityAbsolute: [], fastHands: [], glows: [], godOfEvasion: [] },
    };
}

// Function to parse user trade input
function parseTradeInput(content) {
    const regex = /(\d+)\s*(shines|gold|stellar\s*dust|moons|cards|frames|banners|titles|buffs|divinity\s*absolute|fast\s*hands|glows|god\s*of\s*evasion)/i;
    const match = content.match(regex);

    if (match) {
        const amount = parseInt(match[1]);
        if (amount <= 0) return null; // Validate amount
        const resource = match[2].toLowerCase().replace(/\s+/g, '');
        return { amount, resource };
    }

    return null;
}

// Update trade data based on user input
function updateTradeData(tradeData, userId, resource, amount) {
    if (Array.isArray(tradeData[userId][resource])) {
        tradeData[userId][resource].push(amount); // If it's an array like 'cards', 'titles', etc.
    } else {
        tradeData[userId][resource] += amount; // For numeric resources like 'shines', 'gold', etc.
    }
}

// Function to handle the trade process after both users accept
async function finalizeTrade(tradeData, authorId, targetId) {
    const authorInventory = await fetchInventory(authorId);
    const targetInventory = await fetchInventory(targetId);

    if (!hasSufficientResources(authorInventory, tradeData[authorId]) || !hasSufficientResources(targetInventory, tradeData[targetId])) {
        throw new Error('One or both users do not have sufficient resources for the trade.');
    }

    await updateInventory(authorId, subtractItemsFromInventory(authorInventory, tradeData[authorId]));
    await updateInventory(targetId, subtractItemsFromInventory(targetInventory, tradeData[targetId]));

    await addTradeItems(authorId, tradeData[targetId]);
    await addTradeItems(targetId, tradeData[authorId]);
}

// Function to ensure users have sufficient resources for the trade
function hasSufficientResources(inventory, tradeData, tradeInput) {
    const resource = tradeInput.resource;
    const amount = tradeInput.amount;

    if (Array.isArray(tradeData[resource])) {
        return (inventory[resource][0] >= tradeData[resource].length);
    }
    return (tradeData[resource] + amount <= inventory[resource][0]);
}

// Function to update trade embed
function updateTradeEmbed(tradeData, authorUsername, targetUsername) {
    const embed = new EmbedBuilder()
        .setColor('#7289DA')
        .setTitle(`Trade between ${authorUsername} and ${targetUsername}`)
        .setDescription('These are the selected resources for the trade.')
        .addFields(
            { name: `${authorUsername}'s Offer`, value: createTradeList(tradeData[authorUsername]), inline: true },
            { name: `${targetUsername}'s Offer`, value: createTradeList(tradeData[targetUsername]), inline: true }
        );
    return embed;
}

// Create list of items for trade embed
function createTradeList(tradeData) {
    let tradeList = '';
    for (let resource in tradeData) {
        if (tradeData[resource] > 0 || tradeData[resource].length > 0) {
            tradeList += `${capitalize(resource)}: ${Array.isArray(tradeData[resource]) ? tradeData[resource].join(', ') : tradeData[resource]}\n`;
        }
    }
    return tradeList || 'No items selected.';
}

// Capitalize the first letter of the string
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Function to add trade items to the inventory
async function addTradeItems(userId, tradeItems) {
    // Fetch the current inventory
    const inventory = await fetchInventory(userId);

    // Add trade items to the inventory
    for (const resource in tradeItems) {
        if (Array.isArray(tradeItems[resource])) {
            inventory[resource].push(...tradeItems[resource]); // Add items from array
        } else {
            inventory[resource] += tradeItems[resource]; // Increase quantity for numeric resources
        }
    }

    // Update the inventory in the database
    await updateInventory(userId, inventory);
}

// Function to subtract items from inventory
function subtractItemsFromInventory(inventory, tradeData) {
    // Subtract trade items from the inventory
    for (const resource in tradeData) {
        if (Array.isArray(tradeData[resource])) {
            inventory[resource] = inventory[resource].slice(0, -tradeData[resource].length); // Decrease quantity for arrays
        } else {
            inventory[resource] -= tradeData[resource]; // Subtract numeric values
        }
    }
    return inventory;
}
