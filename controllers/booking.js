const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

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
        res.redirect(`/bookings/${bookingId}`);
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

module.exports.showBooking = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing").populate("user");
    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/bookings");
    }
    // Security check: only the owner of the booking can view it
    if (!booking.user._id.equals(req.user._id)) {
        req.flash("error", "You don't have permission to view this booking.");
        return res.redirect("/bookings");
    }
    res.render("bookings/show.ejs", { booking });
};

module.exports.cancelBooking = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/bookings");
    }

    // Security check: only the owner of the booking can cancel it
    if (!booking.user.equals(req.user._id)) {
        req.flash("error", "You don't have permission to cancel this booking.");
        return res.redirect("/bookings");
    }

    booking.paymentStatus = "cancelled";
    await booking.save();

    req.flash("success", "Booking cancelled successfully.");
    res.redirect(`/bookings/${bookingId}`);
};

module.exports.checkoutBooking = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing");
    
    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/bookings");
    }

    if (!booking.user.equals(req.user._id)) {
        req.flash("error", "You don't have permission to checkout this booking.");
        return res.redirect("/bookings");
    }

    if (booking.paymentStatus !== "pending") {
        req.flash("error", "This booking is already processed.");
        return res.redirect(`/bookings/${bookingId}`);
    }

    // Create a new Razorpay Order
    const options = {
        amount: booking.totalPrice * 100,
        currency: "INR",
        receipt: `receipt_${booking._id}`,
    };

    try {
        const order = await instance.orders.create(options);
        booking.razorpayOrderId = order.id;
        await booking.save();

        res.render("bookings/checkout.ejs", {
            order,
            booking,
            listing: booking.listing,
            key_id: process.env.RAZORPAY_KEY_ID,
            user: req.user
        });
    } catch (err) {
        console.log(err);
        req.flash("error", "Payment service failed. Please try again.");
        res.redirect(`/bookings/${bookingId}`);
    }
};

module.exports.generateReceipt = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing").populate("user");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/bookings");
    }

    if (!booking.user._id.equals(req.user._id)) {
        req.flash("error", "You don't have permission to download this receipt.");
        return res.redirect("/bookings");
    }

    if (booking.paymentStatus !== "paid") {
        req.flash("error", "Receipt is only available for successful payments.");
        return res.redirect(`/bookings/${bookingId}`);
    }

    const doc = new PDFDocument({ margin: 50 });
    const filename = `Receipt_${bookingId}.pdf`;

    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Header
    doc.fillColor("#fe424d").fontSize(25).text("HomeQuest", { align: "right" });
    doc.fillColor("#444444").fontSize(10).text("Luxury Living, Everywhere.", { align: "right" });
    doc.moveDown();

    // Invoice Info
    doc.fillColor("#000000").fontSize(20).text("Booking Receipt", 50, 100);
    doc.fontSize(10).text(`Booking ID: ${booking._id}`, 50, 130);
    doc.text(`Date of Issue: ${new Date().toLocaleDateString()}`, 50, 145);
    doc.moveDown();

    // Line
    doc.moveTo(50, 170).lineTo(550, 170).stroke();

    // Guest & Property Info
    doc.fontSize(12).text("Guest Details", 50, 190, { underline: true });
    doc.fontSize(10).text(`Name: ${booking.user.username}`, 50, 210);
    doc.text(`Email: ${booking.user.email}`, 50, 225);

    doc.fontSize(12).text("Property Details", 300, 190, { underline: true });
    doc.fontSize(10).text(booking.listing.title, 300, 210);
    doc.text(`${booking.listing.location}, ${booking.listing.country}`, 300, 225);
    doc.moveDown();

    // Booking Details Table Header
    doc.rect(50, 260, 500, 20).fill("#f5f5f5").stroke("#f5f5f5");
    doc.fillColor("#000000").fontSize(10).text("Stay Dates", 60, 265);
    doc.text("Description", 200, 265);
    doc.text("Amount", 480, 265);

    // Table Content
    const checkIn = booking.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const checkOut = booking.checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.text(`${checkIn} - ${checkOut}`, 60, 290);
    doc.text(`Accommodation at ${booking.listing.title}`, 200, 290);
    doc.text(`INR ${booking.totalPrice.toLocaleString("en-IN")}`, 480, 290);

    // Total
    doc.moveTo(50, 320).lineTo(550, 320).stroke();
    doc.fontSize(15).text("Total Paid:", 350, 340);
    doc.fontSize(15).text(`INR ${booking.totalPrice.toLocaleString("en-IN")}`, 480, 340, { align: "right" });

    // Payment Reference
    if(booking.razorpayPaymentId) {
        doc.fontSize(8).fillColor("#777777").text(`Payment Reference: ${booking.razorpayPaymentId}`, 50, 370);
    }

    // Footer
    doc.fontSize(10).fillColor("#777777").text(
        "If you have any questions about this receipt, please contact HomeQuest Support.",
        50,
        700,
        { align: "center", width: 500 }
    );

    doc.end();
};

