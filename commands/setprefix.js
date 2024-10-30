const { Prefix } = require('./database/database'); // Importa el modelo Prefix

module.exports = {
    name: 'setprefix',
    description: 'Sets a custom prefix for the server.',
    async run(message, args) {
        // Verificar permisos de administrador
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.channel.send('You need to be an administrator to set the prefix.');
        }

        // Verificar que se haya proporcionado un prefijo
        const newPrefix = args[0];
        if (!newPrefix) {
            return message.channel.send('Please provide a new prefix to set.');
        }

        // Obtener el ID del servidor (guildId)
        const guildId = message.guild.id;

        try {
            // Verificar si ya existe un prefijo para este servidor
            let prefixData = await Prefix.findOne({ guildId });

            if (prefixData) {
                // Si existe, actualizarlo
                prefixData.prefix = newPrefix;
                await prefixData.save();
            } else {
                // Si no existe, crear uno nuevo
                prefixData = new Prefix({
                    guildId,
                    prefix: newPrefix
                });
                await prefixData.save();
            }

            message.channel.send(`The prefix has been set to: ${newPrefix}`);
        } catch (error) {
            console.error('Error setting prefix:', error);
            message.channel.send('An error occurred while setting the prefix.');
        }
    }
};
