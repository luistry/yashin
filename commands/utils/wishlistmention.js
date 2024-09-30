const { fetchWishlist } = require('../database/database'); // Adjust the path as needed

async function wishlistMention(updatedCharacters, channel) {
    try {
        let wishlistMentions = [];

        // Iterate through the characters and check for wishlist matches
        for (const char of updatedCharacters) {
            console.log(`Checking character: ${char.name} from series: ${char.series}`); // Log character being checked
            
            // Fetch wishlists that match the character name and channel
            const matchedWishlists = await fetchWishlist(char.name, channel.id);

            // Log the fetched wishlists for debugging
            console.log('Fetched matched wishlists:', matchedWishlists);

            // Iterate over matched wishlists
            matchedWishlists.forEach(userInventory => {
                const { userId, username } = userInventory; // Destructure userId and username

                console.log(`Match found! Mentioning user: ${username} with ID: ${userId}`); // Log when a match is found
                wishlistMentions.push(`<@${userId}>`); // Mention the user if there's a match
            });
        }

        // If there are users to mention, send the message
        if (wishlistMentions.length > 0) {
            await channel.send({
                content: `A card from your wishlist is dropping! ${wishlistMentions.join(', ')}`,
            });
        } else {
            console.log('No wishlist matches found.'); // Log if no matches found
        }
    } catch (error) {
        console.error('Error in wishlistMention function:', error);
    }
}

module.exports = { wishlistMention };
