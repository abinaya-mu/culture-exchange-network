
require("dotenv").config();

const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// MySQL connection
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10
});

// 1. Check database connection
app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");

        res.json({
            status: "success",
            message: "Database connected"
        });
    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Database connection failed"
        });
    }
});

// 2. Create a new user profile
app.post("/api/users", async (req, res) => {
    try {
        const {
            name,
            country,
            nativeLanguage,
            learningLanguage
        } = req.body;

        if (
            !name?.trim() ||
            !country?.trim() ||
            !nativeLanguage?.trim() ||
            !learningLanguage?.trim()
        ) {
            return res.status(400).json({
                status: "error",
                message: "Please complete all fields."
            });
        }

        const sql = `
            INSERT INTO users
            (name, country, native_language, learning_language)
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await db.execute(sql, [
            name.trim(),
            country.trim(),
            nativeLanguage.trim(),
            learningLanguage.trim()
        ]);

        res.status(201).json({
            status: "success",
            message: "Profile saved successfully!",
            userId: result.insertId
        });
    } catch (error) {
        console.error("Save profile error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to save profile."
        });
    }
});

// 3. Get one user's profile
app.get("/api/users/:userId", async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid user ID."
            });
        }

        const [users] = await db.execute(
            `SELECT id, name, country, native_language, learning_language
             FROM users
             WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Profile not found."
            });
        }

        res.json({
            status: "success",
            user: users[0]
        });
    } catch (error) {
        console.error("Get profile error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to load profile."
        });
    }
});

// 4. Find language partners
app.get("/api/matches/:userId", async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid user ID."
            });
        }

        const [users] = await db.execute(
            `SELECT id, name, country, native_language, learning_language
             FROM users
             WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "User profile not found."
            });
        }

        const user = users[0];

        const [matches] = await db.execute(
            `SELECT id, name, country, native_language, learning_language
             FROM users
             WHERE id <> ?
               AND LOWER(TRIM(native_language)) =
                   LOWER(TRIM(?))
               AND LOWER(TRIM(learning_language)) =
                   LOWER(TRIM(?))
             ORDER BY name`,
            [
                user.id,
                user.learning_language,
                user.native_language
            ]
        );

        res.json({
            status: "success",
            currentUser: user,
            totalMatches: matches.length,
            matches
        });
    } catch (error) {
        console.error("Matching error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to find language partners."
        });
    }
});

// 5. Load messages between two profiles
app.get("/api/messages/:userId/:partnerId", async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const partnerId = Number(req.params.partnerId);

        if (
            !Number.isInteger(userId) || userId <= 0 ||
            !Number.isInteger(partnerId) || partnerId <= 0 ||
            userId === partnerId
        ) {
            return res.status(400).json({
                status: "error",
                message: "Invalid conversation IDs."
            });
        }

        const [messages] = await db.execute(
            `SELECT id, sender_id, receiver_id, message_text, created_at
             FROM messages
             WHERE (sender_id = ? AND receiver_id = ?)
                OR (sender_id = ? AND receiver_id = ?)
             ORDER BY created_at ASC, id ASC`,
            [userId, partnerId, partnerId, userId]
        );

        res.json({
            status: "success",
            messages
        });
    } catch (error) {
        console.error("Load messages error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to load messages."
        });
    }
});
app.post("/api/messages", async (req, res) => {
    try {
        const { senderId, receiverId, messageText } = req.body;

        const sender = Number(senderId);
        const receiver = Number(receiverId);

        if (
            !Number.isInteger(sender) || sender <= 0 ||
            !Number.isInteger(receiver) || receiver <= 0 ||
            sender === receiver ||
            typeof messageText !== "string" ||
            !messageText.trim()
        ) {
            return res.status(400).json({
                status: "error",
                message: "Please enter a valid message."
            });
        }

        const [users] = await db.execute(
            "SELECT id FROM users WHERE id IN (?, ?)",
            [sender, receiver]
        );

        if (users.length !== 2) {
            return res.status(404).json({
                status: "error",
                message: "Sender or receiver profile not found."
            });
        }

        const [result] = await db.execute(
            `INSERT INTO messages
             (sender_id, receiver_id, message_text)
             VALUES (?, ?, ?)`,
            [sender, receiver, messageText.trim()]
        );

        res.status(201).json({
            status: "success",
            message: "Message sent!",
            messageId: result.insertId
        });
    } catch (error) {
        console.error("Send message error:", error);

        res.status(500).json({
            status: "error",
            message: "Unable to save message."
        });
    }
});

// 6. Send and save a message
app.post("/api/messages", async (req, res) => {
    try {
        const senderId = Number(req.body.senderId);
        const receiverId = Number(req.body.receiverId);
        const messageText = req.body.messageText;

        if (
            !Number.isInteger(senderId) || senderId <= 0 ||
            !Number.isInteger(receiverId) || receiverId <= 0 ||
            senderId === receiverId ||
            typeof messageText !== "string" ||
            !messageText.trim()
        ) {
            return res.status(400).json({
                status: "error",
                message: "Enter a message and valid profile IDs."
            });
        }

        if (messageText.trim().length > 2000) {
            return res.status(400).json({
                status: "error",
                message: "Messages must be 2000 characters or fewer."
            });
        }

        const [users] = await db.execute(
            "SELECT id FROM users WHERE id IN (?, ?)",
            [senderId, receiverId]
        );

        if (users.length !== 2) {
            return res.status(404).json({
                status: "error",
                message: "Sender or partner profile not found."
            });
        }

        const [result] = await db.execute(
            `INSERT INTO messages
             (sender_id, receiver_id, message_text)
             VALUES (?, ?, ?)`,
            [senderId, receiverId, messageText.trim()]
        );

        res.status(201).json({
            status: "success",
            message: "Message sent!",
            messageId: result.insertId
        });
    } catch (error) {
        console.error("Send message error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to send message."
        });
    }
});

// 7. Handle unknown API routes
// IMPORTANT: Keep this after every API route.
app.get("/api/chat-test", (req, res) => {
    res.json({
        status: "success",
        message: "Chat route is registered!"
    });
});
app.use("/api", (req, res) => {
    res.status(404).json({
        status: "error",
        message: "API route not found."
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Language matching and chat API routes registered.");
});

