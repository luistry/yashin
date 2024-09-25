const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { fetchInventory } = require('./database/database'); // Adjust the path

module.exports = {
    description: "Show user's profile with banner",
    run: async (message) => {
        try {
            // Obtener el usuario mencionado o el autor del mensaje
            const target = message.mentions.users.first() || message.author;
            if (!target) {
                return message.reply("User not found.");
            }

            // Obtener el inventario del usuario
            const inventory = await fetchInventory(target.id);
            if (!inventory || !inventory.Profile) {
                return message.reply('No profile found for the user.');
            }

            // Desestructurar los objetos de banner y título del array Profile
            const bannerObj = inventory.Profile.find(item => item.type === 'banner');
            const titleObj = inventory.Profile.find(item => item.type === 'title');

            // Verificar si existen el banner y el título
            const backgroundURL = bannerObj ? bannerObj.image : 'https://banners-yashin.b-cdn.net/banner%20default.jpg';
            const titleURL = titleObj ? titleObj.image : null;

            // Crear el canvas
            const canvas = createCanvas(800, 400);
            const context = canvas.getContext('2d');

            // Cargar la imagen de fondo (banner)
            const background = await loadImage(backgroundURL);
            context.drawImage(background, 0, 0, canvas.width, canvas.height);

            // Cargar la imagen de avatar del usuario
            const avatarURL = target.displayAvatarURL({ extension: 'png', size: 128 });
            const avatarImage = await loadImage(avatarURL);

            // Dibujar el avatar en el canvas
            const avatarX = canvas.width / 2 - 50;
            const avatarY = 100;
            const avatarRadius = 50;
            context.save();
            context.beginPath();
            context.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
            context.clip();
            context.drawImage(avatarImage, avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
            context.restore();

            // Switch para los colores basados en el banner
            let usernameColor;
            switch (bannerObj ? bannerObj.name : '') {
                case 'Gojo Satoru Banner':
                    usernameColor = '#828282 '; // Blanco
                    break;
                case 'Naruto Banner':
                    usernameColor = '#ff9900'; // Naranja Naruto
                    break;
                case 'Sukuna Banner':
                    usernameColor = '#ff3333'; // Rojo Sukuna
                    break;
                case 'King Of Pirates Banner':
                    usernameColor = '#ffff33'; // Amarillo
                    break;
                case 'The Hero #1 banner':
                    usernameColor = '#00ccff'; // Azul
                    break;
                case 'White Demon Banner':
                    usernameColor = '#000000'; // Blanco grisáceo
                    break;
                case 'Soul Reaper Banner':
                    usernameColor = '#000000'; // Púrpura oscuro
                    break;
                case 'Vasto Lorde banner':
                    usernameColor = '#ffcc00'; // Dorado
                    break;
                case 'Pillar of Love banner':
                    usernameColor = '#ff66ff'; // Rosa
                    break;
                case 'Demon Slayer':
                    usernameColor = '#009900'; // Verde oscuro
                    break;
                case 'The Traveler':
                    usernameColor = '#ffffff'; // Azul claro
                    break;
                case 'The God Of Contracts':
                    usernameColor = '#ffffff'; // Marrón
                    break;
                default:
                    usernameColor = '#ffffff'; // Color por defecto (blanco)
                    break;
            }

            // Dibujar el nombre de usuario
            context.font = '30px Arial';
            context.fillStyle = usernameColor;
            context.textAlign = 'center';
            context.fillText(target.username, canvas.width / 2, avatarY + avatarRadius * 2 + 30);

            // Dibujar el título si existe
            if (titleURL) {
                const titleImage = await loadImage(titleURL);
                const titleX = canvas.width / 2 - titleImage.width / 2;
                const titleY = avatarY + avatarRadius * 2 + 60;
                context.drawImage(titleImage, titleX, titleY);
            }

            // Enviar la imagen generada
            const attachment = canvas.toBuffer('image/png');
            message.reply({ files: [{ attachment, name: 'profile-image.png' }] });
        } catch (error) {
            console.error('Error generating profile image:', error);
            message.reply('There was an error generating the profile image.');
        }
    }
};
