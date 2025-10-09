import { ENV } from "./lib/env.js";
import express from "express";
import path from "path";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { connectDB } from "./lib/db.js";
import cookieparser from "cookie-parser";
import cors from "cors";
import { app, server } from "./lib/socket.js";

const __dirname = path.resolve();

const PORT = ENV.PORT || 8001;
app.use(express.json({ limit: "5mb" })); // req.body
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(cookieparser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// make ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`Server running on PORT:${PORT}`);
  connectDB();
});
