const { fetchInventory, updateInventory } = require('./database/database');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');
const Canvas = require('canvas');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js'); // Asegúrate de importar correctamente

// Función para cargar la imagen
async function fetchImage(url) {
    if (!/^https?:\/\//i.test(url)) {
        throw new Error('Invalid URL');
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch image');
    }
    return response.buffer();
}

Canvas.registerFont('./commands/fonts/BebasNeue-Regular.ttf', { family: 'Bebas Neue' });

// Función para crear el lienzo de la carta
async function createCardCanvas(card) {
    const canvas = createCanvas(400, 600); // Ajusta el tamaño según sea necesario
    const context = canvas.getContext('2d');

    // Cargar imagen de fondo
    const backgroundImage = await fetchImage(card.default_frame || 'default_background_url.png');
    context.drawImage(await loadImage(backgroundImage), 0, 0, canvas.width, canvas.height);

    // Cargar y dibujar la imagen del personaje
    if (card.img_url) {
        try {
            const characterImage = await loadImage(card.img_url);
            context.globalAlpha = 1.0; // Asegurarse de que la opacidad esté al 100%
            context.drawImage(characterImage, 10, 10, 380, 580); // Ajusta la posición y el tamaño según sea necesario
        } catch (error) {
            console.error(`Error loading image for character ${card._id}:`, error);
        }
    }

    // Añadir texto
    context.fillStyle = 'white';
    context.font = '30px "Bebas Neue"'; // Usar la fuente registrada
    context.fillText(card.name, 20, 450); // Nombre de la carta
    context.fillText(`#${card.__v}`, 20, 500); // Valor de la carta

    return canvas;
}

module.exports = {
    name: 'scratch',
    description: 'Scratches a card to reveal it and displays its __v.',
    run: async (message, args) => {
        try {
            const userId = message.author.id; // ID del usuario que está usando el comando
            const inventory = await fetchInventory(userId); // Obtener el inventario

            // Verificar que hay cartas en el inventario
            if (!inventory || !Array.isArray(inventory.cards) || inventory.cards.length === 0) {
                return await message.channel.send(`No scratch card available for you.`);
            }

            // Obtener el código de la carta a raspar desde los argumentos
            const codeToScratch = args[0]; // El primer argumento es el código
            const cardToScratch = inventory.cards.find(card => card.code === codeToScratch);

            // Verificar si la carta se encuentra en el inventario del usuario
            if (!cardToScratch) {
                return await message.channel.send(`This card does not belong to you.`);
            }

            // Verificar si la carta se puede raspar
            if (!cardToScratch.scratch) {
                return await message.channel.send(`This card has already been scratched.`);
            }

            // Cambiar el campo scratch a false
            cardToScratch.scratch = false;

            // Crear el lienzo de la carta
            const canvas = await createCardCanvas(cardToScratch);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'card.png' }); // Usar AttachmentBuilder correctamente

            // Actualizar inventario
            await updateInventory(userId, { cards: inventory.cards }); // Actualiza solo las cartas

            // Enviar la carta como imagen
            await message.channel.send({ content: `You scratched a card! Here is your card with __v: **#${cardToScratch.__v}**`, files: [attachment] });
        } catch (error) {
            console.error('Error while scratching the card:', error);
            await message.channel.send('There was an error trying to scratch the card. Please try again later.');
        }
    }
};
