import { MessageCircleIcon } from "lucide-react";

const NoConversationPlaceholder = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4 sm:p-6">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4 sm:mb-6">
        <MessageCircleIcon className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400" />
      </div>
      <h3 className="text-lg sm:text-xl font-semibold text-slate-200 mb-2 px-4">
        Select a conversation
      </h3>
      <p className="text-sm sm:text-base text-slate-400 max-w-md px-4">
        Choose a contact from the sidebar to start chatting or continue a
        previous conversation.
      </p>
    </div>
  );
};

export default NoConversationPlaceholder;
