process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Ignore unknown interaction errors
    if (error.code === 10062) {
        console.warn('Ignoring unknown interaction error');
        return;
    }
});

// Here begins the rest of your code
const fs = require('fs');
const { Client, Events, Options } = require("discord.js");
const mongoose = require('mongoose');
const checkUserMiddleware = require('./commands/utils/middlewarecheckregister');

const client = new Client({
    intents: 53608447,
    makeCache: Options.cacheWithLimits({
        MessageManager: 50, // Limits message cache to 50
    }),
    messageCacheLifetime: 60, // Duration of message cache in seconds
    messageSweepInterval: 120 // Interval for cleaning cache in seconds
});

const prefix = "y!";
const allowedUserId = ['346799501878755342','339869018439548938','123864968461287428','300619060729610258','270681503665618954']
let maintenanceMode = false; // Variable for maintenance mode
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

// Load the list of banned users
const bannedUsersFile = './bannedUsers.json';
let bannedUsers = [];
if (fs.existsSync(bannedUsersFile)) {
    bannedUsers = JSON.parse(fs.readFileSync(bannedUsersFile));
}

client.once("ready", () => {
    console.log(`${client.user.tag} is online!`);
    
    // Verify that the prefix is defined
    if (typeof prefix === 'undefined') {
        console.error('Prefix is not defined.');
        return;
    }

    // Set bot's status
    client.user.setActivity(`Use ${prefix}help.`);
});

const processQueue = async () => {
    if (isProcessingQueue || commandQueue.length === 0) return;

    isProcessingQueue = true;

    while (commandQueue.length > 0) {
        const { message, args, commandName } = commandQueue.shift();

        try {
            // Check if the user is banned
            if (bannedUsers.includes(message.author.id)) {
                await message.reply('You are banned from using this bot.'); // Ensure this is awaited
                continue; // Skip processing this command
            }

            // Check if the user is registered before processing the command
            const isRegistered = await checkUserMiddleware(message);
            if (!isRegistered) continue;

            // Execute the command
            const command = require(`./commands/${commandName}`);
            await command.run(message, args);

            // Control frequency with a small delay
            await new Promise(resolve => setTimeout(resolve, 500)); // Reduce delay between commands to 500ms

        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
            message.reply("An error occurred while trying to execute the command!");
        }
    }

    isProcessingQueue = false;
};

// Middleware global for maintenance mode
const globalMiddleware = async (message, next) => {
    if (maintenanceMode && !allowedUserId.includes(message.author.id)) {
        await message.reply('Maintenance is active, please be patient.');
        return; // Bloquea la ejecución del comando si no es un usuario autorizado
    }
    next(); // Continúa con la ejecución del comando si no hay mantenimiento o si es un usuario autorizado
};
// Message handling for commands
client.on(Events.MessageCreate, async (message) => {
    try {
        if (message.author.bot || !message.content.toLowerCase().startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Use middleware for maintenance mode
        await globalMiddleware(message, async () => {
            // Process commands in parallel using promises
            commandQueue.push({ message, args, commandName });
            await processQueue(); // Start processing without blocking other commands
        });

    } catch (error) {
        console.error('Error handling message:', error);
        message.reply('An error occurred while processing your message.');
    }
});

// Command to toggle maintenance mode
client.on(Events.MessageCreate, async (message) => {
    try {
        // Verificar si el ID del usuario está en el array de usuarios permitidos
        if (!allowedUserId.includes(message.author.id)) return;

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