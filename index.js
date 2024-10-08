
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Ignora errores de interacción desconocida
    if (error.code === 10062) {
        console.warn('Ignoring unknown interaction error');
        return;
    }
});

// Aquí comienza el resto de tu código
const { Client, Events,Options  } = require("discord.js");
const mongoose = require('mongoose');
const checkUserMiddleware = require('./commands/utils/middlewarecheckregister');

const client = new Client({
    intents: 53608447,
    makeCache: Options.cacheWithLimits({
        MessageManager: 50, // Limita el caché de mensajes a 50
    }),
    messageCacheLifetime: 60, // Duración de los mensajes en caché en segundos
    messageSweepInterval: 120 // Intervalo para limpiar el caché en segundos
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
            // Verifica si el usuario está registrado antes de procesar el comando
            const isRegistered = await checkUserMiddleware(message);
            if (!isRegistered) continue;

            // Ejecuta el comando
            const command = require(`./commands/${commandName}`);
            await command.run(message, args);

            // Controla la frecuencia con un pequeño retraso
            await new Promise(resolve => setTimeout(resolve, 500)); // Reduce el delay entre comandos a 500ms

        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
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

        // Usar middleware para modo de mantenimiento
        globalMiddleware(message, async () => {
            // Procesar comandos en paralelo utilizando promesas
            commandQueue.push({ message, args, commandName });
            await processQueue(); // Iniciar el procesamiento sin bloquear otros comandos
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
client.login("MTI3MjMwMTk4NTc4OTY0MDg1Nw.G_L-qy.atO4M6nAAgsTW0C8iwAUkAVzKVkyMgJ382G-so")