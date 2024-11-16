const fs = require('fs');
const path = require('path');
const zlib = require('zlib'); // Para compresión
const { fetchAllInventories } = require('./database/database');

// Usuarios autorizados
const authorizedUserIds = ['346799501878755342', '123864968461287428', '339869018439548938', '300619060729610258', '270681503665618954'];

module.exports = {
    name: 'backup',
    description: 'Creates a backup of the inventory database',
    run: async (message) => {
        try {
            // Verificar autorización
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            // Obtener todos los inventarios
            const inventories = await fetchAllInventories();

            if (!inventories || inventories.length === 0) {
                return await message.channel.send('No inventory data found in the database.');
            }

            // Crear directorio de backups
            const backupDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir);
            }

            // Crear el archivo de respaldo
            const filePath = path.join(backupDir, `inventory_backup_${Date.now()}.json`);
            const fileContent = JSON.stringify(inventories, null, 2);
            fs.writeFileSync(filePath, fileContent);

            // Verificar tamaño del archivo
            const stats = fs.statSync(filePath);
            const maxSize = 8 * 1024 * 1024; // 8 MB

            if (stats.size > maxSize) {
                // Comprimir el archivo
                const compressedPath = `${filePath}.gz`;
                const compressedStream = fs.createWriteStream(compressedPath);
                const gzip = zlib.createGzip();
                const input = fs.createReadStream(filePath);

                input.pipe(gzip).pipe(compressedStream);

                await new Promise(resolve => compressedStream.on('finish', resolve));

                // Verificar el tamaño comprimido
                const compressedStats = fs.statSync(compressedPath);

                if (compressedStats.size > maxSize) {
                    // Dividir en partes si aún es demasiado grande
                    const splitDir = path.join(backupDir, `split_${Date.now()}`);
                    fs.mkdirSync(splitDir);

                    const chunkSize = maxSize; // Dividir en partes de máximo 8 MB
                    let chunkIndex = 0;

                    for (let i = 0; i < fileContent.length; i += chunkSize) {
                        const chunkPath = path.join(splitDir, `inventory_part_${chunkIndex + 1}.json`);
                        fs.writeFileSync(chunkPath, fileContent.slice(i, i + chunkSize));
                        chunkIndex++;
                    }

                    // Enviar las partes
                    const splitFiles = fs.readdirSync(splitDir).map(file => path.join(splitDir, file));

                    await message.channel.send({
                        content: 'The backup was too large. Here are the split parts:',
                        files: splitFiles
                    });

                    // Limpiar archivos temporales
                    splitFiles.forEach(file => fs.unlinkSync(file));
                    fs.rmdirSync(splitDir);
                } else {
                    // Enviar archivo comprimido
                    await message.channel.send({
                        content: 'The backup file was compressed due to size limitations:',
                        files: [compressedPath]
                    });

                    // Eliminar archivo comprimido
                    fs.unlinkSync(compressedPath);
                }
            } else {
                // Enviar archivo original si está dentro del límite
                await message.channel.send({
                    content: 'Here is the backup of the inventory database:',
                    files: [filePath]
                });
            }

            // Eliminar archivo original
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('Error creating backup:', err);
            await message.channel.send('There was an error creating the backup.');
        }
    }
};
