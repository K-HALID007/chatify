import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import {Message} from "../models/message.model.js"
import { User } from "../models/user.model.js";

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    // Mark all messages from the other user as read
    const updateResult = await Message.updateMany(
      { senderId: userToChatId, receiverId: myId, read: false },
      { read: true }
    );

    // Notify the sender that their messages were read
    if (updateResult.modifiedCount > 0) {
      const senderSocketId = getReceiverSocketId(userToChatId);
      
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesRead", {
          readBy: myId.toString(),
          chatPartnerId: myId.toString(), // Send the reader's ID (who opened the chat)
        });
       
      } else {
       
      }
    }

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Text or image is required." });
    }
    if (senderId.equals(receiverId)) {
      return res
        .status(400)
        .json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    if (image) {
      try {
        // upload base64 image to cloudinary with timeout
        const uploadResponse = await cloudinary.uploader.upload(image, {
          timeout: 60000, // 60 second timeout for image upload
        });
        imageUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({ message: "Failed to upload image. Please try again." });
      }
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    // Populate sender information for the socket emission
    const populatedMessage = await Message.findById(newMessage._id).populate(
      "senderId",
      "fullName profilePic"
    );

    // Emit to receiver via socket
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      try {
        io.to(receiverSocketId).emit("newMessage", populatedMessage);
        console.log(`Message emitted to receiver ${receiverId} via socket ${receiverSocketId}`);
      } catch (socketError) {
        console.error("Socket emission error:", socketError);
        // Don't fail the request if socket emission fails
      }
    } else {
      console.log(`Receiver ${receiverId} is not online, message saved to database only`);
    }

    // Always return success if message was saved to database
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage controller: ", error.message);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: senderId } = req.params;

    
    // Mark all unread messages from this sender as read
    const updateResult = await Message.updateMany(
      { senderId: senderId, receiverId: myId, read: false },
      { read: true }
    );

    
    // Notify the sender that their messages were read
    if (updateResult.modifiedCount > 0) {
      const senderSocketId = getReceiverSocketId(senderId);
     
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesRead", {
          readBy: myId.toString(),
          chatPartnerId: myId.toString(),
        });
       
      } else {
       
      }
    }

    res.status(200).json({ success: true, modifiedCount: updateResult.modifiedCount });
  } catch (error) {
    console.log("Error in markMessagesAsRead controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // find all the messages where the logged-in user is either sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    }).sort({ createdAt: -1 }); // Sort by most recent first

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
    }).select("-password");

    // Count unread messages and get last message time for each chat partner
    const chatPartnersWithUnread = await Promise.all(
      chatPartners.map(async (partner) => {
        const unreadCount = await Message.countDocuments({
          senderId: partner._id,
          receiverId: loggedInUserId,
          read: false,
        });

        // Get the most recent message with this partner
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: partner._id },
            { senderId: partner._id, receiverId: loggedInUserId },
          ],
        }).sort({ createdAt: -1 });

        return {
          ...partner.toObject(),
          unreadCount,
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
        };
      })
    );

    // Sort by most recent message time (most recent first)
    chatPartnersWithUnread.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    res.status(200).json(chatPartnersWithUnread);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
