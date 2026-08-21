import { useEffect, useRef, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Mic, Video, MonitorUp, Users, PhoneOff, ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

export default function MeetingRoom({ cls, user, onLeave }) {
  const apiRef = useRef(null);
  const [roomName, setRoomName] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [present, setPresent] = useState(null);
  const isTeacher = user.role === "teacher";

  useEffect(() => {
    let cancelled = false;
    api
      .post(`/classes/${cls.id}/join`)
      .then((r) => !cancelled && setRoomName(r.data.room_name))
      .catch(() => {
        toast.error("Could not join the class");
        onLeave();
      });
    return () => {
      cancelled = true;
      apiRef.current?.dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls.id]);

  const refreshParticipants = () => {
    if (!apiRef.current) return;
    const list = apiRef.current.getParticipantsInfo?.() || [];
    setParticipants(list);
  };

  const onApiReady = (jitsiApi) => {
    apiRef.current = jitsiApi;
    jitsiApi.addListener("participantJoined", refreshParticipants);
    jitsiApi.addListener("participantLeft", refreshParticipants);
    jitsiApi.addListener("videoConferenceJoined", refreshParticipants);
    jitsiApi.addListener("videoConferenceLeft", () => {
      apiRef.current?.dispose?.();
      onLeave();
    });
  };

  const cmd = (name) => apiRef.current?.executeCommand?.(name);

  const takeAttendance = async () => {
    const info = apiRef.current?.getParticipantsInfo?.() || [];
    const names = info.map((p) => p.displayName).filter(Boolean);
    if (!names.includes(user.name)) names.push(user.name);
    try {
      const { data } = await api.post(`/classes/${cls.id}/attendance`, { participants: names });
      setPresent(data.present);
      toast.success(`${data.count} student${data.count === 1 ? "" : "s"} marked present`);
    } catch {
      toast.error("Attendance failed");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white" data-testid="meeting-room">
      <div className="flex h-16 items-center justify-between border-b border-[#ececec] px-6">
        <div>
          <div className="font-serif text-lg text-ink" data-testid="meeting-subject">{cls.subject}</div>
          <div className="text-xs text-steel">
            {cls.teacher_name} · {cls.date} at {cls.time}
          </div>
        </div>
        <button data-testid="meeting-close-btn" onClick={() => { cmd("hangup"); onLeave(); }} className="rounded-full p-2 text-steel hover:bg-mist">
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#ececec]">
          {roomName ? (
            <JitsiMeeting
              domain="meet.jit.si"
              roomName={roomName}
              userInfo={{ displayName: user.name }}
              configOverwrite={{
                startWithAudioMuted: true,
                startWithVideoMuted: true,
                prejoinConfig: { enabled: false },
                disableDeepLinking: true,
              }}
              interfaceConfigOverwrite={{
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                TILE_VIEW_MAX_COLUMNS: 5,
              }}
              onApiReady={onApiReady}
              getIFrameRef={(iframe) => {
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.minHeight = "480px";
                iframe.style.border = "0";
              }}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-steel">Connecting to room…</div>
          )}
        </div>

        <div className="hidden w-64 shrink-0 flex-col rounded-2xl border border-[#ececec] bg-fog p-4 md:flex">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
            <Users size={16} /> Participants ({participants.length + 1})
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto text-sm text-steel" data-testid="participants-list">
            <li className="font-medium text-ink">{user.name} (you)</li>
            {participants.map((p, i) => (
              <li key={p.participantId || i}>{p.displayName || "Guest"}</li>
            ))}
          </ul>
          {present && (
            <div className="mt-3 rounded-xl bg-peach p-3" data-testid="attendance-result">
              <div className="text-xs font-medium text-sienna">Marked present</div>
              <div className="mt-1 text-[13px] text-sienna">{present.join(", ") || "—"}</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-[#ececec] py-4">
        <button data-testid="toggle-mic-btn" onClick={() => cmd("toggleAudio")} className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-ink transition-colors hover:bg-ink hover:text-white" title="Microphone">
          <Mic size={20} />
        </button>
        <button data-testid="toggle-video-btn" onClick={() => cmd("toggleVideo")} className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-ink transition-colors hover:bg-ink hover:text-white" title="Camera">
          <Video size={20} />
        </button>
        <button data-testid="share-screen-btn" onClick={() => cmd("toggleShareScreen")} className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-ink transition-colors hover:bg-ink hover:text-white" title="Share screen">
          <MonitorUp size={20} />
        </button>
        {isTeacher && (
          <button data-testid="auto-attendance-btn" onClick={takeAttendance} className="flex h-12 items-center gap-2 rounded-full bg-peach px-5 text-sm font-medium text-sienna transition-opacity hover:opacity-85" title="Auto attendance">
            <ClipboardCheck size={18} /> Auto attendance
          </button>
        )}
        <button data-testid="end-call-btn" onClick={() => cmd("hangup")} className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white transition-opacity hover:opacity-85" title="End call">
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}
