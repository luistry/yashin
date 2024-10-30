const AWS = require('aws-sdk');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { fetchInventory } = require('./database/database'); // Ajusta la ruta según sea necesario

// Configuración de DigitalOcean Spaces
const SPACE_NAME = 'yashin';
const BASE_URL = 'https://yashin.nyc3.cdn.digitaloceanspaces.com/'; // Cambia esto a tu base URL

module.exports = {
    description: "Show user's profile with banner",
    run: async (message) => {
        try {
            const target = message.mentions.users.first() || message.author;
            if (!target) {
                return message.reply("User not found.");
            }

            const inventory = await fetchInventory(target.id);
            if (!inventory || !inventory.Profile) {
                return message.reply('No profile found for the user.');
            }

            const bannerObj = inventory.Profile.find(item => item.type === 'banner');
            const titleObj = inventory.Profile.find(item => item.type === 'title');

            // URL del banner y título
            const bannerKey = bannerObj ? decodeURIComponent(bannerObj.image.split('/').pop()) : 'banner%20default.jpg';
            const titleKey = titleObj ? decodeURIComponent(titleObj.image.split('/').pop()) : null;

            // Usar URLs directas
            const backgroundURL = bannerObj ? `${BASE_URL}banners/${bannerKey}` : 'https://banners-yashin.b-cdn.digitaloceanspaces.com/banner%20default.jpg';
            const titleURL = titleObj ? `${BASE_URL}titles/${titleKey}` : null;

            // Mostrar las URLs generadas
            console.log('Background URL:', backgroundURL);
            console.log('Title URL:', titleURL);

            const canvas = createCanvas(800, 400);
            const context = canvas.getContext('2d');

            // Intentar cargar el banner
            try {
                const background = await loadImage(backgroundURL);
                context.drawImage(background, 0, 0, canvas.width, canvas.height);
            } catch (bgError) {
                console.error('Error loading background image:', bgError);
                return message.reply('The banner image format is unsupported. Please use a PNG or JPEG image.');
            }

            // Cargar la imagen de avatar
            const avatarURL = target.displayAvatarURL({ extension: 'png', size: 128 });
            const avatarImage = await loadImage(avatarURL);
            const avatarX = canvas.width / 2 - 50;
            const avatarY = 100;
            const avatarRadius = 50;
            context.save();
            context.beginPath();
            context.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
            context.clip();
            context.drawImage(avatarImage, avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
            context.restore();

            // Color de nombre de usuario
            let usernameColor = '#ffffff'; // Color por defecto
            const bannerName = bannerObj ? bannerObj.name : '';
            const colorMap = {
                'Gojo Satoru Banner': '#828282',
                'Naruto Banner': '#ff9900',
                'Sukuna Banner': '#ff3333',
                'King Of Pirates Banner': '#ffff33',
                'The Hero #1 banner': '#00ccff',
                'White Demon Banner': '#000000',
                'Soul Reaper Banner': '#000000',
                'Vasto Lorde banner': '#ffcc00',
                'Pillar of Love banner': '#ff66ff',
                'Demon Slayer': '#009900',
                'The Traveler': '#ffffff',
                'The God Of Contracts': '#ffffff'
            };
            usernameColor = colorMap[bannerName] || usernameColor;

            context.font = '30px Arial';
            context.fillStyle = usernameColor;
            context.textAlign = 'center';
            context.fillText(target.username, canvas.width / 2, avatarY + avatarRadius * 2 + 30);

            // Intentar cargar la imagen del título
            if (titleURL) {
                try {
                    const titleImage = await loadImage(titleURL);
                    const titleX = canvas.width / 2 - titleImage.width / 2;
                    const titleY = avatarY + avatarRadius * 2 + 60;
                    context.drawImage(titleImage, titleX, titleY);
                } catch (titleError) {
                    console.error('Error loading title image:', titleError);
                }
            }

            const attachment = canvas.toBuffer('image/png');
            message.reply({ files: [{ attachment, name: 'profile-image.png' }] });
        } catch (error) {
            console.error('Error generating profile image:', error);
            message.reply('There was an error generating the profile image.');
        }
    }
};
