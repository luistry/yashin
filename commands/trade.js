const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database');

module.exports = {
    name: 'trade',
    description: 'Trade Shines, Gold, Stellar Dust, Buffs, Moons, Frames, or Cards with another player.',
    run: async (message, args) => {
        try {
            const targetUser = message.mentions.users.first();
            if (!targetUser) {
                return message.channel.send('Please mention a user to trade with.');
            }

            // Initialize trade data for both users
            const tradeData = initializeTradeData(message.author.id, targetUser.id);

            // Send trade request
            const tradeRequestEmbed = createTradeRequestEmbed(message.author.username, targetUser.username);
            const actionRow = createInitialActionRow();

            const sentMessage = await message.channel.send({ embeds: [tradeRequestEmbed], components: [actionRow] });
            const collector = createInitialCollector(sentMessage, targetUser.id);

            // Handle trade acceptance or cancellation
            handleInitialCollector(collector, message, sentMessage, tradeData, targetUser);

        } catch (error) {
            console.error('Error in trade command:', error);
            message.channel.send('An error occurred while trying to execute the trade. Please try again.');
        }
    },
};

// Function to initialize trade data for both users
function initializeTradeData(authorId, targetId) {
    return {
        [authorId]: { shines: 0, gold: 0, stellarDust: 0, moons: 0, cards: [], confirmed: false },
        [targetId]: { shines: 0, gold: 0, stellarDust: 0, moons: 0, cards: [], confirmed: false },
    };
}

// Function to create the initial trade request embed
function createTradeRequestEmbed(authorUsername, targetUsername) {
    return new EmbedBuilder()
        .setColor('#7289DA')
        .setDescription(`${targetUsername}, do you want to accept ${authorUsername}'s trade request?`);
}

// Function to create the initial action row with accept and decline buttons
function createInitialActionRow() {
    const acceptButton = new ButtonBuilder()
        .setCustomId('accept_trade')
        .setLabel('✔️')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId('decline_trade')
        .setLabel('❌')
        .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder().addComponents(acceptButton, declineButton);
}

// Function to create the collector for the initial trade acceptance or decline
function createInitialCollector(sentMessage, targetUserId) {
    return sentMessage.createMessageComponentCollector({
        filter: i => ['accept_trade', 'decline_trade'].includes(i.customId) && i.user.id === targetUserId,
        time: 120000, // 2-minute timer
    });
}

// Function to handle the initial collector for trade acceptance or decline
function handleInitialCollector(collector, message, sentMessage, tradeData, targetUser) {
    collector.on('collect', async i => {
        try {
            // Defer the update to prevent "interaction failed" error
            await i.deferUpdate(); 

            if (i.customId === 'decline_trade') {
                await handleTradeCancellation(sentMessage, message.author.username, targetUser.username);
                collector.stop(); // Stop further interactions
            } else if (i.customId === 'accept_trade') {
                await handleTradeAcceptance(i, message, sentMessage, tradeData, targetUser);
                collector.stop(); // Stop further interactions
            }
        } catch (error) {
            console.error('Error handling collector:', error);
        }
    });

    // Handle collector end (when time expires or manually stopped)
    collector.on('end', async collected => {
        if (collected.size === 0) {
            const expiredEmbed = createExpiredEmbed();
            await sentMessage.edit({ content: null, embeds: [expiredEmbed], components: [] });
        }
    });
}

// Function to handle trade cancellation
async function handleTradeCancellation(sentMessage, authorUsername, targetUsername) {
    const canceledEmbed = createCanceledEmbed(authorUsername, targetUsername);
    await sentMessage.edit({ content: null, embeds: [canceledEmbed], components: [] });
}

// Function to handle trade acceptance
async function handleTradeAcceptance(i, message, sentMessage, tradeData, targetUser) {
    const acceptedEmbed = createAcceptedEmbed(message.author.username, targetUser.username);
    await sentMessage.edit({ content: null, embeds: [acceptedEmbed], components: [] });

    // Proceed with trade logic here
    // You can add further logic for resource selection
}

// Function to create a trade cancellation embed
function createCanceledEmbed(authorUsername, targetUsername) {
    return new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription(`❌ Trade between ${authorUsername} and ${targetUsername} has been canceled.`);
}

// Function to create a trade acceptance embed
function createAcceptedEmbed(authorUsername, targetUsername) {
    return new EmbedBuilder()
        .setColor('#00FF00')
        .setDescription(`✔️ Trade between ${authorUsername} and ${targetUsername} has been accepted!`);
}

// Function to create an expired trade embed
function createExpiredEmbed() {
    return new EmbedBuilder()
        .setColor('#FFA500')
        .setDescription('⏳ The trade request has expired due to no response.');
}
