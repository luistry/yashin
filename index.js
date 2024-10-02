const { Client, Events, GatewayIntentBits } = require("discord.js");
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');
const checkUserMiddleware = require('./commands/utils/middlewarecheckregister');

// Configurar los intents que realmente necesitas para reducir la carga innecesaria
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        // Elimina GatewayIntentBits.GuildMembers si no es necesario
    ]
});

const prefix = "y!";
const allowedUserId = '346799501878755342';
let maintenanceMode = false; // Variable para el modo de mantenimiento

// Command queue
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

client.once("ready", () => {
    console.log(`${client.user.tag} is online!`);

    // Verifica que el prefijo esté definido
    if (typeof prefix === 'undefined') {
        console.error('Prefix is not defined.');
        return;
    }

    // Establece el estado del bot
    client.user.setActivity(`Use ${prefix}help.`);
});

// Manejo de errores globales
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

// Función para procesar la cola de comandos
const processQueue = async () => {
    if (isProcessingQueue || commandQueue.length === 0) return;

    isProcessingQueue = true;

    while (commandQueue.length > 0) {
        const { message, args, commandName } = commandQueue.shift();

        try {
            // Check if the user is registered
            const isRegistered = await checkUserMiddleware(message);
            if (!isRegistered) continue;

            // Load and execute the command dynamically
            const command = require(`./commands/${commandName}`);
            await command.run(message, args);
        } catch (error) {
            console.error(`Error executing the command ${commandName}:`, error);
            await message.reply("An error occurred while trying to execute the command!");
        }

        // Pausa entre la ejecución de comandos
        await new Promise(resolve => setTimeout(resolve, 50)); // Ajusta el tiempo según sea necesario
    }

    isProcessingQueue = false;
};

// Middleware global para modo de mantenimiento
const globalMiddleware = async (message, next) => {
    if (maintenanceMode && message.author.id !== allowedUserId) {
        await message.reply('Maintenance is active, please be patient.');
        return; // Bloquea la ejecución del comando
    }
    await next(); // Continúa ejecutando el comando si no está en mantenimiento o si es el usuario autorizado
};

// Manejo de mensajes para comandos y mantenimiento en un solo listener
client.on(Events.MessageCreate, async (message) => {
    try {
        // Ignorar mensajes de bots o sin el prefijo correcto
        if (message.author.bot || !message.content.toLowerCase().startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Comando de mantenimiento, solo autorizado para el usuario permitido
        if (message.author.id === allowedUserId && commandName === 'maintenance') {
            if (args[0] === 'active') {
                maintenanceMode = true;
                return message.channel.send('Maintenance mode is now **active**. Only authorized users can execute commands.');
            } else if (args[0] === 'inactive') {
                maintenanceMode = false;
                return message.channel.send('Maintenance mode is now **inactive**. Everyone can use commands again.');
            } else {
                return message.channel.send('Please specify either active or inactive.');
            }
        }

        // Aplicar middleware global de mantenimiento
        await globalMiddleware(message, () => {
            // Añadir el comando a la cola
            commandQueue.push({ message, args, commandName });
            processQueue(); // Procesar la cola de comandos
        });

    } catch (error) {
        console.error('Error handling message:', error);
        await message.reply('An error occurred while processing your message.');
    }
});
client.login("MTI3MjMwMTk4NTc4OTY0MDg1Nw.Gb2FwH.XS4XcHUkKddYTvRNuXcjQElcgicGepf2lXayao")