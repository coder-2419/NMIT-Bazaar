NMIT Bazaar
A simple web app for students at NMIT to buy and sell campus essentials like textbooks, lab coats, and electronics.
Live Links
Website: coder-2419.github.io/NMIT-Bazaar/
Code: github.com/coder-2419/nmit-bazaar
Features:
  Sign Up & Log In: Email and password login. You must verify your email before using the app.
  Post Items: Upload a photo, set a price, pick a category, and describe your item.
  Manage Listings: Edit, delete, or mark your own items as sold.
  Sold Filter: Items marked as sold disappear from the public feed so buyers only see available items.
  Search & Categories: Search by name or filter by category.
  Favorites: Save items to your personal wishlist without affecting other users.
  Live Chat: Message sellers directly in real time with unread badges and pop-up notifications.
  Currency Converter: Automatically converts USD/EUR prices into Indian Rupees (INR) using a live exchange rate API.

Tech Stack:
  Frontend: HTML, CSS, JavaScript
  Database & Auth: Firebase Firestore & Firebase Authentication
  Image Hosting: Cloudinary
  External API: Open Exchange Rates API
  Hosting: GitHub Pages

How It Works:
  Database Rules: firestore.rules ensures you can only edit or delete items that belong to you.
  Images: Uploaded directly to Cloudinary with unique names so no files get overwritten
  Offline Safe: Currency rates are saved in the browser so the app stays fast and doesn't crash if the network slows down


