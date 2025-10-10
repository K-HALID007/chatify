import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,
  chatMessageListener: null,
  globalMessageListener: null,
  recentNotifications: {},

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  requestNotificationPermission: () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },
  getMyChatPartners: async (silent = false) => {
    if (!silent) {
      set({ isUsersLoading: true });
    }
    try {
      const res = await axiosInstance.get("/messages/chats");

      set({ chats: res.data });
    } catch (error) {
      if (!silent) {
        toast.error(error.response.data.message);
      }
    } finally {
      if (!silent) {
        set({ isUsersLoading: false });
      }
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      const { authUser } = useAuthStore.getState();

      // Mark all received messages as read in the frontend immediately
      const updatedMessages = res.data.map((msg) => {
        // If message is from the other user (not from me), mark it as read
        if (msg.receiverId === authUser._id && msg.senderId === userId) {
          return { ...msg, read: true };
        }
        // For messages I sent, keep their read status from database

        return msg;
      });

      set({ messages: updatedMessages });

      // Refresh chat list to update unread counts after marking messages as read (silent refresh)
      get().getMyChatPartners(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData, retryCount = 0) => {
    const { selectedUser, messages } = get();
    const { authUser } = useAuthStore.getState();

    const tempId = `temp-${Date.now()}-${Math.random()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      status: "sending", // Add status field
    };

    // Immediately update the UI by adding the message
    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData,
        { timeout: 10000 } // 10 second timeout
      );

      // Replace optimistic message with real message from server
      const updatedMessages = get().messages.filter(
        (msg) => msg._id !== tempId
      );
      set({ messages: [...updatedMessages, res.data] });

      // Refresh chat list to update order (this chat should move to top)
      get().getMyChatPartners(true);
    } catch (error) {
      console.error("Error sending message:", error);

      // Retry logic - retry up to 2 times
      if (retryCount < 2) {
        console.log(`Retrying message send... Attempt ${retryCount + 1}`);
        setTimeout(() => {
          // Remove failed optimistic message before retry
          const currentMessages = get().messages.filter(
            (msg) => msg._id !== tempId
          );
          set({ messages: currentMessages });
          // Retry
          get().sendMessage(messageData, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s
      } else {
        // After all retries failed, mark message as failed
        const updatedMessages = get().messages.map((msg) =>
          msg._id === tempId ? { ...msg, status: "failed" } : msg
        );
        set({ messages: updatedMessages });
        toast.error(
          error.response?.data?.message ||
            "Failed to send message. Please try again."
        );
      }
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.warn("Socket not available for subscribeToMessages");
      return;
    }

    // Remove any existing listeners first to prevent duplicates
    const existingHandler = get().chatMessageListener;
    if (existingHandler) {
      socket.off("newMessage", existingHandler);
      socket.off("messagesRead");
    }

    const handler = async (newMessage) => {
      const { authUser } = useAuthStore.getState();

      // Extract sender ID and receiver ID (handle both populated and non-populated)
      const senderId =
        typeof newMessage.senderId === "object"
          ? newMessage.senderId._id
          : newMessage.senderId;

      const receiverId =
        typeof newMessage.receiverId === "object"
          ? newMessage.receiverId._id
          : newMessage.receiverId;

      // Get current selected user (might have changed)
      const currentSelectedUser = get().selectedUser;
      if (!currentSelectedUser) return;

      // Check if this message belongs to the current conversation
      // Either: message sent FROM selected user TO me
      // Or: message sent FROM me TO selected user (from another device)
      const isMessageFromSelectedUser =
        senderId === currentSelectedUser._id && receiverId === authUser._id;
      const isMessageToSelectedUser =
        senderId === authUser._id && receiverId === currentSelectedUser._id;

      if (!isMessageFromSelectedUser && !isMessageToSelectedUser) return;

      // Mark message as read immediately in frontend if it's from the selected user
      const messageWithReadStatus = isMessageFromSelectedUser
        ? { ...newMessage, read: true }
        : newMessage;

      // Use functional update to ensure we have latest state
      set((state) => ({
        messages: [...state.messages, messageWithReadStatus],
      }));

      // Mark this message as read in backend only if it's from the selected user
      if (isMessageFromSelectedUser) {
        try {
          await axiosInstance.put(`/messages/mark-read/${senderId}`);
        } catch (error) {
          console.error("Error marking message as read:", error);
        }
      }

      // Refresh chat list to update order (this chat should move to top)
      get().getMyChatPartners(true);
    };

    // Listen for messages read event (when receiver opens the chat)
    const readHandler = (data) => {
      const { authUser } = useAuthStore.getState();
      const currentSelectedUser = get().selectedUser;

      // Update messages - chatPartnerId is the person who READ the messages (receiver)
      // So we need to mark messages where WE are sender and THEY are receiver
      if (
        currentSelectedUser &&
        currentSelectedUser._id === data.chatPartnerId
      ) {
        set((state) => ({
          messages: state.messages.map((msg) => {
            // Mark messages as read where I'm the sender and they're the receiver
            if (
              msg.senderId === authUser._id &&
              msg.receiverId === currentSelectedUser._id
            ) {
              return { ...msg, read: true };
            }
            return msg;
          }),
        }));
      }
    };

    // save handler so we can unsubscribe without removing other listeners
    set({ chatMessageListener: handler });

    socket.on("newMessage", handler);
    socket.on("messagesRead", readHandler);
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    const { chatMessageListener } = get();
    if (socket && chatMessageListener) {
      socket.off("newMessage", chatMessageListener);
      socket.off("messagesRead");
    }
    set({ chatMessageListener: null });
  },

  subscribeToGlobalNotifications: () => {
    const {
      isSoundEnabled,
      selectedUser,
      globalMessageListener,
      recentNotifications,
    } = get();
    const socket = useAuthStore.getState().socket;

    // Prevent duplicate listeners
    if (!socket || globalMessageListener) return;

    const handler = (newMessage) => {
      const { authUser } = useAuthStore.getState();

      // Extract sender and receiver IDs (handle both populated and non-populated)
      const senderId =
        typeof newMessage.senderId === "object"
          ? newMessage.senderId._id
          : newMessage.senderId;

      const receiverId =
        typeof newMessage.receiverId === "object"
          ? newMessage.receiverId._id
          : newMessage.receiverId;

      // Check if message is for me
      const isMessageForMe = receiverId === authUser._id;

      // Only process messages sent TO me (not messages I sent from other devices)
      if (!isMessageForMe) return;

      const currentSelectedUser = get().selectedUser;
      const fromSelectedUser =
        currentSelectedUser && senderId === currentSelectedUser._id;

      // ✅ CRITICAL FIX: Always refresh chat list immediately
      // This ensures chat list shows updated unread counts and message order
      get().getMyChatPartners(true);

      // Update recent notifications map for browser notifications
      const text = newMessage.text
        ? newMessage.text
        : newMessage.image
        ? "[Photo]"
        : "New message";

      const map = { ...(recentNotifications || {}) };
      const arr = Array.isArray(map[senderId]) ? map[senderId].slice() : [];
      arr.push(text);
      const lastTwo = arr.slice(-2);
      map[senderId] = lastTwo;
      set({ recentNotifications: map });

      // Show browser notification and sound only if NOT currently viewing this chat
      if (!fromSelectedUser) {
        // Browser notification
        if (typeof window !== "undefined" && "Notification" in window) {
          const canNotify = Notification.permission === "granted";
          if (canNotify) {
            let senderName = "New message";

            if (
              typeof newMessage.senderId === "object" &&
              newMessage.senderId.fullName
            ) {
              senderName = newMessage.senderId.fullName;
            } else {
              const { chats, allContacts } = get();
              const sender =
                (chats || []).find((u) => u._id === senderId) ||
                (allContacts || []).find((u) => u._id === senderId);
              if (sender?.fullName) {
                senderName = sender.fullName;
              }
            }

            const title = `Message from ${senderName}`;
            const body = lastTwo.join("\n");
            const n = new Notification(title, {
              body,
              icon: "/logo.png",
              tag: senderId,
            });
            n.onclick = () => {
              window.focus?.();
              const { chats, allContacts, setSelectedUser, setActiveTab } =
                get();
              const sender =
                (chats || []).find((u) => u._id === senderId) ||
                (allContacts || []).find((u) => u._id === senderId);
              if (sender) {
                setActiveTab("chats");
                setSelectedUser(sender);
              }
              n.close?.();
            };
          } else if (Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
          }
        }

        // Play notification sound
        if (isSoundEnabled) {
          const notificationSound = new Audio("/sounds/notification.mp3");
          notificationSound.currentTime = 0;
          notificationSound.play().catch(() => {});
        }

        // Vibration on mobile devices
        try {
          navigator.vibrate?.(200);
        } catch {}
      }
    };

    // Listen for messages read event
    const readHandler = (data) => {
      const { authUser } = useAuthStore.getState();
      const currentSelectedUser = get().selectedUser;

      if (
        currentSelectedUser &&
        currentSelectedUser._id === data.chatPartnerId
      ) {
        set((state) => ({
          messages: state.messages.map((msg) => {
            if (
              msg.senderId === authUser._id &&
              msg.receiverId === data.chatPartnerId
            ) {
              return { ...msg, read: true };
            }
            return msg;
          }),
        }));
      }
    };

    socket.on("newMessage", handler);
    socket.on("messagesRead", readHandler);
    set({ globalMessageListener: handler });
  },

  unsubscribeFromGlobalNotifications: () => {
    const socket = useAuthStore.getState().socket;
    const { globalMessageListener } = get();
    if (socket && globalMessageListener) {
      socket.off("newMessage", globalMessageListener);
      socket.off("messagesRead");
      set({ globalMessageListener: null });
    }
  },
}));
