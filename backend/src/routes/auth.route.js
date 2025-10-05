import express from "express";
import { signup } from "../controllers/auth.controller.js";
const router = express.Router();

router.post("/signup",signup);

// Login Route
router.get("/login", (req, res) => {
  res.send("Login endpoint");
});

// Logout Route
router.get("/logout", (req, res) => {
  res.send("Logout endpoint");
});

export default router;
