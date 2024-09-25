const { AnimeCharacter, Inventory } = require('./database/database'); // Ajusta el path si es necesario

const updateWishlist = async (userId, characterName, characterSeries) => {
    try {
        const userInventory = await Inventory.findOne({ _id: userId });

        if (!userInventory) {
            throw new Error('User inventory not found.');
        }

        const wishlist = userInventory.wishlist || [];

        // Check if the character is already in the wishlist
        if (!wishlist.some(item => item.name === characterName && item.series === characterSeries)) {
            // Add the character to the user's wishlist
            wishlist.push({ name: characterName, series: characterSeries });
            await Inventory.updateOne({ _id: userId }, { wishlist });

            // Increment the wishlist count for the character in AnimeCharacter
            await AnimeCharacter.updateOne(
                { name: characterName, series: characterSeries },
                { $inc: { wishlist: 1 } }
            );
        }
    } catch (error) {
        console.error('Error updating wishlist:', error);
        throw error;
    }
};

module.exports = { updateWishlist };
