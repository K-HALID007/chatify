import { useEffect, memo } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useAuthStore } from "../store/useAuthStore";

// Memoized Chat Item Component
const ChatItem = memo(({ chat, isOnline, showUnreadBadge, onClick }) => {
  return (
    <div
      className="bg-cyan-500/10 p-3 sm:p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={`avatar flex-shrink-0 ${isOnline ? "online" : "offline"}`}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full">
            <img
              src={chat.profilePic || "/avatar.png"}
              alt={chat.fullName}
              loading="lazy"
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-slate-200 font-medium text-sm sm:text-base truncate">
            {chat.fullName}
          </h4>
          {!isOnline && (
            <p className="text-slate-400 text-xs">Offline</p>
          )}
        </div>
        {showUnreadBadge && (
          <div className="flex-shrink-0 bg-cyan-500 text-white text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
            {chat.unreadCount}
          </div>
        )}
      </div>
    </div>
  );
});

ChatItem.displayName = "ChatItem";

function ChatsList() {
  const { getMyChatPartners, chats, isUsersLoading, setSelectedUser, selectedUser } =
    useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  return (
    <>
      {chats.map((chat) => {
        // Agar yeh chat currently open hai, toh unread badge mat dikhao
        const isCurrentlyChattingWith = selectedUser && selectedUser._id === chat._id;
        const showUnreadBadge = !isCurrentlyChattingWith && chat.unreadCount > 0;
        const isOnline = onlineUsers.includes(chat._id);

        return (
          <ChatItem
            key={chat._id}
            chat={chat}
            isOnline={isOnline}
            showUnreadBadge={showUnreadBadge}
            onClick={() => setSelectedUser(chat)}
          />
        );
      })}
    </>
  );
}
export default ChatsList;
