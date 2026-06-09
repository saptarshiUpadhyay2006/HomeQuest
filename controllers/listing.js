const Listing=require("../models/listing");
const Booking=require("../models/booking");
const mbxGeoCoding= require('@mapbox/mapbox-sdk/services/geocoding');
const nodemailer = require("nodemailer");
const mapToken=process.env.MAP_TOKEN;
const geocodingClient=mbxGeoCoding({accessToken:mapToken});


module.exports.renderNewForm=(req,res)=>{
    res.render("listings/new.ejs", { title: "Add Your Home | HomeQuest" })
};

module.exports.showListing=async(req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id)
    .populate({path:"reviews",
        populate:{
            path:"author",
        }})
    .populate("owner");
    if(!listing){
        req.flash("error","Listing you requested does not exist!");
        res.redirect("/listings");
    }
    
    // Find all paid bookings for this listing to disable dates on calendar
    const Booking = require("../models/booking.js");
    const bookings = await Booking.find({ listing: id, paymentStatus: "paid" });
    const bookedRanges = bookings.map(b => ({
        from: b.checkIn.toISOString().split('T')[0],
        to: b.checkOut.toISOString().split('T')[0]
    }));

    res.render("listings/show.ejs",{
        listing, 
        bookedRanges,
        title: `${listing.title} | HomeQuest`,
        description: listing.description ? listing.description.substring(0, 160) : "Discover the most beautiful and unique stays around the world with HomeQuest. Book your perfect getaway today.",
        ogImage: listing.images && listing.images.length > 0 ? listing.images[0].url : (listing.image ? listing.image.url : "/logo.png")
    });
};

module.exports.createListing = async (req, res, next) => {
    const response = await geocodingClient.forwardGeocode({
        query: req.body.listing.location,
        limit: 1
    }).send();

    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;

    if (response.body.features.length > 0) {
        newListing.geometry = {
            type: 'Point',
            coordinates: response.body.features[0].geometry.coordinates
        };
    }

    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect(`/listings/${newListing._id}`);
};

module.exports.renderEditForm=async (req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id);
    if(!listing){
        req.flash("error","Listing you requested does not exist!");
        res.redirect("/listings");
    }
    let originalImageUrl=listing.images && listing.images.length > 0 ? listing.images[0].url : "";
    if (originalImageUrl) {
        originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
    }
    res.render("listings/edit.ejs",{
        listing,
        title: `Edit ${listing.title} | HomeQuest`
    });
};

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;
    // We handle images separately to allow appending
    let { images, ...otherData } = req.body.listing;
    let listing = await Listing.findByIdAndUpdate(id, { ...otherData }, { new: true });

    if (typeof req.files !== "undefined" && req.files.length > 0) {
        let newImages = req.files.map(f => ({
            url: f.path,
            filename: f.filename
        }));
        listing.images.push(...newImages);
        await listing.save();
    }
    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing=async(req,res)=>{
    let {id}=req.params;
    let deletedListing=await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success","Listing Deleted!");
    res.redirect("/listings");
}

module.exports.index = async (req, res) => {
    const q = (req.query.q || "").trim();
    const category = req.query.category;
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    
    let query = {};
    
    if (category) {
        query.category = category;
    }
    
    if (q) {
        query.$or = [
          { title:    { $regex: q, $options: "i" } },
          { location: { $regex: q, $options: "i" } },
          { country:  { $regex: q, $options: "i" } },
        ];
    }
    
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }
  
    const allListings = await Listing.find(query);
  
    res.render("listings/index.ejs", { 
        allListings, 
        searchQuery: q, 
        activeCategory: category,
        minPrice: minPrice || "",
        maxPrice: maxPrice || "",
        title: "Discover Unique Stays | HomeQuest",
        description: "Explore the best vacation rentals, luxury homes, and unique stays with HomeQuest. Book your next adventure today."
    });
  };

module.exports.renderDashboard = async (req, res) => {
    const listings = await Listing.find({ owner: req.user._id });
    const listingIds = listings.map(l => l._id);

    const bookings = await Booking.find({ listing: { $in: listingIds } })
        .populate("listing")
        .populate("user")
        .sort({ createdAt: -1 });

    const paidBookings = bookings.filter(b => b.paymentStatus === "paid");
    const totalEarnings = paidBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const totalBookings = paidBookings.length;

    // Sort upcoming bookings by check-in date
    const upcomingBookings = paidBookings
        .filter(b => b.checkOut >= new Date())
        .sort((a, b) => a.checkIn - b.checkIn);

    res.render("listings/dashboard.ejs", { 
        listings, 
        bookings, 
        totalEarnings, 
        totalBookings,
        upcomingBookings,
        title: "Host Dashboard | HomeQuest"
    });
};

module.exports.sendInquiry = async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    const listing = await Listing.findById(id).populate("owner");
    if (!listing) {
        req.flash("error", "Listing you requested does not exist!");
        return res.redirect("/listings");
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        req.flash("error", "Nodemailer error: Email configuration missing on server.");
        return res.redirect(`/listings/${id}`);
    }

    const hostEmail = listing.owner.email;
    const guestUsername = req.user.username;
    const guestEmail = req.user.email;

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: `"HomeQuest Stays" <${process.env.EMAIL_USER}>`,
        to: hostEmail,
        subject: `New Inquiry: ${listing.title} from ${guestUsername}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="background-color: #fe424d; padding: 20px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 22px; color: white;">New Stay Inquiry</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Hi <strong>${listing.owner.username}</strong>,</p>
                    <p>You have received a new question about your listing, <strong>${listing.title}</strong>.</p>
                    
                    <div style="background-color: #f9f9f9; border-left: 4px solid #fe424d; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <h4 style="margin: 0 0 10px 0; color: #333;">Message from ${guestUsername}:</h4>
                        <p style="margin: 0; font-style: italic; color: #555;">"${message}"</p>
                    </div>
                    
                    <div style="background-color: #f1f1f1; padding: 12px; border-radius: 5px; font-size: 13px;">
                        <strong>Guest Contact Info:</strong><br>
                        Username: ${guestUsername}<br>
                        Email: <a href="mailto:${guestEmail}">${guestEmail}</a>
                    </div>
                    
                    <p style="margin-top: 20px;">Please reply directly to the guest's email to answer their questions.</p>
                    
                    <p style="margin-bottom: 0;">Warm regards,<br><strong>The HomeQuest Team</strong></p>
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);

    req.flash("success", "Your inquiry has been sent to the host successfully!");
    res.redirect(`/listings/${id}`);
};

  