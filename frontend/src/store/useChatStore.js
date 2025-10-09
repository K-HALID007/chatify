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
      status: 'sending', // Add status field
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
      const updatedMessages = get().messages.filter(msg => msg._id !== tempId);
      set({ messages: [...updatedMessages, res.data] });
      
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Retry logic - retry up to 2 times
      if (retryCount < 2) {
        console.log(`Retrying message send... Attempt ${retryCount + 1}`);
        setTimeout(() => {
          // Remove failed optimistic message before retry
          const currentMessages = get().messages.filter(msg => msg._id !== tempId);
          set({ messages: currentMessages });
          // Retry
          get().sendMessage(messageData, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s
      } else {
        // After all retries failed, mark message as failed
        const updatedMessages = get().messages.map(msg => 
          msg._id === tempId ? { ...msg, status: 'failed' } : msg
        );
        set({ messages: updatedMessages });
        toast.error(error.response?.data?.message || "Failed to send message. Please try again.");
      }
    }
  },

  subscribeToMessages: () => {
    const { selectedUser, isSoundEnabled } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    const handler = async (newMessage) => {
      // Extract sender ID (handle both populated and non-populated)
      const senderId =
        typeof newMessage.senderId === "object"
          ? newMessage.senderId._id
          : newMessage.senderId;

      const isMessageSentFromSelectedUser = senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      const currentMessages = get().messages;
      set({ messages: [...currentMessages, newMessage] });

      // Mark this message as read immediately since chat is open
      try {
        await axiosInstance.put(`/messages/mark-read/${senderId}`);
      } catch (error) {
        console.error(" Error marking message as read:", error);
      }

      // Refresh chat list to update order (this chat should move to top)
      get().getMyChatPartners(true);

      // NO SOUND when chat is already open - you're already viewing the messages
      // Sound only plays from global handler when you're NOT in the chat
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
        const updatedMessages = get().messages.map((msg) => {
          // Mark messages as read where I'm the sender and they're the receiver
          if (
            msg.senderId === authUser._id &&
            msg.receiverId === currentSelectedUser._id
          ) {
            return { ...msg, read: true };
          }
          return msg;
        });
        set({ messages: updatedMessages });
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
    if (!socket || globalMessageListener) return;

    const handler = (newMessage) => {
      // Extract sender ID (handle both populated and non-populated)
      const senderId =
        typeof newMessage.senderId === "object"
          ? newMessage.senderId._id
          : newMessage.senderId;

      const fromSelectedUser = selectedUser && senderId === selectedUser._id;

      // Always refresh chat list to update unread counts and order
      setTimeout(() => {
        get().getMyChatPartners(true);
      }, 200);

      // Update recent notifications map
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

      // Show browser notification
      if (typeof window !== "undefined" && "Notification" in window) {
        const canNotify = Notification.permission === "granted";
        if (canNotify) {
          // Get sender name from populated data or from existing lists
          let senderName = "New message";

          if (
            typeof newMessage.senderId === "object" &&
            newMessage.senderId.fullName
          ) {
            senderName = newMessage.senderId.fullName;
          } else {
            // try to resolve sender name from existing lists
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
            tag: senderId, // group by sender
          });
          n.onclick = () => {
            window.focus?.();
            // open that chat if we know the user
            const { chats, allContacts, setSelectedUser, setActiveTab } = get();
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
          Notification.requestPermission()
            .then((perm) => {
              if (perm === "granted") {
                // try once after permission grant
                const { subscribeToGlobalNotifications } = get();
                subscribeToGlobalNotifications();
              }
            })
            .catch(() => {});
        }
      }

      // Sound for background/other chat
      if (isSoundEnabled) {
        const notificationSound = new Audio("/sounds/notification.mp3");
        notificationSound.currentTime = 0;
        notificationSound.play().catch(() => {});
      }

      // Optional vibration on supported devices
      try {
        navigator.vibrate?.(200);
      } catch {}
    };

    // Listen for messages read event
    socket.on("messagesRead", (data) => {
      const { authUser } = useAuthStore.getState();
      const currentSelectedUser = get().selectedUser;

      // Update messages in current chat if viewing that conversation
      if (
        currentSelectedUser &&
        currentSelectedUser._id === data.chatPartnerId
      ) {
        const updatedMessages = get().messages.map((msg) => {
          if (
            msg.senderId === authUser._id &&
            msg.receiverId === data.chatPartnerId
          ) {
            return { ...msg, read: true };
          }
          return msg;
        });
        set({ messages: updatedMessages });
      }
    });

    socket.on("newMessage", handler);
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
