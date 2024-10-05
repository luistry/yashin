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
                await setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory, sentMessage);
            } else if (userId === message.author.id) {
                return interaction.reply({ content: '❌ Only the target user can accept this trade.', ephemeral: true });
                
            } else {
                console.error(`Unexpected user: ${interaction.user.username}. Not part of the trade.`);
                return interaction.reply({ content: '❌ You are not part of this trade.', ephemeral: true });
            }

            // Crear el embed de comercio y enviarlo
            const tradingEmbed = createTradingEmbed(message.author.username, targetUser.username, tradeData);
            const actionRow = createTradeActionRow();
            await interaction.update({ embeds: [tradingEmbed], components: [actionRow] });
            const filter = (i) => {
                return ['confirmTrade', 'cancelTrade'].includes(i.customId) &&
                       [message.author.id, targetUser.id].includes(i.user.id);
            };
            
            // Crear el collector para escuchar las interacciones de botones
            const buttonCollector = sentMessage.createMessageComponentCollector({ filter, time: 300000 }); // 5 minutos de espera
            
            // Escuchar el evento 'collect' cuando se presiona un botón
            buttonCollector.on('collect', async (i) => {
                if (i.customId === 'confirmTrade') {
                    // Si el usuario confirma el trade
                    const userId = i.user.id;
                    tradeData[userId].confirmed = true; // Marca que el usuario ha confirmado su trade
            
                    await i.reply(`${i.user.username} has confirmed the trade.`);
            
                    // Verificar si ambos han confirmado
                    if (tradeData[message.author.id].confirmed && tradeData[targetUser.id].confirmed) {
                        // Finalizar el trade
                        await finalizeTrade(interaction,tradeData, message.author.id, targetUser.id);
                        await i.followUp('✅ Trade finalized!');
                        buttonCollector.stop(); // Finalizar el collector después del trade
                        collector.stop();
                    }
                } else if (i.customId === 'cancelTrade') {
                    // Si el usuario cancela el trade
                    await i.reply(`${i.user.username} has canceled the trade.`);
                    buttonCollector.stop(); // Finalizar el collector
                }
            });
            
            // Escuchar el evento 'end' cuando el tiempo del collector termine o alguien cancele el trade
            buttonCollector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await sentMessage.edit({
                        components: [] // Desactiva los botones después de que el tiempo termine
                    });
                    return message.channel.send('⏳ Trade session timed out due to inactivity.');
                } else if (reason === 'user') {
                    await sentMessage.edit({
                        components: [] // Desactiva los botones si el trade fue confirmado o cancelado
                    });
                }
            });
            
      
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
// Function to set up the message collector for trade details
async function setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory, sentMessage) {
    const filter = m => [message.author.id, targetUser.id].includes(m.author.id);
    const messageCollector = message.channel.createMessageCollector({ filter, time: 300000 });
    const lastInputs = { [message.author.id]: null, [targetUser.id]: null }; // Para evitar spam del mismo mensaje

    message.channel.send('Please specify the resources you want to trade. Example: `2 shines` or `moons 3`');

    messageCollector.on('collect', async (msg) => {
        const userId = msg.author.id;
        const tradeInput = parseTradeInput(msg.content);

        if (!tradeInput) {
            return msg.reply('❌ Invalid input. Make sure you use the correct format. Example: `2 shines`.');
        }

        // Prevenir spam: Evitar que el usuario repita la misma entrada consecutivamente
        if (lastInputs[userId] && lastInputs[userId].resource === tradeInput.resource && lastInputs[userId].amount === tradeInput.amount) {
            return msg.reply('🚫 You have already added this exact offer. Please make a different offer.');
        }
        lastInputs[userId] = tradeInput; // Actualiza la última entrada del usuario

        const userInventory = userId === message.author.id ? authorInventory : targetInventory;

        if (!hasSufficientResources(userInventory, tradeData[userId], tradeInput)) {
            return msg.reply('🚫 Insufficient resources for the trade. Please adjust your offer.');
        }

        // Actualiza los datos del trade
        updateTradeData(tradeData, userId, tradeInput.resource, tradeInput.amount);
        console.log(`Trade data updated for ${userId}:`, tradeData);

        // Crear un nuevo embed con las ofertas actualizadas
        const updatedEmbed = new EmbedBuilder()
            .setTitle(`Trade between ${message.author.username} and ${targetUser.username}`)
            .setDescription('These are the selected resources for the trade.')
            .addFields(
                {
                    name: `${message.author.username}'s Offer`,
                    value: formatOffer(tradeData[message.author.id]) || 'No resources added', // Formatea los datos de la oferta
                    inline: true
                },
                {
                    name: `${targetUser.username}'s Offer`,
                    value: formatOffer(tradeData[targetUser.id]) || 'No resources added', // Formatea los datos de la oferta
                    inline: true
                }
            )
            .setFooter({ text: 'The trade will be canceled if there is no response in 5 minutes.' }); // El argumento debe ser un objeto

        // Editar el mensaje original con el nuevo embed
        console.log('Updating embed with new trade data:', tradeData); // Verificar el estado antes de editar el embed
        await sentMessage.edit({ embeds: [updatedEmbed] }).catch(console.error);

        msg.reply(`✅ ${msg.author.username}, you have added **${tradeInput.amount} ${tradeInput.resource}** to the trade.`);

        // Condición para finalizar el colector si ambos jugadores están satisfechos con su oferta
        if (tradeData[message.author.id].confirmed && tradeData[targetUser.id].confirmed) {
            console.log('Both users have confirmed their trades. Finalizing trade.');
            
            // Finalizar el comercio aquí
            await finalizeTrade(tradeData, message.author.id, targetUser.id).catch(err => {
                console.error('Error finalizing trade:', err);
                message.channel.send('⚠️ There was an error finalizing the trade. Please try again later.');
            });

            messageCollector.stop();
        }
    });

    messageCollector.on('end', (collected) => {
        if (collected.size === 0) {
            message.channel.send('⏳ Trade session ended due to inactivity. Please start a new trade if you wish to continue.');
        } else {
            message.channel.send('🚫 Trade session ended. No further trades can be added.');
        }
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
let tradeFinalized = false; // Flag para controlar que solo se finalice una vez

async function finalizeTrade(interaction, tradeData, authorId, targetId) {
    if (tradeFinalized) {
        console.log('Trade already finalized. Skipping execution.');
        return; // Si ya fue finalizado, no ejecutamos la función de nuevo
    }

    console.log(`Finalizing trade between ${authorId} and ${targetId}`);
    
    const completed = createCompletedTradeEmbed(authorId, targetId);

    try {
        // Actualizar el mensaje para confirmar la finalización del trade
        await interaction.update({ embeds: [completed], components: [] });

        // Obtener inventarios de ambos usuarios
        const authorInventory = await fetchInventory(authorId);
        const targetInventory = await fetchInventory(targetId);

        // Verificar si ambos usuarios tienen suficientes recursos
        if (!hasSufficientResources(authorInventory, tradeData[authorId]) || !hasSufficientResources(targetInventory, tradeData[targetId])) {
            throw new Error('One or both users do not have sufficient resources for the trade.');
        }

        // Actualizar inventarios (restar items de los inventarios de ambos)
        await updateInventory(authorId, subtractItemsFromInventory(authorInventory, tradeData[authorId]));
        await updateInventory(targetId, subtractItemsFromInventory(targetInventory, tradeData[targetId]));

        // Añadir los items tradeados al inventario de cada uno
        await addTradeItems(authorId, tradeData[targetId]);
        await addTradeItems(targetId, tradeData[authorId]);

        console.log('Trade finalized successfully.');
        
        // Establecer la bandera de finalización
        tradeFinalized = true;

    } catch (error) {
        console.error('Error finalizing trade:', error);
        await interaction.followUp({ content: '⚠️ There was an error finalizing the trade. Please try again later.' });
    }
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