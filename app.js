if (process.env.NODE_ENV != "production") {
    require('dotenv').config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const LocalStrategy = require("passport-local");
const passport = require("passport");
const User = require("./models/user.js");
const Listing = require("./models/listing.js");


const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/booking.js");
const myBookingsRouter = require("./routes/myBookings.js");


const dbUrl = process.env.ATLASDB_URL;

main().then(() => {
    console.log("connected to DB");
})
    .catch((err) => {
        console.log(err);
    })

async function main() {
    await mongoose.connect(dbUrl);
}

app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"))
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 3600,
    autoRemove: "native",
    stringify: false,
});

store.on("error", () => {
    console.log("ERROR in Mongo session store", err);
});

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
}

// app.get("/",(req,res)=>{
//     res.send("Hi I am root");
// });

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

// Register Google Strategy for production deploy
const GoogleStrategy = require("passport-google-oauth20").Strategy;
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : "";
            if (email) {
                user = await User.findOne({ email });
            }
            if (!user) {
                user = new User({
                    googleId: profile.id,
                    email: email || `${profile.id}@google.mock`,
                    username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000)
                });
                await user.save();
            } else {
                user.googleId = profile.id;
                await user.save();
            }
        }
        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
}));


passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    
    // Default SEO Metadata
    res.locals.title = 'HomeQuest - Discover Your Perfect Stay';
    res.locals.description = 'Discover the most beautiful and unique stays around the world with HomeQuest. Book your perfect getaway today.';
    res.locals.ogImage = 'https://homequest-spuk.vercel.app/logo.png';
    res.locals.canonicalUrl = req.path;
    next();
})

// Dynamic Sitemap Route
app.get("/sitemap.xml", async (req, res) => {
    try {
        res.header('Content-Type', 'application/xml');
        const listings = await Listing.find({}, '_id updatedAt');
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://homequest-spuk.vercel.app/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://homequest-spuk.vercel.app/listings</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://homequest-spuk.vercel.app/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://homequest-spuk.vercel.app/privacy</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://homequest-spuk.vercel.app/terms</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>`;

        listings.forEach(listing => {
            const lastMod = listing.updatedAt ? listing.updatedAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            xml += `
  <url>
    <loc>https://homequest-spuk.vercel.app/listings/${listing._id}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
        });

        xml += '\n</urlset>';
        res.send(xml);
    } catch (e) {
        console.error("Sitemap generation error:", e);
        res.status(500).send("Error generating sitemap");
    }
});

// app.get("/demouser",async(req,res)=>{
//     let fakeUser=new User({
//         email:"student@gmail.com",
//         username:"delta-student"
//     });
//     let registeredUser=await User.register(fakeUser,"helloworld");
//     res.send(registeredUser);
// })

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/listings/:id/bookings", bookingRouter);
app.use("/bookings", myBookingsRouter);
app.use("/", userRouter);

app.get("/", (req, res) => {
    res.redirect("/listings");
});
app.get("/about", (req, res) => {
    res.render("about", {
        title: "About HomeQuest - Academic Major Project",
        description: "Learn about HomeQuest, an academic full-stack web application designed to demonstrate modern web development practices."
    });
});

app.get("/privacy", (req, res) => {
    res.render("privacy", {
        title: "Privacy Policy | HomeQuest",
        description: "Read the privacy disclaimer for HomeQuest. Since this is an academic project, no real personal or financial data is processed."
    });
});

app.get("/terms", (req, res) => {
    res.render("terms", {
        title: "Terms of Service | HomeQuest",
        description: "Read the terms of service disclaimer for HomeQuest. Since this is an academic college project, no real business rules apply."
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// app.listen(8080,()=>{
//     console.log("server is listening to port 8080");
// });

module.exports = app;
