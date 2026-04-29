const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
require("dotenv").config();

const dbUrl = process.env.ATLASDB_URL;

const categories = ["Trending", "Rooms", "Iconic Cities", "Mountains", "Castles", "Amazing pools", "Camping", "Farms", "Arctic", "Domes", "Cruise"];

async function main() {
  await mongoose.connect(dbUrl);
  console.log("Connected to DB");

  const listings = await Listing.find({});
  console.log(`Found ${listings.length} listings. Backfilling categories...`);

  let count = 0;
  for (let listing of listings) {
    if (!listing.category || !categories.includes(listing.category)) {
      // Assign a random category
      listing.category = categories[Math.floor(Math.random() * categories.length)];
      await listing.save();
      count++;
    }
  }

  console.log(`Successfully updated ${count} listings with a category.`);
  mongoose.connection.close();
}

main().catch(err => {
  console.log(err);
  mongoose.connection.close();
});
