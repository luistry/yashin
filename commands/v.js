const { EmbedBuilder } = require('discord.js'); 
const { fetchAllInventories } = require('./database/database');
const Canvas = require('canvas');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');

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
async function createCardCanvas(character) {  
    const cardWidth = 350;
    const cardHeight = 550;
    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');

    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Cargar y dibujar imagen del personaje
    if (character.img_url) {
        try {
            const characterImage = await loadImage(character.img_url);
            context.globalAlpha = 1.0;
            context.drawImage(characterImage, 10, 10, cardWidth - 20, cardHeight - 20);
        } catch (error) {
            console.error(`Error loading image for character ${character._id}:`, error);
        }
    }

    // Dibujar el frame
    const default_frame = character.default_frame && character.default_frame.replace(/^['"]|['"]$/g, '');
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
    const colorLetterName = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter_name || '#000000');
    const colorLetterSeries = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter_series || '#000000');
    const colorLetter = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter || '#000000');

    // Definir textXPosition como la posición horizontal central del card
    const textXPosition = cardWidth / 2;

    // Si el frame no es Dark Orange, dibujar el __v, nombre y serie
    if (!isDarkOrangeFrame) {
        context.fillStyle = colorLetter;
        context.font = 'bold 22px "Bebas Neue"';
        context.textAlign = 'center';
        context.fillText(`#${character.__v}`, cardWidth / 2, cardHeight - 84);
        
        let seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;
        wrapText(context, seriesText, textXPosition, cardHeight - 20, cardWidth - 40, 24);
        
        context.fillStyle = colorLetterName;
        let characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
        context.fillText(characterName, textXPosition, cardHeight - 50);
    }

    // Ajustar posición de texto si el frame es Dark Orange y se omite el __v
    if (isDarkOrangeFrame) {
        // Solo dibujar el nombre y la serie una vez, si el frame es Dark Orange
        context.font = 'bold 30px "Bebas Neue"';
        context.fillStyle = colorLetterName; // Usar color_letter_name para el nombre
        context.textAlign = 'center';

        let characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
        const nameY = cardHeight - 50; // Posición ajustada para el nombre
        context.fillText(characterName, textXPosition, nameY);

        // Dibujar el nombre de la serie con el color correspondiente
        context.font = '24px "Bebas Neue"';
        context.fillStyle = colorLetterSeries; // Usar color_letter_series para la serie
        let seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;

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


module.exports = {
    name: 'v',
    description: 'View details of a specific card from the collection',
    async run(message, args) {
        try {
            const cardCode = args.join(' ').trim();
            const allInventories = await fetchAllInventories();
            let card = null;
            let cardOwner = null;

            for (const inventory of allInventories) {
                card = inventory.cards.find(c => c.code === cardCode);
                if (card) {
                    cardOwner = inventory._id || 'Unknown';
                    break;
                }
            }

            if (!card) {
                return message.channel.send('Card not found. Please check the code and try again.');
            }

            // Verificar si la propiedad scratch es true y ajustar el valor de __v en consecuencia
            const __v = card.scratch ? 'Halloween 2024 🎃' : (card.__v !== undefined ? card.__v : 'Unknown');
            const canvas = await createCardCanvas(card);
            const finalImageBuffer = canvas.toBuffer();
            const rarityInitial = card.rarity ? card.rarity.charAt(0).toUpperCase() : 'Unknown';

            const embed = new EmbedBuilder()
                .setColor('#BEC2CB')
                .setTitle(`Viewing ${card.name}`)
                .setAuthor({
                    name: `Viewing card`,
                    iconURL: message.author.displayAvatarURL({ format: 'png', dynamic: true }),
                })
                .setDescription(
                    `\`${card.code}\` • \`${card.name}\` • \`${card.series}\` • \`${__v}\` • \`${rarityInitial}\`\n**Card Owner**: <@${cardOwner}>`
                )
                .setImage('attachment://card.png');

            await message.channel.send({
                embeds: [embed],
                files: [{ attachment: finalImageBuffer, name: 'card.png' }]
            });
        } catch (error) {
            console.error(error);
            message.channel.send('An error occurred while processing the request.');
        }
    }
};
