import { useState } from "react";
import { InternalChatList } from "@/components/internal-chat/InternalChatList";
import { InternalChatWindow } from "@/components/internal-chat/InternalChatWindow";
import { NewInternalChatDialog } from "@/components/internal-chat/NewInternalChatDialog";
import { PageLayout } from "@/components/PageLayout";

const MensagensInternas = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  return (
    <PageLayout fullHeight>
      {/* Header */}
      <div className="h-14 border-b flex items-center px-4 gap-3 bg-background/80 backdrop-blur-sm shrink-0">
        <h1 className="font-semibold text-lg">Mensagens Internas</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0">
          <InternalChatList
            selectedId={selectedConversation}
            onSelect={setSelectedConversation}
            onNewChat={() => setShowNewChat(true)}
          />
        </div>
        <InternalChatWindow conversationId={selectedConversation} />
      </div>

      <NewInternalChatDialog
        open={showNewChat}
        onOpenChange={setShowNewChat}
        onCreated={(id) => setSelectedConversation(id)}
      />
    </PageLayout>
  );
};

export default MensagensInternas;
