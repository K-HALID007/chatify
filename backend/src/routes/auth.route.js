import express from "express";

const router = express.Router();

router.get("/signup", (req, res) => {
  res.send("Signup endpoint");
});

// Login Route
router.get("/login", (req, res) => {
  res.send("Login endpoint");
});

// Logout Route
router.get("/logout", (req, res) => {
  res.send("Logout endpoint");
});

export default router;
