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
            console.log(`Fetching inventories for ${message.author.username} and ${targetUser.username}`);
            const [authorInventory, targetInventory] = await Promise.all([
                fetchInventory(message.author.id),
                fetchInventory(targetUser.id),
            ]);

            console.log(`Inventories fetched:`, { authorInventory, targetInventory });

            // Initialize trade data
            const tradeData = initializeTradeData(message.author.id, targetUser.id);
            console.log(`Trade data initialized:`, tradeData);

            const tradeRequestEmbed = createTradeRequestEmbed(message.author.username, targetUser.username);
            const actionRow = createInitialActionRow();

            // Send trade request message
            const sentMessage = await message.channel.send({ embeds: [tradeRequestEmbed], components: [actionRow] });
            const collector = createInitialCollector(sentMessage, targetUser.id, message.author.id);

            // Handle collector interactions
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

// Function to create the trading embed
function createTradingEmbed(authorUsername, targetUsername, tradeData) {
    const embed = new EmbedBuilder()
        .setColor('#7289DA')
        .setTitle(`Trade between ${authorUsername} and ${targetUsername}`)
        .setDescription('These are the selected resources for the trade.')
        .addFields(
            { name: `${authorUsername}'s Offer`, value: formatOffer(tradeData[authorUsername]), inline: true },
            { name: `${targetUsername}'s Offer`, value: formatOffer(tradeData[targetUsername]), inline: true }
        )
        .setFooter({ text: 'The trade will be canceled if there is no response in 5 minutes.' })
        .setTimestamp();

    console.log(`Trading embed created for ${authorUsername} and ${targetUsername}:`, embed);
    return embed;
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
// Función para manejar las interacciones del collector
// Función para manejar las interacciones del collector
// Función para manejar las interacciones del collector
function handleInitialCollector(collector, message, sentMessage, tradeData, targetUser, authorInventory, targetInventory) {
    collector.on('collect', async (interaction) => {
        console.log(`Interaction collected from ${interaction.user.username}: ${interaction.customId}`);

        // ID del usuario que interactúa
        const userId = interaction.user.id; 
        
        if (interaction.customId === 'acceptTrade') {
            // Comprobación de qué usuario está aceptando el comercio
            if (userId === targetUser.id) {
                tradeData[targetUser.id].accepted = true;
                console.log(`Trade accepted by ${targetUser.username}. Current trade data:`, tradeData);
            } else if (userId === message.author.id) {
                tradeData[message.author.id].accepted = true;
                console.log(`Trade accepted by ${message.author.username}. Current trade data:`, tradeData);
            } else {
                console.error(`Unexpected user: ${interaction.user.username}. Not part of the trade.`);
                return interaction.reply({ content: '❌ You are not part of this trade.', ephemeral: true });
            }

            // Crear el embed de comercio y enviarlo
            const tradingEmbed = createTradingEmbed(message.author.username, targetUser.username, tradeData);
            const actionRow = createTradeActionRow();
            await interaction.update({ embeds: [tradingEmbed], components: [actionRow] });

            // Comprobar si ambos han aceptado
            if (tradeData[message.author.id].accepted && tradeData[targetUser.id].accepted) {
                console.log(`Both players have accepted the trade.`);
                await interaction.followUp('Both players have accepted the trade! Please specify the resources you want to trade.');
                await setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory, sentMessage);
            }
        } else if (interaction.customId === 'cancelTrade') {
            console.log(`${interaction.user.username} has canceled the trade.`);
            await interaction.update({ content: `${interaction.user.username} has canceled the trade.`, components: [] });
            sentMessage.delete();
            message.channel.send('Trade canceled.');
        }
    });
}


// Create a new action row with checkout buttons
function createTradeActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('confirmTrade').setLabel('✅ Confirm Trade').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancelTrade').setLabel('❌ Cancel Trade').setStyle(ButtonStyle.Danger)
        );
}

// Function to initialize trade data
function initializeTradeData(authorId, targetId) {
    const tradeData = {
        [authorId]: { shines: 0, moons: 0, cards: [], stellarDust: 0, accepted: false, confirmed: false },
        [targetId]: { shines: 0, moons: 0, cards: [], stellarDust: 0, accepted: false, confirmed: false },
    };
    console.log('Trade data initialized:', tradeData);
    return tradeData;
}

// Function to format offer data
function formatOffer(offer) {
    if (!offer || Object.keys(offer).length === 0) {
        return 'No resources added.';
    }

    const entries = [];
    for (const [key, value] of Object.entries(offer)) {
        if (key === 'cards') {
            entries.push(`${value.length} cards`); // Display number of cards
        } else if (value > 0) {
            entries.push(`${value} ${key}`); // Display amount and type of resource
        }
    }
    const formatted = entries.join(', '); // Return formatted string
    console.log(`Formatted offer:`, formatted);
    return formatted;
}

// Function to set up the message collector for trade details
async function setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory, sentMessage) {
    const filter = m => [message.author.id, targetUser.id].includes(m.author.id);
    const messageCollector = message.channel.createMessageCollector({ filter, time: 300000 });

    message.channel.send('Please specify the resources you want to trade. Example: `2 shines` or `moons 3`');

    messageCollector.on('collect', async (msg) => {
        console.log(`Trade input received from ${msg.author.username}: ${msg.content}`);
        const tradeInput = parseTradeInput(msg.content);
        if (tradeInput) {
            const userId = msg.author.id;
            const userInventory = userId === message.author.id ? authorInventory : targetInventory;

            if (!hasSufficientResources(userInventory, tradeData[userId], tradeInput)) {
                return msg.reply('🚫 Insufficient resources for the trade. Please adjust your offer.');
            }

            // Update the trade data
            updateTradeData(tradeData, userId, tradeInput.resource, tradeInput.amount);
            console.log(`Trade data updated for ${userId}:`, tradeData);

            // Edit the trading embed with the new offer data
            const updatedEmbed = createTradingEmbed(message.author.username, targetUser.username, tradeData);
            await sentMessage.edit({ embeds: [updatedEmbed] }); // Edit the same embed with updated data

            // Inform the user about their successful addition
            msg.reply(`✅ ${msg.author.username}, you have added **${tradeInput.amount} ${tradeInput.resource}** to the trade.`);
        } else {
            msg.reply('❌ Invalid input. Make sure you use the correct format. Example: `2 shines`.');
        }
    });

    messageCollector.on('end', async (collected) => {
        const totalMessages = collected.size;
        console.log(`Message collector ended. Total messages collected: ${totalMessages}`);
        if (totalMessages === 0) {
            message.channel.send('⏳ Trade session ended due to inactivity. Please start a new trade if you wish to continue.');
            return;
        }
        // Finalizar el comercio aquí, si es necesario
        await finalizeTrade(tradeData, message.author.id, targetUser.id).catch(err => {
            console.error('Error finalizing trade:', err);
            message.channel.send('⚠️ There was an error finalizing the trade. Please try again later.');
        });
    });
}

// Parse user trade input
function parseTradeInput(content) {
    const regex = /(\d+)\s*(shines|moons|cards|stellar\s*dust)/i;
    const match = content.match(regex);
    if (match) {
        const amount = parseInt(match[1]);
        const resource = match[2].toLowerCase();
        console.log(`Parsed trade input:`, { amount, resource });
        return amount > 0 ? { amount, resource } : null;
    }
    return null;
}

// Check if user has sufficient resources for trade
function hasSufficientResources(inventory, tradeData, tradeInput) {
    const sufficient = inventory[tradeInput.resource] >= (tradeData[tradeInput.resource] + tradeInput.amount);
    console.log(`Checking sufficient resources for ${tradeInput.resource}:`, sufficient);
    return sufficient;
}

// Update trade data based on user input
function updateTradeData(tradeData, userId, resource, amount) {
    tradeData[userId][resource] += amount;
    console.log(`Updated trade data for ${userId}:`, tradeData[userId]);
}

// Finalize trade
async function finalizeTrade(tradeData, authorId, targetId) {
    console.log(`Finalizing trade between ${authorId} and ${targetId}`);
    const authorInventory = await fetchInventory(authorId);
    const targetInventory = await fetchInventory(targetId);

    if (!hasSufficientResources(authorInventory, tradeData[authorId]) || !hasSufficientResources(targetInventory, tradeData[targetId])) {
        throw new Error('One or both users do not have sufficient resources for the trade.');
    }

    await updateInventory(authorId, subtractItemsFromInventory(authorInventory, tradeData[authorId]));
    await updateInventory(targetId, subtractItemsFromInventory(targetInventory, tradeData[targetId]));

    await addTradeItems(authorId, tradeData[targetId]);
    await addTradeItems(targetId, tradeData[authorId]);
    console.log('Trade finalized successfully.');
}

// Function to add trade items to the inventory
async function addTradeItems(userId, tradeItems) {
    const inventory = await fetchInventory(userId);
    console.log(`Current inventory for ${userId}:`, inventory);
    for (const resource in tradeItems) {
        inventory[resource] += tradeItems[resource];
        console.log(`Adding ${tradeItems[resource]} ${resource} to ${userId}'s inventory.`);
    }
    await updateInventory(userId, inventory);
}

// Function to subtract items from inventory
function subtractItemsFromInventory(inventory, tradeData) {
    for (const resource in tradeData) {
        inventory[resource] -= tradeData[resource];
        console.log(`Subtracting ${tradeData[resource]} ${resource} from inventory.`);
    }
    return inventory;
}

// Function to create completed trade embed
function createCompletedTradeEmbed(authorUsername, targetUsername) {
    return new EmbedBuilder()
        .setColor('#32CD32') // Green color for completed trade
        .setTitle('✅ Trade Completed')
        .setDescription(`The trade between ${authorUsername} and ${targetUsername} has been successfully completed!`)
        .setFooter({ text: 'Thank you for trading!' })
        .setTimestamp();
}

// Function to handle confirm/cancel trade buttons
async function handleTradeConfirmation(interaction, tradeData, message, targetUser) {
    const filter = i => [message.author.id, targetUser.id].includes(i.user.id);
    const confirmationCollector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    confirmationCollector.on('collect', async (i) => {
        console.log(`Confirmation interaction collected from ${i.user.username}: ${i.customId}`);

        if (i.customId === 'confirmTrade') {
            tradeData[i.user.id].confirmed = true; // Mark as confirmed
            console.log(`Trade confirmed by ${i.user.username}. Current trade data:`, tradeData);

            // Check if both have confirmed
            if (tradeData[message.author.id].confirmed && tradeData[targetUser.id].confirmed) {
                const completedEmbed = createCompletedTradeEmbed(message.author.username, targetUser.username);
                await i.update({ embeds: [completedEmbed], components: [] }); // Update embed to indicate trade completion
                confirmationCollector.stop(); // Stop the collector
                console.log(`Trade completed between ${message.author.username} and ${targetUser.username}`);
            } else {
                await i.reply({ content: `${i.user.username} has confirmed the trade.`, ephemeral: true });
            }
        } else if (i.customId === 'cancelTrade') {
            console.log(`${i.user.username} has canceled the trade.`);
            await i.update({ content: `${i.user.username} has canceled the trade.`, components: [] });
            confirmationCollector.stop();
            message.channel.send('Trade canceled.');
        }
    });
}
