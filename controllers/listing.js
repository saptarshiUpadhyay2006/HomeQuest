const Listing=require("../models/listing");
const mbxGeoCoding= require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken=process.env.MAP_TOKEN;
const geocodingClient=mbxGeoCoding({accessToken:mapToken});


module.exports.renderNewForm=(req,res)=>{
    res.render("listings/new.ejs")
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
    console.log(listing);
    res.render("listings/show.ejs",{listing});
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
    res.render("listings/edit.ejs",{listing});
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
        maxPrice: maxPrice || ""
    });
  };
  