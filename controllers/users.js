const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const passport = require("passport");

module.exports.renderSignupForm = (req, res) => {
    res.render("./users/signup.ejs");
};

module.exports.signup = async (req, res) => {
    try {
        let { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "welcome to HomeQuest!");
            res.redirect("/listings")
        });
    }
    catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
    req.flash("success", "Welcome to HomeQuest!You are logged in!");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

module.exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "you are logged out!");
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

module.exports.renderEditProfileForm = async (req, res) => {
    res.render("users/editProfile.ejs", { user: req.user });
};

module.exports.updateProfile = async (req, res) => {
    let { bio } = req.body;
    let user = await User.findByIdAndUpdate(req.user._id, { bio });
    
    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        user.avatar = { url, filename };
        await user.save();
    }
    
    req.flash("success", "Profile updated successfully!");
    res.redirect("/profile");
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

module.exports.initiateGoogleAuth = async (req, res, next) => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
    } else {
        await mockGoogleLogin(req, res, next);
    }
};

module.exports.handleGoogleCallback = (req, res, next) => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.authenticate("google", {
            failureRedirect: "/login",
            failureFlash: true
        })(req, res, () => {
            req.flash("success", "Welcome to HomeQuest! Authenticated via Google.");
            let redirectUrl = res.locals.redirectUrl || "/listings";
            res.redirect(redirectUrl);
        });
    } else {
        req.flash("error", "Google credentials not configured.");
        res.redirect("/login");
    }
};

const mockGoogleLogin = async (req, res, next) => {
    try {
        let user = await User.findOne({ googleId: "mock_google_id_12345" });
        if (!user) {
            user = new User({
                googleId: "mock_google_id_12345",
                email: "google_tester@example.com",
                username: "google_tester"
            });
            await user.save();
        }
        req.login(user, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Logged in via Google (Mock Mode)! Add GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET in .env for live OAuth.");
            res.redirect("/listings");
        });
    } catch (e) {
        req.flash("error", "Mock login failed: " + e.message);
        res.redirect("/login");
    }
};