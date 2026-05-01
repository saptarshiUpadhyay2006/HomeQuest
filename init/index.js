const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const path = require("path");
require('dotenv').config({ path: path.join(__dirname, "../.env") });

const dbUrl = process.env.ATLASDB_URL;

main().then(() => {
    console.log("connected to DB");
    initDB();
})
    .catch((err) => {
        console.log(err);
    })

async function main() {
    await mongoose.connect(dbUrl);
}

const mbxGeoCoding = require('@mapbox/mapbox-sdk/services/geocoding');
const geocodingClient = mbxGeoCoding({ accessToken: process.env.MAP_TOKEN });

const initDB = async () => {
    await Listing.deleteMany({});
    
    // Geocode each listing one by one
    const updatedData = [];
    for (let obj of initData.data) {
        let response = await geocodingClient.forwardGeocode({
            query: `${obj.location}, ${obj.country}`,
            limit: 1
        }).send();

        let coordinates = [0, 0];
        if (response.body.features.length > 0) {
            coordinates = response.body.features[0].geometry.coordinates;
        }

        const allAmenities = ["Wifi", "Pool", "AC", "Kitchen", "Parking", "Gym", "TV", "Workspace"];
        const randomAmenities = allAmenities
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.floor(Math.random() * 4) + 2);

        updatedData.push({
            ...obj,
            owner: "69f2df3847322f84ee1c117c",
            geometry: {
                type: "Point",
                coordinates: coordinates
            },
            amenities: randomAmenities
        });
    }

    await Listing.insertMany(updatedData);
    console.log("data was initialized with real coordinates");
}