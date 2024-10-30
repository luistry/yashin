const { Client, Events, Options } = require("discord.js");
const mongoose = require('mongoose');
const fs = require('fs');
const { Prefix } = require('./commands/database/database'); // Modelo de prefijos personalizado
const checkUserMiddleware = require('./commands/utils/middlewarecheckregister');

const client = new Client({
    intents: 53608447,
    makeCache: Options.cacheWithLimits({
        MessageManager: 50, // Limitar caché de mensajes a 50
    }),
    messageCacheLifetime: 60, // Duración del caché de mensajes en segundos
    messageSweepInterval: 120 // Intervalo de limpieza de caché en segundos
});

const allowedUserId = ['346799501878755342','339869018439548938','123864968461287428','300619060729610258','270681503665618954'];
let maintenanceMode = false;
const commandQueue = [];
let isProcessingQueue = false;

// MongoDB connection
const mongoURI = 'mongodb+srv://Yashin:sheismylovemuch@Yashin.ronvl.mongodb.net/?retryWrites=true&w=majority';

const connectDB = async () => {
    try {
        await mongoose.connect(mongoURI);
        console.log('MongoDB connected...');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

connectDB();

// Cargar lista de usuarios baneados
const bannedUsersFile = './bannedUsers.json';
let bannedUsers = [];
if (fs.existsSync(bannedUsersFile)) {
    bannedUsers = JSON.parse(fs.readFileSync(bannedUsersFile));
}

client.once("ready", () => {
    console.log(`${client.user.tag} is online!`);
    client.user.setActivity(`Use y!help.`);
});

// Obtener prefijo de la base de datos o usar prefijo predeterminado
const getPrefix = async (guildId) => {
    const prefixData = await Prefix.findOne({ guildId });
    return prefixData ? prefixData.prefix : 'y!'; // Usa 'y!' como predeterminado
};

const processQueue = async () => {
    if (isProcessingQueue || commandQueue.length === 0) return;

    isProcessingQueue = true;

    while (commandQueue.length > 0) {
        const { message, args, commandName } = commandQueue.shift();

        try {
            if (bannedUsers.includes(message.author.id)) {
                await message.reply('You are banned from using this bot.');
                continue;
            }

            const isRegistered = await checkUserMiddleware(message);
            if (!isRegistered) continue;

            const command = require(`./commands/${commandName}`);
            await command.run(message, args);

            await new Promise(resolve => setTimeout(resolve, 500)); // Control de frecuencia

        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
            message.reply("An error occurred while trying to execute the command!");
        }
    }

    isProcessingQueue = false;
};

const globalMiddleware = async (message, next) => {
    if (maintenanceMode && !allowedUserId.includes(message.author.id)) {
        await message.reply('Maintenance is active, please be patient.');
        return;
    }
    next();
};

// Manejo de mensajes para comandos
client.on(Events.MessageCreate, async (message) => {
    try {
        if (message.author.bot) return;

        // Obtener prefijo específico para el servidor
        const prefix = await getPrefix(message.guild.id);

        if (!message.content.toLowerCase().startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        await globalMiddleware(message, async () => {
            commandQueue.push({ message, args, commandName });
            await processQueue();
        });

    } catch (error) {
        console.error('Error handling message:', error);
        message.reply('An error occurred while processing your message.');
    }
});

// Comando para activar/desactivar el modo de mantenimiento
client.on(Events.MessageCreate, async (message) => {
    try {
        if (!allowedUserId.includes(message.author.id)) return;

        const prefix = await getPrefix(message.guild.id);
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (commandName === 'maintenance') {
            if (args[0] === 'active') {
                maintenanceMode = true;
                await message.channel.send('Maintenance mode is now **active**. Only authorized users can execute commands.');
            } else if (args[0] === 'inactive') {
                maintenanceMode = false;
                await message.channel.send('Maintenance mode is now **inactive**. Everyone can use commands again.');
            } else {
                await message.channel.send('Please specify either `active` or `inactive`.');
            }
        }
    } catch (error) {
        console.error('Error handling maintenance command:', error);
        message.reply('An error occurred while trying to toggle maintenance mode.');
    }
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (error.code === 10062) {
        console.warn('Ignoring unknown interaction error');
        return;
    }
});
client.login("MTI3MjMwMTk4NTc4OTY0MDg1Nw.G_L-qy.atO4M6nAAgsTW0C8iwAUkAVzKVkyMgJ382G-so")