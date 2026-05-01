const mongoose = require('mongoose');
const Listing = require('../models/listing');
require('dotenv').config();

async function findListing() {
    await mongoose.connect(process.env.ATLASDB_URL);
    const listing = await Listing.findOne();
    if (listing) {
        console.log('ID:' + listing._id);
    } else {
        console.log('No listings found');
    }
    mongoose.connection.close();
}

findListing();
