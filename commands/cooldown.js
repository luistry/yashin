const { EmbedBuilder, Colors } = require('discord.js');
const { fetchLastDrop, fetchLastDaily, updateLastDrop,fetchLastGrab,consumeItems } = require('./database/database'); // Ajusta el path si es necesario

// Configura los tiempos de cooldown en milisegundos
const COOLDOWNS = {
    grab: 10 * 60 * 1000, // 10 minutos
    drop: 20 * 60 * 1000, // 20 minutos
    vote: 12 * 60 * 60 * 1000, // 12 horas
    daily: 24 * 60 * 60 * 1000, // 24 horas
};

// Mapa para almacenar los tiempos de cooldown para comandos no persistentes como 'vote'
const cooldowns = new Map();

// Formatear el tiempo de cooldown restante
function formatCooldown(cooldownType, lastUsed) {
    const now = Date.now();
    const cooldownAmount = COOLDOWNS[cooldownType];
    const timeLeft = cooldownAmount - (now - lastUsed);

    if (timeLeft > 0) {
        // Mostrar tiempo restante en minutos para comandos en cooldown
        const minutesLeft = Math.floor(timeLeft / (60 * 1000));
        const hoursLeft = Math.floor(minutesLeft / 60);
        return `${hoursLeft > 0 ? hoursLeft + 'h ' : ''}${minutesLeft % 60}m`;
    } else {
        // Mostrar 'Available' si el comando está listo para usarse
        return 'Available';
    }
}

module.exports = {
    name: "cooldown",
    description: "Show cooldowns for commands",
    run: async (message) => {
        const userId = message.author.id;

        // Fetch the last daily and drop times from the database
        let lastDaily, lastDrop;
        try {
            lastDaily = await fetchLastDaily(userId) || 0;
            lastDrop = await fetchLastDrop(userId) || 0;
            lastgrab = await fetchLastGrab(userId) || 0;
        } catch (err) {
            console.error('Error fetching cooldowns:', err);
            return message.reply('There was an error checking your cooldowns.');
        }

        // Verificar el estado de cooldown para cada comando
        const cooldownStates = {
            Drop: {
                lastUsed: lastDrop,
                cooldownType: 'drop'
            },
            Grab: {
                lastUsed: lastgrab,
                cooldownType: 'grab'
            },
           
            Daily: {
                lastUsed: lastDaily,
                cooldownType: 'daily'
            }
        };

        // Crear el embed
        const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('Cooldowns')
            .setTimestamp();

        // Añadir los tiempos de cooldown al embed
        const fields = Object.entries(cooldownStates).map(([command, { lastUsed, cooldownType }]) => {
            const now = Date.now();
            const cooldownAmount = COOLDOWNS[cooldownType];
            const timeLeft = cooldownAmount - (now - lastUsed);

            let statusText;
            if (timeLeft > 0) {
                // Mostrar tiempo restante en minutos
                const minutesLeft = Math.floor(timeLeft / (60 * 1000));
                const hoursLeft = Math.floor(minutesLeft / 60);
                statusText = `${hoursLeft > 0 ? hoursLeft + 'h ' : ''}${minutesLeft % 60}m`;
            } else {
                statusText = 'Available';
            }

            const statusIcon = statusText === 'Available' ? ':bell:' : ':no_bell:';

            return {
                name: command,
                value: `${statusIcon} ${statusText}`,
                inline: true
            };
        });

        embed.addFields(fields);

        // Enviar el embed al canal
        message.reply({ embeds: [embed] });
    }
};
