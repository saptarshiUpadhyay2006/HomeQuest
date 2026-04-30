const express = require("express");
const router = express.Router({ mergeParams: true });
const bookingController = require("../controllers/booking.js");
const { isLoggedIn } = require("../middleware.js");

// Create a new booking (starts payment process)
router.post("/", isLoggedIn, bookingController.createBooking);

// Verify payment
router.post("/verify/:bookingId", isLoggedIn, bookingController.verifyPayment);

module.exports = router;
