// Manejo de errores globales
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    // Puedes ignorar ciertos errores
    if (reason.code === 10062) {
        console.warn('Ignoring unknown interaction error');
        return;
    }
    // Maneja otros errores críticos
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Ignora errores de interacción desconocida
    if (error.code === 10062) {
        console.warn('Ignoring unknown interaction error');
        return;
    }
});

// Aquí comienza el resto de tu código
const { Client, Events } = require("discord.js");
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');
const checkUserMiddleware = require('./commands/utils/middlewarecheckregister');
const client = new Client({
    intents: 53608447
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

            // Add a short delay before processing the next command to prevent spam
            await new Promise(resolve => setTimeout(resolve, 1000)); 

        } catch (error) {
            console.error(`Could not load the command ${commandName}:`, error);
            message.reply("An error occurred while trying to execute the command!");
        }
    }

    isProcessingQueue = false;
};

// Middleware global para modo de mantenimiento
const globalMiddleware = async (message, next) => {
    if (maintenanceMode && message.author.id !== allowedUserId) {
        await message.reply('Maintenance is active, please be patient.');
        return; // Bloquea la ejecución del comando
    }
    next(); // Continúa ejecutando el comando si no está en mantenimiento o si es el usuario autorizado
};

// Manejo de mensajes para comandos
client.on(Events.MessageCreate, async (message) => {
    try {
        if (message.author.bot || !message.content.toLowerCase().startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Agrega el middleware antes de procesar cualquier comando
        globalMiddleware(message, () => {
            // Añadir el comando a la cola
            commandQueue.push({ message, args, commandName });

            // Iniciar procesamiento de la cola
            processQueue();
        });

    } catch (error) {
        console.error('Error handling message:', error);
        message.reply('An error occurred while processing your message.');
    }
});

// Comando para activar/desactivar el modo de mantenimiento
client.on(Events.MessageCreate, async (message) => {
    try {
        if (message.author.id !== allowedUserId) return;

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


client.login("MTI3MjMwMTk4NTc4OTY0MDg1Nw.Gb2FwH.XS4XcHUkKddYTvRNuXcjQElcgicGepf2lXayao")