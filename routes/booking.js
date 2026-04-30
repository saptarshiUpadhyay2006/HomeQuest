const express = require("express");
const router = express.Router({ mergeParams: true });
const bookingController = require("../controllers/booking.js");
const { isLoggedIn } = require("../middleware.js");

// Create a new booking
router.post("/", isLoggedIn, bookingController.createBooking);

module.exports = router;
