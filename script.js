/* =====================================================
   NMIT BAZAAR - CLIENT LOGIC
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

// Cloudinary Unsigned Upload Settings
const CLOUDINARY_CLOUD_NAME = "a9wphmyb"; 
const CLOUDINARY_UPLOAD_PRESET = "NMIT_Bazaar";             

// State Variables
let currentUser = null;
let marketplaceItems = [];
let activeViewingItem = null;
let authMode = "signin"; // "signin" | "signup" | "reset"

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

// Direct Chat with Seller button inside modal
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
   8. REAL-TIME CHAT (FIRESTORE THREADS & MESSAGES)
===================================================== */
let currentChatId = null;
let unsubscribeMessages = null;
let unsubscribeThreads = null;

const chatLayout = document.querySelector(".chat-layout");
const chatBackBtn = document.getElementById("chatBackBtn");
const chatThreadsList = document.getElementById("chatThreadsList");
const chatHeaderTitle = document.getElementById("chatHeaderTitle");
const chatHeaderSub = document.getElementById("chatHeaderSub");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

// 1. Listen for User's Active Chat Threads in Real-Time
function subscribeToUserChats() {
    if (!currentUser || !chatThreadsList) return;
    if (unsubscribeThreads) unsubscribeThreads();

    unsubscribeThreads = db.collection("chats")
        .where("participants", "array-contains", currentUser.uid)
        .orderBy("updatedAt", "desc")
        .onSnapshot((snapshot) => {
            chatThreadsList.innerHTML = "";

            if (snapshot.empty) {
                chatThreadsList.innerHTML = `
                    <div style="padding: 24px; text-align: center; color: #70807a; font-size: 13px;">
                        No active conversations.<br>Tap "Chat with Seller" on any item!
                    </div>`;
                return;
            }

            snapshot.forEach((doc) => {
                const chat = doc.data();
                const chatId = doc.id;
                const otherUserName = (chat.buyerUid === currentUser.uid) ? chat.sellerName : chat.buyerName;

                const itemDiv = document.createElement("div");
                itemDiv.className = `chat-list-item ${currentChatId === chatId ? "active-chat" : ""}`;
                itemDiv.innerHTML = `
                    <div class="chat-item-img">
                        ${chat.listingImage ? `<img src="${chat.listingImage}" style="width:100%;height:100%;border-radius:10px;object-fit:cover;">` : "📦"}
                    </div>
                    <div class="chat-item-details">
                        <div class="chat-item-title">${chat.listingTitle || "Item"}</div>
                        <div class="chat-item-user">${otherUserName || "Student"}</div>
                        <div class="chat-item-preview">${chat.lastMessage || "Started a chat..."}</div>
                    </div>
                `;

                itemDiv.addEventListener("click", () => {
                    openChatConversation(chatId, chat);
                });

                chatThreadsList.appendChild(itemDiv);
            });
        }, (err) => {
            console.error("Chat threads listener error:", err);
        });
}

// 2. Open an Existing Conversation Window
function openChatConversation(chatId, chatData) {
    currentChatId = chatId;

    // Mobile screen view shift
    if (chatLayout) chatLayout.classList.add("in-conversation");

    // Header info
    const otherUserName = (chatData.buyerUid === currentUser.uid) ? chatData.sellerName : chatData.buyerName;
    if (chatHeaderTitle) chatHeaderTitle.textContent = chatData.listingTitle || "Item";
    if (chatHeaderSub) chatHeaderSub.textContent = `₹${chatData.listingPrice || ""} • Chatting with ${otherUserName || "Student"}`;

    // Highlight selected item in sidebar
    document.querySelectorAll(".chat-list-item").forEach(el => el.classList.remove("active-chat"));

    // Real-time listener for messages subcollection
    if (unsubscribeMessages) unsubscribeMessages();
    if (chatMessages) chatMessages.innerHTML = "";

    unsubscribeMessages = db.collection("chats").doc(chatId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .onSnapshot((snapshot) => {
            if (!chatMessages) return;
            chatMessages.innerHTML = "";

            if (snapshot.empty) {
                chatMessages.innerHTML = `<div style="text-align:center; color:#70807a; padding:20px; font-size:13px;">No messages yet. Send a message below!</div>`;
                return;
            }

            snapshot.forEach((doc) => {
                const msg = doc.data();
                const isSentByMe = msg.senderUid === currentUser.uid;
                const timeString = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now";

                const bubble = document.createElement("div");
                bubble.className = `message-bubble ${isSentByMe ? "sent" : "received"}`;
                bubble.innerHTML = `
                    <p>${msg.text}</p>
                    <span class="msg-time">${timeString}</span>
                `;
                chatMessages.appendChild(bubble);
            });

            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, (err) => {
            console.error("Messages load error:", err);
        });
}

// 3. Initiate Chat from "Chat with Seller" Button
async function startChatWithItem(item) {
    if (!currentUser) {
        alert("Please sign in to chat with sellers.");
        openAuthModal("signin");
        return;
    }

    if (item.sellerUid === currentUser.uid) {
        alert("This is your own listing!");
        return;
    }

    switchNavigationTab("messages");

    const buyerUid = currentUser.uid;
    const sellerUid = item.sellerUid || "seller";
    const buyerName = currentUser.displayName || currentUser.email.split("@")[0];
    const sellerName = item.sellerName || (item.sellerEmail ? item.sellerEmail.split("@")[0] : "Seller");

    // Standard deterministic Chat ID: listingId_buyerUid
    const chatId = `${item.id}_${buyerUid}`;

    const chatDocRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatDocRef.get();

    if (!chatDoc.exists) {
        const initialText = `Hi! I'm interested in buying your ${item.name} for ₹${item.price}. Is it still available on campus?`;

        await chatDocRef.set({
            listingId: item.id,
            listingTitle: item.name,
            listingPrice: item.price,
            listingImage: item.imageUrl || "",
            buyerUid: buyerUid,
            buyerName: buyerName,
            sellerUid: sellerUid,
            sellerName: sellerName,
            participants: [buyerUid, sellerUid],
            lastMessage: initialText,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add introductory message
        await chatDocRef.collection("messages").add({
            senderUid: buyerUid,
            senderName: buyerName,
            text: initialText,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    const updatedSnap = await chatDocRef.get();
    openChatConversation(chatId, updatedSnap.data());
}

// 4. Send Message Function
async function sendChatMessage() {
    if (!currentUser || !currentChatId || !chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";

    try {
        const chatDocRef = db.collection("chats").doc(currentChatId);

        // Add to subcollection
        await chatDocRef.collection("messages").add({
            senderUid: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email.split("@")[0],
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update preview snippet on the thread doc
        await chatDocRef.update({
            lastMessage: text,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error("Error sending message:", err);
    }
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

// Mobile back arrow to thread list
if (chatBackBtn && chatLayout) {
    chatBackBtn.addEventListener("click", () => {
        chatLayout.classList.remove("in-conversation");
    });
}

// Subscribe to chats when user logs in / unsubscribe when logged out
auth.onAuthStateChanged((user) => {
    if (user) {
        subscribeToUserChats();
    } else {
        if (unsubscribeThreads) unsubscribeThreads();
        if (unsubscribeMessages) unsubscribeMessages();
        currentChatId = null;
        if (chatThreadsList) chatThreadsList.innerHTML = "";
        if (chatMessages) chatMessages.innerHTML = "";
    }
});

/* =====================================================
   9. UNIFIED NAVIGATION ROUTING (DESKTOP + MOBILE)
===================================================== */
const pages = {
    home: document.getElementById("homePage"),
    messages: document.getElementById("messagesPage"),
    sell: document.getElementById("sellPage"),
    profile: document.getElementById("profilePage")
};

function switchNavigationTab(targetPage) {
    if (!targetPage || !pages[targetPage]) return;

    if ((targetPage === "sell" || targetPage === "profile") && !currentUser) {
        alert("Please sign in with your email account first.");
        openAuthModal("signin");
        return;
    }

    // Sync Desktop Nav links
    document.querySelectorAll(".nav-link").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-page") === targetPage);
    });

    // Sync Mobile Bottom tabs
    document.querySelectorAll(".bottom-tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-page") === targetPage);
    });

    // Display active page
    Object.values(pages).forEach(p => {
        if (p) p.classList.remove("active-page");
    });
    pages[targetPage].classList.add("active-page");

    if (targetPage === "profile") {
        renderFavorites();
        renderMyListings();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Bind desktop nav buttons
document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => switchNavigationTab(btn.getAttribute("data-page")));
});

// Bind mobile bottom dock buttons
document.querySelectorAll(".bottom-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchNavigationTab(btn.getAttribute("data-page")));
});

/* =====================================================
   10. CATEGORY FILTER
===================================================== */
const categoryButtons = document.querySelectorAll(".category-card");
categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;
        const filtered = marketplaceItems.filter(item => item.category === category);
        
        switchNavigationTab("home");
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
            openAuthModal("signin");
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
            
            switchNavigationTab("home");

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
   13. AUTHENTICATION (UNIVERSAL EMAIL, RESET & VERIFICATION)
===================================================== */
const desktopProfileNavLink = document.getElementById("desktopProfileNavLink");
const bottomProfileTab = document.getElementById("bottomProfileTab");
const authBtn = document.getElementById("authBtn");
const authModal = document.getElementById("authModal");
const closeAuthModal = document.getElementById("closeAuthModal");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const passwordGroup = document.getElementById("passwordGroup");
const authError = document.getElementById("authError");
const authSuccess = document.getElementById("authSuccess");
const authModalTitle = document.getElementById("authModalTitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const authTabsContainer = document.getElementById("authTabsContainer");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
        if (authBtn) authBtn.textContent = "Sign Out";
        if (desktopProfileNavLink) desktopProfileNavLink.classList.remove("hidden");
        if (bottomProfileTab) bottomProfileTab.classList.remove("hidden");

        await loadUserProfile(user.uid);
    } else {
        if (authBtn) authBtn.textContent = "Sign In";
        if (desktopProfileNavLink) desktopProfileNavLink.classList.add("hidden");
        if (bottomProfileTab) bottomProfileTab.classList.add("hidden");

        document.getElementById("userNameDisplay").textContent = "—";
        document.getElementById("userProgramDisplay").textContent = "Program not set";
        document.getElementById("userDeptDisplay").textContent = "Department not set";
        document.getElementById("userYearDisplay").textContent = "—";
    }
});

async function loadUserProfile(uid) {
    try {
        const docSnap = await db.collection("users").doc(uid).get();
        if (docSnap.exists) {
            const data = docSnap.data();
            document.getElementById("userNameDisplay").textContent = data.fullName || currentUser.email.split("@")[0];
            document.getElementById("userProgramDisplay").textContent = data.program || "Program not set";
            document.getElementById("userDeptDisplay").textContent = data.department || "Department not set";
            document.getElementById("userYearDisplay").textContent = data.joiningYear || "—";
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error loading user profile:", e);
        return false;
    }
}

function setAuthMode(mode) {
    authMode = mode;
    if (authError) authError.classList.add("hidden");
    if (authSuccess) authSuccess.classList.add("hidden");

    if (mode === "signin") {
        authModalTitle.textContent = "Sign In";
        authSubmitBtn.textContent = "Sign In";
        passwordGroup.classList.remove("hidden");
        authPassword.required = true;
        authTabsContainer.classList.remove("hidden");
        tabSignIn.classList.add("active");
        tabSignUp.classList.remove("active");
    } else if (mode === "signup") {
        authModalTitle.textContent = "Create Account";
        authSubmitBtn.textContent = "Register";
        passwordGroup.classList.remove("hidden");
        authPassword.required = true;
        authTabsContainer.classList.remove("hidden");
        tabSignUp.classList.add("active");
        tabSignIn.classList.remove("active");
    } else if (mode === "reset") {
        authModalTitle.textContent = "Reset Password";
        authSubmitBtn.textContent = "Send Reset Email";
        passwordGroup.classList.add("hidden");
        authPassword.required = false;
        authTabsContainer.classList.add("hidden");
    }
}

function openAuthModal(mode = "signin") {
    if (!authModal) return;
    setAuthMode(mode);
    authModal.classList.remove("hidden");
}

function closeAuthModalHandler() {
    if (authModal) authModal.classList.add("hidden");
    if (authForm) authForm.reset();
}

if (tabSignIn) tabSignIn.addEventListener("click", () => setAuthMode("signin"));
if (tabSignUp) tabSignUp.addEventListener("click", () => setAuthMode("signup"));
if (forgotPasswordBtn) forgotPasswordBtn.addEventListener("click", () => setAuthMode("reset"));
if (closeAuthModal) closeAuthModal.addEventListener("click", closeAuthModalHandler);

if (authBtn) {
    authBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentUser) {
            if (confirm("Do you want to sign out?")) {
                auth.signOut().then(() => switchNavigationTab("home"));
            }
        } else {
            openAuthModal("signin");
        }
    });
}

if (authForm) {
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = authEmail.value.trim();
        const password = authPassword.value;

        if (authError) authError.classList.add("hidden");
        if (authSuccess) authSuccess.classList.add("hidden");
        authSubmitBtn.disabled = true;

        try {
            if (authMode === "reset") {
                await auth.sendPasswordResetEmail(email);
                authSuccess.textContent = `A password reset link was sent to ${email}. Check your inbox or spam folder.`;
                authSuccess.classList.remove("hidden");
            } else if (authMode === "signup") {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await userCredential.user.sendEmailVerification();

                alert(`Account created! A verification link has been sent to ${email}. Please check your Inbox and Spam folder.`);

                closeAuthModalHandler();
                switchNavigationTab("profile");
                setTimeout(() => openEditProfileModalForSetup(), 300);
            } else {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                closeAuthModalHandler();

                const profileExists = await loadUserProfile(userCredential.user.uid);
                switchNavigationTab("profile");
                if (!profileExists) {
                    setTimeout(() => openEditProfileModalForSetup(), 300);
                }
            }
        } catch (err) {
            authError.textContent = err.message;
            authError.classList.remove("hidden");
        } finally {
            authSubmitBtn.disabled = false;
        }
    });
}

/* =====================================================
   14. PROFILE EDITING MODAL (FIRESTORE SYNC)
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

function openEditProfileModalForSetup() {
    if (!editProfileModal) return;

    document.getElementById("editFullName").value = currentUser?.displayName || "";
    document.getElementById("editDepartment").value = "";
    editJoiningYear.value = "";

    programPills.forEach((p, idx) => p.classList.toggle("active", idx === 0));
    if (selectedProgramInput) selectedProgramInput.value = "Undergraduate - BTech";

    editProfileModal.classList.remove("hidden");
}

if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
        if (!editProfileModal) return;

        const currentName = document.getElementById("userNameDisplay").textContent;
        const currentDept = document.getElementById("userDeptDisplay").textContent;
        const currentYear = document.getElementById("userYearDisplay").textContent;

        document.getElementById("editFullName").value = currentName !== "—" ? currentName : "";
        document.getElementById("editDepartment").value = currentDept !== "Department not set" ? currentDept : "";
        editJoiningYear.value = currentYear !== "—" ? currentYear : "";

        editProfileModal.classList.remove("hidden");
    });
}

if (closeProfileModal) closeProfileModal.addEventListener("click", () => editProfileModal.classList.add("hidden"));
if (cancelProfileModal) cancelProfileModal.addEventListener("click", () => editProfileModal.classList.add("hidden"));

if (editProfileForm) {
    editProfileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newName = document.getElementById("editFullName").value.trim();
        const newDept = document.getElementById("editDepartment").value.trim();
        const enteredYear = parseInt(editJoiningYear.value, 10);
        const thisYear = new Date().getFullYear();
        const program = selectedProgramInput ? selectedProgramInput.value : "Undergraduate - BTech";

        if (enteredYear > thisYear) {
            alert(`Joining year cannot exceed ${thisYear}.`);
            return;
        }

        if (currentUser) {
            await db.collection("users").doc(currentUser.uid).set({
                fullName: newName,
                department: newDept,
                program: program,
                joiningYear: enteredYear,
                email: currentUser.email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        document.getElementById("userNameDisplay").textContent = newName;
        document.getElementById("userDeptDisplay").textContent = newDept;
        document.getElementById("userYearDisplay").textContent = enteredYear;
        document.getElementById("userProgramDisplay").textContent = program;

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