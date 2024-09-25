let maintenanceMode = false;
const allowedUserId = '346799501878755342';

module.exports = {
    name: 'maintenance',
    description: 'Activate or deactivate maintenance mode',
    run: async (message, args) => {
        // Solo el usuario autorizado puede activar/desactivar el modo de mantenimiento
        if (message.author.id !== allowedUserId) {
            return message.channel.send('You are not authorized to use this command.');
        }

        if (args[0] === 'active') {
            maintenanceMode = true;
            
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
    if (maintenanceMode && message.author.id !== allowedUserId) {
        await message.channel.send('Maintenance is active, please be patient.');
        return false; // Bloquea la ejecución de comandos
    }
    return true; // Permite continuar con la ejecución si no hay mantenimiento
};
