import { useEffect, useRef, memo } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";

// Memoized Message Component for better performance
const MessageBubble = memo(({ msg, isOwnMessage }) => {
  return (
    <div className={`chat ${isOwnMessage ? "chat-end" : "chat-start"}`}>
      <div
        className={`chat-bubble relative max-w-[85%] sm:max-w-md md:max-w-lg break-words ${
          isOwnMessage
            ? msg.status === 'failed' 
              ? "bg-red-600/80 text-white"
              : "bg-cyan-600 text-white"
            : "bg-slate-800 text-slate-200"
        }`}
      >
        {msg.image && (
          <img
            src={msg.image}
            alt="Shared"
            className="rounded-lg w-full h-auto max-h-48 sm:max-h-56 md:max-h-64 object-cover"
            loading="lazy"
          />
        )}
        {msg.text && (
          <p className="mt-2 text-sm sm:text-base leading-relaxed">
            {msg.text}
          </p>
        )}
        <p className="text-[10px] sm:text-xs mt-1 flex items-center gap-1">
          <span className="opacity-70">
            {new Date(msg.createdAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isOwnMessage && (
            <span className="text-[10px] sm:text-xs">
              {msg.status === 'sending' ? (
                <span className="opacity-50">· Sending...</span>
              ) : msg.status === 'failed' ? (
                <span className="text-red-200 font-semibold">· Failed</span>
              ) : msg.read === true ? (
                <span className="text-cyan-300 font-semibold">· Seen</span>
              ) : (
                <span className="opacity-50">· Sent</span>
              )}
            </span>
          )}
        </p>
      </div>
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const previousMessagesLengthRef = useRef(0);

  useEffect(() => {
    getMessagesByUserId(selectedUser._id);
    subscribeToMessages();

    // clean up
    return () => unsubscribeFromMessages();
  }, [
    selectedUser,
    getMessagesByUserId,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    // Only scroll if new messages were added (not on scroll)
    if (messages.length > previousMessagesLengthRef.current) {
      if (messageEndRef.current) {
        // Use requestAnimationFrame for smoother scroll
        requestAnimationFrame(() => {
          messageEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
        });
      }
    }
    previousMessagesLengthRef.current = messages.length;
  }, [messages]);

  return (
    <div className="flex flex-col h-full w-full">
      <ChatHeader />
      <div 
        className="flex-1 px-3 sm:px-4 md:px-6 overflow-y-auto py-4 sm:py-6 md:py-8"
        style={{ 
          willChange: 'scroll-position',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
      >
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-full sm:max-w-2xl md:max-w-3xl mx-auto space-y-4 sm:space-y-6">
            {messages.map((msg) => (
              <MessageBubble 
                key={msg._id} 
                msg={msg} 
                isOwnMessage={msg.senderId === authUser._id}
              />
            ))}
            {/* 👇 scroll target */}
            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser.fullName} />
        )}
      </div>

      <MessageInput />
    </div>
  );
}

export default ChatContainer;
