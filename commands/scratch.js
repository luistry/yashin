const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');
const Discord = require('discord.js');

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

    // Cargar imagen de fondo (puedes cambiar la URL a la que desees)
    const backgroundImage = await fetchImage(card.backgroundUrl || 'default_background_url.png');
    const characterImage = await fetchImage(card.imageUrl); // La imagen del personaje

    // Dibujar el fondo
    context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    // Dibujar el personaje
    context.drawImage(characterImage, 50, 50, 300, 300); // Ajusta la posición y tamaño según sea necesario

    // Añadir texto
    context.fillStyle = 'white';
    context.font = '30px "Bebas Neue"'; // Usar la fuente registrada
    context.fillText(card.name, 20, 400); // Nombre de la carta
    context.fillText(`__v: ${card.__v}`, 20, 450); // Valor de la carta

    return canvas;
}

module.exports = {
    name: 'scratch',
    description: 'Scratches a card to reveal it and displays its __v.',
    run: async (message, args) => {
        try {
            const userId = message.author.id; // ID del usuario que está usando el comando
            const inventory = await fetchInventory(userId); // Obtener el inventario

            if (!inventory || !inventory.scratch || inventory.scratch.length === 0) {
                return await message.channel.send(`No scratch card available for you.`);
            }

            // Obtener la carta para raspar
            const cardToScratch = inventory.scratch[0]; // Obtener la primera carta para raspar

            // Verificar si la carta es del usuario
            if (cardToScratch.owner !== userId) {
                return await message.channel.send(`You do not own this card.`);
            }

            // Verificar si la carta se puede raspar
            if (!cardToScratch.scratch) {
                return await message.channel.send(`This card is not scratchable.`);
            }

            // Cambiar el campo scratch a false
            cardToScratch.scratch = false;

            // Crear el lienzo de la carta
            const canvas = await createCardCanvas(cardToScratch);
            const attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'card.png');

            // Actualizar inventario
            inventory.scratch.shift(); // Eliminar la carta de la lista de cartas para raspar
            await updateInventory(userId, { scratch: inventory.scratch });

            // Enviar la carta como imagen
            await message.channel.send({ content: `You scratched a card! Here is your card with __v: **#${cardToScratch.__v}**`, files: [attachment] });
        } catch (error) {
            console.error('Error while scratching the card:', error);
            await message.channel.send('There was an error trying to scratch the card. Please try again later.');
        }
    }
};
