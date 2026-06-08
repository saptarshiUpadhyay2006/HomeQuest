# 🏡 HomeQuest - Luxury Living, Everywhere

HomeQuest is a feature-rich, full-stack vacation rental web application inspired by Airbnb, designed to help users list, discover, and book unique stays around the world.

This project focuses on premium design aesthetics, clean MVC architecture, robust security, and advanced integrations including interactive mapping, geocoding, weather forecasts, live e-commerce transactions, automated PDF invoicing, and real-time host notifications.

---

## Key Features

*   **Interactive Maps & Attractions**: Auto-geocoding of properties on Mapbox GL JS with location boundaries and a **Tilequery Attraction Finder** to locate hotspots in a 3km radius.
*   **Razorpay Checkout**: Fully functional payment gateway with SHA-256 cryptographic signature verification.
*   **Smart Calendar & Bookings**: Integrated date pickers checking booking schedules to block booked ranges and prevent double bookings.
*   **Dynamic Pricing Engine**: Nightly pricing calculations featuring automatic premiums for weekend stays (Friday & Saturday nights).
*   **Automated PDF Receipts**: In-memory generation of official PDF invoices via PDFKit sent instantly to guests.
*   **Nodemailer Notifications**: Automated receipt deliveries and direct host inquiries via SMTP mail channels.
*   **Real-time Weather Widget**: Live weather telemetry fetched dynamically using the Open-Meteo API.
*   **Unified Auth System**: Secure passport logins, Google OAuth 2.0 integrations, and a defensive Google mock callback developer mode.
*   **User Profiles & Wishlists**: Personalized profile centers containing profile picture updates, wishlists, and host booking records.
*   **Responsive Dark Mode**: Persistent theme settings via local storage and CSS custom variables.

---

## Detailed Technical Documentation

We have compiled a top-to-bottom technical architecture documentation detailing schemas, API endpoints, lifecycle events, and step-by-step installation guides:

👉 **[Read the Full Technical Architecture Guide (Project_Doc.md)](Project_Doc.md)**

---

## Tech Stack & Dependencies

*   **Core**: Node.js, Express.js
*   **Database**: MongoDB, Mongoose ODM
*   **Templating**: EJS, ejs-mate
*   **Styling**: Bootstrap 5.3, custom Vanilla CSS variables (for themes)
*   **Auth**: Passport.js (Local, Google OAuth 2.0)
*   **Media**: Cloudinary, Multer
*   **APIs**: Mapbox GL JS, Razorpay API, Open-Meteo, Nodemailer (Gmail SMTP)

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Create a `.env` file in the root directory and copy the values listed in the environment section of [Project_Doc.md](Project_Doc.md).

### 3. Seed database
```bash
node init/index.js
```

### 4. Run application
```bash
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) to explore.

---

*This application is created as a college major project for educational purposes only.*
