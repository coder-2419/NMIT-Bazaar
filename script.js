console.log("Script connected successfully! 🚀");

/* =====================================================
   BACKEND CONFIGURATION (FIRESTORE + CLOUDINARY)
===================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyCz5jwtnPd-zw32eGhF7LCtR59WNYQ4cnE",
  authDomain: "nmit-bazaar.firebaseapp.com",
  projectId: "nmit-bazaar",
  storageBucket: "nmit-bazaar.firebasestorage.app",
  messagingSenderId: "1064459826757",
  appId: "1:1064459826757:web:c6b86ac236559b87d5552c"
};

// Initialize Firebase & Services
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
let currentUser = null;

// Cloudinary Unsigned Settings
const CLOUDINARY_CLOUD_NAME = "a9wphmyb"; 
const CLOUDINARY_UPLOAD_PRESET = "NMIT_Bazaar";             

// In-memory array populated from Firestore
let marketplaceItems = [];

/* =====================================================
   ELEMENTS & CONNECTION STATUS
===================================================== */
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");

function updateConnectionStatus() {
    if(!connectionDot || !connectionText) return;
    if (navigator.onLine) {
        connectionDot.classList.remove("offline");
        connectionDot.classList.add("online");
        connectionText.textContent = "Online";
    } else {
        connectionDot.classList.remove("online");
        connectionDot.classList.add("offline");
        connectionText.textContent = "Offline";
    }
}
updateConnectionStatus();
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

/* =====================================================
   LOADING SCREEN (2-SECOND DELAY)
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
    updateConnectionStatus();
    const loadingScreen = document.getElementById("loadingScreen");
    const app = document.getElementById("app");
    
    if(loadingScreen && app) {
        setTimeout(() => {
            loadingScreen.classList.add("hide");
            setTimeout(() => {
                loadingScreen.style.display = "none";
                app.classList.remove("hidden");
            }, 700);
        }, 2000); 
    }
});

/* =====================================================
   REAL-TIME FIRESTORE LISTENER
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
}, (error) => {
    console.error("Firestore sync error:", error);
});

/* =====================================================
   FAVORITES SYNCHRONIZATION
===================================================== */
function renderFavorites() {
    const favoritesTab = document.getElementById("favoritesTab");
    if (!favoritesTab) return;

    const favoriteItems = marketplaceItems.filter(item => item.isFavorite);
    const container = favoritesTab.querySelector(".product-grid");
    if (!container) return;

    if (favoriteItems.length === 0) {
        container.innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; color: #70807a; padding: 40px;">
                You have no saved favorites.
            </p>`;
        return;
    }

    container.innerHTML = "";
    favoriteItems.forEach(item => {
        const imageContent = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}">`
            : `<div style="font-size: 48px;">${item.icon || "📦"}</div>`;

        const card = document.createElement("article");
        card.className = "product-card";
        card.innerHTML = `
            <div class="favorite-icon-active" data-id="${item.id}" title="Remove from favorites">❤️</div>
            <div class="product-image">${imageContent}</div>
            <div class="product-info">
                <div class="product-category">${item.category}</div>
                <div class="product-name">${item.name}</div>
                <span class="product-price">₹${item.price}</span>
            </div>`;
        container.appendChild(card);
    });
}

function toggleFavorite(itemId) {
    const item = marketplaceItems.find(i => i.id === itemId);
    if (!item) return;

    db.collection("listings").doc(itemId).update({
        isFavorite: !item.isFavorite
    }).catch(err => console.error("Error updating favorite:", err));
}

/* =====================================================
   RENDER PRODUCTS
===================================================== */
const productGrid = document.getElementById("productGrid");
const resultCount = document.getElementById("resultCount");

function renderProducts(items) {
    if (!productGrid || !resultCount) return;
    productGrid.innerHTML = "";
    resultCount.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;

    if (items.length === 0) {
        productGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-icon">🔎</div>
                <h3>No items found</h3>
                <p>Try searching for another item or post a new listing!</p>
            </div>`;
        return;
    }

    items.forEach(item => {
        const card = document.createElement("article");
        card.className = `product-card ${item.isSold ? 'sold-out' : ''}`;
        
        const imageContent = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}">`
            : `<div style="font-size: 48px;">${item.icon || "📦"}</div>`;

        card.innerHTML = `
            <button class="favorite-toggle-btn ${item.isFavorite ? 'is-favorite' : ''}" data-id="${item.id}" aria-label="Add to favorites">
                <svg viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
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

if (productGrid) {
    productGrid.addEventListener("click", (e) => {
        const favoriteBtn = e.target.closest(".favorite-toggle-btn");
        if (favoriteBtn) {
            e.stopPropagation();
            const itemId = favoriteBtn.getAttribute("data-id");
            toggleFavorite(itemId);
        }
    });
}

/* =====================================================
   SEARCH & SORTING
===================================================== */
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchSuggestions = document.getElementById("searchSuggestions");

function performSearch(query) {
    if (!query) {
        if(searchSuggestions) searchSuggestions.classList.add("hidden");
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
    showSuggestions(matches);
}

if (searchInput && searchButton) {
    searchInput.addEventListener("input", function () {
        performSearch(this.value.trim().toLowerCase());
    });

    searchButton.addEventListener("click", function (e) {
        e.preventDefault();
        const query = searchInput.value.trim().toLowerCase();
        performSearch(query);
        if(searchSuggestions) searchSuggestions.classList.add("hidden");
        const marketSection = document.querySelector(".marketplace-section");
        if (marketSection) marketSection.scrollIntoView({ behavior: "smooth" });
    });

    searchInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            searchButton.click();
        }
    });
}

function showSuggestions(items) {
    if(!searchSuggestions) return;
    searchSuggestions.innerHTML = "";
    if (items.length === 0) {
        searchSuggestions.innerHTML = `
            <div class="suggestion-item">
                <div class="suggestion-icon">🔎</div>
                <div>
                    <div class="suggestion-name">No matching items</div>
                    <div class="suggestion-category">Try another search</div>
                </div>
            </div>`;
        searchSuggestions.classList.remove("hidden");
        return;
    }

    items.slice(0, 5).forEach(item => {
        const suggestion = document.createElement("div");
        suggestion.className = "suggestion-item";
        suggestion.innerHTML = `
            <div class="suggestion-icon">📦</div>
            <div>
                <div class="suggestion-name">${item.name}</div>
                <div class="suggestion-category">${item.category} • ₹${item.price}</div>
            </div>`;
        
        suggestion.addEventListener("click", () => {
            searchInput.value = item.name;
            searchSuggestions.classList.add("hidden");
            renderProducts([item]);
        });
        searchSuggestions.appendChild(suggestion);
    });
    searchSuggestions.classList.remove("hidden");
}

document.addEventListener("click", event => {
    if (searchSuggestions && !event.target.closest(".search-wrapper")) {
        searchSuggestions.classList.add("hidden");
    }
});

/* =====================================================
   PAGE NAVIGATION
===================================================== */
const navLinks = document.querySelectorAll(".nav-link");
const pages = {
    home: document.getElementById("homePage"),
    alerts: document.getElementById("alertsPage"),
    sell: document.getElementById("sellPage"),
    profile: document.getElementById("profilePage")
};

navLinks.forEach(button => {
    button.addEventListener("click", () => {
        const target = button.dataset.page;
        if (!target || !pages[target]) return;

        // Gate the Sell tab behind authentication
        if (target === "sell" && !currentUser) {
            alert("Please sign in with your Gmail account to sell items.");
            openAuthModal(false);
            return;
        }

        navLinks.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        
        Object.values(pages).forEach(page => {
            if(page) page.classList.remove("active-page");
        });
        
        pages[target].classList.add("active-page");
        
        if (target === "profile") {
            renderFavorites();
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});

/* =====================================================
   CATEGORY FILTER
===================================================== */
const categoryButtons = document.querySelectorAll(".category-card");
categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;
        const filtered = marketplaceItems.filter(item => item.category === category);
        
        Object.values(pages).forEach(page => {
            if(page) page.classList.remove("active-page");
        });
        if(pages.home) pages.home.classList.add("active-page");
        
        navLinks.forEach(btn => btn.classList.remove("active"));
        const homeBtn = document.querySelector('[data-page="home"]');
        if(homeBtn) homeBtn.classList.add("active");
        
        renderProducts(filtered);
        
        const marketSection = document.querySelector(".marketplace-section");
        if(marketSection) marketSection.scrollIntoView({ behavior: "smooth" });
    });
});

/* =====================================================
   CREATE LISTING FORM HANDLING (CLOUDINARY + FIRESTORE)
===================================================== */
const createListingForm = document.getElementById("createListingForm");
const itemImageInput = document.getElementById("itemImage");
const triggerImageBtn = document.getElementById("triggerImageBtn");
const imagePreview = document.getElementById("imagePreview");
const formError = document.getElementById("formError");

if(triggerImageBtn && itemImageInput) {
    triggerImageBtn.addEventListener("click", () => itemImageInput.click());
    
    itemImageInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                if(imagePreview) imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            }
            reader.readAsDataURL(file);
        }
    });
}

if(createListingForm) {
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
            showError("Please fill out all fields and upload an image.");
            return;
        }

        if (price <= 0) {
            showError("Price must be greater than 0.");
            return;
        }

        if(formError) formError.classList.add("hidden");

        const submitBtn = createListingForm.querySelector(".submit-btn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading image...";

        try {
            // Upload to Cloudinary Free CDN
            const formData = new FormData();
            formData.append("file", imageFile);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                { method: "POST", body: formData }
            );

            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                throw new Error(errData.error?.message || "Image upload failed");
            }

            const uploadData = await uploadRes.json();
            const imageUrl = uploadData.secure_url;

            submitBtn.textContent = "Saving listing...";

            // Save document into Firestore
            await db.collection("listings").add({
                name: name,
                price: price,
                category: category,
                description: desc,
                imageUrl: imageUrl,
                sellerEmail: currentUser.email,
                sellerUid: currentUser.uid,
                isFavorite: false,
                isSold: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Success! Your item is live on NMIT Bazaar.");
            
            createListingForm.reset();
            if(imagePreview) imagePreview.innerHTML = `<span>+ Upload Image</span>`;
            
            const homeNav = document.querySelector('[data-page="home"]');
            if(homeNav) homeNav.click();

        } catch (err) {
            console.error("Listing submission error:", err);
            showError(err.message || "Failed to publish listing.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Publish Listing";
        }
    });
}

function showError(message) {
    if(formError) {
        formError.textContent = message;
        formError.classList.remove("hidden");
    }
}

/* =====================================================
   PROFILE TABS LOGIC
===================================================== */
const profileTabs = document.querySelectorAll(".profile-tab");
const tabContents = document.querySelectorAll(".tab-content");

profileTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        profileTabs.forEach(t => t.classList.remove("active"));
        tabContents.forEach(c => {
            c.classList.remove("active-tab");
            c.classList.add("hidden");
        });

        tab.classList.add("active");

        const targetId = tab.getAttribute("data-tab") + "Tab";
        const targetContent = document.getElementById(targetId);
        if(targetContent) {
            targetContent.classList.remove("hidden");
            targetContent.classList.add("active-tab");
        }
        
        if (tab.getAttribute("data-tab") === "favorites") {
            renderFavorites();
        }
    });
});

/* =====================================================
   CHAT REPLY LOGIC
===================================================== */
const chatInput = document.querySelector(".chat-input");
const chatSendBtn = document.querySelector(".chat-send-btn");
const chatMessages = document.querySelector(".chat-messages");

function sendMessage() {
    if(!chatInput || !chatMessages) return;
    const text = chatInput.value.trim();
    if (!text) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageHTML = `
        <div class="message-bubble sent">
            <p>${text}</p>
            <span class="msg-time">${time}</span>
        </div>
    `;
    
    chatMessages.insertAdjacentHTML("beforeend", messageHTML);
    chatInput.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (chatSendBtn && chatInput && chatMessages) {
    chatSendBtn.addEventListener("click", sendMessage);
    chatInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });
}

/* =====================================================
   EDIT PROFILE MODAL
===================================================== */
const editProfileBtn = document.getElementById("editProfileBtn");
const editProfileModal = document.getElementById("editProfileModal");
const closeProfileModal = document.getElementById("closeProfileModal");
const cancelProfileModal = document.getElementById("cancelProfileModal");
const editProfileForm = document.getElementById("editProfileForm");

const userNameDisplay = document.getElementById("userNameDisplay");
const userProgramDisplay = document.getElementById("userProgramDisplay");
const userDeptDisplay = document.getElementById("userDeptDisplay");
const userYearDisplay = document.getElementById("userYearDisplay");

const editFullName = document.getElementById("editFullName");
const editDepartment = document.getElementById("editDepartment");
const editJoiningYear = document.getElementById("editJoiningYear");
const selectedProgramInput = document.getElementById("selectedProgramInput");
const programPills = document.querySelectorAll(".program-pill-btn");

const currentYear = new Date().getFullYear();
if (editJoiningYear) {
    editJoiningYear.max = currentYear;
}

programPills.forEach(pill => {
    pill.addEventListener("click", () => {
        programPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        if (selectedProgramInput) {
            selectedProgramInput.value = pill.getAttribute("data-program");
        }
    });
});

function openProfileModal() {
    if (!editProfileModal) return;
    
    editJoiningYear.max = new Date().getFullYear();

    editFullName.value = userNameDisplay.textContent.trim();
    editDepartment.value = userDeptDisplay ? userDeptDisplay.textContent.trim() : "";
    editJoiningYear.value = userYearDisplay.textContent.trim();

    const currentProgram = userProgramDisplay ? userProgramDisplay.textContent.trim() : "Undergraduate - BTech";
    if (selectedProgramInput) {
        selectedProgramInput.value = currentProgram;
    }

    programPills.forEach(pill => {
        if (pill.getAttribute("data-program") === currentProgram) {
            pill.classList.add("active");
            pill.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else {
            pill.classList.remove("active");
        }
    });

    editProfileModal.classList.remove("hidden");
}

function closeProfileModalHandler() {
    if (!editProfileModal) return;
    editProfileModal.classList.add("hidden");
}

if (editProfileBtn) editProfileBtn.addEventListener("click", openProfileModal);
if (closeProfileModal) closeProfileModal.addEventListener("click", closeProfileModalHandler);
if (cancelProfileModal) cancelProfileModal.addEventListener("click", closeProfileModalHandler);

if (editProfileModal) {
    editProfileModal.addEventListener("click", (e) => {
        if (e.target === editProfileModal) {
            closeProfileModalHandler();
        }
    });
}

if (editProfileForm) {
    editProfileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const newName = editFullName.value.trim();
        const newDept = editDepartment.value.trim();
        const enteredYear = parseInt(editJoiningYear.value, 10);
        const thisYear = new Date().getFullYear();
        const newProgram = selectedProgramInput ? selectedProgramInput.value.trim() : "Undergraduate - BTech";

        if (enteredYear > thisYear) {
            alert(`Joining year cannot be greater than the current year (${thisYear}).`);
            editJoiningYear.focus();
            return;
        }

        if (newName && newDept && enteredYear && newProgram) {
            userNameDisplay.textContent = newName;
            if (userProgramDisplay) userProgramDisplay.textContent = newProgram;
            if (userDeptDisplay) userDeptDisplay.textContent = newDept;
            userYearDisplay.textContent = enteredYear;
            closeProfileModalHandler();
        }
    });
}

const favoritesTab = document.getElementById("favoritesTab");
if (favoritesTab) {
    favoritesTab.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".favorite-icon-active");
        if (removeBtn) {
            const itemId = removeBtn.getAttribute("data-id");
            if (confirm("Remove this item from your favorites?")) {
                toggleFavorite(itemId);
            }
        }
    });
}

const listingsTab = document.getElementById("listingsTab");
if (listingsTab) {
    listingsTab.addEventListener("click", (e) => {
        const card = e.target.closest(".product-card");
        if (!card) return;

        if (e.target.closest(".delete-btn")) {
            if (confirm("Are you sure you want to permanently delete this listing?")) {
                card.remove();
            }
        } else if (e.target.closest(".sold-btn")) {
            card.classList.toggle("sold-out");
        } else if (e.target.closest(".edit-btn")) {
            alert("This will open the 'Edit Listing' form populated with this item's data.");
        }
    });
}

/* =====================================================
   FIREBASE AUTHENTICATION (GMAIL GATE)
===================================================== */
let isSignUpMode = false;

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
        if (userNameDisplay) userNameDisplay.textContent = user.displayName || user.email.split("@")[0];
    } else {
        if (authBtn) authBtn.textContent = "Sign In";
    }
});

function openAuthModal(signup = false) {
    if (!authModal) return;
    setAuthMode(signup);
    if (authError) authError.classList.add("hidden");
    authModal.classList.remove("hidden");
}

function closeAuthModalHandler() {
    if (!authModal) return;
    authModal.classList.add("hidden");
    if (authForm) authForm.reset();
}

function setAuthMode(signup) {
    isSignUpMode = signup;
    if (isSignUpMode) {
        authModalTitle.textContent = "Create Account";
        authSubmitBtn.textContent = "Register";
        tabSignUp.classList.add("active");
        tabSignIn.classList.remove("active");
    } else {
        authModalTitle.textContent = "Sign In";
        authSubmitBtn.textContent = "Sign In";
        tabSignIn.classList.add("active");
        tabSignUp.classList.remove("active");
    }
}

if (tabSignIn) tabSignIn.addEventListener("click", () => setAuthMode(false));
if (tabSignUp) tabSignUp.addEventListener("click", () => setAuthMode(true));

if (authBtn) {
    authBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (currentUser) {
            if (confirm("Do you want to sign out?")) {
                auth.signOut();
            }
        } else {
            openAuthModal(false);
        }
    });
}

if (closeAuthModal) closeAuthModal.addEventListener("click", closeAuthModalHandler);
if (authModal) {
    authModal