import { XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";

function ChatHeader() {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const isOnline = onlineUsers.includes(selectedUser._id);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") setSelectedUser(null);
    };

    window.addEventListener("keydown", handleEscKey);

    // cleanup function
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser]);

  return (
    <div
      className="flex justify-between items-center bg-slate-800/50 border-b
   border-slate-700/50 min-h-[60px] sm:min-h-[70px] md:min-h-[84px] px-3 sm:px-4 md:px-6 py-3"
    >
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
        <div className={`avatar ${isOnline ? "online" : "offline"} flex-shrink-0`}>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full">
            <img
              src={selectedUser.profilePic || "/avatar.png"}
              alt={selectedUser.fullName}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-slate-200 font-medium text-sm sm:text-base truncate">
            {selectedUser.fullName}
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm">
            {isOnline ? "Online" : "Last seen recently"}
          </p>
        </div>
      </div>

      <button onClick={() => setSelectedUser(null)} className="flex-shrink-0 p-1">
        <XIcon  className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
      </button>
    </div>
  );
}
export default ChatHeader;
