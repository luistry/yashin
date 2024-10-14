let maintenanceMode = false;
const allowedUserIds = ['346799501878755342', '339869018439548938', '123864968461287428', '300619060729610258', '270681503665618954'];

module.exports = {
    name: 'maintenance',
    description: 'Activate or deactivate maintenance mode',
    run: async (message, args) => {
        // Solo los usuarios autorizados pueden activar/desactivar el modo de mantenimiento
        if (!allowedUserIds.includes(message.author.id)) {
            return message.channel.send('You are not authorized to use this command.');
        }

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
};

// Middleware para bloquear todos los comandos durante el mantenimiento
module.exports.globalMiddleware = async (message) => {
    if (maintenanceMode && !allowedUserIds.includes(message.author.id)) {
        await message.channel.send('Maintenance is active, please be patient.');
        return false; // Bloquea la ejecución de comandos
    }
    return true; // Permite continuar con la ejecución si no hay mantenimiento o si es un usuario autorizado
};
