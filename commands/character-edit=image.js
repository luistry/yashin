const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { editAnimeCharacterImage, AnimeCharacter } = require('./database/database');
const AWS = require('aws-sdk');
const axios = require('axios');

// Authorized user IDs
const authorizedUserIds = [
    '346799501878755342',
    '123864968461287428',
    '339869018439548938',
    '300619060729610258',
    '270681503665618954',
    '955254487629561887',
    '755635893938815067',
    '1133740727151632475'
];
const notificationChannelId = '1284269392330494005';

// Configuración de Digital Ocean Spaces
const spacesEndpoint = new AWS.Endpoint('https://nyc3.digitaloceanspaces.com');
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: 'DO00NMRCRGM8X7MRBAAY',
    secretAccessKey: '0cvxIoWPHGCE94G0UUWw5xe6UXUDe2o903N7AKBLsTg',
    region: 'nyc3' // Asegúrate de que esta región sea correcta
});

const SPACE_NAME = 'yashin'; // El nombre de tu espacio en Digital Ocean

module.exports = {
    name: 'character-edit=image',
    description: 'Edit the image of an existing anime character in the database',
    run: async (message, args) => {
        try {
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            const input = args.join(' ').split(',');
            if (input.length < 3) {
                return await message.channel.send('Please provide the character name, series, and new image URL.');
            }

            const name = input[0].trim();
            const series = input[1].trim();
            const new_img_url = input[2].trim();

            if (!isValidUrl(new_img_url)) {
                return await message.channel.send('The provided image URL is invalid. Please provide a valid URL.');
            }

            const characters = await AnimeCharacter.find({
                name: new RegExp(name, 'i'),
                series: new RegExp(series, 'i')
            }).limit(15);

            if (characters.length === 0) {
                return await message.channel.send(`Character with name "${name}" from the series "${series}" not found.`);
            }

            if (characters.length > 1) {
                // Maneja múltiples personajes si es necesario
            } else {
                const character = characters[0];

                // Verificar si la nueva URL es la misma que la actual
                if (character.img_url === new_img_url) {
                    return await message.channel.send('The new image URL is the same as the current one. Please provide a different URL.');
                }

                await handleCharacterEdit(character, new_img_url, message, notificationChannelId);
            }

        } catch (err) {
            console.error('Error editing character image:', err);
            await message.channel.send('There was an error editing the character image in the database.');
        }
    }
};

async function handleCharacterEdit(character, new_img_url, message, notificationChannelId) {
    const previewEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('Character Image Edit Preview')
        .setDescription(`**Name**: ${character.name}\n**Series**: ${character.series}`)
        .setImage(character.img_url) // Imagen actual
        .addFields({ name: '➔', value: 'New Image', inline: true })
        .setThumbnail(new_img_url) // Nueva imagen
        .setTimestamp();

    const checkoutButton = new ButtonBuilder()
        .setCustomId('checkout')
        .setLabel('Update Image')
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger);

    const messageSent = await message.channel.send({
        embeds: [previewEmbed],
        components: [new ActionRowBuilder().addComponents(checkoutButton, cancelButton)]
    });

    const filter = (interaction) => ['checkout', 'cancel'].includes(interaction.customId) && interaction.user.id === message.author.id;
    const collector = messageSent.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'checkout') {
            try {
                // Generar nombre de archivo con el nombre, la serie y un timestamp para evitar caché
                const timestamp = Date.now();
                const filename = `${character.name.replace(/\s+/g, '_')}-${character.series.replace(/\s+/g, '_')}-${timestamp}.jpg`;

                const uploadedUrl = await uploadImageToDigitalOcean(new_img_url, filename);
                await editAnimeCharacterImage(character.name, character.series, uploadedUrl); // Actualizar con la URL subida

                const confirmationEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Character Image Updated')
                    .setDescription(`**Character**: ${character.name}\n**Series**: ${character.series}`)
                    .addFields({ name: '➔', value: 'Image Updated', inline: true })
                    .setThumbnail(uploadedUrl)
                    .setImage(uploadedUrl)
                    .setTimestamp();

                await messageSent.edit({ embeds: [confirmationEmbed], components: [] });

                const notificationChannel = message.client.channels.cache.get(notificationChannelId);
                if (notificationChannel) {
                    await notificationChannel.send({ embeds: [confirmationEmbed] });
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                await message.channel.send('Failed to upload the image.');
            }
        } else if (interaction.customId === 'cancel') {
            await messageSent.edit({ content: 'Character image update canceled.', components: [] });
        }
    });

    collector.on('end', async () => {
        await messageSent.edit({ components: [] });
    });
}

async function uploadImageToDigitalOcean(imageUrl, filename) {
    try {
        // Obtener la imagen de la URL proporcionada
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer'
        });

        // Preparar los parámetros de subida, con el nombre único para evitar caché
        const uploadParams = {
            Bucket: SPACE_NAME,
            Key: filename,
            Body: response.data,
            ACL: 'public-read', // Mantener acceso público
            ContentType: 'image/jpeg' // Verificar que sea imagen JPEG
        };

        // Subir la imagen y sobrescribir la existente
        const data = await s3.upload(uploadParams).promise();

        // Retornar la URL completa del archivo subido (la misma URL será usada para reemplazar la imagen)
        return `https://yashin.nyc3.cdn.digitaloceanspaces.com/${filename}`;
    } catch (error) {
        console.error('Error uploading image to Digital Ocean:', error);
        throw new Error('Image upload failed.');
    }
}

// Función para validar URLs
function isValidUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.protocol.startsWith('http');
    } catch (_) {
        return false;
    }
}
