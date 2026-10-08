console.log("Script initialized with email verification gate 🚀");

const firebaseConfig = {
  apiKey: "AIzaSyCz5jwtnPd-zw32eGhF7LCtR59WNYQ4cnE",
  authDomain: "nmit-bazaar.firebaseapp.com",
  projectId: "nmit-bazaar",
  storageBucket: "nmit-bazaar.firebasestorage.app",
  messagingSenderId: "1064459826757",
  appId: "1:1064459826757:web:c6b86ac236559b87d5552c"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

const CLOUDINARY_CLOUD_NAME = "a9wphmyb";
const CLOUDINARY_UPLOAD_PRESET = "NMIT_Bazaar";

let currentUser = null;
let marketplaceItems = [];
let allUserListings = [];
let userFavoriteIds = new Set();
let activeViewingItem = null;
let activeSelectedCategory = null;
let authMode = "signin";

let currentChatId = null;
let unsubscribeMessages = null;
let unsubscribeThreads = null;
let unsubscribeUnreadBadge = null;
let unsubscribeUserFavorites = null;

let previousUnreadCount = 0;
let hasRequestedNotificationPermission = false;

let liveExchangeRatesToINR = {
    INR: 1,
    USD: 84.0,
    EUR: 92.0
};

async function fetchDailyExchangeRates() {
    const CACHE_KEY = "nmit_bazaar_forex_rates";
    const CACHE_TIME_KEY = "nmit_bazaar_forex_timestamp";
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    const cachedRates = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);

    if (
        cachedRates &&
        cachedTime &&
        Date.now() - Number(cachedTime) < SIX_HOURS
    ) {
        try {
            liveExchangeRatesToINR = JSON.parse(cachedRates);
            return;
        } catch (e) {
            console.warn("Could not parse cached FX rates:", e);
        }
    }

    try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");

        if (!res.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await res.json();

        if (data && data.rates && data.rates.INR) {
            const inrPerUsd = data.rates.INR;
            const inrPerEur = data.rates.EUR
                ? inrPerUsd / data.rates.EUR
                : inrPerUsd * 1.08;

            liveExchangeRatesToINR = {
                INR: 1,
                USD: Number(inrPerUsd.toFixed(2)),
                EUR: Number(inrPerEur.toFixed(2))
            };

            localStorage.setItem(
                CACHE_KEY,
                JSON.stringify(liveExchangeRatesToINR)
            );

            localStorage.setItem(
                CACHE_TIME_KEY,
                String(Date.now())
            );
        }
    } catch (error) {
        console.warn("Exchange rate update failed:", error);
    }
}

function convertToINR(amount, currency) {
    const value = Number(amount) || 0;
    const rate = liveExchangeRatesToINR[currency] || 1;
    return value * rate;
}

function formatMarketplacePrice(item) {
    if (!item) return "₹0";

    const amount = Number(item.price) || 0;
    const currency = item.currency || "INR";

    if (currency === "INR") {
        return `₹${amount.toLocaleString("en-IN")}`;
    }

    const inrValue = convertToINR(amount, currency);

    return `₹${Math.round(inrValue).toLocaleString("en-IN")}`;
}

function getOriginalPriceText(item) {
    if (!item) return "";

    const amount = Number(item.price) || 0;
    const currency = item.currency || "INR";

    if (currency === "INR") {
        return `₹${amount.toLocaleString("en-IN")}`;
    }

    return `${currency} ${amount.toLocaleString("en-IN")}`;
}

function escapeHTML(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getUserDisplayName(user) {
    if (!user) return "User";

    return (
        user.displayName ||
        user.email?.split("@")[0] ||
        "User"
    );
}

function getItemSellerName(item) {
    return (
        item.sellerName ||
        item.sellerDisplayName ||
        item.userName ||
        item.displayName ||
        item.sellerEmail?.split("@")[0] ||
        "NMIT Student"
    );
}

function getItemSellerEmail(item) {
    return (
        item.sellerEmail ||
        item.userEmail ||
        ""
    );
}

function getItemOwnerId(item) {
    return (
        item.sellerUid ||
        item.userId ||
        item.ownerId ||
        ""
    );
}

function isCurrentUserOwner(item) {
    if (!currentUser || !item) return false;

    const ownerId = getItemOwnerId(item);

    if (
        ownerId &&
        ownerId === currentUser.uid
    ) {
        return true;
    }

    const sellerEmail = getItemSellerEmail(item);

    return (
        sellerEmail &&
        currentUser.email &&
        sellerEmail.toLowerCase() === currentUser.email.toLowerCase()
    );
}

function getPageElement(pageName) {
    return document.getElementById(`${pageName}Page`);
}

function switchNavigationTab(pageName) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active-page");
    });

    const targetPage = getPageElement(pageName);

    if (targetPage) {
        targetPage.classList.add("active-page");
    }

    document.querySelectorAll(".nav-link").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    document.querySelectorAll(".bottom-tab-btn").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    if (pageName === "messages") {
        loadMessageThreads();
    }

    if (pageName === "profile") {
        renderProfilePage();
    }

    if (pageName === "sell") {
        resetSellForm();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function openAuthModal(mode = "signin") {
    authMode = mode;

    const modal = document.getElementById("authModal");

    if (!modal) return;

    modal.classList.remove("hidden");

    updateAuthModal();
}

function closeAuthModal() {
    const modal = document.getElementById("authModal");

    if (modal) {
        modal.classList.add("hidden");
    }
}

function updateAuthModal() {
    const signInTab = document.getElementById("signInTab");
    const signUpTab = document.getElementById("signUpTab");
    const title = document.getElementById("authModalTitle");
    const submitButton = document.getElementById("authSubmitBtn");
    const nameField = document.getElementById("authNameField");

    if (authMode === "signup") {
        signInTab?.classList.remove("active");
        signUpTab?.classList.add("active");

        if (title) {
            title.textContent = "Create Account";
        }

        if (submitButton) {
            submitButton.textContent = "Create Account";
        }

        if (nameField) {
            nameField.classList.remove("hidden");
        }
    } else {
        signUpTab?.classList.remove("active");
        signInTab?.classList.add("active");

        if (title) {
            title.textContent = "Welcome Back";
        }

        if (submitButton) {
            submitButton.textContent = "Sign In";
        }

        if (nameField) {
            nameField.classList.add("hidden");
        }
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const nameInput = document.getElementById("authName");

    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    const name = nameInput?.value.trim();

    if (!email || !password) {
        alert("Please enter your email and password.");
        return;
    }

    try {
        if (authMode === "signup") {
            if (!name) {
                alert("Please enter your name.");
                return;
            }

            const credential = await auth.createUserWithEmailAndPassword(
                email,
                password
            );

            await credential.user.updateProfile({
                displayName: name
            });

            await db.collection("users").doc(credential.user.uid).set(
                {
                    uid: credential.user.uid,
                    name,
                    email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                },
                { merge: true }
            );

            alert("Account created successfully.");
        } else {
            await auth.signInWithEmailAndPassword(
                email,
                password
            );
        }

        closeAuthModal();
    } catch (error) {
        console.error(error);

        let message = error.message || "Authentication failed.";

        if (error.code === "auth/email-already-in-use") {
            message = "This email is already registered.";
        }

        if (error.code === "auth/invalid-email") {
            message = "Please enter a valid email address.";
        }

        if (error.code === "auth/weak-password") {
            message = "Password should be at least 6 characters.";
        }

        if (error.code === "auth/invalid-credential") {
            message = "Incorrect email or password.";
        }

        alert(message);
    }
}

async function signOutUser() {
    try {
        await auth.signOut();
        switchNavigationTab("home");
    } catch (error) {
        console.error("Sign out failed:", error);
        alert("Unable to sign out.");
    }
}

function updateAuthButtons() {
    const authButtons = [
        document.getElementById("authBtn"),
        document.getElementById("mobileAuthBtn")
    ];

    authButtons.forEach(button => {
        if (!button) return;

        if (currentUser) {
            button.textContent = "Sign Out";
        } else {
            button.textContent = "Sign In";
        }
    });
}

function handleAuthButtonClick() {
    if (currentUser) {
        signOutUser();
    } else {
        openAuthModal("signin");
    }
}

async function saveUserProfile() {
    if (!currentUser) return;

    const nameInput = document.getElementById("profileNameInput");

    if (!nameInput) return;

    const name = nameInput.value.trim();

    if (!name) {
        alert("Please enter your name.");
        return;
    }

    try {
        await currentUser.updateProfile({
            displayName: name
        });

        await db.collection("users").doc(currentUser.uid).set(
            {
                uid: currentUser.uid,
                name,
                email: currentUser.email
            },
            { merge: true }
        );

        alert("Profile updated successfully.");

        closeEditProfileModal();
        renderProfilePage();
    } catch (error) {
        console.error(error);
        alert("Unable to update profile.");
    }
}

function openEditProfileModal() {
    if (!currentUser) {
        openAuthModal("signin");
        return;
    }

    const modal = document.getElementById("editProfileModal");
    const input = document.getElementById("profileNameInput");

    if (input) {
        input.value = currentUser.displayName || "";
    }

    modal?.classList.remove("hidden");
}

function closeEditProfileModal() {
    document.getElementById("editProfileModal")?.classList.add("hidden");
}

async function uploadImageToCloudinary(file) {
    if (!file) {
        return null;
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    if (!response.ok) {
        throw new Error("Image upload failed.");
    }

    const data = await response.json();

    return data.secure_url;
}

function resetSellForm() {
    const form = document.getElementById("sellForm");

    if (!form) return;

    form.reset();

    const imagePreview = document.getElementById("sellImagePreview");

    if (imagePreview) {
        imagePreview.innerHTML = "";
    }

    const selectedImage = document.getElementById("selectedImage");

    if (selectedImage) {
        selectedImage.value = "";
    }
}

async function handleSellFormSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
        openAuthModal("signin");
        return;
    }

    const name = document.getElementById("itemName")?.value.trim();
    const category = document.getElementById("itemCategory")?.value;
    const price = document.getElementById("itemPrice")?.value;
    const currency =
        document.getElementById("itemCurrency")?.value || "INR";
    const description =
        document.getElementById("itemDescription")?.value.trim();
    const condition =
        document.getElementById("itemCondition")?.value || "";
    const imageInput = document.getElementById("itemImage");

    if (!name || !category || !price) {
        alert("Please fill in all required fields.");
        return;
    }

    const submitButton =
        document.querySelector("#sellForm button[type='submit']");

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Posting...";
    }

    try {
        let imageUrl = "";

        if (imageInput?.files?.length) {
            imageUrl = await uploadImageToCloudinary(
                imageInput.files[0]
            );
        }

        const listing = {
            name,
            category,
            price: Number(price),
            currency,
            description,
            condition,
            imageUrl,
            sellerUid: currentUser.uid,
            sellerEmail: currentUser.email,
            sellerName: getUserDisplayName(currentUser),
            isSold: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("listings").add(listing);

        alert("Your item has been listed successfully.");

        resetSellForm();
        switchNavigationTab("home");
    } catch (error) {
        console.error(error);
        alert("Unable to create listing: " + error.message);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Post Listing";
        }
    }
}

function renderMarketplace(items = marketplaceItems) {
    const productGrid = document.getElementById("productGrid");

    if (!productGrid) return;

    if (!items.length) {
        productGrid.innerHTML = `
            <div class="empty-state">
                <h3>No items found</h3>
                <p>Try another search or category.</p>
            </div>
        `;
        return;
    }

    productGrid.innerHTML = "";

    items.forEach(item => {
        const card = document.createElement("article");

        card.className = `product-card ${item.isSold ? "is-sold" : ""}`;
        card.dataset.id = item.id;

        const imageContent = item.imageUrl
            ? `<img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.name)}">`
            : `<div class="product-placeholder">📦</div>`;

        const isFavorite = userFavoriteIds.has(item.id);

        card.innerHTML = `
            ${item.isSold ? `<span class="sold-ribbon">Sold</span>` : ""}
            <button type="button" class="favorite-btn ${isFavorite ? "active" : ""}" data-id="${item.id}">
                ${isFavorite ? "♥" : "♡"}
            </button>

            <div class="product-image">
                ${imageContent}
            </div>

            <div class="product-info">
                <div class="product-category">
                    ${escapeHTML(item.category || "Others")}
                </div>

                <div class="product-name">
                    ${escapeHTML(item.name)}
                </div>

                <div class="product-price">
                    ${formatMarketplacePrice(item)}
                </div>

                <div class="product-seller">
                    ${escapeHTML(getItemSellerName(item))}
                </div>
            </div>
        `;

        card.querySelector(".product-image")?.addEventListener(
            "click",
            () => openProductDetailModal(item.id)
        );

        card.querySelector(".product-info")?.addEventListener(
            "click",
            () => openProductDetailModal(item.id)
        );

        card.querySelector(".favorite-btn")?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                toggleFavorite(item.id);
            }
        );

        productGrid.appendChild(card);
    });
}

async function loadMarketplaceItems() {
    try {
        const snapshot = await db
            .collection("listings")
            .orderBy("createdAt", "desc")
            .get();

        marketplaceItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderMarketplace();
        updateCategoryCounts();
    } catch (error) {
        console.error("Failed to load listings:", error);

        try {
            const snapshot = await db
                .collection("listings")
                .get();

            marketplaceItems = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            marketplaceItems.sort((a, b) => {
                const aTime = a.createdAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || 0;
                return bTime - aTime;
            });

            renderMarketplace();
            updateCategoryCounts();
        } catch (fallbackError) {
            console.error(fallbackError);
        }
    }
}

function updateCategoryCounts() {
    document.querySelectorAll(".category-card").forEach(card => {
        const category = card.dataset.category;

        const count = marketplaceItems.filter(
            item => item.category === category && !item.isSold
        ).length;

        const countElement = card.querySelector(".category-count");

        if (countElement) {
            countElement.textContent = count;
        }
    });
}

function filterMarketplace() {
    const searchInput = document.getElementById("searchInput");

    const query = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    let filtered = marketplaceItems.filter(item => {
        if (activeSelectedCategory) {
            return item.category === activeSelectedCategory;
        }

        return true;
    });

    if (query) {
        filtered = filtered.filter(item => {
            const text = [
                item.name,
                item.category,
                item.description,
                item.condition,
                getItemSellerName(item)
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return text.includes(query);
        });
    }

    renderMarketplace(filtered);
}

function performSearch() {
    activeSelectedCategory = null;

    document.querySelectorAll(".category-card").forEach(card => {
        card.classList.remove("active");
    });

    filterMarketplace();

    document.getElementById("searchSuggestions")?.classList.add("hidden");

    document.getElementById("productGrid")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function showSearchSuggestions() {
    const input = document.getElementById("searchInput");
    const suggestions = document.getElementById("searchSuggestions");

    if (!input || !suggestions) return;

    const query = input.value.trim().toLowerCase();

    if (!query) {
        suggestions.classList.add("hidden");
        return;
    }

    const matches = marketplaceItems
        .filter(item => {
            const text = [
                item.name,
                item.category,
                item.description
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return text.includes(query);
        })
        .slice(0, 6);

    if (!matches.length) {
        suggestions.innerHTML = `
            <div class="search-suggestion-empty">
                No matching products found
            </div>
        `;

        suggestions.classList.remove("hidden");
        return;
    }

    suggestions.innerHTML = matches
        .map(item => `
            <button type="button" class="search-suggestion" data-id="${item.id}">
                <span>${escapeHTML(item.name)}</span>
                <small>${escapeHTML(item.category || "")}</small>
            </button>
        `)
        .join("");

    suggestions.classList.remove("hidden");

    suggestions.querySelectorAll(".search-suggestion").forEach(button => {
        button.addEventListener("click", () => {
            const item = marketplaceItems.find(
                product => product.id === button.dataset.id
            );

            if (!item) return;

            input.value = item.name;
            suggestions.classList.add("hidden");

            openProductDetailModal(item.id);
        });
    });
}

function selectCategory(category) {
    activeSelectedCategory = category;

    const searchInput = document.getElementById("searchInput");

    if (searchInput) {
        searchInput.value = "";
    }

    document.querySelectorAll(".category-card").forEach(card => {
        card.classList.toggle(
            "active",
            card.dataset.category === category
        );
    });

    filterMarketplace();

    document.getElementById("productGrid")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function loadUserFavorites() {
    if (!currentUser) {
        userFavoriteIds = new Set();
        renderMarketplace();
        return;
    }

    try {
        const snapshot = await db
            .collection("users")
            .doc(currentUser.uid)
            .collection("favorites")
            .get();

        userFavoriteIds = new Set(
            snapshot.docs.map(doc => doc.id)
        );

        renderMarketplace();
    } catch (error) {
        console.error("Unable to load favorites:", error);
    }
}

async function toggleFavorite(itemId) {
    if (!currentUser) {
        openAuthModal("signin");
        return;
    }

    const favoriteRef = db
        .collection("users")
        .doc(currentUser.uid)
        .collection("favorites")
        .doc(itemId);

    try {
        if (userFavoriteIds.has(itemId)) {
            await favoriteRef.delete();
            userFavoriteIds.delete(itemId);
        } else {
            await favoriteRef.set({
                listingId: itemId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            userFavoriteIds.add(itemId);
        }

        renderMarketplace();

        if (
            document
                .getElementById("profilePage")
                ?.classList.contains("active-page")
        ) {
            renderProfilePage();
        }
    } catch (error) {
        console.error("Favorite update failed:", error);
        alert("Unable to update favorite.");
    }
}

function openProductDetailModal(itemId) {
    const item = marketplaceItems.find(
        product => product.id === itemId
    );

    if (!item) return;

    activeViewingItem = item;

    const modal = document.getElementById("productModal");

    if (!modal) return;

    const image = document.getElementById("modalProductImage");
    const name = document.getElementById("modalProductName");
    const category = document.getElementById("modalProductCategory");
    const price = document.getElementById("modalProductPrice");
    const description = document.getElementById("modalProductDescription");
    const condition = document.getElementById("modalProductCondition");
    const seller = document.getElementById("modalProductSeller");

    if (image) {
        if (item.imageUrl) {
            image.src = item.imageUrl;
            image.classList.remove("hidden");
        } else {
            image.removeAttribute("src");
            image.classList.add("hidden");
        }
    }

    if (name) {
        name.textContent = item.name || "";
    }

    if (category) {
        category.textContent = item.category || "";
    }

    if (price) {
        price.textContent = formatMarketplacePrice(item);
    }

    if (description) {
        description.textContent =
            item.description || "No description provided.";
    }

    if (condition) {
        condition.textContent =
            item.condition || "Not specified";
    }

    if (seller) {
        seller.textContent = getItemSellerName(item);
    }

    const favoriteButton =
        document.getElementById("modalFavoriteBtn");

    if (favoriteButton) {
        favoriteButton.textContent =
            userFavoriteIds.has(item.id) ? "♥" : "♡";

        favoriteButton.classList.toggle(
            "active",
            userFavoriteIds.has(item.id)
        );
    }

    const ownerActions =
        document.getElementById("modalOwnerActions");

    if (ownerActions) {
        ownerActions.classList.toggle(
            "hidden",
            !isCurrentUserOwner(item)
        );
    }

    const contactButton =
        document.getElementById("contactSellerBtn");

    if (contactButton) {
        contactButton.classList.toggle(
            "hidden",
            isCurrentUserOwner(item)
        );
    }

    modal.classList.remove("hidden");
}

function closeProductDetailModal() {
    document
        .getElementById("productModal")
        ?.classList.add("hidden");

    activeViewingItem = null;
}

function openImageLightbox(url) {
    if (!url) return;

    const lightbox = document.getElementById("imageLightbox");
    const image = document.getElementById("lightboxImage");

    if (!lightbox || !image) return;

    image.src = url;
    lightbox.classList.remove("hidden");
}

function closeImageLightbox() {
    document
        .getElementById("imageLightbox")
        ?.classList.add("hidden");
}

async function contactSeller() {
    if (!currentUser) {
        openAuthModal("signin");
        return;
    }

    if (!activeViewingItem) return;

    if (isCurrentUserOwner(activeViewingItem)) {
        return;
    }

    const sellerUid = getItemOwnerId(activeViewingItem);

    if (!sellerUid) {
        alert("Seller information is unavailable.");
        return;
    }

    try {
        const chatId = [
            currentUser.uid,
            sellerUid
        ]
            .sort()
            .join("_");

        await db.collection("chats").doc(chatId).set(
            {
                participants: [currentUser.uid, sellerUid],
                listingId: activeViewingItem.id,
                listingName: activeViewingItem.name,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
        );

        closeProductDetailModal();

        currentChatId = chatId;

        switchNavigationTab("messages");

        openChat(chatId);
    } catch (error) {
        console.error(error);
        alert("Unable to start conversation.");
    }
}

async function loadMessageThreads() {
    const chatList = document.getElementById("chatList");

    if (!chatList) return;

    if (!currentUser) {
        chatList.innerHTML = `
            <div class="empty-chat-state">
                <p>Please sign in to view your messages.</p>
            </div>
        `;
        return;
    }

    if (unsubscribeThreads) {
        unsubscribeThreads();
    }

    unsubscribeThreads = db
        .collection("chats")
        .where("participants", "array-contains", currentUser.uid)
        .onSnapshot(async snapshot => {
            const chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            chats.sort((a, b) => {
                const aTime = a.updatedAt?.seconds || 0;
                const bTime = b.updatedAt?.seconds || 0;

                return bTime - aTime;
            });

            if (!chats.length) {
                chatList.innerHTML = `
                    <div class="empty-chat-state">
                        <p>No conversations yet.</p>
                    </div>
                `;
                return;
            }

            chatList.innerHTML = "";

            for (const chat of chats) {
                const otherUserId =
                    chat.participants.find(
                        id => id !== currentUser.uid
                    );

                let otherUser = null;

                try {
                    if (otherUserId) {
                        const userDoc = await db
                            .collection("users")
                            .doc(otherUserId)
                            .get();

                        if (userDoc.exists) {
                            otherUser = userDoc.data();
                        }
                    }
                } catch (error) {
                    console.warn(error);
                }

                const item = document.createElement("button");

                item.type = "button";
                item.className =
                    `chat-list-item ${chat.id === currentChatId ? "active-chat" : ""}`;

                item.innerHTML = `
                    <div class="chat-item-img">💬</div>
                    <div class="chat-item-details">
                        <div class="chat-item-title">
                            ${escapeHTML(
                                otherUser?.name ||
                                otherUser?.email ||
                                "NMIT Student"
                            )}
                        </div>

                        <div class="chat-item-user">
                            ${escapeHTML(chat.listingName || "Marketplace")}
                        </div>

                        <div class="chat-item-preview">
                            ${escapeHTML(chat.lastMessage || "Start a conversation")}
                        </div>
                    </div>
                `;

                item.addEventListener(
                    "click",
                    () => openChat(chat.id)
                );

                chatList.appendChild(item);
            }
        });
}

async function openChat(chatId) {
    currentChatId = chatId;

    const chatWindow =
        document.getElementById("chatWindow");

    const chatMessages =
        document.getElementById("chatMessages");

    if (!chatWindow || !chatMessages) return;

    chatWindow.classList.add("chat-open");

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    let chatData = null;

    try {
        const chatDoc = await db
            .collection("chats")
            .doc(chatId)
            .get();

        if (chatDoc.exists) {
            chatData = chatDoc.data();
        }
    } catch (error) {
        console.error(error);
    }

    const otherUserId =
        chatData?.participants?.find(
            id => id !== currentUser?.uid
        );

    let otherUser = null;

    if (otherUserId) {
        try {
            const userDoc = await db
                .collection("users")
                .doc(otherUserId)
                .get();

            if (userDoc.exists) {
                otherUser = userDoc.data();
            }
        } catch (error) {
            console.error(error);
        }
    }

    const title =
        document.getElementById("chatWindowTitle");

    const subtitle =
        document.getElementById("chatWindowSubtitle");

    if (title) {
        title.textContent =
            otherUser?.name ||
            otherUser?.email ||
            "NMIT Student";
    }

    if (subtitle) {
        subtitle.textContent =
            chatData?.listingName || "Marketplace";
    }

    unsubscribeMessages = db
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .onSnapshot(snapshot => {
            chatMessages.innerHTML = "";

            snapshot.docs.forEach(doc => {
                const message = doc.data();

                const bubble =
                    document.createElement("div");

                const sent =
                    message.senderId === currentUser?.uid;

                bubble.className =
                    `message-bubble ${sent ? "sent" : "received"}`;

                const time =
                    message.createdAt?.toDate
                        ? message.createdAt
                              .toDate()
                              .toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit"
                              })
                        : "";

                bubble.innerHTML = `
                    <div>${escapeHTML(message.text || "")}</div>
                    <span class="msg-time">${time}</span>
                `;

                chatMessages.appendChild(bubble);
            });

            chatMessages.scrollTop =
                chatMessages.scrollHeight;
        });

    document
        .getElementById("chatInput")
        ?.focus();
}

async function sendChatMessage() {
    if (!currentUser || !currentChatId) return;

    const input =
        document.getElementById("chatInput");

    if (!input) return;

    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    try {
        const messageData = {
            text,
            senderId: currentUser.uid,
            senderName: getUserDisplayName(currentUser),
            createdAt:
                firebase.firestore.FieldValue.serverTimestamp()
        };

        await db
            .collection("chats")
            .doc(currentChatId)
            .collection("messages")
            .add(messageData);

        await db
            .collection("chats")
            .doc(currentChatId)
            .set(
                {
                    lastMessage: text,
                    lastMessageSenderId: currentUser.uid,
                    updatedAt:
                        firebase.firestore.FieldValue.serverTimestamp()
                },
                { merge: true }
            );
    } catch (error) {
        console.error(error);
        alert("Unable to send message.");
    }
}

function closeMobileChat() {
    document
        .getElementById("chatWindow")
        ?.classList.remove("chat-open");

    currentChatId = null;

    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
}

function openEditItemModal(item) {
    if (!item || !isCurrentUserOwner(item)) {
        return;
    }

    const modal =
        document.getElementById("editItemModal");

    if (!modal) return;

    const idInput =
        document.getElementById("editItemId");

    const nameInput =
        document.getElementById("editItemName");

    const categoryInput =
        document.getElementById("editItemCategory");

    const priceInput =
        document.getElementById("editItemPrice");

    const currencyInput =
        document.getElementById("editItemCurrency");

    const descriptionInput =
        document.getElementById("editItemDescription");

    const conditionInput =
        document.getElementById("editItemCondition");

    if (idInput) idInput.value = item.id;
    if (nameInput) nameInput.value = item.name || "";
    if (categoryInput) categoryInput.value = item.category || "";
    if (priceInput) priceInput.value = item.price || "";
    if (currencyInput) currencyInput.value = item.currency || "INR";
    if (descriptionInput) descriptionInput.value = item.description || "";
    if (conditionInput) conditionInput.value = item.condition || "";

    modal.classList.remove("hidden");
}

function closeEditItemModal() {
    document
        .getElementById("editItemModal")
        ?.classList.add("hidden");
}

async function saveEditedItem(event) {
    event.preventDefault();

    if (!currentUser) return;

    const id =
        document.getElementById("editItemId")?.value;

    if (!id) return;

    const item =
        marketplaceItems.find(product => product.id === id);

    if (!item || !isCurrentUserOwner(item)) {
        alert("You can only edit your own listings.");
        return;
    }

    const updates = {
        name:
            document.getElementById("editItemName")?.value.trim(),
        category:
            document.getElementById("editItemCategory")?.value,
        price:
            Number(document.getElementById("editItemPrice")?.value || 0),
        currency:
            document.getElementById("editItemCurrency")?.value || "INR",
        description:
            document.getElementById("editItemDescription")?.value.trim(),
        condition:
            document.getElementById("editItemCondition")?.value || "",
        updatedAt:
            firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db
            .collection("listings")
            .doc(id)
            .update(updates);

        closeEditItemModal();

        alert("Listing updated successfully.");

        await loadMarketplaceItems();
        renderProfilePage();
    } catch (error) {
        console.error(error);
        alert("Unable to update listing.");
    }
}

async function toggleSoldStatus(itemId) {
    if (!currentUser) return;

    const item =
        marketplaceItems.find(product => product.id === itemId);

    if (!item || !isCurrentUserOwner(item)) {
        alert("You can only update your own listing.");
        return;
    }

    try {
        await db
            .collection("listings")
            .doc(itemId)
            .update({
                isSold: !item.isSold,
                updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()
            });

        await loadMarketplaceItems();
        renderProfilePage();
    } catch (error) {
        console.error(error);
        alert("Unable to update listing status.");
    }
}

function renderProfilePage() {
    const profileName =
        document.getElementById("profileName");

    const profileEmail =
        document.getElementById("profileEmail");

    const myListingsGrid =
        document.getElementById("myListingsGrid");

    const favoritesGrid =
        document.getElementById("favoritesGrid");

    if (!currentUser) {
        if (profileName) {
            profileName.textContent = "Guest User";
        }

        if (profileEmail) {
            profileEmail.textContent = "Sign in to manage your profile";
        }

        if (myListingsGrid) {
            myListingsGrid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#70807a;padding:40px;">
                    <p>Please sign in to view your listings.</p>
                    <button type="button" class="secondary-button" style="margin-top:10px;" onclick="openAuthModal('signin')">
                        Sign In
                    </button>
                </div>
            `;
        }

        if (favoritesGrid) {
            favoritesGrid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;color:#70807a;padding:40px;">
                    <p>Please sign in to view your favorites.</p>
                </div>
            `;
        }

        return;
    }

    if (profileName) {
        profileName.textContent =
            getUserDisplayName(currentUser);
    }

    if (profileEmail) {
        profileEmail.textContent =
            currentUser.email || "";
    }

    renderMyListings();
    renderFavorites();
}

function renderMyListings() {
    const myListingsGrid =
        document.getElementById("myListingsGrid");

    if (!myListingsGrid) return;

    if (!currentUser) {
        myListingsGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;color:#70807a;padding:40px;">
                <p>Please sign in to view your listings.</p>
                <button type="button" class="secondary-button" style="margin-top:10px;" onclick="openAuthModal('signin')">
                    Sign In
                </button>
            </div>
        `;

        return;
    }

    const myItems = allUserListings.filter(item => {
        return (
            item.sellerUid === currentUser.uid ||
            item.userId === currentUser.uid ||
            (
                item.sellerEmail &&
                item.sellerEmail.toLowerCase() ===
                    currentUser.email?.toLowerCase()
            )
        );
    });

    if (!myItems.length) {
        myListingsGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;color:#70807a;padding:40px;">
                <h3>No Listings Found</h3>
                <p>You haven't posted any items for sale yet.</p>
                <button type="button" class="primary-button" style="margin-top:15px;" onclick="switchNavigationTab('sell')">
                    + Sell an Item
                </button>
            </div>
        `;

        return;
    }

    myListingsGrid.innerHTML = "";

    myItems.forEach(item => {
        const card = document.createElement("article");

        card.className =
            `product-card my-listing-card ${item.isSold ? "is-sold" : ""}`;

        card.dataset.id = item.id;

        const imageContent = item.imageUrl
            ? `<img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.name)}">`
            : `<div style="font-size:48px;">📦</div>`;

        card.innerHTML = `
            ${item.isSold ? `<span class="sold-ribbon">Sold</span>` : ""}

            <div class="product-image">
                ${imageContent}
            </div>

            <div class="product-info">
                <div class="product-category">
                    ${escapeHTML(item.category || "")}
                </div>

                <div class="product-name">
                    ${escapeHTML(item.name || "")}
                </div>

                <span class="product-price">
                    ${formatMarketplacePrice(item)}
                </span>
            </div>

            <div class="listing-actions-bar">
                <div class="listing-btn-group">
                    <button type="button" class="action-btn edit-btn" data-id="${item.id}">
                        Edit
                    </button>

                    <button type="button" class="action-btn delete-btn" data-id="${item.id}">
                        Delete
                    </button>
                </div>

                <button
                    type="button"
                    class="sold-toggle-btn ${item.isSold ? "marked-sold" : ""}"
                    data-id="${item.id}"
                >
                    ${item.isSold ? "✓ Sold" : "Sold"}
                </button>
            </div>
        `;

        card.querySelector(".product-image")?.addEventListener(
            "click",
            () => openProductDetailModal(item.id)
        );

        card.querySelector(".product-info")?.addEventListener(
            "click",
            () => openProductDetailModal(item.id)
        );

        card.querySelector(".edit-btn")?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                openEditItemModal(item);
            }
        );

        card.querySelector(".delete-btn")?.addEventListener(
            "click",
            async event => {
                event.stopPropagation();

                if (
                    !confirm(
                        `Are you sure you want to delete "${item.name}"?`
                    )
                ) {
                    return;
                }

                try {
                    await db
                        .collection("listings")
                        .doc(item.id)
                        .delete();

                    await loadMarketplaceItems();
                    await loadAllUserListings();
                    renderProfilePage();
                } catch (error) {
                    alert(
                        "Failed to delete listing: " +
                        error.message
                    );
                }
            }
        );

        card.querySelector(".sold-toggle-btn")?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                toggleSoldStatus(item.id);
            }
        );

        myListingsGrid.appendChild(card);
    });
}

function renderFavorites() {
    const favoritesGrid =
        document.getElementById("favoritesGrid");

    if (!favoritesGrid) return;

    if (!currentUser) {
        favoritesGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;color:#70807a;padding:40px;">
                <p>Please sign in to view your favorites.</p>
            </div>
        `;

        return;
    }

    const favorites = marketplaceItems.filter(
        item => userFavoriteIds.has(item.id)
    );

    if (!favorites.length) {
        favoritesGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;color:#70807a;padding:40px;">
                <h3>No Favorites Yet</h3>
                <p>Items you favorite will appear here.</p>
            </div>
        `;

        return;
    }

    favoritesGrid.innerHTML = "";

    favorites.forEach(item => {
        const card = document.createElement("article");

        card.className =
            `product-card ${item.isSold ? "is-sold" : ""}`;

        card.dataset.id = item.id;

        const imageContent = item.imageUrl
            ? `<img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.name)}">`
            : `<div class="product-placeholder">📦</div>`;

        card.innerHTML = `
            ${item.isSold ? `<span class="sold-ribbon">Sold</span>` : ""}

            <button type="button" class="favorite-icon-active" data-id="${item.id}">
                ♥
            </button>

            <div class="product-image">
                ${imageContent}
            </div>

            <div class="product-info">
                <div class="product-category">
                    ${escapeHTML(item.category || "")}
                </div>

                <div class="product-name">
                    ${escapeHTML(item.name || "")}
                </div>

                <div class="product-price">
                    ${formatMarketplacePrice(item)}
                </div>
            </div>
        `;

        card.querySelector(".product-image")?.addEventListener(
            "click",
            () => openProductDetailModal(item.id)
        );

        card.querySelector(".product-info")?.addEventListener(
            "click",
            () => openProductDetailModal(item.id)
        );

        card.querySelector(".favorite-icon-active")?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                toggleFavorite(item.id);
            }
        );

        favoritesGrid.appendChild(card);
    });
}

async function loadAllUserListings() {
    try {
        const snapshot = await db
            .collection("listings")
            .get();

        allUserListings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Unable to load user listings:", error);
        allUserListings = [];
    }
}

function setActiveProfileTab(tabName) {
    document.querySelectorAll(".profile-tab").forEach(tab => {
        tab.classList.toggle(
            "active",
            tab.dataset.tab === tabName
        );
    });

    document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.remove("active-tab");
    });

    const target =
        document.getElementById(`${tabName}Tab`);

    target?.classList.add("active-tab");
}

function handleSearchInput() {
    const searchInput =
        document.getElementById("searchInput");

    if (!searchInput) return;

    if (searchInput.value.trim()) {
        showSearchSuggestions();
    } else {
        document
            .getElementById("searchSuggestions")
            ?.classList.add("hidden");
    }

    filterMarketplace();
}

function setupEventListeners() {
    document.querySelectorAll(".nav-link").forEach(button => {
        button.addEventListener("click", () => {
            switchNavigationTab(button.dataset.page);
        });
    });

    document.querySelectorAll(".bottom-tab-btn").forEach(button => {
        button.addEventListener("click", () => {
            switchNavigationTab(button.dataset.page);
        });
    });

    document
        .getElementById("authBtn")
        ?.addEventListener("click", handleAuthButtonClick);

    document
        .getElementById("mobileAuthBtn")
        ?.addEventListener("click", handleAuthButtonClick);

    document
        .getElementById("searchInput")
        ?.addEventListener("input", handleSearchInput);

    document
        .getElementById("searchInput")
        ?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                performSearch();
            }
        });

    document
        .getElementById("searchButton")
        ?.addEventListener("click", performSearch);

    document.querySelectorAll(".category-card").forEach(card => {
        card.addEventListener("click", () => {
            selectCategory(card.dataset.category);
        });
    });

    document
        .getElementById("sellForm")
        ?.addEventListener("submit", handleSellFormSubmit);

    document
        .getElementById("authForm")
        ?.addEventListener("submit", handleAuthSubmit);

    document
        .getElementById("signInTab")
        ?.addEventListener("click", () => {
            authMode = "signin";
            updateAuthModal();
        });

    document
        .getElementById("signUpTab")
        ?.addEventListener("click", () => {
            authMode = "signup";
            updateAuthModal();
        });

    document
        .getElementById("signOutBtn")
        ?.addEventListener("click", signOutUser);

    document
        .getElementById("editProfileForm")
        ?.addEventListener("submit", event => {
            event.preventDefault();
            saveUserProfile();
        });

    document
        .getElementById("editItemForm")
        ?.addEventListener("submit", saveEditedItem);

    document
        .getElementById("contactSellerBtn")
        ?.addEventListener("click", contactSeller);

    document
        .getElementById("modalFavoriteBtn")
        ?.addEventListener("click", () => {
            if (activeViewingItem) {
                toggleFavorite(activeViewingItem.id);
            }
        });

    document
        .getElementById("chatSendBtn")
        ?.addEventListener("click", sendChatMessage);

    document
        .getElementById("chatInput")
        ?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                sendChatMessage();
            }
        });

    document
        .getElementById("chatBackBtn")
        ?.addEventListener("click", closeMobileChat);

    document
        .getElementById("editProfileBtn")
        ?.addEventListener("click", openEditProfileModal);

    document
        .getElementById("modalProductImage")
        ?.addEventListener("click", event => {
            if (event.target.src) {
                openImageLightbox(event.target.src);
            }
        });
}

function updateLoadingScreen() {
    const loadingScreen =
        document.getElementById("loadingScreen");

    const app =
        document.getElementById("app");

    if (!loadingScreen || !app) return;

    loadingScreen.classList.add("hide");
    app.classList.remove("hidden");

    setTimeout(() => {
        loadingScreen.remove();
    }, 500);
}

auth.onAuthStateChanged(async user => {
    currentUser = user;

    updateAuthButtons();

    if (currentUser) {
        await loadUserFavorites();
        await loadAllUserListings();

        if (!hasRequestedNotificationPermission) {
            hasRequestedNotificationPermission = true;

            if (
                "Notification" in window &&
                Notification.permission === "default"
            ) {
                try {
                    await Notification.requestPermission();
                } catch (error) {
                    console.warn(error);
                }
            }
        }
    } else {
        userFavoriteIds = new Set();
        allUserListings = [];
    }

    renderMarketplace();

    if (
        document
            .getElementById("profilePage")
            ?.classList.contains("active-page")
    ) {
        renderProfilePage();
    }

    if (
        document
            .getElementById("messagesPage")
            ?.classList.contains("active-page")
    ) {
        loadMessageThreads();
    }
});

async function initializeApp() {
    setupEventListeners();

    await fetchDailyExchangeRates();
    await loadMarketplaceItems();

    await loadAllUserListings();

    renderProfilePage();

    setTimeout(updateLoadingScreen, 700);
}

document.addEventListener("DOMContentLoaded", initializeApp);

document.addEventListener("click", event => {
    const suggestions =
        document.getElementById("searchSuggestions");

    const searchWrapper =
        document.querySelector(".search-wrapper");

    if (
        suggestions &&
        searchWrapper &&
        !searchWrapper.contains(event.target)
    ) {
        suggestions.classList.add("hidden");
    }
});

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.signOutUser = signOutUser;
window.switchNavigationTab = switchNavigationTab;
window.openProductDetailModal = openProductDetailModal;
window.closeProductDetailModal = closeProductDetailModal;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.openEditItemModal = openEditItemModal;
window.closeEditItemModal = closeEditItemModal;
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.toggleFavorite = toggleFavorite;
window.toggleSoldStatus = toggleSoldStatus;
window.openChat = openChat;
window.closeMobileChat = closeMobileChat;
window.sendChatMessage = sendChatMessage;
window.setActiveProfileTab = setActiveProfileTab;
window.selectCategory = selectCategory;
window.performSearch = performSearch;
window.contactSeller = contactSeller;