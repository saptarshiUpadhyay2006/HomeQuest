const express=require("express");
const router=express.Router();
const wrapAsync=require("../utils/wrapAsync.js");
const Listing=require("../models/listing.js");
const flash=require("connect-flash");
const {isLoggedIn,isOwner,validateListing}=require("../middleware.js");

const listingController=require("../controllers/listing.js");
const multer  = require('multer')
const {storage}=require("../cloudConfig.js");
const upload = multer({storage});


router
    .route("/")
    .get(wrapAsync(listingController.index))
    .post(
        isLoggedIn,
        upload.array('listing[images]', 5),
        (req, res, next) => {
            if (req.files) {
              req.body.listing.images = req.files.map(f => ({
                url: f.path,
                filename: f.filename
              }));
            }
            next();
          },
        validateListing,
        wrapAsync(listingController.createListing)
    );

//new route
router.get("/new",isLoggedIn,listingController.renderNewForm);

router
    .route("/:id")
    .get(wrapAsync(listingController.showListing))
    .put(isLoggedIn,
        isOwner,
        upload.array("listing[images]", 5),
        (req, res, next) => {
        if (req.files && req.files.length > 0) {
            req.body.listing.images = req.files.map(f => ({
                url: f.path,
                filename: f.filename
            }));
        }
        next();
        },
        validateListing,
        wrapAsync(listingController.updateListing))
    .delete(isLoggedIn,isOwner,wrapAsync(listingController.destroyListing));

//Edit route
router.get("/:id/edit",isLoggedIn,isOwner,wrapAsync(listingController.renderEditForm));

module.exports=router;
