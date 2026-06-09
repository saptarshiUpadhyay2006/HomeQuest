const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Nodemailer Transporter configuration
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
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

    // Calculate total price dynamically using weekend vs weekday prices
    const weekendPrice = listing.weekendPrice || listing.price;
    const weekdayPrice = listing.price;
    let totalPrice = 0;
    let current = new Date(checkInDate);

    while (current < checkOutDate) {
        let day = current.getDay(); // 5 = Friday, 6 = Saturday
        if (day === 5 || day === 6) {
            totalPrice += weekendPrice;
        } else {
            totalPrice += weekdayPrice;
        }
        current.setDate(current.getDate() + 1);
    }

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
            user: req.user,
            title: `Checkout Booking - ${listing.title} | HomeQuest`
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

        // Fetch fully populated booking data to trigger email sending
        const booking = await Booking.findById(bookingId).populate("listing").populate("user");
        if (booking && booking.user && booking.user.email) {
            sendReceiptEmail(booking).catch(err => {
                console.error("Async receipt email error:", err);
            });
        }

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
    res.render("bookings/index.ejs", { 
        bookings,
        title: "My Bookings | HomeQuest"
    });
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
    res.render("bookings/show.ejs", { 
        booking,
        title: "Booking Details | HomeQuest"
    });
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
            user: req.user,
            title: `Checkout Booking - ${booking.listing.title} | HomeQuest`
        });
    } catch (err) {
        console.log(err);
        req.flash("error", "Payment service failed. Please try again.");
        res.redirect(`/bookings/${bookingId}`);
    }
};

function buildPdfContent(doc, booking) {
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
}

function generatePdfBuffer(booking) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                resolve(Buffer.concat(buffers));
            });
            doc.on('error', (err) => {
                reject(err);
            });
            buildPdfContent(doc, booking);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

async function sendReceiptEmail(booking) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("Nodemailer: EMAIL_USER or EMAIL_PASS environment variables are not set. Skipping receipt email.");
        return;
    }

    try {
        const pdfBuffer = await generatePdfBuffer(booking);
        const checkInStr = booking.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const checkOutStr = booking.checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const mailOptions = {
            from: `"HomeQuest Stays" <${process.env.EMAIL_USER}>`,
            to: booking.user.email,
            subject: `Booking Confirmed: ${booking.listing.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <div style="background-color: #fe424d; padding: 20px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">Booking Confirmed!</h1>
                    </div>
                    <div style="padding: 20px;">
                        <p>Hi <strong>${booking.user.username}</strong>,</p>
                        <p>Thank you for booking your stay with HomeQuest. Your payment was successful, and your stay is confirmed.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                            <h3 style="margin-top: 0; color: #fe424d;">Stay Details</h3>
                            <p style="margin: 5px 0;"><strong>Property:</strong> ${booking.listing.title}</p>
                            <p style="margin: 5px 0;"><strong>Location:</strong> ${booking.listing.location}, ${booking.listing.country}</p>
                            <p style="margin: 5px 0;"><strong>Dates:</strong> ${checkInStr} to ${checkOutStr}</p>
                            <p style="margin: 5px 0;"><strong>Total Paid:</strong> INR ${booking.totalPrice.toLocaleString("en-IN")}</p>
                            <p style="margin: 5px 0;"><strong>Booking ID:</strong> <span style="font-family: monospace; font-size: 13px;">${booking._id}</span></p>
                        </div>
                        
                        <p>We have attached your official PDF invoice/receipt to this email for your records.</p>
                        
                        <p style="margin-bottom: 0;">Warm regards,<br><strong>The HomeQuest Team</strong></p>
                    </div>
                    <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #e0e0e0;">
                        This is an automated receipt for your booking at HomeQuest.
                    </div>
                </div>
            `,
            attachments: [
                {
                    filename: `Receipt_${booking._id}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Receipt email sent successfully to ${booking.user.email}: ${info.messageId}`);
    } catch (error) {
        console.error("Error sending receipt email via Nodemailer:", error);
    }
}

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
    buildPdfContent(doc, booking);
    doc.end();
};

