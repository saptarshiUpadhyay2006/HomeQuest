const User=require("../models/user");
const Listing=require("../models/listing");
const Booking=require("../models/booking");

module.exports.renderSignupForm=(req,res)=>{
    res.render("./users/signup.ejs");
};

module.exports.signup=async(req,res)=>{
    try{
        let {username,email,password}=req.body;
    const newUser=new User({email,username});
    const registeredUser=await User.register(newUser,password);
    console.log(registeredUser);
    req.login(registeredUser,(err)=>{
        if(err){
            return next(err);
        }
        req.flash("success","welcome to wanderlust!");
        res.redirect("/listings")
    });
    }
    catch(e){
        req.flash("error",e.message);
        res.redirect("/signup");
    }
};

module.exports.renderLoginForm=(req,res)=>{
    res.render("users/login.ejs");
};

module.exports.login=async(req,res)=>{
    req.flash("success","Welcome to Wanderlust!You are logged in!");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

module.exports.logout=(req,res)=>{
    req.logout((err)=>{
        if(err){
            return next(err);
        }
        req.flash("success","you are logged out!");
        res.redirect("/listings");
    })
};

module.exports.renderProfile = async (req, res) => {
    const user = await User.findById(req.user._id).populate({
        path: "wishlist",
        populate: { path: "owner" }
    });
    const listings = await Listing.find({ owner: req.user._id });
    const bookings = await Booking.find({ user: req.user._id }).populate("listing");
    res.render("users/profile.ejs", { user, listings, bookings });
};

module.exports.toggleWishlist = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    const index = user.wishlist.indexOf(id);
    if (index === -1) {
        user.wishlist.push(id);
        await user.save();
        res.json({ added: true });
    } else {
        user.wishlist.splice(index, 1);
        await user.save();
        res.json({ added: false });
    }
};