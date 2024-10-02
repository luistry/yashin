const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { updateInventory, fetchInventory } = require('./database/database');

module.exports = {
    name: 'multitrade',
    description: 'Trade multiple resources with another player.',
    run: async (message, args) => {
        try {
            const targetUser = message.mentions.users.first();
            if (!targetUser) return message.channel.send('Please mention a user to trade with.');

            // Fetch inventories
            const [authorInventory, targetInventory] = await Promise.all([
                fetchInventory(message.author.id),
                fetchInventory(targetUser.id),
            ]);

            const tradeData = initializeTradeData(message.author.id, targetUser.id);
            const tradeRequestEmbed = createTradeRequestEmbed(message.author.username, targetUser.username);
            const actionRow = createInitialActionRow();

            const sentMessage = await message.channel.send({ embeds: [tradeRequestEmbed], components: [actionRow] });
            const collector = createInitialCollector(sentMessage, targetUser.id, message.author.id);

            handleInitialCollector(collector, message, sentMessage, tradeData, targetUser, authorInventory, targetInventory);

        } catch (error) {
            console.error('Error in multitrade command:', error);
            message.channel.send('An error occurred while trying to execute the trade. Please try again.');
        }
    },
};

// Function to create the initial trade request embed
function createTradeRequestEmbed(authorUsername, targetUsername) {
    return new EmbedBuilder()
        .setColor('#00FF7F')
        .setTitle('🔄 Trade Request')
        .setDescription(`${authorUsername} wants to trade with you, ${targetUsername}.`)
        .setFooter({ text: 'The trade will be canceled if there is no response in 2 minutes.' })
        .setTimestamp();
}

// Function to create action buttons for trade acceptance or cancellation
function createInitialActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('acceptTrade').setLabel('✅ Accept Trade').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancelTrade').setLabel('❌ Cancel Trade').setStyle(ButtonStyle.Danger)
        );
}

// Function to create a collector for the initial trade request
function createInitialCollector(sentMessage, targetUserId, authorUserId) {
    const filter = interaction => [targetUserId, authorUserId].includes(interaction.user.id);
    return sentMessage.createMessageComponentCollector({ filter, time: 120000 });
}

// Function to handle button interactions
function handleInitialCollector(collector, message, sentMessage, tradeData, targetUser, authorInventory, targetInventory) {
    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'acceptTrade') {
            await interaction.update({ content: `${interaction.user.username} has accepted the trade!`, components: [] });
            message.channel.send('Both players have accepted the trade! Please specify the resources you want to trade.');
            await setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory);
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

// Function to initialize trade data
function initializeTradeData(authorId, targetId) {
    return {
        [authorId]: { shines: 0, gold: 0, stellarDust: 0 },
        [targetId]: { shines: 0, gold: 0, stellarDust: 0 },
    };
}

// Function to set up the message collector for trade details
async function setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory) {
    const filter = m => [message.author.id, targetUser.id].includes(m.author.id);
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
}

// Parse user trade input
function parseTradeInput(content) {
    const regex = /(\d+)\s*(shines|gold|stellar\s*dust)/i;
    const match = content.match(regex);
    if (match) {
        const amount = parseInt(match[1]);
        const resource = match[2].toLowerCase();
        return amount > 0 ? { amount, resource } : null;
    }
    return null;
}

// Check if user has sufficient resources for trade
function hasSufficientResources(inventory, tradeData, tradeInput) {
    return inventory[tradeInput.resource] >= (tradeData[tradeInput.resource] + tradeInput.amount);
}

// Update trade data based on user input
function updateTradeData(tradeData, userId, resource, amount) {
    tradeData[userId][resource] += amount;
}

// Update trade embed
function updateTradeEmbed(tradeData, authorUsername, targetUsername) {
    return new EmbedBuilder()
        .setColor('#7289DA')
        .setTitle(`Trade between ${authorUsername} and ${targetUsername}`)
        .setDescription('These are the selected resources for the trade.')
        .addFields(
            { name: `${authorUsername}'s Offer`, value: `${tradeData[authorUsername].shines} shines, ${tradeData[authorUsername].gold} gold`, inline: true },
            { name: `${targetUsername}'s Offer`, value: `${tradeData[targetUsername].shines} shines, ${tradeData[targetUsername].gold} gold`, inline: true }
        );
}

// Finalize trade
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

// Function to add trade items to the inventory
async function addTradeItems(userId, tradeItems) {
    const inventory = await fetchInventory(userId);
    for (const resource in tradeItems) {
        inventory[resource] += tradeItems[resource];
    }
    await updateInventory(userId, inventory);
}

// Function to subtract items from inventory
function subtractItemsFromInventory(inventory, tradeData) {
    for (const resource in tradeData) {
        inventory[resource] -= tradeData[resource];
    }
    return inventory;
}
