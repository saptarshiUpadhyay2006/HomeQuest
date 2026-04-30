const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/booking.js");
const { isLoggedIn } = require("../middleware.js");

// Get all bookings for the logged-in user
router.get("/", isLoggedIn, bookingController.index);

module.exports = router;
