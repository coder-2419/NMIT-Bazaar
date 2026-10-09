console.log("Script initialized with user-scoped favorites and email verification gate 🚀");


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

    if (cachedRates && cachedTime && (Date.now() - Number(cachedTime) < SIX_HOURS)) {
        try {
            liveExchangeRatesToINR = JSON.parse(cachedRates);
            return;
        } catch (e) {
            console.warn("Could not parse cached FX rates:", e);
        }
    }

    try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!res.ok) throw new Error("Network response was not ok");
        
        const data = await res.json();
        if (data && data.rates && data.rates.INR) {
            const inrPerUsd = data.rates.INR;
            const inrPerEur = data.rates.EUR ? (inrPerUsd / data.rates.EUR) : (inrPerUsd * 1.08);

            liveExchangeRatesToINR = {
                INR: 1,
                USD: Number(inrPerUsd.toFixed(2)),
                EUR: Number(inrPerEur.toFixed(2))
            };

            localStorage.setItem(CACHE_KEY, JSON.stringify(liveExchangeRatesToINR));
            localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
            console.log("Live market exchange rates online sync completed:", liveExchangeRatesToINR);

            if (marketplaceItems.length > 0) {
                renderProducts(marketplaceItems);
            }
        }
    } catch (err) {
        console.warn("Live currency rates online fetch failed, using fallback:", err);
    }
}

function getPriceInRupees(price, currency = "INR") {
    const curr = (currency || "INR").toUpperCase();
    const rate = liveExchangeRatesToINR[curr] || 1;
    return Math.round(Number(price) * rate);
}

function formatMarketplacePrice(item) {
    const inrVal = getPriceInRupees(item.price, item.currency || "INR");
    const curr = (item.currency || "INR").toUpperCase();
    
    if (curr === "INR") {
        return `₹${inrVal.toLocaleString("en-IN")}`;
    }
    const symbol = curr === "USD" ? "$" : (curr === "EUR" ? "€" : curr);
    return `₹${inrVal.toLocaleString("en-IN")} <span class="currency-original-note">(${symbol}${item.price})</span>`;
}

fetchDailyExchangeRates();


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


db.collection("listings").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
    marketplaceItems = [];
    allUserListings = [];

    snapshot.forEach((doc) => {
        const data = doc.data();
        const itemObj = { id: doc.id, ...data };
        
        allUserListings.push(itemObj);

        
        if (data.isSold !== true) {
            marketplaceItems.push(itemObj);
        }
    });
    
    
    if (activeSelectedCategory) {
        const filtered = marketplaceItems.filter(item => item.category === activeSelectedCategory);
        renderProducts(filtered);
    } else {
        renderProducts(marketplaceItems);
    }

    renderFavorites();
    renderMyListings();
}, (error) => {
    console.error("Firestore sync error:", error);
});


const productGrid = document.getElementById("productGrid");
const resultCount = document.getElementById("resultCount");

function renderProducts(items) {
    if (!productGrid || !resultCount) return;
    productGrid.innerHTML = "";
    resultCount.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;

    if (items.length === 0) {
        productGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1; text-align:center; padding:40px; color:#70807a;">
                <h3>No items available</h3>
                <p>Be the first one to post a listing!</p>
            </div>`;
        return;
    }

    items.forEach(item => {
        const card = document.createElement("article");
        card.className = "product-card";
        card.setAttribute("data-id", item.id);

        const isFavoritedByCurrentUser = userFavoriteIds.has(item.id);

        const imageContent = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}">`
            : `<div style="font-size: 48px;">📦</div>`;

        card.innerHTML = `
            <button class="favorite-toggle-btn ${isFavoritedByCurrentUser ? 'is-favorite' : ''}" data-id="${item.id}" aria-label="Favorite">
                <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
            <div class="product-image">${imageContent}</div>
            <div class="product-info">
                <div class="product-category">${item.category}</div>
                <div class="product-name">${item.name}</div>
                <span class="product-price">${formatMarketplacePrice(item)}</span>
            </div>`;
        productGrid.appendChild(card);
    });
}

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
    const item = allUserListings.find(i => i.id === itemId) || marketplaceItems.find(i => i.id === itemId);
    if (!item || !productDetailModal) return;

    activeViewingItem = item;
    detailModalImg.src = item.imageUrl || "nmit-logo.png";
    detailCategory.textContent = item.category;
    detailTitle.textContent = item.name;
    detailPrice.innerHTML = formatMarketplacePrice(item);
    
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

if (modalChatSellerBtn) {
    modalChatSellerBtn.addEventListener("click", () => {
        if (!activeViewingItem) return;
        closeDetailModalHandler();
        startChatWithItem(activeViewingItem);
    });
}


function subscribeToUserFavorites(uid) {
    if (unsubscribeUserFavorites) unsubscribeUserFavorites();

    unsubscribeUserFavorites = db.collection("users").doc(uid).collection("favorites")
        .onSnapshot((snapshot) => {
            userFavoriteIds = new Set();
            snapshot.forEach(doc => userFavoriteIds.add(doc.id));
            
            
            if (activeSelectedCategory) {
                renderProducts(marketplaceItems.filter(i => i.category === activeSelectedCategory));
            } else {
                renderProducts(marketplaceItems);
            }
            renderFavorites();
        }, (err) => console.error("Error listening to user favorites:", err));
}

async function toggleFavorite(itemId) {
    if (!currentUser) {
        alert("Please sign in to save items to your favorites.");
        openAuthModal("signin");
        return;
    }

    const favRef = db.collection("users").doc(currentUser.uid).collection("favorites").doc(itemId);

    try {
        if (userFavoriteIds.has(itemId)) {
            await favRef.delete();
        } else {
            await favRef.set({
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (err) {
        console.error("Error updating favorite:", err);
    }
}

function renderFavorites() {
    const favoritesTab = document.getElementById("favoritesTab");
    if (!favoritesTab) return;

    const container = favoritesTab.querySelector(".product-grid");
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #70807a; padding: 40px;">Please sign in to view your favorites.</p>`;
        return;
    }

    const favoriteItems = allUserListings.filter(item => userFavoriteIds.has(item.id));

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
                <span class="product-price">${formatMarketplacePrice(item)}</span>
            </div>`;
        container.appendChild(card);
    });
}

const favoritesTabElem = document.getElementById("favoritesTab");
if (favoritesTabElem) {
    favoritesTabElem.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".favorite-icon-active");
        if (removeBtn) {
            const itemId = removeBtn.getAttribute("data-id");
            toggleFavorite(itemId);
        }
    });
}


function renderMyListings() {
    const myListingsGrid = document.getElementById("myListingsGrid");
    if (!myListingsGrid) return;

    if (!currentUser) {
        myListingsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #70807a; padding: 40px;">
                <p>Please sign in to view your listings.</p>
                <button type="button" class="secondary-button" style="margin-top: 10px;" onclick="openAuthModal('signin')">Sign In</button>
            </div>`;
        return;
    }

    const myItems = allUserListings.filter(item => {
        return item.sellerUid === currentUser.uid || 
               item.userId === currentUser.uid ||
               (item.sellerEmail && item.sellerEmail.toLowerCase() === currentUser.email?.toLowerCase());
    });

    if (myItems.length === 0) {
        myListingsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #70807a; padding: 40px;">
                <h3>No Listings Found</h3>
                <p>You haven't posted any items for sale yet.</p>
                <button type="button" class="primary-button" style="margin-top: 15px;" onclick="switchNavigationTab('sell')">+ Sell an Item</button>
            </div>`;
        return;
    }

    myListingsGrid.innerHTML = "";
    myItems.forEach(item => {
        const card = document.createElement("article");
        card.className = `product-card my-listing-card ${item.isSold ? "is-sold" : ""}`;
        card.setAttribute("data-id", item.id);

        const imageContent = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}">`
            : `<div style="font-size: 48px;">📦</div>`;

        card.innerHTML = `
            ${item.isSold ? `<span class="sold-ribbon">Sold</span>` : ""}
            <div class="product-image">${imageContent}</div>
            <div class="product-info">
                <div class="product-category">${item.category}</div>
                <div class="product-name">${item.name}</div>
                <span class="product-price">${formatMarketplacePrice(item)}</span>
            </div>
            <div class="listing-actions-bar">
                <div class="listing-btn-group">
                    <button type="button" class="action-btn edit-btn" data-id="${item.id}">Edit</button>
                    <button type="button" class="action-btn delete-btn" data-id="${item.id}">Delete</button>
                </div>
                <button type="button" class="sold-toggle-btn ${item.isSold ? "marked-sold" : ""}" data-id="${item.id}">
                    ${item.isSold ? "✓ Sold" : "Sold"}
                </button>
            </div>
        `;

        card.querySelector(".product-image").addEventListener("click", () => openProductDetailModal(item.id));
        card.querySelector(".product-info").addEventListener("click", () => openProductDetailModal(item.id));

        card.querySelector(".edit-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openEditItemModal(item);
        });

        card.querySelector(".delete-btn").addEventListener("click", async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                try {
                    await db.collection("listings").doc(item.id).delete();
                } catch (err) {
                    alert("Failed to delete listing: " + err.message);
                }
            }
        });

        card.querySelector(".sold-toggle-btn").addEventListener("click", async (e) => {
            e.stopPropagation();
            const newSoldStatus = !item.isSold;
            try {
                await db.collection("listings").doc(item.id).update({
                    isSold: newSoldStatus
                });
            } catch (err) {
                alert("Failed to update status: " + err.message);
            }
        });

        myListingsGrid.appendChild(card);
    });
}


const editListingModal = document.getElementById("editListingModal");
const closeEditModal = document.getElementById("closeEditModal");
const cancelEditModal = document.getElementById("cancelEditModal");
const editListingForm = document.getElementById("editListingForm");
const triggerEditImageBtn = document.getElementById("triggerEditImageBtn");
const editItemImageInput = document.getElementById("editItemImage");
const editImagePreviewImg = document.getElementById("editImagePreviewImg");
const editFormError = document.getElementById("editFormError");
const saveEditBtn = document.getElementById("saveEditBtn");

let activeEditingItem = null;

if (triggerEditImageBtn && editItemImageInput) {
    triggerEditImageBtn.addEventListener("click", () => editItemImageInput.click());
    editItemImageInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                editImagePreviewImg.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

function openEditItemModal(item) {
    if (!editListingModal) return;
    activeEditingItem = item;
    
    document.getElementById("editItemId").value = item.id;
    document.getElementById("editItemName").value = item.name || "";
    document.getElementById("editItemPrice").value = item.price || "";
    document.getElementById("editItemCurrency").value = item.currency || "INR";
    document.getElementById("editItemCategory").value = item.category || "Books";
    document.getElementById("editItemDescription").value = item.description || "";
    
    editImagePreviewImg.src = item.imageUrl || "nmit-logo.png";
    editItemImageInput.value = "";
    if (editFormError) editFormError.classList.add("hidden");

    editListingModal.classList.remove("hidden");
}

if (closeEditModal) closeEditModal.addEventListener("click", () => editListingModal.classList.add("hidden"));
if (cancelEditModal) cancelEditModal.addEventListener("click", () => editListingModal.classList.add("hidden"));

if (editListingForm) {
    editListingForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const itemId = document.getElementById("editItemId").value;
        const updatedName = document.getElementById("editItemName").value.trim();
        const updatedPrice = parseFloat(document.getElementById("editItemPrice").value);
        const updatedCurrency = document.getElementById("editItemCurrency").value;
        const updatedCategory = document.getElementById("editItemCategory").value;
        const updatedDesc = document.getElementById("editItemDescription").value.trim();
        const newPhotoFile = editItemImageInput.files[0];

        saveEditBtn.disabled = true;
        saveEditBtn.textContent = newPhotoFile ? "Uploading photo..." : "Saving...";

        try {
            let finalImageUrl = activeEditingItem?.imageUrl || "";

            if (newPhotoFile) {
                const formData = new FormData();
                formData.append("file", newPhotoFile);
                formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

                const uploadRes = await fetch(
                    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                    { method: "POST", body: formData }
                );
                if (!uploadRes.ok) throw new Error("Image upload failed.");
                const uploadData = await uploadRes.json();
                finalImageUrl = uploadData.secure_url;
            }

            await db.collection("listings").doc(itemId).update({
                name: updatedName,
                price: updatedPrice,
                currency: updatedCurrency,
                category: updatedCategory,
                description: updatedDesc,
                imageUrl: finalImageUrl,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            editListingModal.classList.add("hidden");
        } catch (err) {
            console.error(err);
            if (editFormError) {
                editFormError.textContent = err.message || "Failed to save edits.";
                editFormError.classList.remove("hidden");
            }
        } finally {
            saveEditBtn.disabled = false;
            saveEditBtn.textContent = "Update Listing";
        }
    });
}


const chatLayout = document.querySelector(".chat-layout");
const chatBackBtn = document.getElementById("chatBackBtn");
const chatThreadsList = document.getElementById("chatThreadsList");
const chatHeaderTitle = document.getElementById("chatHeaderTitle");
const chatHeaderSub = document.getElementById("chatHeaderSub");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

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

function openChatConversation(chatId, chatData) {
    currentChatId = chatId;

    if (chatLayout) chatLayout.classList.add("in-conversation");

    const otherUserName = (chatData.buyerUid === currentUser.uid) ? chatData.sellerName : chatData.buyerName;
    if (chatHeaderTitle) chatHeaderTitle.textContent = chatData.listingTitle || "Item";
    if (chatHeaderSub) chatHeaderSub.textContent = `Chatting with ${otherUserName || "Student"}`;

    document.querySelectorAll(".chat-list-item").forEach(el => el.classList.remove("active-chat"));

    if (chatData.lastSenderUid && chatData.lastSenderUid !== currentUser.uid) {
        db.collection("chats").doc(chatId).update({
            isRead: true,
            unreadCount: 0
        }).catch(err => console.warn("Failed marking chat read:", err));
    }

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

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    switchNavigationTab("messages");

    const buyerUid = currentUser.uid;
    const sellerUid = item.sellerUid || "seller";
    const buyerName = currentUser.displayName || currentUser.email.split("@")[0];
    const sellerName = item.sellerName || (item.sellerEmail ? item.sellerEmail.split("@")[0] : "Seller");

    const chatId = `${item.id}_${buyerUid}`;
    const chatDocRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatDocRef.get();

    if (!chatDoc.exists) {
        const initialText = `Hi! I'm interested in buying your ${item.name} for ₹${getPriceInRupees(item.price, item.currency)}. Is it still available on campus?`;

        await chatDocRef.set({
            listingId: item.id,
            listingTitle: item.name,
            listingPrice: item.price,
            listingCurrency: item.currency || "INR",
            listingImage: item.imageUrl || "",
            buyerUid: buyerUid,
            buyerName: buyerName,
            sellerUid: sellerUid,
            sellerName: sellerName,
            participants: [buyerUid, sellerUid],
            lastMessage: initialText,
            lastSenderUid: buyerUid,
            isRead: false,
            unreadCount: 1,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

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

async function sendChatMessage() {
    if (!currentUser || !currentChatId || !chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";

    try {
        const chatDocRef = db.collection("chats").doc(currentChatId);

        await chatDocRef.collection("messages").add({
            senderUid: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email.split("@")[0],
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await chatDocRef.update({
            lastMessage: text,
            lastSenderUid: currentUser.uid,
            isRead: false,
            unreadCount: firebase.firestore.FieldValue.increment(1),
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

if (chatBackBtn && chatLayout) {
    chatBackBtn.addEventListener("click", () => {
        chatLayout.classList.remove("in-conversation");
    });
}


const pages = {
    home: document.getElementById("homePage"),
    messages: document.getElementById("messagesPage"),
    sell: document.getElementById("sellPage"),
    profile: document.getElementById("profilePage")
};

function switchNavigationTab(targetPage) {
    if (!targetPage || !pages[targetPage]) return;

    if ((targetPage === "sell" || targetPage === "profile") && !currentUser) {
        alert("Please sign in with your verified email account first.");
        openAuthModal("signin");
        return;
    }

    document.querySelectorAll(".nav-link").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-page") === targetPage);
    });

    document.querySelectorAll(".bottom-tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-page") === targetPage);
    });

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

document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => switchNavigationTab(btn.getAttribute("data-page")));
});
document.querySelectorAll(".bottom-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchNavigationTab(btn.getAttribute("data-page")));
});


const categoryButtons = document.querySelectorAll(".category-card");
categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;

        if (activeSelectedCategory === category) {
            activeSelectedCategory = null;
            categoryButtons.forEach(b => b.classList.remove("selected-category"));
            renderProducts(marketplaceItems);
        } else {
            activeSelectedCategory = category;
            categoryButtons.forEach(b => b.classList.toggle("selected-category", b.dataset.category === category));
            const filtered = marketplaceItems.filter(item => item.category === category);
            renderProducts(filtered);
        }

        switchNavigationTab("home");
        const marketSection = document.querySelector(".marketplace-section");
        if (marketSection) marketSection.scrollIntoView({ behavior: "smooth" });
    });
});


const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchSuggestions = document.getElementById("searchSuggestions");

function performSearch(query) {
    if (!query) {
        if (searchSuggestions) searchSuggestions.classList.add("hidden");
        renderProducts(activeSelectedCategory ? marketplaceItems.filter(i => i.category === activeSelectedCategory) : marketplaceItems);
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
        const currency = document.getElementById("itemCurrency") ? document.getElementById("itemCurrency").value : "INR";
        const category = document.getElementById("itemCategory").value;
        const desc = document.getElementById("itemDescription").value.trim();
        const imageFile = itemImageInput.files[0];

        if (!name || isNaN(price) || !category || !desc || !imageFile) {
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
                currency: currency,
                category: category,
                description: desc,
                imageUrl: uploadData.secure_url,
                sellerName: currentUser.displayName || currentUser.email.split("@")[0],
                sellerEmail: currentUser.email,
                sellerUid: currentUser.uid,
                isSold: false,
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


const desktopProfileNavLink = document.getElementById("desktopProfileNavLink");
const bottomProfileTab = document.getElementById("bottomProfileTab");
const authBtn = document.getElementById("authBtn");
const mobileAuthBtn = document.getElementById("mobileAuthBtn");
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

function updateAuthButtonTexts(text) {
    if (authBtn) authBtn.textContent = text;
    if (mobileAuthBtn) mobileAuthBtn.textContent = text;
}

auth.onAuthStateChanged(async (user) => {
    
    if (user && !user.emailVerified) {
        currentUser = null;
        updateAuthButtonTexts("Sign In");
        if (desktopProfileNavLink) desktopProfileNavLink.classList.add("hidden");
        if (bottomProfileTab) bottomProfileTab.classList.add("hidden");
        return;
    }

    currentUser = user;
    if (user && user.emailVerified) {
        updateAuthButtonTexts("Sign Out");
        if (desktopProfileNavLink) desktopProfileNavLink.classList.remove("hidden");
        if (bottomProfileTab) bottomProfileTab.classList.remove("hidden");

        await loadUserProfile(user.uid);
        subscribeToUserFavorites(user.uid);
        monitorUnreadMessages(user.uid);
        subscribeToUserChats();
        renderMyListings();
        renderFavorites();
    } else {
        updateAuthButtonTexts("Sign In");
        if (desktopProfileNavLink) desktopProfileNavLink.classList.add("hidden");
        if (bottomProfileTab) bottomProfileTab.classList.add("hidden");

        if (unsubscribeThreads) unsubscribeThreads();
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeUnreadBadge) unsubscribeUnreadBadge();
        if (unsubscribeUserFavorites) unsubscribeUserFavorites();

        userFavoriteIds.clear();
        currentChatId = null;
        if (chatThreadsList) chatThreadsList.innerHTML = "";
        if (chatMessages) chatMessages.innerHTML = "";

        document.getElementById("userNameDisplay").textContent = "—";
        document.getElementById("userProgramDisplay").textContent = "Program not set";
        document.getElementById("userDeptDisplay").textContent = "Department not set";
        document.getElementById("userYearDisplay").textContent = "—";

        const dBadge = document.getElementById("desktopUnreadBadge");
        const mBadge = document.getElementById("mobileUnreadBadge");
        if (dBadge) dBadge.classList.add("hidden");
        if (mBadge) mBadge.classList.add("hidden");

        renderProducts(marketplaceItems);
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
        console.error("Error loading profile:", e);
        return false;
    }
}

function monitorUnreadMessages(uid) {
    const desktopBadge = document.getElementById("desktopUnreadBadge");
    const mobileBadge = document.getElementById("mobileUnreadBadge");

    if (unsubscribeUnreadBadge) unsubscribeUnreadBadge();

    unsubscribeUnreadBadge = db.collection("chats")
        .where("participants", "array-contains", uid)
        .onSnapshot((snapshot) => {
            let totalUnread = 0;
            let newestIncomingMessage = null;

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.lastSenderUid && data.lastSenderUid !== uid && data.isRead === false) {
                    totalUnread += (data.unreadCount || 1);
                    if (!newestIncomingMessage || (data.updatedAt && data.updatedAt > newestIncomingMessage.updatedAt)) {
                        newestIncomingMessage = data;
                    }
                }
            });

            const updateBadge = (el) => {
                if (!el) return;
                if (totalUnread > 0) {
                    el.textContent = totalUnread > 99 ? "99+" : totalUnread;
                    el.classList.remove("hidden");
                } else {
                    el.classList.add("hidden");
                }
            };

            updateBadge(desktopBadge);
            updateBadge(mobileBadge);

            if (totalUnread > previousUnreadCount && newestIncomingMessage) {
                if ("Notification" in window && Notification.permission === "granted") {
                    const senderTitle = newestIncomingMessage.buyerUid === uid 
                        ? newestIncomingMessage.sellerName 
                        : newestIncomingMessage.buyerName;

                    try {
                        const notif = new Notification(`New message from ${senderTitle || "Student"}`, {
                            body: newestIncomingMessage.lastMessage || "Sent an inquiry on NMIT Bazaar.",
                            icon: "nmit-logo.png",
                            badge: "nmit-logo.png"
                        });
                        notif.onclick = () => {
                            window.focus();
                            switchNavigationTab("messages");
                        };
                    } catch (e) {
                        console.warn("Notification constructor error:", e);
                    }
                }
            }

            previousUnreadCount = totalUnread;
        }, (err) => {
            console.error("Badge sync error:", err);
        });
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

function handleAuthButtonClick() {
    if (currentUser) {
        if (confirm("Do you want to sign out?")) {
            auth.signOut().then(() => switchNavigationTab("home"));
        }
    } else {
        openAuthModal("signin");
    }
}

if (authBtn) authBtn.addEventListener("click", handleAuthButtonClick);
if (mobileAuthBtn) mobileAuthBtn.addEventListener("click", handleAuthButtonClick);

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
                await auth.signOut(); 

                alert(`Account created! A verification link has been sent to ${email}.\n\n⚠️ Check Spam or Promotions if it doesn't appear within 1 minute, and tap "Report Not Spam". You can sign in once verified!`);
                closeAuthModalHandler();
                openAuthModal("signin");
            } else {
                
                try {
                    const userCredential = await auth.signInWithEmailAndPassword(email, password);
                    const user = userCredential.user;

                    
                    if (!user.emailVerified) {
                        await auth.signOut();

                        const resend = confirm(
                            `Your email (${email}) has not been verified yet.\n\n` +
                            `Please click the link sent to your inbox or spam folder before logging in.\n\n` +
                            `Would you like to resend the verification link?`
                        );

                        if (resend) {
                            
                            const tempCredential = await auth.signInWithEmailAndPassword(email, password);
                            await tempCredential.user.sendEmailVerification();
                            await auth.signOut();
                            alert(`A new verification link has been sent to ${email}. Please verify your email and sign in.`);
                        }
                        return;
                    }

                    if ("Notification" in window && Notification.permission === "default") {
                        Notification.requestPermission();
                    }

                    closeAuthModalHandler();
                    const profileExists = await loadUserProfile(user.uid);
                    switchNavigationTab("profile");
                    if (!profileExists) {
                        setTimeout(() => openEditProfileModalForSetup(), 300);
                    }
                } catch (loginErr) {
                    if (loginErr.code === "auth/user-not-found" || loginErr.code === "auth/invalid-credential") {
                        throw new Error("Account not registered. Please register first.");
                    } else if (loginErr.code === "auth/wrong-password") {
                        throw new Error("Incorrect password. Please try again or reset your password.");
                    } else {
                        throw loginErr;
                    }
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
        const targetTabName = tab.getAttribute("data-tab");

        profileTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        tabContents.forEach(pane => {
            pane.classList.remove("active-tab");
            pane.classList.add("hidden");
        });

        const targetPane = document.getElementById(targetTabName + "Tab");
        if (targetPane) {
            targetPane.classList.remove("hidden");
            targetPane.classList.add("active-tab");
        }

        if (targetTabName === "listings") {
            renderMyListings();
        } else if (targetTabName === "favorites") {
            renderFavorites();
        }
    });
});