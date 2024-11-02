const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); 
const { updateInventory, fetchInventory } = require('./database/database');
let activeTrades = new Set(); // Para rastrear las sesiones activas
module.exports = {
    name: 'multitrade',
    description: 'Trade multiple resources with another player.',
    run: async (message, args) => {
        try {
            if (message.guild.id !== '1272302731528376350') {
                return message.channel.send("This command can only be used in this server.");
            }
            const targetUser = message.mentions.users.first();
            if (!targetUser) return message.channel.send('Please mention a user to trade with.');

            if (targetUser.id === message.author.id) {
                return message.channel.send("You cannot trade with yourself.");
            }
             // Verificar si los usuarios ya tienen un trade activo
        if (activeTrades.has(message.author.id) || activeTrades.has(targetUser.id)) {
            return message.channel.send('One of the users already has an active trade.');
        }

        // Marcar a los usuarios como activos en el trade
        activeTrades.add(message.author.id);
        activeTrades.add(targetUser.id);
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
// Function to initialize trade data for both users
function initializeTradeData(authorId, targetId) {
    const tradeData = {
        [authorId]: {
            shines: 0,
            moons: 0,
            cards: [],
            stellarDust: 0,
            gold: 0,                // Añadido
            divinityAbsolute: 0,     // Añadido
            glows: 0,                // Añadido
            extragrab: 0,            // Añadido
            extradrop: 0, 
            candy: 0,          // Añadido
            frames: [],              // Añadido (manejo de frames)
            accepted: false,
            confirmed: false
        },
        [targetId]: {
            shines: 0,
            moons: 0,
            cards: [],
            stellarDust: 0,
            gold: 0,                // Añadido
            divinityAbsolute: 0,     // Añadido
            glows: 0,                // Añadido
            extragrab: 0,            // Añadido
            extradrop: 0,    
            candy: 0,          // Añadido
            frames: [],              // Añadido (manejo de frames)
            accepted: false,
            confirmed: false
        }
    };

    // Tracking the session status for both users (initializing with false)
    activeTrades[authorId] = false;
    activeTrades[targetId] = false;

    console.log('Trade data initialized:', tradeData);
    return tradeData;
}


// Function to format offer data for displaying the resources
function formatOffer(offer) {
    if (!offer || Object.keys(offer).length === 0) {
        return 'No resources added.';
    }

    const entries = [];
    for (const [key, value] of Object.entries(offer)) {
        if (key === 'cards') {
            entries.push(`${value.length} cards`); // Display number of cards
        } else if (value > 0 && key !== 'accepted' && key !== 'confirmed') {
            entries.push(`${value} ${key}`); // Display amount and type of resource
        }
    }

    const formatted = entries.length > 0 ? entries.join(', ') : 'No resources added.';
    console.log('Formatted offer:', formatted);
    return formatted;
}

// Function to set up the message collector for trade details
function addCardsToTradeInput(inventory, tradeInput, cardCodes) {
    // Initialize an array to hold the cards to be added
    const cardsToAdd = [];

    // Iterate through the provided card codes
    for (const code of cardCodes) {
        // Check if the card exists in the user's inventory (regardless of grabbed_by)
        const card = inventory.cards.find(card => card.code === code);
        
        // If the card exists, add it to the cardsToAdd array
        if (card) {
            cardsToAdd.push(card);
        } else {
            console.log(`Card with code ${code} does not exist in the inventory.`);
        }
    }

    // If there are cards to add, update the tradeInput
    if (cardsToAdd.length > 0) {
        tradeInput.cards = tradeInput.cards || []; // Initialize if undefined
        tradeInput.cards.push(...cardsToAdd); // Add the cards to the trade input
        console.log(`Added cards to trade input:`, cardsToAdd);
    } else {
        console.log(`No cards were added to the trade input.`);
    }
}
// Function to set up the message collector for trade details
const activeCollectors = {}; // Store active collectors for trades
let isTradeActive = true; // Variable de control global
async function setupMessageCollector(message, tradeData, targetUser, authorInventory, targetInventory, sentMessage) {
    const userIds = [message.author.id, targetUser.id];
    if (!isTradeActive) return; // Si el trade ya fue finalizado, no ejecuta nada más
    
    if (activeCollectors[message.channel.id]) {
        return message.reply('🚫 There is already an active trade session in this channel. Please finalize or cancel it before starting a new one.');
    }

    const messageCollector = message.channel.createMessageCollector({ filter: m => userIds.includes(m.author.id), time: 100000 });
    activeCollectors[message.channel.id] = messageCollector;

    const lastInputs = { [message.author.id]: null, [targetUser.id]: null };

    message.channel.send('Please specify the resources you want to trade. Example: `2 shines` or `moons 3`');

    messageCollector.on('collect', async (msg) => {
        const userId = msg.author.id;
        const tradeInput = parseTradeInput(msg.content);

        // Evitar entradas duplicadas
        if (lastInputs[userId] === tradeInput) {
            return msg.reply('🚫 You cannot submit the same trade input consecutively.');
        }

        lastInputs[userId] = tradeInput;

        const userInventory = userId === message.author.id ? authorInventory : targetInventory;

        // Asegúrate de que el `tradeData` para el usuario esté inicializado
        if (!tradeData[userId]) {
            tradeData[userId] = { shines: 0, moons: 0, gold: 0, cards: [] };
        }

        // **Verificación de recursos** (aplica para shines, moons, etc.)
        if (['shines', 'moons', 'gold'].includes(tradeInput.resource)) {
            const availableAmount = userInventory[tradeInput.resource] || 0; // Recurso disponible del inventario
            const newTotal = tradeData[userId][tradeInput.resource] + tradeInput.amount; // Nuevo total después de agregar el trade

            if (newTotal > availableAmount) {
                return msg.reply(`🚫 You do not have enough **${tradeInput.resource}**. You only have **${availableAmount}** available.`);
            }

            // Si tiene suficientes recursos, actualiza el trade
            tradeData[userId][tradeInput.resource] = newTotal;
            msg.reply(`✅ You have successfully added **${tradeInput.amount} ${tradeInput.resource}** to the trade.`);
        }

        // **Manejo de cartas**
        else if (tradeInput.resource === 'cards') {
            const cardExists = userInventory.cards.some(card => card.code === tradeInput.cardCode);
            const cardAlreadyAdded = tradeData[userId].cards.includes(tradeInput.cardCode);

            if (cardExists) {
                if (cardAlreadyAdded) {
                    return msg.reply(`🚫 Card with code **${tradeInput.cardCode}** has already been added to the trade.`);
                }

                tradeData[userId].cards.push(tradeInput.cardCode);
                msg.reply(`✅ You have successfully added **${tradeInput.cardCode}** to the trade.`);
            } else {
                return msg.reply(`🚫 Card with code **${tradeInput.cardCode}** does not exist in your inventory.`);
            }
        }

        console.log(`Trade data updated for ${userId}:`, tradeData);

        // Crear y actualizar el embed con las ofertas actualizadas
        const updatedEmbed = new EmbedBuilder()
            .setTitle(`Trade between ${message.author.username} and ${targetUser.username}`)
            .setDescription('These are the selected resources for the trade.')
            .addFields(
                { name: `${message.author.username}'s Offer`, value: formatOffer(tradeData[message.author.id]) || 'No resources added', inline: true },
                { name: `${targetUser.username}'s Offer`, value: formatOffer(tradeData[targetUser.id]) || 'No resources added', inline: true }
            )
            .setFooter({ text: 'The trade will be canceled if there is no response in 5 minutes.' });

        await sentMessage.edit({ embeds: [updatedEmbed] }).catch(console.error);

        // Verificar si ambos usuarios han confirmado sus trades
        if (tradeData[message.author.id].confirmed && tradeData[targetUser.id].confirmed) {
            console.log('Both users have confirmed their trades. Finalizing trade.');
            await finalizeTrade(tradeData, message.author.id, targetUser.id).catch(err => {
                console.error('Error finalizing trade:', err);
                message.channel.send('⚠️ There was an error finalizing the trade. Please try again later.');
            });
            messageCollector.stop();
        }
    });

    messageCollector.on('end', (collected) => {
        delete activeCollectors[message.channel.id];

        if (collected.size === 0) {
            message.channel.send('⏳ Trade session ended due to inactivity. Please start a new trade if you wish to continue.');
        } else {
            message.channel.send('🚫 Trade session ended. No further trades can be added.');
        }
    });
}




// Parse user trade input
function parseTradeInput(content) {
    // Regex for resources including spaces, and card codes
    const resourceRegex = /(\d+)\s*(shines|moons|candy|cards|stellar\s*dust|gold|divinity\s*absolute|glows|extra\s*grab|extra\s*drop|frames)/i;
    const cardRegex = /([a-zA-Z0-9]{3,7})/; // Regex for card codes with 3-7 characters

    const matchResource = content.match(resourceRegex);
    const matchCard = content.match(cardRegex);

    if (matchResource) {
        const amount = parseInt(matchResource[1]);
        let resource = matchResource[2].toLowerCase().replace(/\s+/g, ''); // Normalize

        // Normalize resource names
        switch (resource) {
            case 'stellardust':
                resource = 'stellarDust';
                break;
            case 'divinityabsolute':
                resource = 'divinityAbsolute';
                break;
            case 'extragrab':
                resource = 'extraGrab';
                break;
            case 'extradrop':
                resource = 'extra_drop';
                break;
            // Additional resource cases if needed
        }

        console.log(`Parsed trade input:`, { amount, resource });

        // Return only if amount is greater than 0
        return amount > 0 ? { amount, resource } : null;
    } else if (matchCard) {
        // If it's just a card code
        const cardCode = matchCard[1]; // Extract card code
        console.log(`Parsed card code:`, cardCode);
        return { resource: 'cards', cardCode }; // Return with resource type
    }

    return null;
}


// Check if user has sufficient resources for trade
const resourceMapping = {
    extradrop: 'extra_drop',
    extraGrab: 'extra_grab',
    divinityAbsolute: 'DivinityAbsolute',
    cards: 'cards'
};


const lastAddedCardCodes = {};

// Create a new array to store the codes of added cards for trade data
const addedCardCodes = []; // This can be moved to tradeData if needed

function hasSufficientResources(inventory, tradeData, tradeInput, userId) {
    // Check if the resource is cards
    if (tradeInput.resource === 'cards') {
        // Verify if the card with the given code exists in the user's inventory
        const cardExists = inventory.cards.some(card => card.code === tradeInput.cardCode);
        console.log(`Checking if card ${tradeInput.cardCode} exists in inventory:`, cardExists);

        if (cardExists) {
            // Store the card code in the global variable for the user
            lastAddedCardCodes[userId] = tradeInput.cardCode;

            // Add the card code to the new array
            addedCardCodes.push(tradeInput.cardCode);

            return true; // Return true if the card exists
        } else {
            return false; // Card does not exist
        }
    }

    // For other resources, map the resource name using resourceMapping or fall back to the original resource name
    const resourceName = resourceMapping[tradeInput.resource] || tradeInput.resource;
    const quantity = inventory[resourceName] || 0; // Get the quantity directly, default to 0 if not found

    // Calculate the required amount for the trade
    const requiredAmount = (tradeData[tradeInput.resource] || 0) + tradeInput.amount;
    const sufficient = quantity >= requiredAmount;

    console.log(`Checking sufficient resources for ${tradeInput.resource}:`, sufficient);
    return sufficient;
}

// Function to clear the added card codes after processing the trade
function clearAddedCardCodes(userId) {
    delete lastAddedCardCodes[userId];
}







// Update trade data based on user input
function updateTradeData(tradeData, userId, resource, amount, cardCode) {
    // Check if the resource is cards
    if (resource === 'cards') {
        // Ensure the tradeData for this user has a cards array
        if (!tradeData[userId].cards) {
            tradeData[userId].cards = []; // Initialize if undefined
        }

        // Check if the card already exists in the trade data
        const cardExists = tradeData[userId].cards.some(card => card.code === cardCode);
        if (!cardExists) {
            // If the card doesn't exist, add it to the trade data
            tradeData[userId].cards.push({ code: cardCode });
            console.log(`Added card ${cardCode} to trade data for user ${userId}.`);
        } else {
            console.log(`Card ${cardCode} already in trade data for user ${userId}.`);
        }
        return; // Exit after handling card update
    }

    const resourceName = resourceMapping[resource] || resource; // Use mapped name or fall back to original

    // Ensure the resource exists in the tradeData
    if (!tradeData[userId][resourceName]) {
        tradeData[userId][resourceName] = 0; // Initialize if undefined
    }
    tradeData[userId][resourceName] += amount;

    console.log(`Updated trade data for ${userId}:`, tradeData[userId]);
}


// Finalize trade
let tradeFinalized = false; // Flag para controlar que solo se finalice una vez


async function finalizeTrade(interaction, tradeData, authorId, targetId, collector) {
    try {
        const authorOffer = tradeData[authorId];
        const targetOffer = tradeData[targetId];

        // Validate offers before processing
        if (!authorOffer || !targetOffer) {
            console.error('Invalid trade data: Author or target offer is missing.');
            await interaction.followUp('⚠️ Invalid trade data. Please try again later.');
            return;
        }

        // Restar los recursos del autor
        await subtractItemsFromInventory(authorId, authorOffer, targetId);

        // Restar los recursos del target
        await subtractItemsFromInventory(targetId, targetOffer, authorId);

        // Agregar los recursos al inventario del target
        await addTradeItems(targetId, authorOffer);

        // Agregar los recursos al inventario del autor
        await addTradeItems(authorId, targetOffer);

        console.log(`Trade successfully finalized between ${authorId} and ${targetId}.`);
          isTradeActive = false; 
        activeTrades.delete(authorId);
        activeTrades.delete(targetId);
        setupMessageCollector = null
        parseTradeInput = null
        // Detener el collector si está activo
        if (collector) {
            collector.stop();  // Finaliza el colector si sigue activo
            console.log('Collector has been stopped.');
        }

       
    } catch (error) {
        console.error('Error finalizing trade:', error);
        await interaction.followUp('⚠️ There was an error finalizing the trade. Please try again later.');
    }
}

async function subtractItemsFromInventory(userId, tradeItems, otherPlayerId) {
    const inventory = await fetchInventory(userId);
    
    // Check if inventory is valid
    if (!inventory || !Array.isArray(inventory.cards)) {
        console.error(`No inventory found for user ID: ${userId}`);
        return []; // Return empty array if inventory is not valid
    }
    
    console.log(`Current inventory for ${userId}:`, inventory);

    let cardsToTransfer = [];  // Array to store cards to transfer
    const transferredCardCodes = new Set();  // To ensure card codes are unique

    // Handle cards
    if (tradeItems.cards && Array.isArray(tradeItems.cards)) {
        for (const cardCode of tradeItems.cards) {
            const existingCardIndex = inventory.cards.findIndex(invCard => invCard.code === cardCode);

            if (existingCardIndex !== -1 && !transferredCardCodes.has(cardCode)) {
                // Store the card to transfer
                const cardToTransfer = inventory.cards[existingCardIndex];
                cardsToTransfer.push(cardToTransfer);
                transferredCardCodes.add(cardCode); // Add code to the set to ensure uniqueness

                // Remove the card from the inventory of the player who is subtracting
                inventory.cards.splice(existingCardIndex, 1);
                console.log(`Subtracted card ${cardCode} from ${userId}'s inventory.`);
            } else if (transferredCardCodes.has(cardCode)) {
                console.log(`Card ${cardCode} has already been transferred.`);
            } else {
                console.log(`Attempted to remove card ${cardCode} from ${userId}'s inventory, but it was not found.`);
            }
        }
    }

    // Handle numeric resources like shines, moons, etc.
    for (const resource in tradeItems) {
        if (typeof tradeItems[resource] === 'number' && inventory[resource] && Array.isArray(inventory[resource])) {
            // Ensure not to go below zero
            if (inventory[resource][0] >= tradeItems[resource]) {
                inventory[resource][0] -= tradeItems[resource];
                console.log(`Subtracted ${tradeItems[resource]} ${resource} from ${userId}'s inventory.`);
            } else {
                console.log(`Insufficient ${resource} in ${userId}'s inventory.`);
            }
        }
    }

    // Update the inventory
    await updateInventory(userId, inventory);
    console.log(`Inventory updated for ${userId}.`);

    // Now add the cards to the other player's inventory
    if (cardsToTransfer.length > 0) {
        await addTradeItems(otherPlayerId, { cards: cardsToTransfer });
    }

    return cardsToTransfer;  // Return the transferred cards
}

async function addTradeItems(userId, tradeItems) {
    const inventory = await fetchInventory(userId);
    
    // Check if inventory is valid
    if (!inventory || !Array.isArray(inventory.cards)) {
        console.error(`No inventory found for user ID: ${userId}`);
        return; // Exit if inventory is not valid
    }

    console.log(`Current inventory for ${userId}:`, inventory);

    // Handle cards
    if (tradeItems.cards && Array.isArray(tradeItems.cards)) {
        const existingCardCodes = new Set(inventory.cards.map(invCard => invCard.code)); // Set of existing card codes

        for (const card of tradeItems.cards) {
            if (!existingCardCodes.has(card.code)) {
                // Add the card to the inventory if it does not already exist
                inventory.cards.push(card);
                console.log(`Added card ${card.code} to ${userId}'s inventory.`);
            } else {
                console.log(`Card ${card.code} already exists in ${userId}'s inventory. No duplicates allowed.`);
            }
        }
    }

    // Handle numeric resources like shines, moons, etc.
    for (const resource in tradeItems) {
        if (typeof tradeItems[resource] === 'number' && inventory[resource] && Array.isArray(inventory[resource])) {
            // Add the number to the first element of the array
            inventory[resource][0] += tradeItems[resource];
            console.log(`Added ${tradeItems[resource]} ${resource} to ${userId}'s inventory.`);
        }
    }

    await updateInventory(userId, inventory);
    console.log(`Inventory updated for ${userId}.`);
}
