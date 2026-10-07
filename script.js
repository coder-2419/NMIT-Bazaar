/* =====================================================
   NMIT BAZAAR - CLIENT SCRIPT
===================================================== */
console.log("Script connected successfully! 🚀");

/* =====================================================
   1. FIREBASE & CLOUDINARY CONFIGURATION
===================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyCz5jwtnPd-zw32eGhF7LCtR59WNYQ4cnE",
  authDomain: "nmit-bazaar.firebaseapp.com",
  projectId: "nmit-bazaar",
  storageBucket: "nmit-bazaar.firebasestorage.app",
  messagingSenderId: "1064459826757",
  appId: "1:1064459826757:web:c6b86ac236559b87d5552c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Cloudinary Settings
const CLOUDINARY_CLOUD_NAME = "a9wphmyb"; 
const CLOUDINARY_UPLOAD_PRESET = "NMIT_Bazaar";             

// State Variables
let currentUser = null;
let marketplaceItems = [];
let activeViewingItem = null;
let isSignUpMode = false;

/* =====================================================
   2. INSTANT POP LOADING SCREEN (NO BLOCKERS)
===================================================== */
window.addEventListener("DOMContentLoaded", () => {
    const loadingScreen = document.getElementById("loadingScreen");
    const app = document.getElementById("app");
    
    setTimeout(() => {
        if (loadingScreen) {
            loadingScreen.classList.add("hide");
            setTimeout(() => {
                loadingScreen.style.display = "none";
                if (app) app.classList.remove("hidden");
            }, 300);
        }
    }, 1200);
});

/* =====================================================
   3. REAL-TIME FIRESTORE LISTENER
===================================================== */
db.collection("listings").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
    marketplaceItems = [];
    snapshot.forEach((doc) => {
        marketplaceItems.push({
            id: doc.id,
            ...doc.data()
        });
    });
    
    renderProducts(marketplaceItems);
    renderFavorites();
    renderMyListings();
}, (error) => {
    console.error("Firestore sync error:", error);
});

/* =====================================================
   4. RENDER MARKETPLACE PRODUCTS
===================================================== */
const productGrid = document.getElementById("productGrid");
const resultCount = document.getElementById("resultCount");

function renderProducts(items) {
    if (!productGrid || !resultCount) return;
    productGrid.innerHTML = "";
    resultCount.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;

    if (items.length === 0) {
        productGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1; text-align:center; padding:40px; color:#70807a;">
                <h3>No items available yet</h3>
                <p>Be the first one to post a listing!</p>
            </div>`;
        return;
    }

    items.forEach(item => {
        const card = document.createElement("article");
        card.className = "product-card";
        card.setAttribute("data-id", item.id);

        const imageContent = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}">`
            : `<div style="font-size: 48px;">📦</div>`;

        card.innerHTML = `
            <button class="favorite-toggle-btn ${item.isFavorite ? 'is-favorite' : ''}" data-id="${item.id}" aria-label="Favorite">
                <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
            <div class="product-image">${imageContent}</div>
            <div class="product-info">
                <div class="product-category">${item.category}</div>
                <div class="product-name">${item.name}</div>
                <span class="product-price">₹${item.price}</span>
            </div>`;
        productGrid.appendChild(card);
    });
}

// Product Grid Click: Detail Modal or Favorite Toggle
if (productGrid) {
    productGrid.addEventListener("click", (e) => {
        const favoriteBtn = e.target.closest(".favorite-toggle-btn");
        if (favoriteBtn) {
            e.stopPropagation();
            toggleFavorite(favoriteBtn.getAttribute("data-id"));
            return;
        }

        const card = e.target.closest(".product-card");
        if (card) {
            const itemId = card.getAttribute("data-id");
            openProductDetailModal(itemId);
        }
    });
}

/* =====================================================
   5. PRODUCT DETAIL & ZOOM LIGHTBOX
===================================================== */
const productDetailModal = document.getElementById("productDetailModal");
const closeDetailModal = document.getElementById("closeDetailModal");
const detailModalImg = document.getElementById("detailModalImg");
const detailImageWrapper = document.getElementById("detailImageWrapper");
const detailCategory = document.getElementById("detailCategory");
const detailTitle = document.getElementById("detailTitle");
const detailPrice = document.getElementById("detailPrice");
const detailSeller = document.getElementById("detailSeller");
const detailDescription = document.getElementById("detailDescription");
const modalChatSellerBtn = document.getElementById("modalChatSellerBtn");

const imageLightbox = document.getElementById("imageLightbox");
const lightboxImg = document.getElementById("lightboxImg");

function openProductDetailModal(itemId) {
    const item = marketplaceItems.find(i => i.id === itemId);
    if (!item || !productDetailModal) return;

    activeViewingItem = item;
    detailModalImg.src = item.imageUrl || "nmit-logo.png";
    detailCategory.textContent = item.category;
    detailTitle.textContent = item.name;
    detailPrice.textContent = `₹${item.price}`;
    
    const sellerName = item.sellerName || (item.sellerEmail ? item.sellerEmail.split("@")[0] : "Student Seller");
    detailSeller.textContent = sellerName;
    detailDescription.textContent = item.description || "No additional description provided.";

    productDetailModal.classList.remove("hidden");
}

function closeDetailModalHandler() {
    if (productDetailModal) productDetailModal.classList.add("hidden");
}

if (closeDetailModal) closeDetailModal.addEventListener("click", closeDetailModalHandler);
if (productDetailModal) {
    productDetailModal.addEventListener("click", (e) => {
        if (e.target === productDetailModal) closeDetailModalHandler();
    });
}

// Fullscreen Image Lightbox
if (detailImageWrapper && imageLightbox && lightboxImg) {
    detailImageWrapper.addEventListener("click", () => {
        if (detailModalImg.src) {
            lightboxImg.src = detailModalImg.src;
            imageLightbox.classList.remove("hidden");
        }
    });

    imageLightbox.addEventListener("click", () => {
        imageLightbox.classList.add("hidden");
    });
}

// Chat with Seller button inside modal
if (modalChatSellerBtn) {
    modalChatSellerBtn.addEventListener("click", () => {
        if (!activeViewingItem) return;
        closeDetailModalHandler();
        startChatWithItem(activeViewingItem);
    });
}

/* =====================================================
   6. FAVORITES LOGIC
===================================================== */
function toggleFavorite(itemId) {
    const item = marketplaceItems.find(i => i.id === itemId);
    if (!item) return;

    db.collection("listings").doc(itemId).update({
        isFavorite: !item.isFavorite
    }).catch(err => console.error("Error updating favorite:", err));
}

function renderFavorites() {
    const favoritesTab = document.getElementById("favoritesTab");
    if (!favoritesTab) return;

    const favoriteItems = marketplaceItems.filter(item => item.isFavorite);
    const container = favoritesTab.querySelector(".product-grid");
    if (!container) return;

    if (favoriteItems.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #70807a; padding: 40px;">No saved favorites yet.</p>`;
        return;
    }

    container.innerHTML = "";
    favoriteItems.forEach(item => {
        const imageContent = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}">`
            : `<div style="font-size: 48px;">📦</div>`;

        const card = document.createElement("article");
        card.className = "product-card";
        card.innerHTML = `
            <div class="favorite-icon-active" data-id="${item.id}" title="Remove favorite">❤️</div>
            <div class="product-image">${imageContent}</div>
            <div class="product-info">
                <div class="product-category">${item.category}</div>
                <div class="product-name">${item.name}</div>
                <span class="product-price">₹${item.price}</span>
            </div>`;
        container.appendChild(card);
    });
}

const favoritesTab = document.getElementById("favoritesTab");
if (favoritesTab) {
    favoritesTab.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".favorite-icon-active");
        if (removeBtn) {
            const itemId = removeBtn.getAttribute("data-id");
            toggleFavorite(itemId);
        }
    });
}

/* =====================================================
   7. MY LISTINGS (PROFILE TAB)
===================================================== */
function renderMyListings() {
    const myListingsGrid = document.getElementById("myListingsGrid");
    if (!myListingsGrid) return;

    if (!currentUser) {
        myListingsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#70807a; padding:40px;">Please sign in to view your listings.</p>`;
        return;
    }

    const myItems = marketplaceItems.filter(i => i.sellerUid === currentUser.uid);
    if (myItems.length === 0) {
        myListingsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#70807a; padding:40px;">You haven't listed any items yet.</p>`;
        return;
    }

    myListingsGrid.innerHTML = "";
    myItems.forEach(item => {
        const card = document.createElement("article");
        card.className = "product-card";
        card.innerHTML = `
            <div class="product-image"><img src="${item.imageUrl || ''}" alt=""></div>
            <div class="product-info">
                <div class="product-category">${item.category}</div>
                <div class="product-name">${item.name}</div>
                <span class="product-price">₹${item.price}</span>
            </div>`;
        myListingsGrid.appendChild(card);
    });
}

/* =====================================================
   8. MESSAGES & CHAT INTERACTION
===================================================== */
const chatListingTitle = document.getElementById("chatListingTitle");
const chatSellerSubtitle = document.getElementById("chatSellerSubtitle");
const chatHeaderTitle = document.getElementById("chatHeaderTitle");
const chatHeaderSub = document.getElementById("chatHeaderSub");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

function startChatWithItem(item) {
    const messagesNav = document.querySelector('[data-page="messages"]');
    if (messagesNav) messagesNav.click();

    const sellerName = item.sellerName || (item.sellerEmail ? item.sellerEmail.split("@")[0] : "Student Seller");

    if (chatListingTitle) chatListingTitle.textContent = item.name;
    if (chatSellerSubtitle) chatSellerSubtitle.textContent = sellerName;
    if (chatHeaderTitle) chatHeaderTitle.textContent = item.name;
    if (chatHeaderSub) chatHeaderSub.textContent = `₹${item.price} • Chatting with ${sellerName}`;

    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="message-bubble received">
                <p>Hi! I'm interested in buying your <strong>${item.name}</strong> for ₹${item.price}. Is it still available on campus?</p>
                <span class="msg-time">Just now</span>
            </div>
        `;
    }
}

function sendChatMessage() {
    if (!chatInput || !chatMessages) return;
    const text = chatInput.value.trim();
    if (!text) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement("div");
    bubble.className = "message-bubble sent";
    bubble.innerHTML = `<p>${text}</p><span class="msg-time">${time}</span>`;
    
    chatMessages.appendChild(bubble);
    chatInput.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (chatSendBtn) chatSendBtn.addEventListener("click", sendChatMessage);
if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendChatMessage();
        }
    });
}

/* =====================================================
   9. PAGE NAVIGATION & ROUTE GATING
===================================================== */
const navLinks = document.querySelectorAll(".nav-link");
const pages = {
    home: document.getElementById("homePage"),
    messages: document.getElementById("messagesPage"),
    sell: document.getElementById("sellPage"),
    profile: document.getElementById("profilePage")
};

navLinks.forEach(button => {
    button.addEventListener("click", () => {
        const target = button.dataset.page;
        if (!target || !pages[target]) return;

        // Gate sell and profile tabs behind login
        if ((target === "sell" || target === "profile") && !currentUser) {
            alert("Please sign in with your Gmail account first.");
            openAuthModal(false);
            return;
        }

        navLinks.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        
        Object.values(pages).forEach(p => {
            if (p) p.classList.remove("active-page");
        });
        pages[target].classList.add("active-page");

        if (target === "profile") {
            renderFavorites();
            renderMyListings();
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});

/* =====================================================
   10. CATEGORY FILTER
===================================================== */
const categoryButtons = document.querySelectorAll(".category-card");
categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;
        const filtered = marketplaceItems.filter(item => item.category === category);
        
        Object.values(pages).forEach(p => p && p.classList.remove("active-page"));
        if (pages.home) pages.home.classList.add("active-page");
        
        navLinks.forEach(btn => btn.classList.remove("active"));
        const homeBtn = document.querySelector('[data-page="home"]');
        if (homeBtn) homeBtn.classList.add("active");
        
        renderProducts(filtered);
        const marketSection = document.querySelector(".marketplace-section");
        if (marketSection) marketSection.scrollIntoView({ behavior: "smooth" });
    });
});

/* =====================================================
   11. SEARCH
===================================================== */
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchSuggestions = document.getElementById("searchSuggestions");

function performSearch(query) {
    if (!query) {
        if (searchSuggestions) searchSuggestions.classList.add("hidden");
        renderProducts(marketplaceItems);
        return;
    }

    let matches = marketplaceItems.filter(item =>
        item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query)
    );

    matches.sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
    });

    renderProducts(matches);
}

if (searchInput) {
    searchInput.addEventListener("input", function() {
        performSearch(this.value.trim().toLowerCase());
    });
}
if (searchButton) {
    searchButton.addEventListener("click", (e) => {
        e.preventDefault();
        performSearch(searchInput.value.trim().toLowerCase());
    });
}

/* =====================================================
   12. CREATE LISTING (CLOUDINARY + FIRESTORE)
===================================================== */
const createListingForm = document.getElementById("createListingForm");
const itemImageInput = document.getElementById("itemImage");
const triggerImageBtn = document.getElementById("triggerImageBtn");
const imagePreview = document.getElementById("imagePreview");
const formError = document.getElementById("formError");

if (triggerImageBtn && itemImageInput) {
    triggerImageBtn.addEventListener("click", () => itemImageInput.click());
    itemImageInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (imagePreview) imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

if (createListingForm) {
    createListingForm.addEventListener("submit", async function(e) {
        e.preventDefault();

        if (!currentUser) {
            alert("Please sign in before posting an item.");
            openAuthModal(false);
            return;
        }

        const name = document.getElementById("itemName").value.trim();
        const price = parseFloat(document.getElementById("itemPrice").value);
        const category = document.getElementById("itemCategory").value;
        const desc = document.getElementById("itemDescription").value.trim();
        const imageFile = itemImageInput.files[0];

        if (!name || !price || !category || !desc || !imageFile) {
            if (formError) {
                formError.textContent = "Please fill out all fields and upload an image.";
                formError.classList.remove("hidden");
            }
            return;
        }

        const submitBtn = createListingForm.querySelector(".submit-btn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading image...";

        try {
            const formData = new FormData();
            formData.append("file", imageFile);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                { method: "POST", body: formData }
            );

            if (!uploadRes.ok) throw new Error("Image upload failed.");
            const uploadData = await uploadRes.json();

            submitBtn.textContent = "Saving listing...";

            await db.collection("listings").add({
                name: name,
                price: price,
                category: category,
                description: desc,
                imageUrl: uploadData.secure_url,
                sellerName: currentUser.displayName || currentUser.email.split("@")[0],
                sellerEmail: currentUser.email,
                sellerUid: currentUser.uid,
                isFavorite: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Success! Your item is live on NMIT Bazaar.");
            createListingForm.reset();
            if (imagePreview) imagePreview.innerHTML = `<span>+ Upload Image</span>`;
            
            const homeNav = document.querySelector('[data-page="home"]');
            if (homeNav) homeNav.click();

        } catch (err) {
            console.error(err);
            if (formError) {
                formError.textContent = err.message || "Failed to publish listing.";
                formError.classList.remove("hidden");
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Publish Listing";
        }
    });
}

/* =====================================================
   13. AUTHENTICATION & PROFILE TAB VISIBILITY
===================================================== */
const profileNavLink = document.getElementById("profileNavLink");
const authBtn = document.getElementById("authBtn");
const authModal = document.getElementById("authModal");
const closeAuthModal = document.getElementById("closeAuthModal");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authModalTitle = document.getElementById("authModalTitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");

auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        if (authBtn) authBtn.textContent = "Sign Out";
        if (profileNavLink) profileNavLink.classList.remove("hidden"); // Reveal Profile Tab
        const nameDisplay = document.getElementById("userNameDisplay");
        if (nameDisplay) nameDisplay.textContent = user.displayName || user.email.split("@")[0];
    } else {
        if (authBtn) authBtn.textContent = "Sign In";
        if (profileNavLink) profileNavLink.classList.add("hidden"); // Hide Profile Tab
    }
});

function openAuthModal(signup = false) {
    if (!authModal) return;
    isSignUpMode = signup;
    authModalTitle.textContent = isSignUpMode ? "Create Account" : "Sign In";
    authSubmitBtn.textContent = isSignUpMode ? "Register" : "Sign In";
    tabSignUp.classList.toggle("active", isSignUpMode);
    tabSignIn.classList.toggle("active", !isSignUpMode);
    if (authError) authError.classList.add("hidden");
    authModal.classList.remove("hidden");
}

function closeAuthModalHandler() {
    if (authModal) authModal.classList.add("hidden");
    if (authForm) authForm.reset();
}

if (tabSignIn) tabSignIn.addEventListener("click", () => openAuthModal(false));
if (tabSignUp) tabSignUp.addEventListener("click", () => openAuthModal(true));
if (closeAuthModal) closeAuthModal.addEventListener("click", closeAuthModalHandler);

if (authBtn) {
    authBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentUser) {
            if (confirm("Do you want to sign out?")) {
                auth.signOut().then(() => {
                    const homeNav = document.querySelector('[data-page="home"]');
                    if (homeNav) homeNav.click();
                });
            }
        } else {
            openAuthModal(false);
        }
    });
}

if (authForm) {
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = authEmail.value.trim().toLowerCase();
        const password = authPassword.value;

        if (!email.endsWith("@gmail.com")) {
            authError.textContent = "Access restricted: Please use a valid @gmail.com address.";
            authError.classList.remove("hidden");
            return;
        }

        authError.classList.add("hidden");
        authSubmitBtn.disabled = true;

        try {
            if (isSignUpMode) {
                await auth.createUserWithEmailAndPassword(email, password);
                alert("Account created successfully!");
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
            closeAuthModalHandler();
        } catch (err) {
            authError.textContent = err.message;
            authError.classList.remove("hidden");
        } finally {
            authSubmitBtn.disabled = false;
        }
    });
}

/* =====================================================
   14. PROFILE EDITING MODAL
===================================================== */
const editProfileBtn = document.getElementById("editProfileBtn");
const editProfileModal = document.getElementById("editProfileModal");
const closeProfileModal = document.getElementById("closeProfileModal");
const cancelProfileModal = document.getElementById("cancelProfileModal");
const editProfileForm = document.getElementById("editProfileForm");
const editJoiningYear = document.getElementById("editJoiningYear");
const programPills = document.querySelectorAll(".program-pill-btn");
const selectedProgramInput = document.getElementById("selectedProgramInput");

if (editJoiningYear) editJoiningYear.max = new Date().getFullYear();

programPills.forEach(pill => {
    pill.addEventListener("click", () => {
        programPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        if (selectedProgramInput) selectedProgramInput.value = pill.getAttribute("data-program");
    });
});

if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
        if (!editProfileModal) return;
        editProfileModal.classList.remove("hidden");
    });
}
if (closeProfileModal) closeProfileModal.addEventListener("click", () => editProfileModal.classList.add("hidden"));
if (cancelProfileModal) cancelProfileModal.addEventListener("click", () => editProfileModal.classList.add("hidden"));

if (editProfileForm) {
    editProfileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const newName = document.getElementById("editFullName").value.trim();
        const newDept = document.getElementById("editDepartment").value.trim();
        const enteredYear = parseInt(editJoiningYear.value, 10);
        const thisYear = new Date().getFullYear();

        if (enteredYear > thisYear) {
            alert(`Joining year cannot exceed ${thisYear}.`);
            return;
        }

        if (newName) document.getElementById("userNameDisplay").textContent = newName;
        if (newDept) document.getElementById("userDeptDisplay").textContent = newDept;
        document.getElementById("userYearDisplay").textContent = enteredYear;
        if (selectedProgramInput) document.getElementById("userProgramDisplay").textContent = selectedProgramInput.value;
        editProfileModal.classList.add("hidden");
    });
}

const profileTabs = document.querySelectorAll(".profile-tab");
const tabContents = document.querySelectorAll(".tab-content");
profileTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        profileTabs.forEach(t => t.classList.remove("active"));
        tabContents.forEach(c => c.classList.remove("active-tab", "hidden"));

        tab.classList.add("active");
        const target = document.getElementById(tab.getAttribute("data-tab") + "Tab");
        tabContents.forEach(c => c.classList.add("hidden"));
        if (target) target.classList.remove("hidden");
    });
});