// backend/src/routes/keys.js
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");

/**
 * @openapi
 * /api/keys:
 *   get:
 *     summary: Get all active keys
 *     tags: [Keys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Key ID
 *                   identifier:
 *                     type: string
 *                     description: Key identifier
 *                   isActive:
 *                     type: boolean
 *                     description: Key active status
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     description: Key creation timestamp
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
    const keys = await req.db.all("SELECT * FROM keys WHERE isActive = 1");
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: "Error fetching keys" });
  }
});

/**
 * @openapi
 * /api/keys:
 *   post:
 *     summary: Create a new key
 *     tags: [Keys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Key identifier
 *     responses:
 *       201:
 *         description: Key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Key ID
 *                 identifier:
 *                   type: string
 *                   description: Key identifier
 *       400:
 *         description: Validation errors or key identifier already exists
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
router.post("/", body("identifier").notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { identifier } = req.body;
    const result = await req.db.run(
      "INSERT INTO keys (identifier) VALUES (?)",
      [identifier],
    );
    res.status(201).json({ id: result.lastID, identifier });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Key identifier already exists" });
    }
    res.status(500).json({ error: "Error creating key" });
  }
});

/**
 * @openapi
 * /api/keys/assign:
 *   post:
 *     summary: Assign a key to a user
 *     tags: [Keys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyId
 *               - assignedTo
 *             properties:
 *               keyId:
 *                 type: integer
 *                 description: ID of the key to assign
 *               assignedTo:
 *                 type: integer
 *                 description: ID of the user to assign the key to
 *     responses:
 *       201:
 *         description: Key assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: ID of the key assignment record
 *       400:
 *         description: Validation errors or key is already assigned
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
router.post(
  "/assign",
  body("keyId").isInt(),
  body("assignedTo").isInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { keyId, assignedTo } = req.body;

      // Check if key is already assigned
      const currentAssignment = await req.db.get(
        "SELECT * FROM key_assignments WHERE keyId = ? AND returnedAt IS NULL",
        [keyId],
      );

      if (currentAssignment) {
        return res.status(400).json({ error: "Key is already assigned" });
      }

      const result = await req.db.run(
        "INSERT INTO key_assignments (keyId, assignedTo, assignedBy) VALUES (?, ?, ?)",
        [keyId, assignedTo, req.user.id],
      );

      res.status(201).json({ id: result.lastID });
    } catch (error) {
      res.status(500).json({ error: "Error assigning key" });
    }
  },
);

/**
 * @openapi
 * /api/keys/return/{keyId}:
 *   post:
 *     summary: Return a key
 *     tags: [Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the key to return
 *     responses:
 *       200:
 *         description: Key returned successfully
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
router.post("/return/:keyId", async (req, res) => {
  try {
    await req.db.run(
      "UPDATE key_assignments SET returnedAt = CURRENT_TIMESTAMP WHERE keyId = ? AND returnedAt IS NULL",
      [req.params.keyId],
    );
    res.json({ message: "Key returned successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error returning key" });
  }
});

/**
 * @openapi
 * /api/keys/history/{keyId}:
 *   get:
 *     summary: Get the assignment history for a key
 *     tags: [Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the key to retrieve history for
 *     responses:
 *       200:
 *         description: Key assignment history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Key assignment ID
 *                   keyId:
 *                     type: integer
 *                     description: Key ID
 *                   assignedTo:
 *                     type: integer
 *                     description: ID of the user the key was assigned to
 *                   assignedBy:
 *                     type: integer
 *                     description: ID of the user who assigned the key
 *                   assignedAt:
 *                     type: string
 *                     format: date-time
 *                     description: Timestamp of key assignment
 *                   returnedAt:
 *                     type: string
 *                     format: date-time
 *                     description: Timestamp of key return (if returned)
 *                   assignedToEmail:
 *                     type: string
 *                     format: email
 *                     description: Email of the user the key was assigned to
 *                   assignedByEmail:
 *                     type: string
 *                     format: email
 *                     description: Email of the user who assigned the key
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
router.get("/history/:keyId", async (req, res) => {
  try {
    const history = await req.db.all(
      `SELECT ka.*,
        u1.email as assignedToEmail,
        u2.email as assignedByEmail
       FROM key_assignments ka
       JOIN users u1 ON ka.assignedTo = u1.id
       JOIN users u2 ON ka.assignedBy = u2.id
       WHERE ka.keyId = ?
       ORDER BY ka.assignedAt DESC`,
      [req.params.keyId],
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Error fetching key history" });
  }
});

module.exports = router;
