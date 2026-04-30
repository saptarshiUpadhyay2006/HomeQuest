const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");

module.exports.createBooking = async (req, res) => {
    let { id } = req.params;
    let { checkIn, checkOut } = req.body;

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    // Server-side validation of dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkOutDate <= checkInDate) {
        req.flash("error", "Check-out date must be after Check-in date.");
        return res.redirect(`/listings/${id}`);
    }

    // Calculate total price server-side for security
    const timeDifference = Math.abs(checkOutDate - checkInDate);
    const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
    
    // Prevent booking for 0 days if somehow submitted
    const validDays = daysDifference > 0 ? daysDifference : 1; 
    const totalPrice = validDays * listing.price;

    const newBooking = new Booking({
        listing: listing._id,
        user: req.user._id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalPrice: totalPrice
    });

    await newBooking.save();

    req.flash("success", "Successfully booked your stay!");
    res.redirect("/bookings");
};

module.exports.index = async (req, res) => {
    // Populate the listing so we can show its details (title, image, location)
    const bookings = await Booking.find({ user: req.user._id }).populate("listing").sort({ createdAt: -1 });
    res.render("bookings/index.ejs", { bookings });
};
