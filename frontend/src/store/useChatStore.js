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

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      // Ensure it's always an array
      const contacts = Array.isArray(res.data)
        ? res.data
        : res.data?.contacts || [];
      set({ allContacts: contacts });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load contacts");
      set({ allContacts: [] }); // Set empty array on error
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");

      // Debug log to see what the API returns
      console.log("API Response:", res.data);

      // Handle different response structures
      let chatsArray;
      if (Array.isArray(res.data)) {
        chatsArray = res.data;
      } else if (res.data?.chats && Array.isArray(res.data.chats)) {
        chatsArray = res.data.chats;
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        chatsArray = res.data.data;
      } else {
        console.error("Unexpected response structure:", res.data);
        chatsArray = [];
      }

      set({ chats: chatsArray });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load chats");
      set({ chats: [] }); // Set empty array on error
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      // Ensure it's always an array
      const messages = Array.isArray(res.data)
        ? res.data
        : res.data?.messages || [];
      set({ messages });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
      set({ messages: [] }); // Set empty array on error
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const { authUser } = useAuthStore.getState();

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Immediately update the ui by adding the message
    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );

      // Replace optimistic message with real one
      const updatedMessages = messages.map((msg) =>
        msg._id === tempId ? res.data : msg
      );
      set({ messages: updatedMessages });
    } catch (error) {
      // Remove optimistic message on failure
      set({ messages: messages.filter((msg) => msg._id !== tempId) });
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser, isSoundEnabled } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser =
        newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      const currentMessages = get().messages;
      set({ messages: [...currentMessages, newMessage] });

      if (isSoundEnabled) {
        const notificationSound = new Audio("/sounds/notification.mp3");
        notificationSound.currentTime = 0;
        notificationSound
          .play()
          .catch((e) => console.log("Audio play failed:", e));
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },
}));
