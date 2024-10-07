const mongoose = require('mongoose');
const axios = require('axios');
const fetch = require('node-fetch');

// Supongamos que tienes el userId de alguna otra manera
// Define el esquema para el inventario
const inventorySchema = new mongoose.Schema({
    _id: String,
    shines: [Number],
    gold: [Number],
    stellar_dust: [Number],
    user_id: { type: String, index: true },
    username: String,
    last_daily: Date,
    last_drop: Date,
    last_grab: Date,
    last_vote: Date,
    tags: [],
    moons: [],
    Box_banner: [],
    Banners: [],
    Box_title: [],
    Titles: [],
    Buffs: [],
    DivinityAbsolute: [],
    GodofEvasion: [],
    Glows: [],
    mails: [],
    FastHands: [],
    SpeedOfReaction: [],
    info: [],
    wishlist_channel: String,
    referers: [],
    user_referer: [],
    Profile: [],
    wishlist: [{ // Cambia esto a un arreglo de objetos
        name: String,
        series: String
    }],// Almacena solo los IDs de los personajes en el array
    cards: [],
    extra_grab: [],
    extra_drop: [],
     Frames:[{
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        image: { type: String } // Asegúrate de que el campo `image` esté definido
    }],
    
}, { collection: 'inventory' });



const Inventory = mongoose.model('Inventory', inventorySchema);

// Función para verificar si un usuario existe
async function checkUserExists(userId) {
    try {
        const user = await Inventory.findOne({ user_id: userId });
        return user !== null;
    } catch (err) {
        console.error('Error checking user existence:', err);
        throw err;
    }
}

// Función para obtener el inventario desde MongoDB
async function fetchInventory(userId) {
    try {
        const inventory = await Inventory.findOne({ user_id: userId });
       
        return inventory;
    } catch (err) {
        console.error('Error fetching inventory:', err);
        throw err;
    }
}
async function addCardToInventory(userId, cardData) {
    try {
        const inventory = await Inventory.findOneAndUpdate(
            { user_id: userId },
            { $push: { cards: cardData } },
            { new: true, upsert: true } // 'upsert' para crear el documento si no existe
        );

 
        return inventory;
    } catch (error) {
        console.error('Error updating inventory:', error);
        throw error;
    }
}


const frameSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    moons: {
        type: Number,
        required: true,
        default: 800 // Default price in shines
    },
    description: {
        type: String,
        required: true
    },
    imagecarousel: {
        type: String, // URL of the carousel image
        required: true
    },
    image: {
        type: String, // URL of the main image
        required: true
    }, color_letter: {
    type: String,
    required: true
}
}, { collection: 'frames' });
const Frame = mongoose.model('Frame', frameSchema);
// Función para registrar un nuevo usuario
async function registerUser(userId, username) {
    try {
        const userExists = await checkUserExists(userId);
        if (userExists) {
            throw new Error('User already registered');
        }

        const newUser = new Inventory({
            _id: userId,
            shines: [],            // Inicializa como un array vacío
            gold: [],              // Inicializa como un array vacío
            stellar_dust: [],      // Inicializa como un array vacío
            user_id: userId,
            username: username,
            last_daily: null,
            last_drop: null,
            extra_grab: [],        // Inicializa como un array vacío
            extra_drop: [],        // Inicializa como un array vacío
            last_grab: null,
            last_vote: null,
            tags: [],
               mails: [],
            referers: [],
            user_referer: [],
            moons: [],
            Profile: [],
            Box_banner: [],
    Banners: [],
    Box_title: [],
    Titles: [],
            DivinityAbsolute: [],
    GodofEvasion: [],
    Glows: [],
    FastHands: [],
    SpeedOfReaction: [],
            Buffs: [],
            wishlist_channel: String,
            info: [],
            wishlist: [],          // Inicializa como un array vacío
            cards: [],
            Frames: [],// Inicializa como un array vacío
        });

        await newUser.save();
        console.log('User registered successfully');
    } catch (err) {
        console.error('Error registering user:', err);
        throw err;
    }
}
const updateLastGrab = async (userId) => {
    try {
        const currentTime = Date.now();
        await Inventory.updateOne(
            { user_id: userId },
            { $set: { last_grab: currentTime } },
            { upsert: true }
        );
    } catch (err) {
        console.error('Error updating last grab:', err);
        throw err;
    }
};

// Función para obtener la última fecha en que el usuario reclamó la recompensa diaria
async function fetchLastDaily(userId) {
    try {
        const user = await Inventory.findOne({ user_id: userId });
        return user ? user.last_daily : null;
    } catch (err) {
        console.error('Error fetching last daily:', err);
        throw err;
    }
}
async function fetchLastVote(userId) {
    try {
        const user = await Inventory.findOne({ user_id: userId });
        return user ? user.last_vote : null;
    } catch (err) {
        console.error('Error fetching last vote:', err);
        throw err;
    }
}

async function fetchLastDrop(userId) {
    try {
        const user = await Inventory.findOne({ user_id: userId }); // Asegúrate de usar el campo correcto
        return user ? user.last_drop : null;
    } catch (error) {
        console.error('Error fetching last drop:', error);
        throw error;
    }
}
async function updateLastDrop(userId) {
    // Encuentra el inventario del usuario
    let inventory = await fetchInventory(userId);
    
    if (!inventory) {
        // Si el inventario no existe, crear uno nuevo
        inventory = new Inventory({ userId });
    }

    // Actualizar la propiedad `last_drop` con la fecha y hora actual
    inventory.last_drop = new Date();
    await inventory.save();
}
const fetchLastGrab = async (userId) => {
    try {
        const user = await Inventory.findOne({ user_id: userId });
        return user ? user.last_grab : null;
    } catch (err) {
        console.error('Error fetching last grab:', err);
        throw err;
    }
};



async function addFrameToInventory(userId, frameName, quantity) {
    try {
        console.log(`Intentando agregar el marco ${frameName} al inventario del usuario ${userId} con cantidad ${quantity}`);

        // Buscar el inventario del usuario
        const inventory = await Inventory.findOne({ user_id: userId });
        if (!inventory) {
            throw new Error('Inventario del usuario no encontrado.');
        }
        console.log('Inventario del usuario encontrado.');

        // Buscar el marco en la base de datos de marcos
        const frame = await Frame.findOne({ name: frameName });
        if (!frame) {
            throw new Error('Frame no encontrado.');
        }
        console.log(`Frame encontrado: ${frameName}`);
        console.log(`Color del marco: ${frame.color_letter}`);

        // Verificar que frame.moons sea un número
        if (isNaN(frame.moons)) {
            throw new Error('El costo del marco en lunas no es válido.');
        }

        // Calcular el costo total en lunas
        const totalCostMoons = frame.moons * quantity;
        const currentMoons = (inventory.moons || []).reduce((total, value) => total + value, 0);

        console.log(`Lunas actuales: ${currentMoons}, Costo total en lunas: ${totalCostMoons}`);

        // Verificar si el usuario tiene suficientes lunas
        if (currentMoons < totalCostMoons) {
            throw new Error('No tienes suficientes lunas para comprar este marco.');
        }

        // Actualizar las lunas después de la compra
        let remainingMoons = totalCostMoons;
        const updatedMoonsArray = (inventory.moons || []).map(moon => {
            if (remainingMoons === 0) return moon;
            if (moon >= remainingMoons) {
                const result = moon - remainingMoons;
                remainingMoons = 0;
                return result;
            } else {
                remainingMoons -= moon;
                return 0;
            }
        }).filter(moon => moon > 0); // Eliminar valores de 0

        console.log(`Array de lunas después de la compra: ${updatedMoonsArray}`);

        // Comprobar si el marco ya existe en el inventario
        const frameIndex = inventory.Frames.findIndex(f => f.name === frameName);

        if (frameIndex !== -1) {
            // El marco ya existe en el inventario, actualizar cantidad y color_letter
            console.log('El marco ya existe en el inventario, actualizando cantidad y color_letter.');

            // Actualizar el marco existente
            const updateResult = await Inventory.findOneAndUpdate(
                { user_id: userId, 'Frames.name': frameName },
                {
                    $set: {
                        moons: updatedMoonsArray,
                        'Frames.$.color_letter': frame.color_letter // Asegurarse de que color_letter se actualice
                    },
                    $inc: { 'Frames.$.quantity': quantity }
                },
                { new: true }
            );

            console.log('Inventario actualizado correctamente.');
            return updateResult;
        } else {
            // El marco no existe, agregarlo
            console.log('El marco no está en el inventario, agregando nuevo marco.');

            const addFrameResult = await Inventory.findOneAndUpdate(
                { user_id: userId },
                {
                    $set: { moons: updatedMoonsArray },
                    $push: {
                        Frames: {
                            name: frameName,
                            quantity: quantity,
                            image: frame.image,
                            color_letter: frame.color_letter // Agregar color_letter al nuevo marco
                        }
                    }
                },
                { new: true }
            );

            if (!addFrameResult) {
                throw new Error('No se pudo actualizar el inventario.');
            }

            console.log('Inventario actualizado correctamente con nuevo marco.');
            return addFrameResult;
        }
    } catch (error) {
        console.error('Error actualizando el inventario:', error.message);
        
        // Manejar error de interacción expirado
        if (error.code === 10062) {
            console.error('La interacción ha expirado. Enviando mensaje alternativo.');
            await i.reply('La interacción ha expirado. Por favor, inténtalo de nuevo.');
        } else {
            throw error;
        }
    }
}


const applyFrameToCard = async (userId, cardCode, frameName) => {
    try {
        console.log(`Intentando aplicar el marco ${frameName} a la carta ${cardCode} para el usuario ${userId}`);

        // Obtén el inventario del usuario
        const userInventory = await fetchInventory(userId);
        if (!userInventory) {
            console.error('Inventario no encontrado.');
            return false;
        }
        console.log('Inventario del usuario encontrado.');

        // Buscar la carta correspondiente en el inventario
        const cardIndex = userInventory.cards.findIndex(c => c.code === cardCode);
        if (cardIndex === -1) {
            console.error('Carta no encontrada.');
            return false;
        }
        console.log(`Carta encontrada: ${cardCode}`);

        // Verificar si la carta ya tiene un marco aplicado
        if (userInventory.cards[cardIndex].frame) {
            console.error('La carta ya tiene un marco aplicado.');
            return false;
        }

        // Buscar el marco en el inventario del usuario
        const frameIndex = userInventory.Frames.findIndex(f => f.name.toLowerCase() === frameName.toLowerCase());
        if (frameIndex === -1) {
            console.error(`Marco no encontrado: ${frameName}`);
            return false;
        }
        const frame = userInventory.Frames[frameIndex];
        console.log(`Marco encontrado: ${frameName}`);

        // Actualizar el campo del marco en la carta
        userInventory.cards[cardIndex].frame = {
            name: frameName,
            image_card: frame.image // Asegúrate de que 'image' es la propiedad correcta
        };
        console.log(`Marco ${frameName} aplicado a la carta ${cardCode}`);

        // Reducir la cantidad o eliminar el marco si la cantidad es 1
        if (frame.quantity > 1) {
            userInventory.Frames[frameIndex].quantity -= 1;
            console.log(`Cantidad del marco ${frameName} reducida a ${userInventory.Frames[frameIndex].quantity}`);
        } else {
            userInventory.Frames.splice(frameIndex, 1);
            console.log(`Marco ${frameName} eliminado del inventario.`);
        }

        // Actualizar el inventario del usuario en la base de datos
        const updateResult = await Inventory.findOneAndUpdate(
            { user_id: userId },
            {
                $set: {
                    cards: userInventory.cards,
                    Frames: userInventory.Frames
                }
            },
            { new: true } // Devuelve el documento actualizado
        );

        if (!updateResult) {
            console.error('No se pudo actualizar el inventario.');
            return false;
        }

        console.log('Inventario guardado correctamente.');
        return true;
    } catch (error) {
        console.error('Error al aplicar el marco a la carta:', error);
        return false;
    }
};


// Función para actualizar la cantidad de oro del usuario y la fecha de la última recompensa diaria
async function updateGoldAndShine(userId, goldAmount) {
    try {
        if (typeof goldAmount !== 'number') {
            throw new Error('Amount must be a number');
        }

        const user = await Inventory.findOne({ user_id: userId });

        if (!user) {
            throw new Error('User not found');
        }

        // Calculate the new gold and shine totals
        const currentGold = user.gold.reduce((total, value) => total + value, 0);
        const newGoldTotal = currentGold + goldAmount;

      

        // Update the user with the new gold and shine values
        const updatedUser = await Inventory.findOneAndUpdate(
            { user_id: userId },
            {
                $set: { 
                    gold: [newGoldTotal],
                  
                    last_daily: new Date() 
                }
            },
            { new: true }
        );

        return updatedUser;
    } catch (err) {
        console.error('Error updating gold', err);
        throw err;
    }
}

async function updateStellarDust(userId, stellarDustAmount, goldAmount) {
    try {
        if (typeof stellarDustAmount !== 'number' || typeof goldAmount !== 'number') {
            throw new Error('Amounts must be numbers');
        }

        const user = await Inventory.findOne({ user_id: userId });

        if (!user) {
            throw new Error('User not found');
        }

        // Calculate the new stellar dust total
        const currentStellarDust = user.stellar_dust.reduce((total, value) => total + value, 0);
        const newStellarDustTotal = currentStellarDust + stellarDustAmount;

        // Calculate the new gold total
        const currentGold = user.gold.reduce((total, value) => total + value, 0);
        const newGoldTotal = currentGold + goldAmount;

        // Update the user with the new values
        const updatedUser = await Inventory.findOneAndUpdate(
            { user_id: userId },
            {
                $set: { 
                    stellar_dust: [newStellarDustTotal],
                    gold: [newGoldTotal]
                }
            },
            { new: true }
        );

        return updatedUser;
    } catch (err) {
        console.error('Error updating stellar dust:', err);
        throw err;
    }
}

// Define el esquema para los personajes de anime
const animeCharacterSchema = new mongoose.Schema({
    _id: { type: Number, required: true },
    name: { type: String, required: true },
    series: { type: String, required: true },
    img_url: { type: String, required: true },
    __v: { type: Number, default: 0 },
    wishlist: {
        type: Number,
        default: 0
    },
    burned: { type: Number, default: 0}, 

}, { collection: 'animeCharacters' });

const AnimeCharacter = mongoose.model('AnimeCharacter', animeCharacterSchema);

// Función para actualizar la lista de deseos
// Función para actualizar la lista de deseos
async function updateWishlist(userId, characterName, characterSeries, increment = true) {
    try {
        // Buscar el personaje por nombre y serie
        const character = await AnimeCharacter.findOne({ name: characterName, series: characterSeries });
        if (!character) {
            return { success: false, message: 'Character not found.' };
        }

        // Buscar el inventario del usuario
        const userInventory = await Inventory.findById(userId);
        if (!userInventory) {
            return { success: false, message: 'User inventory not found.' };
        }

        // Establecer el límite de la wishlist (por defecto es 10)
        const wishlistLimit = userInventory.limited || 10;

        // Verificar la cantidad actual en la wishlist
        const wishlistCount = userInventory.wishlist.length;

        // Si se quiere incrementar y ya alcanzó el límite
        if (increment && wishlistCount >= wishlistLimit) {
            return { success: false, message: `Wishlist limit reached. You can only have ${wishlistLimit} items.` };
        }

        // Crear el objeto de la wishlist
        const wishlistItem = { name: character.name, series: character.series };

        // Actualizar la wishlist del usuario
        const update = increment
            ? { $addToSet: { wishlist: wishlistItem } }  // Añadir sin duplicados
            : { $pull: { wishlist: wishlistItem } };     // Eliminar si está presente

        const result = await Inventory.findByIdAndUpdate(userId, update, { new: true });

        return result
            ? { success: true, message: 'Wishlist updated successfully.' }
            : { success: false, message: 'Failed to update wishlist.' };

    } catch (error) {
        console.error('Error updating wishlist:', error);
        return { success: false, message: 'An error occurred while updating the wishlist.' };
    }
}


async function updateInventory(userId, updatedData) {
    try {
        return await Inventory.findByIdAndUpdate(
            userId,
            { $set: updatedData },
            { new: true } // Devuelve el documento actualizado
        );
    } catch (error) {
        console.error('Error updating inventory:', error);
        throw error;
    }
}


// database/database.js

async function fetchAllInventories() {
    try {
        // Fetch all documents from the Inventory collection
        const inventories = await Inventory.find().exec();
        return inventories;
    } catch (error) {
        console.error('Error fetching all inventories:', error);
        throw error;
    }
}
// Función para consumir ítems del inventario
// database/database.js

// Función para consumir ítems del inventario

// Función para consumir ítems del inventario
async function consumeItems(userId, items) {
    try {
        // Fetch the user's inventory
        const inventory = await fetchInventory(userId);

        if (!inventory) {
            console.error('User inventory not found');
            return false;
        }

        const inventoryUpdates = {};
        let anyItemAvailable = false;

        items.forEach(item => {
            if (inventory[item] && inventory[item].length > 0) {
                anyItemAvailable = true;
                inventoryUpdates[item] = inventory[item].map(value => {
                    if (parseInt(value) > 0) {
                        return parseInt(value) - 1; // Decrease the quantity by 1
                    }
                    return value;
                }).filter(value => value > 0); // Remove zero or negative values
            }
        });

        if (anyItemAvailable) {
            await updateInventory(userId, inventoryUpdates); // Update the inventory in the database
            return true;
        } else {
            console.error('Not enough items to consume');
            return false;
        }
    } catch (error) {
        console.error('Error consuming items:', error);
        return false;
    }
}
//
async function addTagToInventory(userId, tagName, emoji) {
    try {
        // Fetch the user's current inventory
        const inventory = await fetchInventory(userId);
        const tags = inventory ? inventory.tags || [] : [];

        // Check if the tag limit has been reached
        if (tags.length >= 10) {
            return { success: false, message: 'You have reached the maximum limit of 10 tags.' };
        }

        // Combine the emoji and tag name
        const tagWithEmoji = `${emoji} ${tagName}`;

        // Check if the tag already exists
        if (tags.includes(tagWithEmoji)) {
            return { success: false, message: `You already have a tag named **${tagWithEmoji}** in your inventory.` };
        }

        // Add the new tag with emoji to the array
        tags.push(tagWithEmoji);

        // Update the user's inventory with the new tag
        await updateInventory(userId, { tags });

        return { success: true, message: `Tag **${tagWithEmoji}** has been created and added to your inventory.` };
    } catch (error) {
        console.error('Error in addTagToInventory:', error);
        return { success: false, message: 'An error occurred while adding the tag to your inventory.' };
    }
}

async function transferFrame(fromInventory, toInventory, frameName, amount) {
    try {
        // Encuentra el índice del frame en el inventario de origen
        const frameIndex = fromInventory.Frames.findIndex(frame => frame.name === frameName);

        if (frameIndex === -1) {
            throw new Error('El frame no se encontró en el inventario del usuario de origen.');
        }

        // Extrae el frame del inventario de origen
        const [frame] = fromInventory.Frames.splice(frameIndex, 1);

        // Ajusta la cantidad del frame en el inventario de destino
        if (amount) {
            frame.quantity = (frame.quantity || 1) + amount;
        } else {
            frame.quantity = (frame.quantity || 1);
        }

        toInventory.Frames.push(frame);

        console.log('Frame transferido con éxito.');
    } catch (error) {
        console.error('Error al transferir el frame:', error);
        throw new Error('Error al transferir el frame.');
    }
}
//

// Función para insertar los primeros 2400 personajes en la colección animeCharacters

async function addAnimeCharacter(name, series, img_url) {
    try {
        // Busca el personaje con el _id más alto que sea mayor o igual a 15500
        const highestIdCharacter = await AnimeCharacter.findOne({ _id: { $gte: 15500 } }).sort({ _id: -1 }).exec();

        // Si no hay personajes con _id >= 15500, asigna el _id como 15500, si no, suma 1 al _id más alto
        const newId = highestIdCharacter ? highestIdCharacter._id + 1 : 15500;

        // Crea un nuevo personaje con el _id correcto
        const newCharacter = new AnimeCharacter({
            _id: newId,
            name: name,
            series: series,
            img_url: img_url,
            wishlist: 0, // Valor por defecto
            burned: 0 // Valor por defecto
        });

        // Guarda el nuevo personaje en la base de datos
        await newCharacter.save();

        console.log('Nuevo personaje de anime añadido:', newCharacter);
    } catch (error) {
        console.error('Error al añadir el personaje de anime:', error);
    }
}

async function editAnimeCharacterImage(name, series, new_img_url) {
    try {
        // Search for the character by name and series
        const character = await AnimeCharacter.findOne({ name: name, series: series }).exec();

        // If the character is not found, log an error
        if (!character) {
            console.log(`Character with name "${name}" from the series "${series}" not found.`);
            return;
        }

        // Update only the img_url field
        character.img_url = new_img_url;

        // Save the changes to the database
        await character.save();

        console.log(`Character "${name}" image updated to: ${new_img_url}`);
    } catch (error) {
        console.error('Error updating the character image:', error);
    }
}
//

 // Import your AnimeCharacter model


// Function to introduce a delay

const updateCardsWithCharacterIdForAllUsers = async () => {
  try {
    // Obtener todos los inventarios existentes
    const inventories = await fetchAllInventories();

    // Filtrar inventarios con un _id válido y que no estén vacíos
    const validInventories = inventories.filter(inventory => inventory._id && inventory.cards && inventory.cards.length > 0);

    // Iterar sobre cada inventario válido
    for (let inventory of validInventories) {
      let updatedCards = inventory.cards.map(async (card) => {
        // Buscar el personaje correspondiente en la colección AnimeCharacters usando el _id del personaje
        const matchingCharacter = await AnimeCharacter.findOne({ _id: card._id });

        // Si existe el personaje, actualiza las propiedades series e img_url en la carta
        if (matchingCharacter) {
          card.series = matchingCharacter.series;
          card.img_url = matchingCharacter.img_url;
        }

        return card;
      });

      // Espera a que todas las promesas se resuelvan antes de actualizar el inventario del usuario
      updatedCards = await Promise.all(updatedCards);

      // Actualiza las cartas del usuario si se realizaron modificaciones
      await Inventory.updateOne(
        { _id: inventory._id },
        { $set: { cards: updatedCards } }
      );
    }

    console.log("Series e img_url updated correctly in all inventorys.");
  } catch (error) {
    console.error("error trying to update series e img_url in cards", error);
  }
};

//Update every card in the user collection and change the image and series name based in the id
//updateCardsWithCharacterIdForAllUsers()
// Invocar la función para actualizar las cartas en todos los inventarios válidos





//
//

async function fetchCharacterData(id) {
    try {
        const response = await axios.get(`https://api.jikan.moe/v4/characters/${id}/full`);
        const character = response.data.data;

        // Mapear los datos necesarios
        return {
            _id: character.mal_id,  // Asignar el ID de MyAnimeList como _id
            name: character.name,
            series: character.anime[0]?.anime?.title || 'Unknown', // Asignar el título del anime si está disponible
            img_url: character.images.jpg.image_url // Asignar la URL de la imagen
        };
    } catch (err) {
        console.error(`Error fetching data for character ID ${id}: ${err.message}`);
        throw err; // Re-lanzar el error para manejarlo más arriba
    }
}
//
const applyBuffToUser = async (userId, buffName) => {
    try {
          const user = await Inventory.findOne({ user_id: userId });
        if (!user) {
            throw new Error('User not found');
        }

        const buff = user.Buffs.find(b => b.name === buffName);
        if (buff) {
            // Si el buff ya existe, sumamos los días restantes
            buff.days_remaining += 30;
        } else {
            // Si el buff no existe, lo creamos con 30 días
            user.Buffs.push({
                name: buffName,
                days_remaining: 30,
                applied_on: new Date() // Guardar la fecha de aplicación
            });
        }

        await user.save();
    } catch (err) {
        console.error('Error applying buff:', err);
        throw err;
    }
};
const updateDailyBuffs = async (userId) => {
    try {
        // Obtener el inventario del usuario específico usando fetchInventory
        const userInventory = await fetchInventory(userId);
        const now = new Date();

        // Verificar que el inventario tenga un array de Buffs con al menos un elemento
        if (!userInventory || !Array.isArray(userInventory.Buffs) || userInventory.Buffs.length === 0) {
            return; // No hay buffs para actualizar
        }

        let inventoryUpdated = false;

        // Recorrer los buffs del inventario
        userInventory.Buffs = userInventory.Buffs.map(buff => {
            if (buff.days_remaining > 0) {
                // Convertir applied_on a un objeto Date
                const appliedOnDate = new Date(buff.applied_on);
                
                // Calcular la diferencia en días entre la fecha actual y applied_on
                const daysPassed = Math.floor((now - appliedOnDate) / (1000 * 60 * 60 * 24));

                // Restar los días transcurridos de days_remaining solo si han pasado días
                if (daysPassed > 0) {
                    buff.days_remaining = Math.max(buff.days_remaining - daysPassed, 0);

                    // Si el buff aún tiene días restantes, actualizar la fecha de applied_on a la actual
                    if (buff.days_remaining > 0) {
                        buff.applied_on = now.toISOString();
                    }

                    inventoryUpdated = true;
                }
            }

            // Si los días restantes llegan a 0, marcar active como false
            if (buff.days_remaining === 0 && buff.active) {
                buff.active = false;
                inventoryUpdated = true;
            }

            return buff;
        });

        // Si hubo cambios en los buffs, actualizar el inventario del usuario
        if (inventoryUpdated) {
            await updateInventory(userId, { Buffs: userInventory.Buffs });
        }
    } catch (err) {
        console.error('Error actualizando buffs:', err);
        throw err;
    }
};

// Función para actualizar los buffs diarios

async function getDatabaseSnapshot() {
    try {
        // Obtiene todos los documentos de la colección AnimeCharacter
        const characters = await AnimeCharacter.find({}).exec();

        // Mapear los datos a un formato de texto simple
        return characters.map(character => ({
            name: character.name,
            series: character.series,
            img_url: character.img_url
        }));
    } catch (err) {
        console.error('Error fetching database snapshot:', err);
        throw err; // Lanza el error para que el código que llama a esta función pueda manejarlo
    }
}

//
//async function fetchWishlist(characterName, dropChannelId) {
   // try {
        // Fetch all user inventories
       // const inventories = await fetchAllInventories(); // Cambiado a fetchAllInventories

        // Check if inventories is null or not an array
      //  if (!Array.isArray(inventories)) {
           // console.error('Inventories is null or not an array:', inventories);
         //   return []; // Return an empty array to avoid further errors
       // }

        // Check if at least one inventory has a valid wishlist_channel
       // const hasValidChannel = inventories.some(inventory =>
           // typeof inventory.wishlist_channel === 'string' && 
         //   inventory.wishlist_channel.length > 1
       // );

       // if (!hasValidChannel) {
            //console.log('No valid wishlist_channel found in any inventory.');
          //  return []; // Return an empty array if no valid channel exists
        //}

        // Filter inventories to find those containing the character in their wishlist and the correct wishlist channel
       // const matchedInventories = inventories.filter(inventory => 
            //inventory.wishlist_channel === dropChannelId && // Check that the channel matches
          //  inventory.wishlist && inventory.wishlist.some(item => item.name.toLowerCase() === characterName.toLowerCase()) // Check if the character is in the wishlist
        //);

        // Log to check matched inventories
       // console.log('Matched inventories:', matchedInventories);

       // return matchedInventories.map(inventory => ({
            //userId: inventory.user_id, // Cambiar a user_id
          //  username: inventory.username, // Incluir el nombre de usuario para mención
        //    wishlist_channel: inventory.wishlist_channel,
      //      wishlist: inventory.wishlist // Optionally return the wishlist if needed
    //    }));
   // } catch (error) {
    //    console.error('Error fetching wishlists:', error);
  //      throw error;
//    //}
//}
//




//

async function insertAnimeCharacters() {
    try {
        const characters = [];
        for (let i = 1; i <= 15000; i++) {
            try {
                console.log(`Fetching data for character ID ${i}...`);
                // Verifica si el personaje ya está en la base de datos
                const existingCharacter = await AnimeCharacter.findById(i);
                if (existingCharacter) {
                    console.log(`Character ID ${i} already exists in the database. Skipping.`);
                    continue; // Saltar al siguiente ID si ya existe
                }

                const characterData = await fetchCharacterData(i);
                console.log(`Fetched data for character ID ${i}:`, characterData);
                characters.push(characterData);

                await delay(2000); // Espera 2 segundos entre cada solicitud para evitar el límite de tasa
            } catch (err) {
                console.error(`Failed to fetch or insert character with ID ${i}:`, err.message);
                if (err.response?.status === 429) {
                    console.log(`Rate limit exceeded for character ID ${i}. Retrying in 2000ms...`);
                    await delay(2000); // Espera adicional en caso de límite de tasa
                }
            }
        }

        if (characters.length > 0) {
            console.log('Inserting characters into database...');
            await AnimeCharacter.insertMany(characters, { ordered: false });
            console.log('Anime characters inserted successfully.');
        } else {
            console.log('No characters were inserted due to API errors or existing entries.');
        }
    } catch (err) {
        console.error('Error inserting anime characters:', err);
    }
}
//



// Función para manejar el voto de un usuario


// Ejemplo de uso: Reemplaza 'USER_ID' con el ID del usuario que votó en tu lógica
 // Asigna el ID del usuario que votó aquí

  //insertAnimeCharacters(); insertar personajes de anime 

// Delay function to wait between API requests
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Exportación de las funciones y modelos
module.exports = { 
    fetchInventory, 
    registerUser, 
    checkUserExists, 
    fetchLastDaily, 
    updateGoldAndShine,
    updateWishlist,
    insertAnimeCharacters, AnimeCharacter,updateInventory,addCardToInventory,fetchLastDrop,updateLastDrop,fetchLastGrab,updateLastGrab,consumeItems,updateStellarDust,Frame,addFrameToInventory,applyFrameToCard,fetchAllInventories,addTagToInventory,fetchLastVote,updateDailyBuffs,applyBuffToUser,addAnimeCharacter,editAnimeCharacterImage,getDatabaseSnapshot,
};