if(process.env.NODE_ENV!="production"){
    require('dotenv').config();
}

const express=require("express");
const app=express();
const mongoose=require("mongoose");
const path=require("path");
const methodOverride=require("method-override");
const ejsMate=require("ejs-mate");
const ExpressError=require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash=require("connect-flash");
const LocalStrategy = require("passport-local");
const passport=require("passport");
const User = require("./models/user.js");


const listingRouter=require("./routes/listing.js");
const reviewRouter=require("./routes/review.js");
const userRouter=require("./routes/user.js");
const bookingRouter=require("./routes/booking.js");
const myBookingsRouter=require("./routes/myBookings.js");


const dbUrl=process.env.ATLASDB_URL;

main().then(()=>{
    console.log("connected to DB");
})
    .catch((err)=>{
        console.log(err);
    })

async function main(){
    await mongoose.connect(dbUrl);
}

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"))
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname,"/public")));

const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 3600,
    autoRemove: "native",
    stringify: false,
});

store.on("error",()=>{
    console.log("ERROR in Mongo session store",err);
});

const sessionOptions={
    store,
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        expires: Date.now()+7*24*60*60*1000,
        maxAge:7*24*60*60*1000,
        httpOnly:true,
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

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
    res.locals.success=req.flash("success");
    res.locals.error=req.flash("error");
    res.locals.currUser=req.user;
    next();
})

// app.get("/demouser",async(req,res)=>{
//     let fakeUser=new User({
//         email:"student@gmail.com",
//         username:"delta-student"
//     });
//     let registeredUser=await User.register(fakeUser,"helloworld");
//     res.send(registeredUser);
// })

app.use("/listings",listingRouter);
app.use("/listings/:id/reviews",reviewRouter);
app.use("/listings/:id/bookings",bookingRouter);
app.use("/bookings",myBookingsRouter);
app.use("/",userRouter);

app.get("/", (req, res) => {
    res.redirect("/listings"); 
});
app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/privacy", (req, res) => {
    res.render("privacy");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// app.listen(8080,()=>{
//     console.log("server is listening to port 8080");
// });