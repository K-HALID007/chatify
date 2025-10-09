function MessagesLoadingSkeleton() {
  return (
    <div className="max-w-full sm:max-w-2xl md:max-w-3xl mx-auto space-y-4 sm:space-y-6 px-2">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className={`chat ${
            index % 2 === 0 ? "chat-start" : "chat-end"
          } animate-pulse`}
        >
          <div className={`chat-bubble bg-slate-800 text-white w-24 sm:w-32 h-8 sm:h-10`}></div>
        </div>
      ))}
    </div>
  );
}
export default MessagesLoadingSkeleton;
