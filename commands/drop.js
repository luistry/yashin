const { EmbedBuilder, AttachmentBuilder, ReactionCollector, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Canvas = require('canvas');

const { AnimeCharacter, fetchInventory, addCardToInventory, fetchLastDrop, updateLastDrop, fetchLastGrab, updateLastGrab ,consumeItems,updateDailyBuffs } = require('./database/database');
const fetch = require('node-fetch');
const frameImageUrl = 'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png';

async function fetchImage(url) {
    // Check if URL is valid and starts with 'http://' or 'https://'
    if (!/^https?:\/\//i.test(url)) {
        throw new Error('Invalid URL');
    }

    // Define a timeout function that rejects the promise after a specified time (20 seconds)
    const timeout = (ms) => {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: Image load took too long (more than 20 seconds).')), ms)
        );
    };

    try {
        // Race between the fetch request and the timeout (set to 20 seconds)
        const response = await Promise.race([
            fetch(url), // Attempt to fetch the image
            timeout(20000) // Timeout after 20 seconds
        ]);

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        return await response.buffer(); // Return the image buffer

    } catch (error) {
        console.error('Error fetching image:', error.message);
        throw error; // Rethrow the error so it can be handled elsewhere if needed
    }
}

// Constants
const COOLDOWN_DURATION_DROP = 20 * 60 * 1000; // 20 minutes
const COOLDOWN_DURATION_GRAB = 10 * 60 * 1000;  // 10 minutes
// Generates an array of 3 unique random numbers within the specified range
// Generates a random character ID


// Generates a random character ID
// Generates an array of 3 unique random character IDs between 1 and 13500
function getRandomCharacterIds() {
    const ids = new Set();

    // Generate one ID between 15000 and 15408
    const randomIdInRange = Math.floor(Math.random() * (150669 - 150121 + 1)) + 150121; // ID in range
    const randomIdInRange1 = Math.floor(Math.random() * (200278 - 200215 + 1)) + 200215;

    ids.add(randomIdInRange);
    ids.add(randomIdInRange1);
    // Continue adding random IDs until we have 3 total
    while (ids.size < 3) {
        const randomId = Math.floor(Math.random() * 15408) + 1; // Random ID between 1 and 15408
        ids.add(randomId);
    }

    return Array.from(ids);
}

// Fetches a valid character from the database or generates a new one if needed
const getValidCharacter = async () => {
    let character = null;

    while (!character) {
        // Get 3 random character IDs
        const randomCharacterIds = getRandomCharacterIds();
        console.log(`Fetching characters with IDs: ${randomCharacterIds.join(', ')}`);

        // Try to find a character from one of the random IDs
        for (const id of randomCharacterIds) {
            character = await AnimeCharacter.findById(id).exec();

            if (character) {
                break; // Stop searching if a valid character is found
            }
        }

        if (!character) {
            console.log('No character found, generating a new one.');
            // Optionally generate and save a new character
            // character = await generateAndSaveNewCharacter();
        }
    }

    return character;
};
// Fetches valid characters from the database or generates new ones if needed
const getValidCharacters = async () => {
    const validCharacters = [];
    const maxAttempts = 40; // Limit attempts to avoid infinite loops

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Get 3 random character IDs
        const randomCharacterIds = getRandomCharacterIds();
        console.log(`Fetching characters with IDs: ${randomCharacterIds.join(', ')}`);

        // Fetch characters in parallel
        const characters = await Promise.all(randomCharacterIds.map(id => AnimeCharacter.findById(id).exec()));

        // Filter valid characters
        const filteredCharacters = characters.filter(character => 
            character && character.name && character.series
        );

        validCharacters.push(...filteredCharacters);

        // Stop if we have enough valid characters
        if (validCharacters.length >= 3) {
            return validCharacters.slice(0, 3); // Return only the first 3 valid characters
        }

        // Optionally generate and save new characters if needed
        // You can also add logic to handle cases where all generated characters are not valid
    }

    console.warn('Not enough valid characters found after maximum attempts.');
    return validCharacters.slice(0, 3); // Return only the available valid characters
};


// Example usage
getValidCharacters()
    .then(characters => {
        if (characters.length > 0) {
            console.log('Valid Characters:', characters);
        } else {
            console.log('No valid characters found.');
        }
    })
    .catch(err => console.error('Error getting valid characters:', err));

// Get quality factor based on rarity
function getQualityFactor(rarity) {
    const factors = {
        'Bad': 1,
        'Good': 1.2,
        'Mid': 1.5,
        'Perfect': 2.0,
        'Legendary': 3.0
    };
    return factors[rarity] || 1;
}

// Format cooldown time
function formatCooldown(type, lastCooldown, duration) {
    const currentTime = Date.now();
    const timePassed = currentTime - lastCooldown;
    const timeLeft = duration - timePassed;

    if (timeLeft > 0) {
        const secondsLeft = Math.floor(timeLeft / 1000);
        
        if (secondsLeft < 60) {
            // Menos de un minuto restante, mostrar solo segundos
            return `${secondsLeft}s`;
        } else {
            // Más de un minuto restante, mostrar minutos y segundos
            const minutesLeft = Math.floor(secondsLeft / 60);
            const secondsRemaining = secondsLeft % 60;
            return `${minutesLeft}m ${secondsRemaining}s`;
        }
    }
    
    return 'Available'; // Mostrar 'Available' si no hay cooldown
}




// Generate a random alphanumeric code
function generateRandomCode(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Get a random rarity
function getRandomRarity() {
    const rarities = ['Bad', 'Good', 'Mid', 'Perfect', 'Legendary'];
    return rarities[Math.floor(Math.random() * rarities.length)];
}
async function updateCharacterStats(id, rarity) {
    try {
        // Asegúrate de que id es un número entero (Int32)
        const characterId = parseInt(id, 10);  // Convierte el id a número entero

        // Verifica que el id sea un número entero
        if (isNaN(characterId)) {
            console.error('ID is not a valid integer:', id);
            return null;
        }

        // Busca el personaje usando el ID como número entero
        const character = await AnimeCharacter.findOne({ _id: characterId }).exec();
        
        if (character) {
            character.__v = (character.__v || 0) + 1;
            character.code = generateRandomCode(Math.floor(Math.random() * 4) + 3);
            character.rarity = rarity;

            await character.save();
            return { code: character.code, rarity };
        } else {
            console.log('Character not found');
            return null; // Si no se encuentra el personaje, retorna null
        }
    } catch (error) {
        console.error('Error updating character stats:', error);
        return null;
    }
}

// Handle cooldown logic for drop
const HALF_COOLDOWN_DURATION_DROP = 10 * 60 * 1000; // 10 minutes if buff active
const HALF_COOLDOWN_DURATION_GRAB = 5 * 60 * 1000; // 5 minutes if buff active

function formatCooldown(type, lastCooldown, duration) {
    const currentTime = Date.now();
    const timePassed = currentTime - lastCooldown;
    const timeLeft = duration - timePassed;

    if (timeLeft > 0) {
        const secondsLeft = Math.floor(timeLeft / 1000);
        
        if (secondsLeft < 60) {
            return `${secondsLeft}s`; // Less than one minute remaining
        } else {
            const minutesLeft = Math.floor(secondsLeft / 60);
            return `${minutesLeft}m`; // More than one minute remaining
        }
    }
    return null; // No cooldown left
}

async function handleDropCooldown(userId, message) {
    const lastDrop = await fetchLastDrop(userId);
    const currentTime = Date.now();
    const COOLDOWN_DURATION_DROP = 20 * 60 * 1000; // 20 minutos
    const HALF_COOLDOWN_DURATION_DROP = 10 * 60 * 1000; // 10 minutos

    if (lastDrop) {
        const timePassed = currentTime - lastDrop;
        let duration = COOLDOWN_DURATION_DROP;

        // Fetch inventory y verificar buffs activos
        const inventory = await fetchInventory(userId);
        const buffs = inventory.Buffs || [];

        // Verificar si el buff 'Speed of Reaction' está activo
        const SpeedofReactionBuff = buffs.find(buff => buff.name === 'Speed of Reaction' && buff.active);
        if (SpeedofReactionBuff) {
            duration = HALF_COOLDOWN_DURATION_DROP; // Aplicar el efecto del buff
        }

        const timeLeft = duration - timePassed;

        if (timeLeft > 0) {
            // Verificar si el usuario tiene "extra drops"
            if (inventory.extra_drop > 0) {
                // Usar un "extra drop"
                await consumeItems(userId, ['extra_drop']);
                await message.channel.send(`${message.author}, you used an extra drop! Remaining extra drops: ${inventory.extra_drop - 1}`);
                return false; // No hay cooldown activo
            } else {
                // Si no hay "extra drops", mostrar el cooldown restante
                const cooldownMessage = formatCooldown('drop', lastDrop, duration);
                await message.channel.send(`You are on cooldown. Please wait ${cooldownMessage}.`);
                return true; // Cooldown activo
            }
        }
    }

    // Actualizar el último drop si no hay cooldown activo
    await updateLastDrop(userId);
    return false; // No hay cooldown activo
}

async function handleGrabCooldown(userId) {
    const lastGrab = await fetchLastGrab(userId);
    const currentTime = Date.now();
    const COOLDOWN_DURATION_GRAB = 10 * 60 * 1000;  // 10 minutos
    const HALF_COOLDOWN_DURATION_GRAB = 5 * 60 * 1000;  // 5 minutos

    if (lastGrab) {
        const timePassed = currentTime - lastGrab;
        let duration = COOLDOWN_DURATION_GRAB;

        // Fetch inventory y verificar buffs activos
        const inventory = await fetchInventory(userId);
        const buffs = inventory.Buffs || [];

        const fastHandsBuff = buffs.find(buff => buff.name === 'Fast Hands' && buff.active);
        if (fastHandsBuff) {
            duration = HALF_COOLDOWN_DURATION_GRAB; // Aplicar el efecto del buff
        }

        const timeLeft = duration - timePassed;

        if (timeLeft > 0) {
            // Retornar el mensaje de cooldown formateado
            return formatCooldown('grab', lastGrab, duration);
        }
    }

    // No hay cooldown activo
    await updateLastGrab(userId);
    return false; // Retornar false si no hay cooldown activo
}
// Create card canvas
Canvas.registerFont('./commands/fonts/BebasNeue-Regular.ttf', { family: 'Bebas Neue' });

let frameImage; // Variable to hold the preloaded frame image

// Function to preload the frame image
async function preloadFrameImage() {
    try {
        frameImage = await fetchImage(frameImageUrl);
    } catch (error) {
        console.error('Error preloading frame image:', error);
        frameImage = null; // Set to null if loading fails
    }
}

// Call this function before using `createCardCanvas`
preloadFrameImage();

async function createCardCanvas(characters, userId) {
    const cardWidth = 250;
    const cardHeight = 450;
    const padding = 35;
    const offsetX = 30;
    const maxRetries = 3;

    let inventory;
    try {
        inventory = await fetchInventory(userId);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return null; // Exit if there's an issue fetching inventory
    }

    if (!inventory) {
        console.error('Inventory is null');
        return null; // Exit if inventory is null
    }

    const buffs = inventory.Buffs || [];
    const divinityAbsoluteBuff = buffs.find(buff => buff.name === 'Divinity Absolute');
    const isDivinityAbsoluteActive = divinityAbsoluteBuff && divinityAbsoluteBuff.active;

    const numOfCharacters = isDivinityAbsoluteActive ? 4 : 3;
    const displayCharacters = characters.slice(0, numOfCharacters);

    let frameImage;
    try {
        frameImage = await loadFrameImage('https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png', maxRetries);
    } catch (error) {
        console.error('Error loading frame image:', error);
        return null; // Exit if frame image cannot be loaded
    }

    const canvasWidth = displayCharacters.length * (cardWidth + padding) + offsetX - padding + 10;
    const canvas = Canvas.createCanvas(canvasWidth, 460);
    const context = canvas.getContext('2d');
    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < displayCharacters.length; i++) {
        const character = displayCharacters[i];
        const cardX = i * (cardWidth + padding) + offsetX;

        if (character.img_url) {
            try {
                const characterImage = await Canvas.loadImage(character.img_url);
                context.drawImage(characterImage, cardX + 10, 10, cardWidth - 20, cardHeight - 20);
            } catch (error) {
                console.error(`Error loading image for character ${character._id}:`, error);
                // Mostrar un mensaje de error en lugar de la imagen
                context.fillStyle = '#FFFFFF';
                context.font = 'bold 20px Arial';
                context.textAlign = 'center';
                context.fillText("Image don't load", cardX + cardWidth / 2, cardHeight / 2);
            }
        }

        context.drawImage(frameImage, cardX, 0, cardWidth, cardHeight);

        // Draw character version number
        context.font = 'bold 20px Bebas Neue';
        context.fillStyle = '#000000';
        context.textAlign = 'center';
        context.fillText(`#${character.__v}`, cardX + cardWidth / 2, 444);

        // Character name
        context.font = 'bold 20px Bebas Neue';
        context.fillStyle = '#000000';
        context.textAlign = 'center';
        let characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
        context.fillText(characterName, cardX + cardWidth / 2, cardHeight - 60);

        // Series name
        context.font = '20px Bebas Neue';
        context.fillStyle = '#000000';
        context.textAlign = 'center';
        let seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;
        wrapText(context, seriesText, cardX + cardWidth / 2, cardHeight - 30, cardWidth - 40, 24);
    }

    return canvas;
}

// Load frame image with retries
const loadFrameImage = async (url, retries) => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await Canvas.loadImage(url);
        } catch (error) {
            console.error(`Attempt ${attempt + 1} to load frame image failed:`, error);
            if (attempt === retries - 1) {
                throw new Error('Failed to load frame image after multiple attempts.');
            }
        }
    }
};


// Helper function to wrap text
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineCount = 0;

    for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = context.measureText(testLine).width;
        if (testWidth > maxWidth && line !== '') {
            context.fillText(line, x, y);
            line = word + ' ';
            y += lineHeight;
            lineCount++;
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, y);
    return y;
}

// Handle button interactions



let inventory;  // Declare inventory in a higher scope
module.exports = { 
    name: 'd',
    description: 'Drop a card every 20 minutes.',
    run: async (message) => {
        const user = message.author;
        const channel = message.channel;

        if (!user || !channel) {
            console.error('Message author or channel is missing.');
            return;
        }

        const userInventory = await fetchInventory(user.id);
        if (!userInventory || !userInventory._id) {
            console.error('Inventory fetch failed or no inventory found for the user.');
            return;
        }

        const userId = userInventory._id;
        await updateDailyBuffs(userId);

        const cooldownActive = await handleDropCooldown(userId, message);
        if (cooldownActive) return;

        const getValidCharacter = async () => {
            let character = null;
            while (!character) {
                const randomCharacterId = getRandomCharacterIds();
                character = await AnimeCharacter.findById(randomCharacterId).exec();
                if (!character) {
                    console.log('Character not found, generating a new one.');
                }
            }
            return character;
        };

        const updatedCharacters = [];
        for (let i = 0; i < 5; i++) {
            const character = await getValidCharacter();
            const rarity = getRandomRarity();
            const updatedStats = await updateCharacterStats(character._id, rarity);

            if (updatedStats) {
                updatedCharacters.push({
                    _id: character._id,
                    name: character.name,
                    series: character.series,
                    img_url: character.img_url,
                    rarity: updatedStats.rarity,
                    code: updatedStats.code,
                    __v: character.__v,
                    generate: character.generate || 0,
                    wishlist: character.wishlist || null
                });
            }
        }
         // Array para almacenar las IDs a las que se hará ping
//await wishlistMention(updatedCharacters, message.channel.id);

    

        const canvas = await createCardCanvas(updatedCharacters, userId);
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'cards.webp' });

        const userBuffs = await fetchInventory(userId);
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        const isBuffActive = userBuffs.Buffs.some(buff => buff.name === 'Divinity Absolute' && buff.active);
        const numberOfCharactersToShow = isBuffActive ? 4 : 3;

        const dropList = updatedCharacters
            .slice(0, numberOfCharactersToShow)
            .map((char, index) => 
                `${emojis[index]} **${char.name}** - ${char.series} - ${char.code} • #${char.__v}`
            )
            .join('\n');

        const msg = await message.channel.send({
            content: `<@${userId}> drop\n${dropList}`,
            files: [attachment]
        });

        for (let i = 0; i < numberOfCharactersToShow; i++) {
            await msg.react(emojis[i]);
        }
        const increased = await fetchInventory(userId);

        if (!increased) {
            console.error('No se encontró el inventario del usuario.');
            return;
        }
        
        // Verificar si el campo `daily_stats` existe y es un array válido
        if (!Array.isArray(increased.daily_stats) || increased.daily_stats.length === 0) {
            // Inicializar con un objeto que contiene `daily_burn`
            increased.daily_stats = [{daily_drops: 1 }];
        } else {
            // Trabajar con el primer objeto del array `daily_stats`
            const stats = increased.daily_stats[0];
        
            // Incrementar el contador `daily_burn` del primer objeto
            stats.daily_drops = (stats.daily_drops || 0) + 1;
        }
        
        // Guardar los cambios en la base de datos
        await increased.save();
        console.log('Daily stats actualizado:', increased.daily_stats);

//reactions to add the card grabbed
const filter = (reaction, user) => emojis.includes(reaction.emoji.name) && !user.bot;
const cardGrabbed = new Map(); 
const priorityMap = new Map(); 
const collector = msg.createReactionCollector({ filter, time: 60000 });

// Crear un conjunto para mantener el estado de cooldown
const cooldownUsers = new Set(); 

let dropperPriority = true; 
setTimeout(() => {
    dropperPriority = false; 
}, 6000); // 6 segundos

collector.on('collect', async (reaction, reactingUser) => {
    const index = emojis.indexOf(reaction.emoji.name);
    if (index === -1) return;

    const selectedCharacter = updatedCharacters[index];
    if (!selectedCharacter) return;

    // Comprobar si el usuario está en cooldown
    const isCooldownUser = cooldownUsers.has(reactingUser.id);
    const inventory = await fetchInventory(reactingUser.id);
    const hasExtraGrab = inventory.extra_grab > 0;

    // Manejo de cooldown
    if (isCooldownUser && !hasExtraGrab) {
        await message.channel.send({
            content: `${reactingUser}, you cannot grab a card right now. Please wait for your cooldown to expire.`,
            ephemeral: true
        });
        return;
    }

    const grabCooldown = await handleGrabCooldown(reactingUser.id);
    const hasCardBeenGrabbed = cardGrabbed.has(selectedCharacter._id);

    if (grabCooldown) {
        if (hasCardBeenGrabbed) {
            await message.channel.send({
                content: `${reactingUser}, you are on cooldown and the card has already been grabbed. No extra grab used.`,
                ephemeral: true
            });
            return;
        } else if (hasExtraGrab) {
            await consumeItems(reactingUser.id, ['extra_grab']);
            await message.channel.send({
                content: `Cooldown active. Extra grab used! Remaining extra grabs: ${inventory.extra_grab - 1}`,
                ephemeral: true
            });
        } else {
            await message.channel.send({
                content: `${reactingUser}, you are on cooldown. Please wait ${grabCooldown}.`,
                ephemeral: true
            });
            return;
        }
    }

    const priority = priorityMap.get(selectedCharacter._id);
    const currentTime = Date.now();
    
    // Si la prioridad del dropper ha terminado
    if (!dropperPriority) {
        // Permitir al usuario tomar la carta si no está en cooldown
        if (!hasCardBeenGrabbed) {
            cardGrabbed.set(selectedCharacter._id, reactingUser.id);
            cooldownUsers.add(reactingUser.id); // Agregar al usuario a la lista de cooldown

            await addCardToInventory(reactingUser.id, {
                _id: selectedCharacter._id,
                name: selectedCharacter.name,
                series: selectedCharacter.series,
                img_url: selectedCharacter.img_url,
                rarity: selectedCharacter.rarity,
                code: selectedCharacter.code,
                __v: selectedCharacter.__v,
                dropped_on: new Date(),
                grabbed_by: reactingUser.id,
                channel_id: message.channel.id,
                guild_id: message.guild.id,
                default_frame: "'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png'",
                morph_apply: "",
                last_morph: "",
                color_letter_name: "",
                last_color_letter_name: "",
                last_color_letter_series: "",
                color_letter_series: "",
                last_color_letter: "",
                color_letter: ""
            });

            await message.channel.send(`${reactingUser}, you grabbed the card \`${selectedCharacter.code}\` · \` #${selectedCharacter.__v}\` · ***${selectedCharacter.series}***: ***${selectedCharacter.name}*** · it has ***${selectedCharacter.rarity}*** rarity`);

            // Remover al usuario del cooldown después de un tiempo (ejemplo: 4 minutos)
            setTimeout(() => {
                cooldownUsers.delete(reactingUser.id);
            }, 240000); // 240000 ms = 4 minutos
        } else {
            await message.reply(`${reactingUser}, the card has already been grabbed!`);
        }
        return;
    }

    // Lógica para manejar la prioridad
    if (dropperPriority && reactingUser.id !== userId) {
        await message.channel.send({
            content: `${reactingUser}, **the dropper has priority for a few more seconds!** Please wait.`,
            ephemeral: true
        });
        return;
    }

    // Manejo de la lógica de prioridad
    if (!priority) {
        priorityMap.set(selectedCharacter._id, { userId, timestamp: currentTime });
    }

    const priorityData = priorityMap.get(selectedCharacter._id);

    if (priorityData && priorityData.userId === userId && currentTime - priorityData.timestamp < 6000) {
        if (!hasCardBeenGrabbed) {
            cardGrabbed.set(selectedCharacter._id, userId);
            cooldownUsers.add(reactingUser.id); // Agregar al usuario a la lista de cooldown

            await addCardToInventory(reactingUser.id, {
                _id: selectedCharacter._id,
                name: selectedCharacter.name,
                series: selectedCharacter.series,
                img_url: selectedCharacter.img_url,
                rarity: selectedCharacter.rarity,
                code: selectedCharacter.code,
                __v: selectedCharacter.__v,
                dropped_on: new Date(),
                grabbed_by: reactingUser.id,
                channel_id: message.channel.id,
                guild_id: message.guild.id,
                default_frame: "'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png'",
                morph_apply: "",
                last_morph: "",
                color_letter_name: "",
                last_color_letter_name: "",
                last_color_letter_series: "",
                color_letter_series: "",
                last_color_letter: "",
                color_letter: ""
            });

            await message.channel.send(`${reactingUser}, you grabbed the card \`${selectedCharacter.code}\` · \` #${selectedCharacter.__v}\` · ***${selectedCharacter.series}***: ***${selectedCharacter.name}*** · it has ***${selectedCharacter.rarity}*** rarity`);
          

            // Remover al usuario del cooldown después de un tiempo (ejemplo: 4 minutos)
            setTimeout(() => {
                cooldownUsers.delete(reactingUser.id);
            }, 240000); // 240000 ms = 4 minutos
        } else {
            await message.reply(`${reactingUser}, the card has already been grabbed!`);
        }
    } else if (priorityData && priorityData.userId !== reactingUser.id) {
        await message.channel.send({
            content: `You can't grab this card because <@${priorityData.userId}> has priority.`,
            ephemeral: true
        });
    }
});

collector.on('end', async collected => {
    if (collected.size === 0) {
        try {
            await msg.edit({ content: `${msg.content}\n\n**The Drop has Expired.**` });
            await msg.reactions.removeAll();
        } catch (error) {
            console.error('Error handling drop expiration:', error);
        }
    }
});

console.log(`Drop executed by ${user.username} in channel ${channel.id} with ${updatedCharacters.length} characters.`);
    }
}