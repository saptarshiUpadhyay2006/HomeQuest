const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/booking.js");
const { isLoggedIn } = require("../middleware.js");

// Get all bookings for the logged-in user
router.get("/", isLoggedIn, bookingController.index);

// Show a specific booking
router.get("/:bookingId", isLoggedIn, bookingController.showBooking);

// Cancel a specific booking
router.post("/:bookingId/cancel", isLoggedIn, bookingController.cancelBooking);

// Checkout a pending booking
router.get("/:bookingId/checkout", isLoggedIn, bookingController.checkoutBooking);

// Download receipt for a paid booking
router.get("/:bookingId/receipt", isLoggedIn, bookingController.generateReceipt);

module.exports = router;
