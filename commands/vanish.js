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

// Generates a random character ID
// Generates an array of 3 unique random character IDs between 1 and 13500
function getRandomCharacterIds() {
    const ids = new Set();

    // Generate one ID between 15000 and 15408
    const randomIdInRange = Math.floor(Math.random() * (150669 - 150121 + 1)) + 150121; // ID in range
    const randomIdInRange1 = Math.floor(Math.random() * (200200 - 200001 + 1)) + 200001;
  //  ids.add(randomIdInRange);
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


// Fetch character by ID
async function fetchCharacterById(id) {
    try {
        const character = await AnimeCharacter.findOne({ _id: id }).exec();
        return character || null;
    } catch (error) {
        console.error('Error fetching character:', error);
        return null;
    }
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

// Variable global para almacenar la versión actual seleccionada
let version = null;

// Update character stats
async function updateCharacterStats(id, rarity) {
    try {
        const character = await AnimeCharacter.findOne({ _id: id }).exec();
        if (character) {
            character.generate = character.generate || 0;

            // Validar si misingversion tiene elementos y usar la posición 0
            if (character.misingversion && character.misingversion.length > 0) {
                version = character.misingversion[0]; // Asignar la posición 0 de misingversion a la variable global
            } else {
                console.error(`No valid misingversion found for character ID: ${id}`);
                return null; // Salir si no hay versiones faltantes
            }

            character.code = generateRandomCode(Math.floor(Math.random() * 4) + 3);
            character.rarity = rarity;

            await character.save();
            return {
                code: character.code,
                rarity,
                version // Retorna la variable global version
            };
        }
        console.error(`Character with ID: ${id} not found.`);
        return null;
    } catch (error) {
        console.error('Error updating character stats:', error);
        return null;
    }
}


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

    const canvasWidth = displayCharacters.length * (cardWidth + padding) + offsetX - padding + 10;
    const canvas = Canvas.createCanvas(canvasWidth, 460);
    const context = canvas.getContext('2d');
    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Iterar sobre los personajes y usar la variable global version en lugar de __v
    for (let i = 0; i < displayCharacters.length; i++) {
        const character = displayCharacters[i];
        const cardX = i * (cardWidth + padding) + offsetX;

        // Seleccionar el marco adecuado según la ID del personaje
        let frameImage;
        try {
            if (character._id >= 200000) { // Comprobar si la ID está en el rango de Halloween
                frameImage = await loadFrameImage('https://yashin.nyc3.cdn.digitaloceanspaces.com/Dark_Orange.png', maxRetries);
            } else {
                frameImage = await loadFrameImage('https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png', maxRetries);
            }
        } catch (error) {
            console.error('Error loading frame image:', error);
            return null; // Exit if frame image cannot be loaded
        }

        if (character.img_url) {
            try {
                const characterImage = await Canvas.loadImage(character.img_url);
                context.drawImage(characterImage, cardX + 10, 10, cardWidth - 20, cardHeight - 20);
            } catch (error) {
                console.error(`Error loading image for character ${character._id}:`, error);
                // Mostrar un mensaje de error en lugar de la imagen
                context.fillStyle = '#FFFFFF';
                context.font = 'bold 16px Arial';
                context.textAlign = 'center';
                context.fillText("Image doesn't load", cardX + cardWidth / 2, cardHeight / 2);
            }
        }

        context.drawImage(frameImage, cardX, 0, cardWidth, cardHeight);

        // Definir el color del texto en función de la ID del personaje
        const textColor = character._id >= 200000 ? '#FFFFFF' : '#000000'; // Blanco para Halloween, negro para otros

        // Verificar si misingversion existe y tiene elementos
        if (character.misingversion && character.misingversion.length > 0) {
            // Usar la variable global version asignada previamente
            const firstVersion = version || character.misingversion[0]; // Fallback por seguridad

            console.log(`Character Name: ${character.name}`);
            console.log(`misingversion Array:`, character.misingversion);
            console.log(`Selected version from global variable 'version': ${firstVersion}`);

            // Solo dibujar el número de versión si NO es una carta de Halloween
            if (character._id < 200000) { // Comprobar si la ID no está en el rango de Halloween
                context.font = 'bold 20px Bebas Neue';
                context.fillStyle = textColor;
                context.textAlign = 'center';
                context.fillText(`#${firstVersion}`, cardX + cardWidth / 2, 444); // Usamos la primera versión directamente
            }
        }

        // Nombre del personaje
        context.font = 'bold 23px Bebas Neue';
        context.fillStyle = textColor;
        context.textAlign = 'center';
        let characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
        context.fillText(characterName, cardX + cardWidth / 2, cardHeight - 60);

        // Nombre de la serie
        context.font = '20px Bebas Neue';
        context.fillStyle = textColor;
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
module.exports = { 
    name: 'vanish',
    description: 'vanish drop for cards despawned/burned',
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

        // Update daily buffs (optional, depending on your logic)
        await updateDailyBuffs(userId);

        // Check vanish drops
        const vanish = userInventory.vanish || 0; // Ensure vanish is not undefined

        if (vanish <= 0) {
            // If the user has no vanish drops
            return message.channel.send("You don't have any vanish drops available.");
        }

        // Proceed if the user has vanish drops
        message.channel.send(`Vanish drop used. Remaining vanish drops: ${vanish - 1}`);

        // Logic to consume a vanish drop (e.g., decrement vanish by 1)
        userInventory.vanish -= 1;
        await userInventory.save(); // Save changes to the inventory

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
            version: updatedStats.version, // Usamos la versión actualizada desde updatedStats
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
        .map((char, index) => {
            // Verificar si la ID del personaje es de Halloween
            const isHalloween = char._id >= 200000; // Ajusta el número según tus requisitos
            const pumpkinEmoji = isHalloween ? '🎃' : ''; // Emoji de calabaza solo si es Halloween
        
            // Formatear la salida dependiendo de si es de Halloween o no
            const versionText = isHalloween ? '' : ` • #${char.version}`; // Mostrar "version" solo si NO es de Halloween
        
            return `${emojis[index]} **${char.name}** - ${char.series} - ${char.code} ${pumpkinEmoji}${versionText}`;
        })
        .join('\n');
        
    
        const msg = await message.channel.send({
            content: `<@${userId}>Vanish Drop\n${dropList}`,
            files: [attachment]
        });

        for (let i = 0; i < numberOfCharactersToShow; i++) {
            await msg.react(emojis[i]);
        }
        let candyReactionAdded = false;
        let candyAmount = 0;
        if (Math.random() < 0.2) { // 20% de probabilidad de caramelo
            candyAmount = Math.floor(Math.random() * 3) + 1; // Cantidad de caramelos aleatoria entre 1 y 3
            await msg.react('🍬');
            candyReactionAdded = true;
        }
//reactions to add the card grabbed
const filter = (reaction, user) => (emojis.includes(reaction.emoji.name) || reaction.emoji.name === '🍬') && !user.bot;
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
    if (reaction.emoji.name === '🍬' && candyReactionAdded) {
        candyReactionAdded = false; // Solo un jugador puede obtener el caramelo

        await addCandyToInventory(reactingUser.id, candyAmount);
        await message.channel.send(`${reactingUser} has received **${candyAmount}** 🍬 candy!`);
        return; 
    }
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
            const isHalloweencard = selectedCharacter._id >= 200000;

            const default_frame = isHalloweencard 
                ? 'https://yashin.nyc3.cdn.digitaloceanspaces.com/Dark_Orange.png'
                : 'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png';
            
            const scratch = isHalloweencard; // Se asigna directamente el valor boolean
            async function removeFirstMisingVersionBySelectedCharacter(selectedCharacter) {
                try {
                    // Buscar el personaje en la base de datos por su _id
                    const character = await AnimeCharacter.findOne({ _id: selectedCharacter._id }).exec();
            
                    if (character && character.misingversion && character.misingversion.length > 0) {
                        // Eliminar la posición 0 del array misingversion
                        character.misingversion.shift();
            
                        // Guardar los cambios en la base de datos
                        await character.save();
            
                        console.log(`misingversion actualizado para el personaje ${character.name}:`, character.misingversion);
                        return true; // Retornar éxito
                    } else {
                        console.log(`El personaje con ID ${selectedCharacter._id} no tiene un array misingversion válido.`);
                        return false; // No se pudo actualizar
                    }
                } catch (error) {
                    console.error(`Error al actualizar misingversion para el personaje con ID ${selectedCharacter._id}:`, error);
                    return false; // Error
                }
            }
            
            await addCardToInventory(reactingUser.id, {
                _id: selectedCharacter._id,
                name: selectedCharacter.name,
                series: selectedCharacter.series,
                img_url: selectedCharacter.img_url,
                rarity: selectedCharacter.rarity,
                code: selectedCharacter.code,
                __v: selectedCharacter.version,
                dropped_on: new Date(),
                grabbed_by: reactingUser.id,
                channel_id: message.channel.id,
                guild_id: message.guild.id,
                default_frame: default_frame,
                morph_apply: "",
                last_morph: "",
                color_letter_name: "",
                last_color_letter_name: "",
                last_color_letter_series: "",
                color_letter_series: "",
                last_color_letter: "",
                color_letter: "",
                scratch: scratch
            });
         
          // Determinar si el personaje es de Halloween basado en su ID
const isHalloweenCharacter = selectedCharacter._id >= 200000;
const success = await removeFirstMisingVersionBySelectedCharacter(selectedCharacter);

if (success) {
    console.log("La posición 0 del array misingversion fue eliminada correctamente.");
} else {
    console.log("No se pudo actualizar el array misingversion.");
}
// Mensaje base
const baseMessage = `${reactingUser}, you grabbed the card \`${selectedCharacter.code}\` · ***${selectedCharacter.series}***: ***${selectedCharacter.name}*** · it has ***${selectedCharacter.rarity}*** rarity`;

// Enviar el mensaje con la versión de __v si no es de Halloween
if (!isHalloweenCharacter) {
    await message.channel.send(`${baseMessage} · \`#${selectedCharacter.version}\``);
} else {
    // Mensaje para cartas de Halloween (puedes personalizarlo según necesites)
    await message.channel.send(`${baseMessage} · 🎃 This card is a Halloween special!`);
}


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
            const isHalloweencard1 = selectedCharacter._id >= 200000;

            const default_frame = isHalloweencard1 
                ? 'https://yashin.nyc3.cdn.digitaloceanspaces.com/Dark_Orange.png'
                : 'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png';
               
                
                // Actualizar en la base de datos para reflejar el cambio en misingversion
                async function removeFirstMisingVersionBySelectedCharacter(selectedCharacter) {
                    try {
                        // Buscar el personaje en la base de datos por su _id
                        const character = await AnimeCharacter.findOne({ _id: selectedCharacter._id }).exec();
                
                        if (character && character.misingversion && character.misingversion.length > 0) {
                            // Eliminar la posición 0 del array misingversion
                            character.misingversion.shift();
                
                            // Guardar los cambios en la base de datos
                            await character.save();
                
                            console.log(`misingversion actualizado para el personaje ${character.name}:`, character.misingversion);
                            return true; // Retornar éxito
                        } else {
                            console.log(`El personaje con ID ${selectedCharacter._id} no tiene un array misingversion válido.`);
                            return false; // No se pudo actualizar
                        }
                    } catch (error) {
                        console.error(`Error al actualizar misingversion para el personaje con ID ${selectedCharacter._id}:`, error);
                        return false; // Error
                    }
                }
                
                
            const scratch = isHalloweencard1; // Se asigna directamente el valor boolean
            await addCardToInventory(reactingUser.id, {
                _id: selectedCharacter._id,
                name: selectedCharacter.name,
                series: selectedCharacter.series,
                img_url: selectedCharacter.img_url,
                rarity: selectedCharacter.rarity,
                code: selectedCharacter.code,
                __v: selectedCharacter.version,
                dropped_on: new Date(),
                grabbed_by: reactingUser.id,
                channel_id: message.channel.id,
                guild_id: message.guild.id,
                default_frame: default_frame,
                morph_apply: "",
                last_morph: "",
                color_letter_name: "",
                last_color_letter_name: "",
                last_color_letter_series: "",
                color_letter_series: "",
                last_color_letter: "",
                color_letter: "",
                scratch: scratch
                
            });
// Determinar si el personaje es de Halloween basado en su ID
const isHalloweenCharacter = selectedCharacter._id >= 200000;
const success = await removeFirstMisingVersionBySelectedCharacter(selectedCharacter);

if (success) {
    console.log("La posición 0 del array misingversion fue eliminada correctamente.");
} else {
    console.log("No se pudo actualizar el array misingversion.");
}
// Mensaje base
const baseMessage = `${reactingUser}, you grabbed the card \`${selectedCharacter.code}\` · ***${selectedCharacter.series}***: ***${selectedCharacter.name}*** · it has ***${selectedCharacter.rarity}*** rarity`;

// Enviar el mensaje con la versión de __v si no es de Halloween
if (!isHalloweenCharacter) {
    await message.channel.send(`${baseMessage} · \`#${selectedCharacter.version}\``);
} else {
    // Mensaje para cartas de Halloween (puedes personalizarlo según necesites)
    await message.channel.send(`${baseMessage} · 🎃 This card is a Halloween special!`);
}


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
            await msg.edit({ content: `${msg.content}\n\n**The Vanish Drop has Expired.**` });
            await msg.reactions.removeAll();
        } catch (error) {
            console.error('Error handling drop expiration:', error);
        }
    }
});

console.log(`Vanish Drop executed by ${user.username} in channel ${channel.id} with ${updatedCharacters.length} characters.`);
    }
}