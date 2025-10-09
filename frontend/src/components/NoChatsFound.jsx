import { MessageCircleIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

function NoChatsFound() {
  const { setActiveTab } = useChatStore();

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-10 text-center space-y-3 sm:space-y-4">
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-cyan-500/10 rounded-full flex items-center justify-center">
        <MessageCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400" />
      </div>
      <div className="px-4">
        <h4 className="text-slate-200 font-medium mb-1 text-sm sm:text-base">
          No conversations yet
        </h4>
        <p className="text-slate-400 text-xs sm:text-sm">
          Start a new chat by selecting a contact from the contacts tab
        </p>
      </div>
      <button
        onClick={() => setActiveTab("contacts")}
        className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-cyan-400 bg-cyan-500/10 rounded-lg hover:bg-cyan-500/20 transition-colors"
      >
        Find contacts
      </button>
    </div>
  );
}
export default NoChatsFound;
