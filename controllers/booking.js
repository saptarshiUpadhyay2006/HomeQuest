const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports.createBooking = async (req, res) => {
    let { id } = req.params;
    let { checkIn, checkOut } = req.body;

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkOutDate <= checkInDate) {
        req.flash("error", "Check-out date must be after Check-in date.");
        return res.redirect(`/listings/${id}`);
    }

    const timeDifference = Math.abs(checkOutDate - checkInDate);
    const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
    const validDays = daysDifference > 0 ? daysDifference : 1; 
    const totalPrice = validDays * listing.price;

    // Create Razorpay Order
    const options = {
        amount: totalPrice * 100, // amount in the smallest currency unit (paise)
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
    };

    try {
        const order = await instance.orders.create(options);
        
        const newBooking = new Booking({
            listing: listing._id,
            user: req.user._id,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            totalPrice: totalPrice,
            razorpayOrderId: order.id,
            paymentStatus: "pending"
        });

        await newBooking.save();

        res.render("bookings/checkout.ejs", {
            order,
            booking: newBooking,
            listing,
            key_id: process.env.RAZORPAY_KEY_ID,
            user: req.user
        });
    } catch (err) {
        console.log(err);
        req.flash("error", "Payment service failed. Please try again.");
        res.redirect(`/listings/${id}`);
    }
};

module.exports.verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const { bookingId } = req.params;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
        await Booking.findByIdAndUpdate(bookingId, {
            paymentStatus: "paid",
            razorpayPaymentId: razorpay_payment_id
        });
        req.flash("success", "Payment successful! Your stay is booked.");
        res.redirect("/bookings");
    } else {
        await Booking.findByIdAndUpdate(bookingId, { paymentStatus: "failed" });
        req.flash("error", "Payment verification failed.");
        res.redirect("/listings");
    }
};

module.exports.index = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id }).populate("listing").sort({ createdAt: -1 });
    res.render("bookings/index.ejs", { bookings });
};

