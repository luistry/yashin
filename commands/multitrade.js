const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { updateInventory, fetchInventory } = require('./database/database');

module.exports = {
    name: 'multitrade',
    description: 'Trade multiple resources with another player.',
    run: async (message, args) => {
        try {
            const targetUser = message.mentions.users.first();
            if (!targetUser) {
                return message.channel.send('Please mention a user to trade with.');
            }

            const [authorInventory, targetInventory] = await fetchInventories(message.author.id, targetUser.id);

            const tradeData = initializeTradeData(message.author.id, targetUser.id, authorInventory, targetInventory);
            const tradeRequestEmbed = createTradeRequestEmbed(message.author.username, targetUser.username);
            const actionRow = createInitialActionRow();

            const sentMessage = await message.channel.send({ embeds: [tradeRequestEmbed], components: [actionRow] });
            const collector = createInitialCollector(sentMessage, targetUser.id, message.author.id);

            handleInitialCollector(collector, message, sentMessage, tradeData, targetUser, authorInventory, targetInventory);
            await setupMessageCollector(message, tradeData, targetUser, sentMessage);
        } catch (error) {
            console.error('Error in multitrade command:', error);
            message.channel.send('An error occurred while trying to execute the trade. Please try again.');
        }
    },
};

// Fetch inventories concurrently
async function fetchInventories(authorId, targetId) {
    console.log(`Fetching inventories for ${authorId} and ${targetId}`);
    const [authorInventory, targetInventory] = await Promise.all([
        fetchInventory(authorId),
        fetchInventory(targetId),
    ]);
    console.log(`Inventories fetched:`, { authorInventory, targetInventory });
    return [authorInventory, targetInventory];
}

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

function handleInitialCollector(collector, message, sentMessage, tradeData, targetUser, authorInventory, targetInventory) {
    collector.on('collect', async (interaction) => {
        console.log(`Interaction collected from ${interaction.user.username}: ${interaction.customId}`);

        const userId = interaction.user.id; 
        
        if (interaction.customId === 'acceptTrade') {
            if (userId === targetUser.id) {
                tradeData[targetUser.id].accepted = true;
                console.log(`Trade accepted by ${targetUser.username}. Current trade data:`, tradeData);
                
                // Check if the author also accepted
                if (tradeData[message.author.id].accepted) {
                    console.log(`Both players have accepted the trade.`);
                    const actionRow = createTradeActionRow();
                    const tradingEmbed = createTradingEmbed(message.author.username, targetUser.username, tradeData);

                    await interaction.followUp({ embeds: [tradingEmbed], components: [actionRow] });
                    await setupMessageCollector(message, tradeData, targetUser, sentMessage);
                } else {
                    await interaction.reply({ content: 'Trade accepted. Waiting for the other player to accept.', ephemeral: true });
                }
            } else {
                await interaction.reply({ content: '❌ Only the target user can accept the trade.', ephemeral: true });
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
function initializeTradeData(authorId, targetId, authorInventory, targetInventory) {
    return {
        [authorId]: { ...initializeUserData(authorInventory), accepted: false, confirmed: false },
        [targetId]: { ...initializeUserData(targetInventory), accepted: false, confirmed: false }
    };
}

// Helper function to initialize user data
function initializeUserData(inventory) {
    return {
        shines: inventory.shines?.[0] || 0,
        moons: inventory.moons?.[0] || 0,
        stellarDust: inventory.stellar_dust?.[0] || 0,
        cards: inventory.cards || [],
        extra_grab: inventory.extra_grab?.[0] || 0,
        extra_drop: inventory.extra_drop?.[0] || 0,
        DivinityAbsolute: inventory.DivinityAbsolute?.[0] || 0,
        FastHands: inventory.FastHands?.[0] || 0,
        Glows: inventory.Glows?.[0] || 0,
        GodofEvasion: inventory.GodofEvasion?.[0] || 0,
        SpeedOfReaction: inventory.SpeedOfReaction?.[0] || 0
    };
}

function formatOffer(offer) {
    const entries = [];
    for (const [key, value] of Object.entries(offer)) {
        if (key === 'cards') {
            entries.push(`${value.length} cards`); // Show the number of cards
        } else if (value > 0) {
            entries.push(`${value} ${key}`); // Show the amount and type of resource
        }
    }
    return entries.length > 0 ? entries.join(', ') : 'No resources added.';
}

// Set up message collector for trade details
async function setupMessageCollector(message, tradeData, targetUser, sentMessage) {
    const filter = m => [message.author.id, targetUser.id].includes(m.author.id);
    const messageCollector = message.channel.createMessageCollector({ filter, time: 300000 });

    messageCollector.on('collect', async (msg) => {
        const userId = msg.author.id;
        
        // Ensure both players have accepted before processing trade input
        if (!tradeData[message.author.id].accepted || !tradeData[targetUser.id].accepted) {
            return msg.reply('❌ Both players must accept the trade before adding resources.');
        }

        console.log(`Trade input received from ${msg.author.username}: ${msg.content}`);
        const tradeInput = parseTradeInput(msg.content);

        if (tradeInput) {
            const userInventory = userId === message.author.id ? await fetchInventory(userId) : await fetchInventory(targetUser.id);
            
            if (!hasSufficientResources(userInventory, tradeData[userId], tradeInput)) {
                return msg.reply('🚫 Insufficient resources for the trade. Please adjust your offer.');
            }

            updateTradeData(tradeData, userId, tradeInput.resource, tradeInput.amount);
            console.log(`Trade data updated for ${userId}:`, tradeData);
            const updatedEmbed = createTradingEmbed(message.author.username, targetUser.username, tradeData);
            await sentMessage.edit({ embeds: [updatedEmbed] });
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
        await finalizeTrade(tradeData, message.author.id, targetUser.id).catch(err => {
            console.error('Error finalizing trade:', err);
            message.channel.send('❌ There was an error finalizing the trade. Please try again.');
        });
    });
}

// Finalize trade
async function finalizeTrade(tradeData, authorId, targetId) {
    // Logic for confirming and finalizing the trade goes here.
    console.log(`Finalizing trade between ${authorId} and ${targetId}...`);
}

// Check if the user has sufficient resources for the trade
function hasSufficientResources(inventory, tradeDataUser, tradeInput) {
    const { resource, amount } = tradeInput;
    return inventory[resource] >= (tradeDataUser[resource] || 0) + amount;
}

// Parse trade input from user message
function parseTradeInput(input) {
    const regex = /^(\d+)\s+(\w+)$/; // Matches 'number resource'
    const match = input.match(regex);
    if (match) {
        const amount = parseInt(match[1], 10);
        const resource = match[2].toLowerCase();
        return { amount, resource };
    }
    return null;
}

// Update trade data with the user's offer
function updateTradeData(tradeData, userId, resource, amount) {
    if (!tradeData[userId][resource]) {
        tradeData[userId][resource] = 0;
    }
    tradeData[userId][resource] += amount;
}
