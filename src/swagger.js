// backend/src/routes/users.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");

router.get("/", async (req, res) => {
  try {
    const users = await req.db.all(
      "SELECT id, email, isActive, createdAt, updatedAt FROM users",
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error fetching users" });
  }
});

router.post("/", body("email").isEmail(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.body;
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const result = await req.db.run(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, hashedPassword],
    );

    res.status(201).json({
      id: result.lastID,
      email,
      tempPassword,
      message: "User created successfully",
    });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Error creating user" });
  }
});

router.put(
  "/:id",
  body("email").isEmail().optional(),
  body("isActive").isBoolean().optional(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, isActive } = req.body;
      const updates = [];
      const values = [];

      if (email) {
        updates.push("email = ?");
        values.push(email);
      }
      if (isActive !== undefined) {
        updates.push("isActive = ?");
        values.push(isActive);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No valid updates provided" });
      }

      updates.push("updatedAt = CURRENT_TIMESTAMP");
      values.push(req.params.id);

      await req.db.run(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      res.json({ message: "User updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Error updating user" });
    }
  },
);

router.delete("/:id", async (req, res) => {
  try {
    await req.db.run(
      "UPDATE users SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.id],
    );
    res.json({ message: "User deactivated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deactivating user" });
  }
});

module.exports = router;
