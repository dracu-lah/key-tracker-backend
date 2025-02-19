// backend/src/routes/users.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: User ID
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: User's email address
 *                   isActive:
 *                     type: boolean
 *                     description: User active status
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     description: User creation timestamp
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     description: User update timestamp
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 */
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

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: User ID
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: User's email address
 *                 tempPassword:
 *                   type: string
 *                   description: Temporary password for the new user
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Validation errors or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                         description: Error message
 *                 error:
 *                   type: string
 *                   description: Error message
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 */
router.post("/", body("email").isEmail(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.body;
    const tempPassword = "password123";
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

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address for the user
 *               isActive:
 *                 type: boolean
 *                 description: New active status for the user
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Validation errors or no valid updates provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                         description: Error message
 *                 error:
 *                   type: string
 *                   description: Error message
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 */
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

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Deactivate a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user to deactivate
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 */
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
