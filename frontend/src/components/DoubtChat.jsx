import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, Save, XCircle, X } from "lucide-react";
import { toast } from "sonner";
import api, { fileUrl, downloadBlob } from "../lib/api";
import { Avatar, StatusBadge } from "./bits";

export default function DoubtChat({ thread, user, onCloseThread }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [closed, setClosed] = useState(thread.status === "closed");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const isStudentView = user.role === "student";
  const otherName = isStudentView ? thread.teacher_name : thread.student_name;
  const otherPic = isStudentView ? thread.teacher_pic : null;

  const load = async () => {
    try {
      const { data } = await api.get(`/doubts/threads/${thread.id}/messages`);
      setMessages(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() && !file) return;
    const fd = new FormData();
    fd.append("text", text);
    if (file) fd.append("file", file);
    try {
      await api.post(`/doubts/threads/${thread.id}/messages`, fd);
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch {
      toast.error("Could not send message");
    }
  };

  const saveChat = async () => {
    const res = await api.get(`/doubts/threads/${thread.id}/transcript`, { responseType: "blob" });
    downloadBlob(res.data, `doubt-${thread.subject}.txt`);
    toast.success("Chat saved");
  };

  const closeChat = async () => {
    await api.post(`/doubts/threads/${thread.id}/close`);
    setClosed(true);
    toast.success("Chat closed");
    onCloseThread?.();
  };

  return (
    <div className="card flex h-full min-h-[480px] flex-col" data-testid="doubt-chat">
      <div className="flex items-center justify-between border-b border-[#ececec] px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar src={otherPic} name={otherName} size={38} />
          <div>
            <div className="text-[15px] font-medium text-ink" data-testid="chat-other-name">{otherName}</div>
            <div className="text-xs text-steel">{thread.subject}</div>
          </div>
          <StatusBadge status={closed ? "closed" : "open"} />
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="save-chat-btn" onClick={saveChat} className="btn-ghost !px-3.5 !py-2 text-xs" title="Save chat">
            <Save size={14} /> Save chat
          </button>
          {!closed && (
            <button data-testid="close-chat-btn" onClick={closeChat} className="btn-ghost !px-3.5 !py-2 text-xs" title="Close chat">
              <XCircle size={14} /> Close chat
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" data-testid="chat-messages" style={{ maxHeight: 420 }}>
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-smoke">No messages yet. Start the conversation below.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine ? "bg-ink text-white" : "bg-mist text-ink"
                }`}
              >
                {!mine && <div className="mb-0.5 text-xs font-medium opacity-60">{m.sender_name}</div>}
                {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                {m.file && (
                  <a
                    href={fileUrl(m.file)}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-1 flex items-center gap-1.5 text-xs underline ${mine ? "text-white/80" : "text-steel"}`}
                  >
                    <Paperclip size={12} /> {m.file_name || "Attachment"}
                  </a>
                )}
                <div className={`mt-1 text-right text-[10px] ${mine ? "text-white/50" : "text-ash"}`}>
                  {(m.created_at || "").slice(11, 16)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!closed ? (
        <div className="border-t border-[#ececec] px-5 py-4">
          {file && (
            <div className="mb-2 flex items-center gap-2 text-xs text-steel">
              <Paperclip size={12} /> {file.name}
              <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-ink">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              data-testid="chat-file-input"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              data-testid="chat-attach-btn"
              onClick={() => fileRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mist text-ink transition-colors hover:bg-ink hover:text-white"
            >
              <Paperclip size={18} />
            </button>
            <input
              data-testid="chat-message-input"
              className="input !rounded-full"
              placeholder="Type your message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button data-testid="chat-send-btn" onClick={send} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-opacity hover:opacity-85">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-[#ececec] px-5 py-4 text-center text-sm text-smoke" data-testid="chat-closed-note">
          This chat is closed. Saved transcript is still available via “Save chat”.
        </div>
      )}
    </div>
  );
}
