const express=require("express");
const router=express.Router();
const User=require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync");
const passport=require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");

const userController=require("../controllers/users.js");

router.route("/signup")
    .get(userController.renderSignupForm)
    .post(wrapAsync(userController.signup));

router.route("/login")
    .get(userController.renderLoginForm)
    .post(saveRedirectUrl,
        passport.authenticate("local",
        {failureRedirect:'/login',
        failureFlash:true}),
        userController.login);

const multer = require('multer');
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

router.get("/logout",userController.logout);

router.get("/profile", isLoggedIn, wrapAsync(userController.renderProfile));
router.get("/profile/edit", isLoggedIn, wrapAsync(userController.renderEditProfileForm));
router.put("/profile", isLoggedIn, upload.single("avatar"), wrapAsync(userController.updateProfile));
router.post("/wishlist/:id", isLoggedIn, wrapAsync(userController.toggleWishlist));

module.exports=router;