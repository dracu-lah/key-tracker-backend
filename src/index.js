// backend/src/index.js
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const keyRoutes = require("./routes/keys");
const { authenticateToken } = require("./middleware/auth");
const swaggerDocs = require("./swagger"); // Import swagger

const app = express();

app.use(cors());
app.use(express.json());

// Database initialization
let db;
(async () => {
  db = await open({
    filename: path.join(__dirname, "database.sqlite"),
    driver: sqlite3.Database,
  });

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      isActive BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT UNIQUE NOT NULL,
      isActive BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS key_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyId INTEGER NOT NULL,
      assignedTo INTEGER NOT NULL,
      assignedBy INTEGER NOT NULL,
      assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      returnedAt DATETIME,
      FOREIGN KEY (keyId) REFERENCES keys (id),
      FOREIGN KEY (assignedTo) REFERENCES users (id),
      FOREIGN KEY (assignedBy) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      token TEXT NOT NULL,
      expiresAt DATETIME NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id)
    );
  `);
})();

// Make db available in requests
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/keys", authenticateToken, keyRoutes);

// Swagger documentation
swaggerDocs(app); // Initialize swagger

const PORT = process.env.PORT || 5010;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
