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
    const cardWidth = 350;
    const cardHeight = 550;
    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');

    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Cargar y dibujar imagen del personaje
    if (card.img_url) {
        try {
            const characterImage = await loadImage(card.img_url);
            context.globalAlpha = 1.0;
            context.drawImage(characterImage, 10, 10, cardWidth - 20, cardHeight - 20);
        } catch (error) {
            console.error(`Error loading image for character ${card._id}:`, error);
        }
    }

    // Dibujar el frame
    const default_frame = card.default_frame && card.default_frame.replace(/^['"]|['"]$/g, '');
    if (default_frame && /^https?:\/\//i.test(default_frame)) {
        try {
            const frameImg = await loadImage(default_frame);
            context.drawImage(frameImg, 0, 0, cardWidth, cardHeight);
        } catch (error) {
            console.error(`Error loading frame image from URL ${default_frame}:`, error);
        }
    }

    // Determinar colores de texto y ajustar si es el frame especificado
    const isDarkOrangeFrame = (default_frame === 'https://yashin.nyc3.cdn.digitaloceanspaces.com/Dark_Orange.png');
    const colorLetterName = isDarkOrangeFrame ? '#FFFFFF' : (card.color_letter_name || '#000000');
    const colorLetterSeries = isDarkOrangeFrame ? '#FFFFFF' : (card.color_letter_series || '#000000');
    const colorLetter = isDarkOrangeFrame ? '#FFFFFF' : (card.color_letter || '#000000');

    // Definir textXPosition como la posición horizontal central del card
    const textXPosition = cardWidth / 2;

    // Si el frame no es Dark Orange, dibujar el __v, nombre y serie
    if (!isDarkOrangeFrame) {
        context.fillStyle = colorLetter;
        context.font = 'bold 22px "Bebas Neue"';
        context.textAlign = 'center';
        context.fillText(`#${card.__v}`, cardWidth / 2, cardHeight - 84);
        
        let seriesText = card.series.length > 16 ? card.series.slice(0, 15) + '-' : card.series;
        wrapText(context, seriesText, textXPosition, cardHeight - 20, cardWidth - 40, 24);
        
        context.fillStyle = colorLetterName;
        let characterName = card.name.length > 15 ? card.name.slice(0, 14) + '-' : card.name;
        context.fillText(characterName, textXPosition, cardHeight - 50);
    }

    // Ajustar posición de texto si el frame es Dark Orange y se omite el __v
    if (isDarkOrangeFrame) {
        // Solo dibujar el nombre y la serie una vez, si el frame es Dark Orange
        context.font = 'bold 30px "Bebas Neue"';
        context.fillStyle = colorLetterName; // Usar color_letter_name para el nombre
        context.textAlign = 'center';

        let characterName = card.name.length > 15 ? card.name.slice(0, 14) + '-' : card.name;
        const nameY = cardHeight - 50; // Posición ajustada para el nombre
        context.fillText(characterName, textXPosition, nameY);

        // Dibujar el nombre de la serie con el color correspondiente
        context.font = '24px "Bebas Neue"';
        context.fillStyle = colorLetterSeries; // Usar color_letter_series para la serie
        let seriesText = card.series.length > 16 ? card.series.slice(0, 15) + '-' : card.series;

        const seriesY = nameY + 30; // Asegurarse de que no se superponga con el nombre
        wrapText(context, seriesText, textXPosition, seriesY, cardWidth - 40, 24);
    }

    return canvas;
}

// Función auxiliar para envolver texto
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;
    for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = context.measureText(testLine).width;
        if (testWidth > maxWidth && line !== '') {
            context.fillText(line, x, lineY);
            line = word + ' ';
            lineY += lineHeight;
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, lineY);
    return lineY + lineHeight;
}

// Función para manejar el comando "scratch"
module.exports = {
    name: 'scratch',
    description: 'Scratches a card to reveal it and displays its __v.',
    run: async (message, args) => {
        try {
            const userId = message.author.id; // ID del usuario que está usando el comando
            const inventory = await fetchInventory(userId); // Obtener el inventario

            // Verificar que hay cartas y scratch cards disponibles
            if (!inventory || inventory.scratch === undefined || inventory.scratch <= 0) {
                return await message.channel.send(`You have no scratch cards left to use.`);
            }

            if (!Array.isArray(inventory.cards) || inventory.cards.length === 0) {
                return await message.channel.send(`No scratchable cards available in your inventory.`);
            }

            // Obtener el código de la carta a raspar desde los argumentos
            const codeToScratch = args[0];
            const cardToScratch = inventory.cards.find(card => card.code === codeToScratch);

            // Verificar si la carta pertenece al usuario
            if (!cardToScratch) {
                return await message.channel.send(`The card with code "${codeToScratch}" does not belong to you.`);
            }

            if (cardToScratch.scratch === false) {
                return await message.channel.send(`This card has already been scratched.`);
            }

            // Actualizar el estado de la carta
            cardToScratch.scratch = false;

            // Crear el lienzo de la carta
            const canvas = await createCardCanvas(cardToScratch);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'card.png' });

            // Restar 1 al contador de scratch y actualizar inventario
            inventory.scratch -= 1;

            await updateInventory(userId, {
                scratch: inventory.scratch,
                cards: inventory.cards.map(card =>
                    card.code === codeToScratch ? cardToScratch : card // Actualizar solo la carta modificada
                )
            });

            //randomissue()
            await message.channel.send({
                content: `You scratched a card! Here is your card with #: **#${cardToScratch.__v}**\nYou now have **${inventory.scratch}** scratch cards left.`,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error while scratching the card:', error);
            await message.channel.send('There was an error trying to scratch the card. Please try again later.');
        }
    }
};
