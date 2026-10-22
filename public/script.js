
const form = document.getElementById("profileForm");
const message = document.getElementById("message");
const matchesSection = document.getElementById("matchesSection");
const matchSummary = document.getElementById("matchSummary");
const matchesList = document.getElementById("matchesList");

const profileSection = document.getElementById("profileSection");
const profileDetails = document.getElementById("profileDetails");
const backToMatches = document.getElementById("backToMatches");
const startChatButton = document.getElementById("startChatButton");

const chatSection = document.getElementById("chatSection");
const chatTitle = document.getElementById("chatTitle");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatStatus = document.getElementById("chatStatus");
const backToProfile = document.getElementById("backToProfile");

let currentUserId = null;
let selectedPartner = null;

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error("Server returned a non-JSON response. Restart the server and check the API routes.");
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

function showOnly(section) {
    matchesSection.hidden = true;
    profileSection.hidden = true;
    chatSection.hidden = true;

    if (section) {
        section.hidden = false;
        section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

// Create profile and load matches
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const profile = {
        name: document.getElementById("name").value.trim(),
        country: document.getElementById("country").value.trim(),
        nativeLanguage: document.getElementById("nativeLanguage").value.trim(),
        learningLanguage: document.getElementById("learningLanguage").value.trim()
    };

    message.textContent = "Saving profile...";
    showOnly(null);
    matchesList.replaceChildren();

    try {
        const savedUser = await apiRequest("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profile)
        });

        currentUserId = savedUser.userId;
        message.textContent = savedUser.message;

        await loadMatches();
    } catch (error) {
        message.textContent = error.message;
    }
});

async function loadMatches() {
    const data = await apiRequest(`/api/matches/${currentUserId}`);

    matchSummary.textContent =
        `We found ${data.totalMatches} potential language partner(s).`;

    matchesList.replaceChildren();

    if (data.matches.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent =
            "No matching partners yet. Invite someone to join!";
        matchesList.appendChild(emptyMessage);
    }

    data.matches.forEach((partner) => {
        const card = document.createElement("article");
        card.className = "partner-card";

        const name = document.createElement("h3");
        name.textContent = partner.name;

        const country = document.createElement("p");
        country.textContent = `Country: ${partner.country}`;

        const native = document.createElement("p");
        native.textContent = `Native language: ${partner.native_language}`;

        const learning = document.createElement("p");
        learning.textContent = `Learning: ${partner.learning_language}`;

        const badge = document.createElement("span");
        badge.className = "match-badge";
        badge.textContent = "Language match ✓";

        const actions = document.createElement("div");
        actions.className = "partner-actions";

        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.textContent = "View Profile";
        viewButton.addEventListener("click", () => openProfile(partner.id));

        const chatButton = document.createElement("button");
        chatButton.type = "button";
        chatButton.textContent = "Chat 💬";
        chatButton.addEventListener("click", async () => {
            try {
                selectedPartner = partner;
                await openChat();
            } catch (error) {
                message.textContent = error.message;
            }
        });

        actions.append(viewButton, chatButton);
        card.append(name, country, native, learning, badge, actions);
        matchesList.appendChild(card);
    });

    showOnly(matchesSection);
}

async function openProfile(partnerId) {
    try {
        const data = await apiRequest(`/api/users/${partnerId}`);
        selectedPartner = data.user;

        profileDetails.replaceChildren();

        const name = document.createElement("h3");
        name.textContent = selectedPartner.name;

        const country = document.createElement("p");
        country.textContent = `Country: ${selectedPartner.country}`;

        const native = document.createElement("p");
        native.textContent =
            `Native language: ${selectedPartner.native_language}`;

        const learning = document.createElement("p");
        learning.textContent =
            `Learning language: ${selectedPartner.learning_language}`;

        profileDetails.append(name, country, native, learning);
        showOnly(profileSection);
    } catch (error) {
        message.textContent = error.message;
    }
}

startChatButton.addEventListener("click", async () => {
    try {
        await openChat();
    } catch (error) {
        chatStatus.textContent = error.message;
    }
});

async function openChat() {
    if (!currentUserId || !selectedPartner) {
        throw new Error("Create a profile and select a language partner first.");
    }

    if (Number(selectedPartner.id) === Number(currentUserId)) {
        throw new Error("You cannot chat with your own profile.");
    }

    chatTitle.textContent = `Chat with ${selectedPartner.name}`;
    chatStatus.textContent = "Loading conversation...";
    chatMessages.replaceChildren();
    showOnly(chatSection);

    await loadMessages();
}

async function loadMessages() {
    const data = await apiRequest(
        `/api/messages/${currentUserId}/${selectedPartner.id}`
    );

    chatMessages.replaceChildren();

    if (data.messages.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No messages yet. Say hello!";
        chatMessages.appendChild(empty);
    }

    data.messages.forEach((item) => {
        const bubble = document.createElement("div");
        bubble.className =
            "chat-message " +
            (Number(item.sender_id) === Number(currentUserId)
                ? "sent"
                : "received");

        const text = document.createElement("div");
        text.textContent = item.message_text;

        const time = document.createElement("small");
        time.textContent = new Date(item.created_at).toLocaleString();

        bubble.append(text, time);
        chatMessages.appendChild(bubble);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatStatus.textContent = "";
}

// Send a message and save it to MySQL
chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const messageText = chatInput.value.trim();

    if (!messageText || !currentUserId || !selectedPartner) {
        return;
    }

    chatStatus.textContent = "Sending...";

    try {
        await apiRequest("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                senderId: currentUserId,
                receiverId: selectedPartner.id,
                messageText
            })
        });

        chatInput.value = "";
        await loadMessages();
        chatStatus.textContent = "Message sent!";
    } catch (error) {
        chatStatus.textContent = error.message;
    }
});

backToMatches.addEventListener("click", () => {
    showOnly(matchesSection);
});

backToProfile.addEventListener("click", () => {
    showOnly(profileSection);
});
