import { useChatStore } from "../store/useChatStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import ChatContainer from "../components/ChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";

function ChatPage() {
  const { activeTab, selectedUser } = useChatStore();

  return (
    <div className="relative w-full max-w-6xl h-screen sm:h-[600px] md:h-[700px] lg:h-[800px] px-2 sm:px-0">
      <BorderAnimatedContainer>
        {/* LEFT SIDE - Hidden on mobile when chat is selected */}
        <div
          className={`${
            selectedUser ? "hidden sm:flex" : "flex"
          } w-full sm:w-64 md:w-72 lg:w-80 bg-slate-800/50 backdrop-blur-sm flex-col`}
        >
          <ProfileHeader />
          <ActiveTabSwitch />

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
            {activeTab === "chats" ? <ChatsList /> : <ContactList />}
          </div>
        </div>

        {/* RIGHT SIDE - Full width on mobile when chat is selected */}
        <div
          className={`${
            selectedUser ? "flex" : "hidden sm:flex"
          } flex-1 flex-col bg-slate-900/50 backdrop-blur-sm`}
        >
          {selectedUser ? <ChatContainer /> : <NoConversationPlaceholder />}
        </div>
      </BorderAnimatedContainer>
    </div>
  );
}

export default ChatPage;
