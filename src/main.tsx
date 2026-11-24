import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Brain, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Code2,
  Copy, Download, Eye, EyeOff, FileText, Files, Globe2, Image as ImageIcon, Images, Library,
  LogIn, LogOut, Menu, Mic, CircleHelp, MoreHorizontal, Plus, Search, Share2, LockKeyhole, Folder,
  Send, Settings, Sparkles, Sun, ThumbsDown, ThumbsUp, Trash2,
  UserRound, Volume2, X, Zap
} from "lucide-react";
import "./styles.css";
import "./theme.css";
import "./chat-theme.css";

type Mode = "fast" | "smart" | "reasoning" | "coding" | "research" | "vision" | "study";
type Section = "Chat" | "Search" | "Explore" | "Library" | "Settings";
type Rating = "helpful" | "not_helpful";
type IconComponent = typeof Sparkles;

interface User {
  email: string;
  name: string | null;
  role: "user" | "owner";
}

interface Source {
  title?: string;
  url: string;
  content?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  sources?: Source[];
  attachments?: Array<{ fileName: string; mimeType: string; previewUrl?: string }>;
  streaming?: boolean;
  generationType?: "image" | "document";
  progress?: number;
  progressLabel?: string;
}

interface Conversation {
  id: string;
  title: string;
  mode: string;
  archived?: boolean;
  pinned?: boolean;
  messages: ChatMessage[];
}

interface Preference {
  learning: boolean;
  crossChat: boolean;
  language: string;
  personality: string;
}

interface SavedMemory {
  id: string;
  category: string;
  content: string;
  updatedAt: string;
}

interface LibraryFile {
  fileName: string;
  size: number;
  type: string;
  url: string;
  updatedAt: string;
}

interface ExploreResult {
  fileName: string;
  mimeType?: string;
  previewUrl?: string;
  content?: string;
  title?: string;
}

interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  previewUrl?: string;
}

interface ApiErrorBody {
  error?: string;
  code?: string;
}

interface SpeechResultLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechResultLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  let response: Response;
  try { response = await fetch(url, { ...init, credentials: "include", headers, signal: controller.signal }); }
  catch (error) {
    if (controller.signal.aborted) throw new Error("The server request timed out or was cancelled. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? String((body as ApiErrorBody).error || `Request failed (${response.status}).`)
      : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, body && typeof body === "object" && "code" in body ? String((body as ApiErrorBody).code || "") : undefined);
  }
  return body as T;
}

async function requestWithRetry<T>(url: string, attempts = 3, signal?: AbortSignal): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) throw new Error("Request cancelled.");
    try { return await request<T>(url, { method: "GET", signal }, 5000); }
    catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.status < 500) throw error;
      if (attempt < attempts - 1) await new Promise(resolve => window.setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The server is not responding. Check your connection and retry.");
}

function uploadRequest<T>(form: FormData, onProgress: (percent: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.withCredentials = true;
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error("The upload could not reach the server. Check your connection and retry."));
    xhr.ontimeout = () => reject(new Error("The upload timed out. Try a smaller file or retry."));
    xhr.timeout = 60000;
    xhr.onload = () => {
      let body: unknown;
      try { body = JSON.parse(xhr.responseText); } catch { body = null; }
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = body && typeof body === "object" && "error" in body ? String((body as ApiErrorBody).error || `Upload failed (${xhr.status}).`) : `Upload failed (${xhr.status}).`;
        reject(new ApiError(message, xhr.status));
        return;
      }
      resolve(body as T);
    };
    xhr.send(form);
  });
}

function jsonRequest(method: string, body?: unknown): RequestInit {
  return { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

function makeId() {
  return crypto.randomUUID();
}

function getGuestHistory(): Conversation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("kopli.guest-conversations.v1") || "[]");
    if (!Array.isArray(value)) return [];
    const conversations = value.filter((item): item is Conversation =>
      item && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.messages)
    );
    return conversations.map(conversation => ({
      ...conversation,
      messages: conversation.messages.map(message => ({
        ...message,
        attachments: message.attachments?.map(({ fileName, mimeType }) => ({ fileName, mimeType }))
      }))
    }));
  } catch (error) {
    console.error("Could not read local chat history:", error);
    return [];
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function detectCreationIntent(prompt: string): { type: "image" | "document"; format?: "docx" | "pdf" | "pptx" | "xlsx" } | null {
  const text = prompt.trim();
  const action = /\b(create|generate|make|build|prepare|design|draw|write|draft)\b/i;
  if (!action.test(text)) return null;
  if (/\b(image|picture|photo|illustration|artwork|wallpaper)\b/i.test(text)) return { type: "image" };
  if (/\b(power\s*point|powerpoint|pptx?|slides?|slide deck|presentation)\b/i.test(text)) return { type: "document", format: "pptx" };
  if (/\b(pdf)\b/i.test(text)) return { type: "document", format: "pdf" };
  if (/\b(excel|spreadsheet|workbook|xlsx?)\b/i.test(text)) return { type: "document", format: "xlsx" };
  if (/\b(word|docx|word document|document|report|assignment|project report|resume|cv)\b/i.test(text)) return { type: "document", format: "docx" };
  return null;
}

const modes: Array<{ id: Mode; label: string; detail: string; icon: IconComponent }> = [
  { id: "fast", label: "Fast", detail: "Quick response", icon: Zap },
  { id: "smart", label: "Smart", detail: "Balanced assistant", icon: Sparkles },
  { id: "reasoning", label: "Reasoning", detail: "Complex analysis", icon: Brain },
  { id: "coding", label: "Coding", detail: "Programming assistant", icon: Code2 },
  { id: "research", label: "Research", detail: "Real web sources", icon: Globe2 },
  { id: "vision", label: "Vision", detail: "Image-aware workflow", icon: Eye },
  { id: "study", label: "Study", detail: "Learn step by step", icon: Brain }
];

const navigation: Array<{ label: Section; icon: IconComponent }> = [
  { label: "Chat", icon: Sparkles },
  { label: "Search", icon: Search },
  { label: "Explore", icon: Globe2 },
  { label: "Library", icon: Library },
  { label: "Settings", icon: Settings }
];

function MessageView({
  message,
  onFeedback,
  onCopy,
  onSpeak
}: {
  message: ChatMessage;
  onFeedback: (message: ChatMessage, rating: Rating) => void;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <article className={`message ${message.role}${message.streaming ? " streaming" : ""}`}>
      <div className="message-user-content">
        <div className="message-content">
          {message.content
            ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            : <div className="thinking-state" role="status"><span>Thinking</span></div>}
          {message.generationType && message.streaming && <div className="generation-card" role="status" aria-live="polite">
            <div className="generation-card-heading"><span className="generation-card-icon">{message.generationType === "image" ? <ImageIcon size={17} /> : <FileText size={17} />}</span><span>{message.progressLabel || (message.generationType === "image" ? "Creating your image" : "Creating your document")}</span><strong>{message.progress ?? 8}%</strong></div>
            <div className="generation-progress-track"><span style={{ width: `${message.progress ?? 8}%` }} /></div>
            <div className="generation-card-footer"><span>Preparing</span><span>Generating</span><span>Finishing</span></div>
          </div>}
          {!!message.sources?.length && <div className="sources" aria-label="Sources">
            {message.sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">[{index + 1}] {source.title || source.url}</a>)}
          </div>}
        </div>
          {!!message.attachments?.length && <div className="message-attachments" aria-label="Message attachments">
            {message.attachments.map((attachment, index) => attachment.previewUrl
              ? <img key={`${attachment.fileName}-${index}`} src={attachment.previewUrl} alt={attachment.fileName} />
              : <span key={`${attachment.fileName}-${index}`}><FileText size={16} />{attachment.fileName}</span>)}
          </div>}
        {!isUser && !message.streaming && message.content && <div className="message-actions" aria-label="Response actions">
          <button type="button" aria-label="Copy response" title="Copy" onClick={() => onCopy(message.content)}><Copy size={16} /></button>
          <button type="button" aria-label="Read response aloud" title="Read aloud" onClick={() => onSpeak(message.content)}><Volume2 size={16} /></button>
          <button type="button" aria-label="Mark helpful" title="Helpful" onClick={() => onFeedback(message, "helpful")}><ThumbsUp size={16} /></button>
          <button type="button" aria-label="Mark not helpful" title="Not helpful" onClick={() => onFeedback(message, "not_helpful")}><ThumbsDown size={16} /></button>
        </div>}
      </div>
    </article>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [authStage, setAuthStage] = useState<"account" | "forgot" | "reset" | "verify">("account");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirmation, setAuthPasswordConfirmation] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "degraded" | "offline">("checking");
  const [section, setSection] = useState<Section>("Chat");
  const [sidebarOpen, setSidebarOpen] = useState(() => { if (window.matchMedia("(max-width: 900px)").matches) return false; try { const saved = localStorage.getItem("kopli.sidebar"); if (saved) return saved === "open"; } catch {} return false; });
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [mode, setMode] = useState<Mode>("smart");
  const [headerModeOpen, setHeaderModeOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [chatActionsOpen, setChatActionsOpen] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [composerModeOpen, setComposerModeOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("kopli.theme") === "dark"; }
    catch (error) { console.error("Could not read theme preference:", error); return false; }
  });
  const [reduceEffects, setReduceEffects] = useState(() => {
    try {
      const saved = localStorage.getItem("kopli.reduce-effects");
      return saved === null ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : saved === "true";
    }
    catch (error) { console.error("Could not read motion preference:", error); return false; }
  });
  const [conversations, setConversations] = useState<Conversation[]>(() => getGuestHistory());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState("");
  const [preferences, setPreferences] = useState<Preference>({
    learning: true, crossChat: true, language: "English", personality: "balanced"
  });
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memories, setMemories] = useState<SavedMemory[]>([]);
  const [memoryStats, setMemoryStats] = useState({ memoryCount: 0, projectCount: 0, summaryCount: 0, feedback: {} as Record<string, number> });
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryResults, setMemoryResults] = useState<Array<{ conversationId: string; title: string; summary: string | null; updatedAt: string }>>([]);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Source[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<LibraryFile[]>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [toolType, setToolType] = useState<"image" | "docx" | "pdf" | "pptx" | "xlsx">("image");
  const [toolPrompt, setToolPrompt] = useState("");
  const [toolTitle, setToolTitle] = useState("");
  const [toolResult, setToolResult] = useState<ExploreResult | null>(null);
  const [toolPreview, setToolPreview] = useState(false);
  const [toolStyle, setToolStyle] = useState("");
  const [toolAspect, setToolAspect] = useState("1:1");
  const [toolImageFormat, setToolImageFormat] = useState("png");
  const [toolProviders, setToolProviders] = useState<{ groq?: boolean; cloudflareAi?: boolean } | null>(null);
  const [imageHistory, setImageHistory] = useState<Array<{ prompt: string; previewUrl: string; fileName: string }>>([]);
  const [toolBusy, setToolBusy] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [settingsDetail, setSettingsDetail] = useState("");
  const [settingsSearch, setSettingsSearch] = useState("");
  const appRootRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraFallbackInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const objectUrlsRef = useRef(new Set<string>());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickToBottomRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const parallaxFrameRef = useRef<number | null>(null);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);

  const currentMode = useMemo(() => modes.find(item => item.id === mode) || modes[1], [mode]);
  const ModeIcon = currentMode.icon;
  const assistantVisualState = voiceActive ? "listening"
    : toolBusy ? "generating"
      : searchBusy || (streaming && mode === "research") ? "searching"
        : streaming ? "thinking"
          : speaking ? "speaking"
            : /\b(?:failed|error|could not)\b/i.test(notice) ? "error"
              : "idle";

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations(getGuestHistory());
      return;
    }
    setConversations(await request<Conversation[]>("/api/conversations"));
  }, [user]);

  const checkServerConnection = useCallback(async (signal?: AbortSignal, isActive: () => boolean = () => true) => {
    setConnectionStatus("checking");
    try {
      let health = await requestWithRetry<{ status: string; ready: boolean; persistence: string }>("/health", 3, signal);
      if (!isActive()) return;
      setConnectionStatus("connected");
      for (let attempt = 0; health.persistence === "starting" && attempt < 6; attempt += 1) {
        await new Promise(resolve => window.setTimeout(resolve, Math.min(500 * 2 ** attempt, 4000)));
        health = await requestWithRetry<{ status: string; ready: boolean; persistence: string }>("/health", 2, signal);
        if (!isActive()) return;
      }
      if (health.persistence !== "ready") {
        setConnectionStatus("degraded");
        return;
      }
      try {
        const result = await requestWithRetry<{ authenticated: boolean; user?: User }>("/api/auth/me", 2, signal);
        if (isActive()) setUser(result.authenticated && result.user ? result.user : null);
      } catch (error) {
        if (isActive() && (!(error instanceof ApiError) || error.status !== 401)) {
          setConnectionStatus("degraded");
        }
      }
    } catch (error) {
      if (isActive()) {
        setConnectionStatus("offline");
      }
    } finally {
      if (isActive()) setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void checkServerConnection(controller.signal, () => active);
    return () => { active = false; controller.abort(); };
  }, [checkServerConnection]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get("verifyToken");
    if (verificationToken) {
      setAuthStage("verify");
      setRegistering(false);
      setAuthOpen(true);
      setAuthBusy(true);
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
      void request<{ message: string }>("/api/auth/verify-email", jsonRequest("POST", { token: verificationToken }))
        .then(result => setAuthMessage(result.message))
        .catch(error => setAuthError(errorText(error)))
        .finally(() => setAuthBusy(false));
      return;
    }
    const token = params.get("resetToken");
    if (token) {
      setResetToken(token);
      setAuthStage("reset");
      setRegistering(false);
      setAuthPassword("");
      setAuthPasswordConfirmation("");
      setAuthOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!cameraOpen || capturedPhoto) return;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera preview is not supported by this browser. You can still use the device camera picker.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        cameraStreamRef.current = stream;
        const video = cameraVideoRef.current;
        if (video) { video.srcObject = stream; void video.play().catch(error => setCameraError(errorText(error))); }
        setCameraError("");
      })
      .catch(error => {
        if (cancelled) return;
        setCameraError(error instanceof Error && error.name === "NotAllowedError"
          ? "Camera access was blocked. Allow camera access or open the device camera picker."
          : "The camera could not be opened. Try the device camera picker instead.");
      });
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraOpen, capturedPhoto]);

  useEffect(() => {
    if (!attachmentMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!attachmentMenuRef.current?.contains(event.target as Node)) setAttachmentMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [attachmentMenuOpen]);

  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 900px)");
    const update = () => setMobileViewport(viewport.matches);
    viewport.addEventListener("change", update);
    return () => viewport.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const root = appRootRef.current;
    if (!root || reduceEffects || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const bounds = root.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      if (parallaxFrameRef.current !== null) window.cancelAnimationFrame(parallaxFrameRef.current);
      parallaxFrameRef.current = window.requestAnimationFrame(() => {
        root.style.setProperty("--pointer-x", `${x * 18}px`);
        root.style.setProperty("--pointer-y", `${y * 14}px`);
        parallaxFrameRef.current = null;
      });
    };
    const reset = () => {
      root.style.setProperty("--pointer-x", "0px");
      root.style.setProperty("--pointer-y", "0px");
    };
    root.addEventListener("pointermove", move, { passive: true });
    root.addEventListener("pointerleave", reset, { passive: true });
    return () => {
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", reset);
      if (parallaxFrameRef.current !== null) window.cancelAnimationFrame(parallaxFrameRef.current);
    };
  }, [reduceEffects]);

  useEffect(() => {
    if (authReady) void loadLibrary();
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setConversations(getGuestHistory());
      return;
    }
    let active = true;
    Promise.all([
      request<Conversation[]>("/api/conversations"),
      request<Preference>("/api/memory/preferences")
    ]).then(([history, savedPreferences]) => {
      if (!active) return;
      setConversations(history);
      setPreferences(savedPreferences);
    }).catch(error => { if (active) setNotice(errorText(error)); });
    return () => { active = false; };
  }, [user, authReady]);

  useEffect(() => {
    if (!user && activeId && messages.length) {
      setConversations(previous => {
        const old = previous.find(item => item.id === activeId);
        const next: Conversation = {
          id: activeId,
          title: old?.title || messages.find(item => item.role === "user")?.content.slice(0, 60) || "New chat",
          mode,
          messages,
          archived: old?.archived || false,
          pinned: old?.pinned || false
        };
        const updated = [next, ...previous.filter(item => item.id !== activeId)].slice(0, 100);
        try { localStorage.setItem("kopli.guest-conversations.v1", JSON.stringify(updated)); }
        catch (error) { console.error("Could not save local chat history:", error); }
        return updated;
      });
    }
  }, [user, activeId, messages, mode]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/chat\/([^/]+)/);
    if (!match) return;
    const routeMode = match[1] as Mode;
    if (modes.some(option => option.id === routeMode)) {
      setMode(routeMode);
      setSection("Chat");
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("kopli.theme", dark ? "dark" : "light"); }
    catch (error) { console.error("Could not save theme preference:", error); }
  }, [dark]);

  useEffect(() => {
    try { localStorage.setItem("kopli.reduce-effects", String(reduceEffects)); }
    catch (error) { console.error("Could not save motion preference:", error); }
  }, [reduceEffects]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    if (!stickToBottomRef.current) {
      setShowScrollToLatest(true);
      return;
    }
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const latest = messagesRef.current;
      if (latest && stickToBottomRef.current) latest.scrollTo({ top: latest.scrollHeight, behavior: "instant" });
    });
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [prompt]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        if (cameraOpen) closeCamera();
        else if (attachmentMenuOpen) setAttachmentMenuOpen(false);
        else if (memoryOpen) setMemoryOpen(false);
        else if (authOpen) closeAuthDialog();
        else if (headerModeOpen) setHeaderModeOpen(false);
        else if (composerModeOpen) setComposerModeOpen(false);
        else if (mobileViewport) setSidebarOpen(false);
        return;
      }
      const tvBrowser = /\b(?:smart[- ]?tv|tizen|webos|android tv|google tv|googletv|aftb|bravia)\b/i.test(navigator.userAgent);
      if (!tvBrowser && !window.matchMedia("(min-width: 1920px) and (hover: none)").matches) return;
      const target = event.target as HTMLElement | null;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target?.tagName || "")) return;
      if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
      const items = Array.from(document.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]'
      )).filter(item => item.offsetWidth && item.offsetHeight);
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
      items[(index + (forward ? 1 : -1) + items.length) % items.length]?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authOpen, attachmentMenuOpen, cameraOpen, composerModeOpen, headerModeOpen, memoryOpen, mobileViewport]);

  function newChat() {
    abortRef.current?.abort();
    stickToBottomRef.current = true;
    setShowScrollToLatest(false);
    setActiveId(null);
    setMessages([]);
    setPrompt("");
    setUploadedFiles([]);
    setStreaming(false);
    setSection("Chat");
    setSidebarOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function selectConversation(conversation: Conversation) {
    abortRef.current?.abort();
    stickToBottomRef.current = true;
    setShowScrollToLatest(false);
    setActiveId(conversation.id);
    setMessages(conversation.messages);
    setMode(modes.some(item => item.id === conversation.mode) ? conversation.mode as Mode : "smart");
    setSection("Chat");
    setSidebarOpen(false);
  }

  async function updateConversationFlag(id: string, flag: "pinned" | "archived") {
    const item = conversations.find(conversation => conversation.id === id);
    if (!item) return;
    const value = !item[flag];
    if (user) {
      try { await request(`/api/conversations/${encodeURIComponent(id)}`, jsonRequest("PATCH", { [flag]: value })); }
      catch (error) { setNotice(errorText(error)); return; }
    }
    setConversations(previous => previous.map(conversation => conversation.id === id ? { ...conversation, [flag]: value } : conversation));
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      if (user) await request(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
      const updated = conversations.filter(item => item.id !== id);
      setConversations(updated);
      if (!user) localStorage.setItem("kopli.guest-conversations.v1", JSON.stringify(updated));
      if (activeId === id) newChat();
    } catch (error) { setNotice(errorText(error)); }
  }

  async function uploadSelectedFiles(selected: File[]): Promise<boolean> {
    if (!selected.length || uploadBusy) return false;
    const maxAttachments = 10 - uploadedFiles.length;
    const imageCount = uploadedFiles.filter(file => file.mimeType.startsWith("image/")).length;
    const supported = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|json|zip|rtf|md|png|jpe?g|webp|gif)$/i;
    const accepted: File[] = [];
    for (const file of selected) {
      if (!supported.test(file.name)) { setNotice(`${file.name} is not a supported attachment type.`); continue; }
      if (file.size > 25 * 1024 * 1024) { setNotice(`${file.name} is larger than the 25 MB file limit.`); continue; }
      if (uploadedFiles.length + accepted.length >= 10) { setNotice("Attach up to 10 files per message."); break; }
      if (file.type.startsWith("image/") && imageCount + accepted.filter(item => item.type.startsWith("image/")).length >= 3) {
        setNotice("Attach up to 3 images in one message."); continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) return false;
    if (accepted.length > maxAttachments) accepted.length = maxAttachments;
    const form = new FormData();
    accepted.forEach(file => form.append("files", file));
    setUploadBusy(true);
    setUploadProgress(0);
    setAttachmentMenuOpen(false);
    try {
      const result = await uploadRequest<{ files: UploadedFile[] }>(form, setUploadProgress);
      const uploaded = result.files.map((file, index) => {
        const source = accepted[index];
        const previewUrl = source?.type.startsWith("image/") ? URL.createObjectURL(source) : undefined;
        if (previewUrl) objectUrlsRef.current.add(previewUrl);
        return { ...file, previewUrl };
      });
      setUploadedFiles(previous => [...previous, ...uploaded].slice(0, 10));
      return true;
    } catch (error) { setNotice(errorText(error)); return false; }
    finally { setUploadBusy(false); setUploadProgress(0); }
  }

  function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    void uploadSelectedFiles(selected);
  }

  function closeCamera() {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
      objectUrlsRef.current.delete(capturedPhotoUrl);
    }
    setCapturedPhotoUrl("");
    setCapturedPhoto(null);
    setCameraOpen(false);
  }

  function captureCameraPhoto() {
    const video = cameraVideoRef.current;
    if (!video?.videoWidth || !video.videoHeight) { setCameraError("The camera preview is not ready yet. Wait a moment and try again."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setCameraError("This browser cannot process the camera image."); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) { setCameraError("The photo could not be captured. Please try again."); return; }
      const photo = new File([blob], `kopli-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      const previewUrl = URL.createObjectURL(photo);
      objectUrlsRef.current.add(previewUrl);
      setCapturedPhoto(photo);
      setCapturedPhotoUrl(previewUrl);
      cameraStreamRef.current?.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }, "image/jpeg", 0.92);
  }

  async function useCameraPhoto() {
    if (!capturedPhoto) return;
    const photo = capturedPhoto;
    if (await uploadSelectedFiles([photo])) closeCamera();
  }

  function removeUploadedFile(file: UploadedFile) {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
      objectUrlsRef.current.delete(file.previewUrl);
    }
    setUploadedFiles(previous => previous.filter(item => item.id !== file.id));
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = prompt.trim();
    if ((!text && !uploadedFiles.length) || streaming || streamingRef.current || uploadBusy) return;
    let submittedText = text || "Please review the attached file.";
    const files = uploadedFiles;
    const creationIntent = files.length === 0 ? detectCreationIntent(text) : null;
    stickToBottomRef.current = true;
    setShowScrollToLatest(false);
    setPrompt("");
    setUploadedFiles([]);
    streamingRef.current = true;
    setStreaming(true);
    const conversationId = activeId || makeId();
    const userMessage: ChatMessage = {
      id: makeId(), role: "user", content: text || "Please review the attached file.", createdAt: new Date().toISOString(),
      attachments: files.map(file => ({ fileName: file.fileName, mimeType: file.mimeType, previewUrl: file.previewUrl }))
    };
    const assistantId = makeId();
    setActiveId(conversationId);
    setSection("Chat");
    setMessages(previous => [...previous, userMessage, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    const controller = new AbortController();
    abortRef.current = controller;
    const requestTimeout = window.setTimeout(() => controller.abort(), 120000);
    try {
      await requestWithRetry<{ status: string }>("/health", 2, controller.signal);
      if (creationIntent) {
        let progress = 8;
        const progressLabel = creationIntent.type === "image" ? "Creating your image" : "Building your document";
        setMessages(previous => previous.map(item => item.id === assistantId
          ? { ...item, generationType: creationIntent.type, progress, progressLabel, streaming: true }
          : item));
        const progressTimer = window.setInterval(() => {
          progress = Math.min(92, progress + (progress < 45 ? 5 : progress < 75 ? 3 : 1));
          setMessages(previous => previous.map(item => item.id === assistantId
            ? { ...item, progress, progressLabel: progress < 35 ? "Preparing your request" : progress < 82 ? (creationIntent.type === "image" ? "Generating image details" : "Writing and formatting content") : "Finishing your file" }
            : item));
        }, 900);
        try {
          let assistantContent = "";
          let generatedAttachments: ChatMessage["attachments"] = [];
          if (creationIntent.type === "image") {
            const result = await request<{ id: string; url: string; fileName: string; mimeType: string; imageData: string }>(
              "/api/images/generate",
              jsonRequest("POST", { prompt: text, includePreview: true }),
              150000
            );
            const previewUrl = `data:${result.mimeType};base64,${result.imageData}`;
            assistantContent = `Your image is ready. [Open or download the full image](${result.url})`;
            generatedAttachments = [{ fileName: result.fileName, mimeType: result.mimeType, previewUrl }];
            setImageHistory(previous => [{ prompt: text, previewUrl, fileName: result.fileName }, ...previous].slice(0, 5));
          } else {
            const format = creationIntent.format || "docx";
            const endpoint = format === "pdf" ? "/api/pdf/generate" : format === "pptx" ? "/api/presentations/generate" : "/api/documents/generate";
            const result = await request<{ id: string; url: string; fileName: string; mimeType: string; format: string }>(
              endpoint,
              jsonRequest("POST", { content: text, format, includeContent: false }),
              150000
            );
            assistantContent = `Your ${format.toUpperCase()} file is ready.\n\n[Download ${result.fileName}](${result.url})`;
          }
          await request(`/api/conversations/${encodeURIComponent(conversationId)}/artifacts`, jsonRequest("POST", {
            userMessage: text,
            assistantMessage: assistantContent,
            title: text.slice(0, 60),
            mode
          })).catch(error => { setNotice(`File created, but chat history could not be saved: ${errorText(error)}`); });
          setMessages(previous => previous.map(item => item.id === assistantId
            ? { ...item, content: assistantContent, attachments: generatedAttachments, progress: 100, progressLabel: "Complete", streaming: false }
            : item));
          if (user) {
            void loadConversations();
            void loadLibrary();
          }
        } finally {
          window.clearInterval(progressTimer);
        }
        return;
      }
      for (const file of files) {
        if (file.mimeType.startsWith("image/")) continue;
        const analysis = await request<{ text: string; truncated: boolean }>(
          `/api/files/${encodeURIComponent(file.id)}/analyze`,
          jsonRequest("POST", { mimeType: file.mimeType })
        );
        submittedText += `\n\n[Text extracted from ${file.fileName}${analysis.truncated ? " (truncated)" : ""}]\n${analysis.text.slice(0, 30000)}`;
      }
      const hasImages = files.some(file => file.mimeType.startsWith("image/"));
      if (mode === "research" && !hasImages) {
        const result = await request<{ answer: string; sources: Source[]; conversationId?: string }>("/api/chat/search", jsonRequest("POST", { message: submittedText, conversationId }));
        setActiveId(result.conversationId || conversationId);
        setMessages(previous => previous.map(message => message.id === assistantId
          ? { ...message, content: result.answer, sources: result.sources, streaming: false }
          : message));
      } else {
        if (mode === "research" && hasImages) setNotice("Attached images use Vision mode. Web search is not included in this response.");
        const response = await fetch("/api/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId,
            message: submittedText,
            mode,
            attachments: files.map(file => ({ id: file.id, mimeType: file.mimeType, fileName: file.fileName })),
            history: messages.map(message => ({ role: message.role, content: message.content }))
          })
        });
        if (!response.ok) {
          const failure: unknown = await response.json().catch(() => null);
          const message = failure && typeof failure === "object" && "error" in failure
            ? String((failure as ApiErrorBody).error || `Request failed (${response.status}).`)
            : failure && typeof failure === "object" && "response" in failure
              ? String((failure as { response?: string }).response || `Request failed (${response.status}).`)
              : `Request failed (${response.status}).`;
          throw new ApiError(message, response.status);
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const result = await response.json() as { response?: string; error?: string };
          if (result.error && !result.response) throw new Error(result.error);
          setMessages(previous => previous.map(message => message.id === assistantId
            ? { ...message, content: result.response || result.error || "Command processed.", streaming: false }
            : message));
          return;
        }
        if (!response.body) throw new Error("The chat response stream is unavailable.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        while (!done) {
          const chunk = await reader.read();
          done = chunk.done;
          buffer += decoder.decode(chunk.value, { stream: !done });
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6);
              if (payload === "[DONE]") continue;
              const data: { text?: string; error?: string; conversationId?: string } = JSON.parse(payload);
              if (data.conversationId) setActiveId(data.conversationId);
              if (data.error) throw new Error(data.error);
              if (data.text) setMessages(previous => previous.map(message => message.id === assistantId
                ? { ...message, content: message.content + data.text, streaming: true }
                : message));
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
        setMessages(previous => previous.map(message => message.id === assistantId ? { ...message, streaming: false } : message));
      }
      if (user) {
        try { await loadConversations(); }
        catch (error) { setNotice(`Response received, but history could not refresh: ${errorText(error)}`); }
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (files.length) setUploadedFiles(files);
      if (!aborted && text) setPrompt(text);
      setMessages(previous => previous.map(message => message.id === assistantId
        ? { ...message, content: aborted ? (message.content || "Response stopped.") : `Unable to complete the request: ${errorText(error)}`, streaming: false }
        : message));
    } finally {
      window.clearTimeout(requestTimeout);
      setStreaming(false);
      streamingRef.current = false;
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (registering && authPassword !== authPasswordConfirmation) { setAuthError("The passwords do not match."); return; }
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const path = registering ? "/api/auth/register" : "/api/auth/login";
      const result = await request<{ user?: User; message?: string }>(path, jsonRequest("POST", {
        ...(registering ? { name: authName } : {}),
        email: authEmail,
        password: authPassword
      }));
      if (!result.user) throw new Error("The account service returned an incomplete sign-in response.");
      setUser(result.user);
      setActiveId(null);
      setMessages([]);
      setAuthOpen(false);
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
      setAuthPasswordConfirmation("");
      setConnectionStatus("connected");
    } catch (error) {
      setAuthError(errorText(error));
    }
    finally { setAuthBusy(false); }
  }

  async function resendVerificationEmail() {
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const result = await request<{ message: string }>("/api/auth/resend-verification", jsonRequest("POST", { email: authEmail }));
      setAuthMessage(result.message);
    } catch (error) { setAuthError(errorText(error)); }
    finally { setAuthBusy(false); }
  }

  function openAccountAuth(createAccount = false) {
    setAuthStage("account");
    setRegistering(createAccount);
    setAuthError("");
    setAuthMessage("");
    setAuthPassword("");
    setAuthPasswordConfirmation("");
    setShowAuthPassword(false);
    setAuthOpen(true);
  }

  function closeAuthDialog() {
    setAuthOpen(false);
    setAuthPassword("");
    setAuthPasswordConfirmation("");
    setShowAuthPassword(false);
  }

  async function submitPasswordRecovery(event: FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const result = await request<{ message: string }>("/api/auth/forgot-password", jsonRequest("POST", { email: authEmail }));
      setAuthMessage(result.message);
    } catch (error) { setAuthError(errorText(error)); }
    finally { setAuthBusy(false); }
  }

  async function submitPasswordReset(event: FormEvent) {
    event.preventDefault();
    if (authPassword !== authPasswordConfirmation) { setAuthError("The new passwords do not match."); return; }
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const result = await request<{ message: string }>("/api/auth/reset-password", jsonRequest("POST", { token: resetToken, password: authPassword }));
      setAuthMessage(result.message);
      setAuthStage("account");
      setRegistering(false);
      setResetToken("");
      setAuthPassword("");
      setAuthPasswordConfirmation("");
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
    } catch (error) { setAuthError(errorText(error)); }
    finally { setAuthBusy(false); }
  }

  async function signOut() {
    if (!user || !window.confirm(`Log out of KOPLI AI as ${user.email}?`)) return;
    let cookieCleared = false;
    try { await request("/api/auth/logout", { method: "POST" }); cookieCleared = true; }
    catch (error) {
      const message = errorText(error);
      cookieCleared = message.includes("session cookie was cleared");
      setNotice(cookieCleared
        ? `Your browser session ended, but server invalidation could not be verified: ${message}`
        : `KOPLI AI could not complete logout. Your session is still active; retry when the server is reachable. ${message}`);
      if (!cookieCleared) return;
    }
    setUser(null);
    setConversations([]);
    setActiveId(null);
    setMessages([]);
    setSection("Chat");
    setProfileMenuOpen(false);
  }

  async function updatePreferences(update: Partial<Preference>) {
    if (!user) { openAccountAuth(); return; }
    const previous = preferences;
    setPreferences(current => ({ ...current, ...update }));
    try { setPreferences(await request<Preference>("/api/memory/preferences", jsonRequest("PATCH", update))); }
    catch (error) { setPreferences(previous); setNotice(errorText(error)); }
  }

  async function openMemoryManager() {
    if (!user) { openAccountAuth(); setNotice("Sign in to manage saved memory."); return; }
    setMemoryOpen(true);
    setMemoryResults([]);
    try {
      const [data, stats] = await Promise.all([
        request<{ memories: SavedMemory[] }>("/api/memory"),
        request<typeof memoryStats>("/api/memory/dashboard")
      ]);
      setMemories(data.memories);
      setMemoryStats(stats);
    } catch (error) { setNotice(errorText(error)); }
  }

  async function searchPastChats(event: FormEvent) {
    event.preventDefault();
    if (!memoryQuery.trim()) return;
    try {
      const result = await request<{ results: typeof memoryResults }>("/api/memory/search", jsonRequest("POST", { query: memoryQuery }));
      setMemoryResults(result.results);
    } catch (error) { setNotice(errorText(error)); }
  }

  async function deleteMemory(id: string) {
    try {
      await request(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
      setMemories(previous => previous.filter(memory => memory.id !== id));
      setMemoryStats(previous => ({ ...previous, memoryCount: Math.max(0, previous.memoryCount - 1) }));
    } catch (error) { setNotice(errorText(error)); }
  }

  async function editMemory(id: string) {
    try {
      const memory = await request<SavedMemory>(`/api/memory/${encodeURIComponent(id)}`, jsonRequest("PATCH", { content: memoryDraft }));
      setMemories(previous => previous.map(item => item.id === id ? memory : item));
      setEditingMemoryId(null);
    } catch (error) { setNotice(errorText(error)); }
  }

  async function clearMemories() {
    if (!window.confirm("Delete all saved memories and summaries?")) return;
    try {
      await request("/api/memory", { method: "DELETE" });
      setMemories([]);
      setMemoryResults([]);
      setMemoryStats(previous => ({ ...previous, memoryCount: 0, projectCount: 0, summaryCount: 0 }));
    } catch (error) { setNotice(errorText(error)); }
  }

  async function exportData() {
    if (!user) { openAccountAuth(); return; }
    try {
      const value = await request<unknown>("/api/memory/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "kopli-memory-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { setNotice(errorText(error)); }
  }

  async function rateMessage(message: ChatMessage, rating: Rating) {
    if (!user) { setNotice("Sign in to save response feedback."); return; }
    try {
      await request("/api/feedback", jsonRequest("POST", { conversationId: activeId, messageId: message.id, rating }));
      setNotice("Thanks for helping improve KOPLI AI.");
    } catch (error) { setNotice(errorText(error)); }
  }

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Copied to clipboard."); }
    catch (error) { setNotice(`Could not copy response: ${errorText(error)}`); }
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) { setNotice("Speech playback is not supported in this browser."); return; }
    speechSynthesis.cancel();
    setSpeaking(false);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    speechSynthesis.speak(utterance);
  }

  function scrollToLatest() {
    stickToBottomRef.current = true;
    setShowScrollToLatest(false);
    const element = messagesRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }

  function toggleVoice() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setVoiceActive(false);
      return;
    }
    const voiceWindow = window as SpeechWindow;
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) { setNotice("Voice input is not supported in this browser."); return; }
    const recognition = new Recognition();
    recognition.lang = preferences.language === "tanglish" ? "en-IN" : "en-US";
    recognition.interimResults = true;
    recognition.onresult = result => setPrompt(Array.from(result.results).map(item => item[0]?.transcript || "").join(""));
    recognition.onerror = event => {
      setNotice(`Voice input failed: ${event.error}.`);
      setVoiceActive(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => { setVoiceActive(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    try { recognition.start(); setVoiceActive(true); }
    catch (error) { setNotice(errorText(error)); recognitionRef.current = null; }
  }

  async function runWebSearch(event: FormEvent) {
    event.preventDefault();
    if (!searchQuery.trim() || searchBusy) return;
    setSearchBusy(true);
    try {
      const result = await request<{ sources: Source[] }>("/api/search", jsonRequest("POST", { query: searchQuery }));
      setSearchResults(result.sources || []);
    } catch (error) { setNotice(errorText(error)); }
    finally { setSearchBusy(false); }
  }

  async function loadLibrary() {
    setLibraryBusy(true);
    try { setLibraryFiles((await request<{ files: LibraryFile[] }>("/api/library")).files || []); }
    catch (error) { setNotice(errorText(error)); }
    finally { setLibraryBusy(false); }
  }

  async function removeLibraryFile(fileName: string) {
    if (!window.confirm(`Delete ${fileName}?`)) return;
    try {
      await request(`/api/library/${encodeURIComponent(fileName)}`, { method: "DELETE" });
      setLibraryFiles(previous => previous.filter(item => item.fileName !== fileName));
    } catch (error) { setNotice(errorText(error)); }
  }

  async function generateContent(event: FormEvent) {
    event.preventDefault();
    if (!toolPrompt.trim() || toolBusy) return;
    setToolBusy(true);
    setToolResult(null);
    try {
      if (toolType === "image") {
        const result = await request<{ fileName: string; mimeType: string; imageData: string }>("/api/images/generate", jsonRequest("POST", { prompt: toolPrompt, aspectRatio: toolAspect, stylePreset: toolStyle, outputFormat: toolImageFormat, includePreview: true }));
        const previewUrl = `data:${result.mimeType};base64,${result.imageData}`;
        setToolResult({ fileName: result.fileName, mimeType: result.mimeType, previewUrl });
        setImageHistory(previous => [{ prompt: toolPrompt, previewUrl, fileName: result.fileName }, ...previous.filter(item => item.previewUrl !== previewUrl)].slice(0, 5));
      } else if (toolType === "docx") {
        const result = await request<{ title: string; content: string }>("/api/documents/draft", jsonRequest("POST", { prompt: toolPrompt, title: toolTitle || undefined }));
        setToolResult({ title: result.title, content: result.content, fileName: `${result.title}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      } else {
        const endpoint = toolType === "pdf" ? "/api/pdf/generate" : toolType === "pptx" ? "/api/presentations/generate" : "/api/documents/generate";
        const result = await request<{ fileName: string; mimeType: string; content: string }>(endpoint, jsonRequest("POST", { content: toolPrompt, title: toolTitle || undefined, format: toolType, includeContent: true }));
        setToolResult({ fileName: result.fileName, mimeType: result.mimeType, previewUrl: `data:${result.mimeType};base64,${result.content}` });
      }
    } catch (error) { setNotice(errorText(error)); }
    finally { setToolBusy(false); }
  }

  async function exportDocument(format: "docx" | "pdf" | "txt") {
    if (!toolResult?.content || !toolResult.title) return;
    try {
      const response = await fetch("/api/documents/export", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: toolResult.title, content: toolResult.content, format }) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(body.error || `Export failed (${response.status}).`, response.status);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${toolResult.title.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "KOPLI_AI_Document"}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setNotice(errorText(error)); }
  }

  useEffect(() => {
    if (section !== "Explore") return;
    let active = true;
    void request<{ groq?: boolean; cloudflareAi?: boolean }>("/api/status").then(status => { if (active) setToolProviders(status); }).catch(error => { if (active) setNotice(errorText(error)); });
    return () => { active = false; };
  }, [section]);


  async function shareCurrentChat() {
    setChatActionsOpen(false);
    const transcript = messages.map(message => `${message.role === "user" ? "You" : "KOPLI AI"}: ${message.content}`).join("\\n\\n");
    if (!transcript.trim()) { setNotice("There is no chat to share yet."); return; }
    try {
      await navigator.clipboard.writeText(transcript);
      setNotice("Chat copied. You can now share it.");
    } catch {
      setNotice("Chat sharing is not available in this browser.");
    }
  }

  function chooseSection(next: Section) {
    setSection(next);
    setSidebarOpen(false);
    setSettingsDetail("");
    if (next === "Library") void loadLibrary();
  }

  const currentHistory = conversations.filter(item => !item.archived);
  const settingsLinks = ["Appearance", "Personalization", "Data & memory", "Account", "About KOPLI AI"]
    .filter(item => item.toLowerCase().includes(settingsSearch.toLowerCase()));

  return (
    <div ref={appRootRef} className={`app${dark ? " dark" : ""}${reduceEffects ? " reduce-effects" : ""}`}>
      {mobileViewport && sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`} aria-label="Main navigation">
        <div className="brand"><span className="brand-mark"><img className="hen-image hen-small" src="/logo.png" alt="" /></span><strong>KOPLI <b>AI</b></strong></div>
        <button className="new-chat" aria-label="New chat" title="New chat" onClick={newChat}><Plus size={18} aria-hidden="true" /><span>New chat</span></button>
        <nav className="nav" aria-label="Workspace">
          {navigation.map(item => {
            const Icon = item.icon;
            const label = ({Chat:"AI Assistant",Search:"Web Search",Explore:"Explore AI",Library:"My Files",Settings:"Settings",Admin:"Admin"} as Record<string,string>)[item.label];
            return <button key={item.label} className={section === item.label ? "active" : ""} aria-label={label} title={label} aria-current={section === item.label ? "page" : undefined} onClick={() => chooseSection(item.label)}><Icon size={18} aria-hidden="true" /><span>{label}</span></button>;
          })}
        </nav>
        <button className="sidebar-about" aria-label="About KOPLI AI" title="About KOPLI AI" onClick={() => { setSection("Settings"); setSettingsDetail("About KOPLI AI"); setSidebarOpen(false); }}><CircleHelp size={17} aria-hidden="true" /><span>About KOPLI AI</span></button>
        <div className="history">
          <div className="history-title">Recent chats</div>
          {currentHistory.length ? currentHistory.map(conversation => (
            <div className={`history-row${activeId === conversation.id ? " active" : ""}`} key={conversation.id}>
              <button className="history-open" title={conversation.title} onClick={() => selectConversation(conversation)}><span>{conversation.pinned ? "📌 " : ""}{conversation.title}</span></button>
              <details className="history-menu"><summary aria-label={`Actions for ${conversation.title}`}><MoreHorizontal size={17} /></summary>
                <div className="history-actions">
                  <button onClick={() => void updateConversationFlag(conversation.id, "pinned")}>{conversation.pinned ? "Unpin" : "Pin"}</button>
                  {user && <button onClick={() => void updateConversationFlag(conversation.id, "archived")}>Archive</button>}
                  <button onClick={() => void deleteConversation(conversation.id)}>Delete</button>
                </div>
              </details>
            </div>
          )) : <div className="empty-history">{authReady ? "Your conversations will appear here." : "Loading history…"}</div>}
        </div>
        <button className="profile" onClick={() => user ? chooseSection("Settings") : openAccountAuth()}>
          <span className="avatar">{user ? (user.name || user.email).slice(0, 2).toUpperCase() : <UserRound size={16} />}</span>
          <span><strong>{user?.name || "Guest"}</strong><span>{user?.email || "Sign in to sync memory"}</span></span>
          {user ? <Settings size={16} /> : <LogIn size={16} />}
        </button>
      </aside>

      <main className="main">
        <div className="chat-floating-controls" aria-label="Chat controls">
          <button className="icon-button floating-menu-button" aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"} title="Menu" onClick={() => setSidebarOpen(value => !value)}><Menu size={20} /></button>
          {section === "Chat" && <div className="chat-floating-actions">
            <button className="floating-new-chat" type="button" onClick={() => { setChatLocked(false); newChat(); }}><Plus size={17} /><span>New chat</span></button>
            <div className="chat-actions-wrap">
              <button className="icon-button floating-more-button" type="button" aria-label="Chat options" title="Chat options" aria-expanded={chatActionsOpen} onClick={() => setChatActionsOpen(value => !value)}><MoreHorizontal size={20} /></button>
              {chatActionsOpen && <div className="chat-actions-menu" role="menu" aria-label="Chat options">
                <button type="button" role="menuitem" onClick={() => void shareCurrentChat()}><Share2 size={17} /><span>Share chat</span></button>
                <button type="button" role="menuitem" onClick={() => { setChatLocked(value => !value); setChatActionsOpen(false); }}><LockKeyhole size={17} /><span>{chatLocked ? "Unlock chat" : "Lock chat"}</span></button>
                <button type="button" role="menuitem" onClick={() => { setChatActionsOpen(false); chooseSection("Explore"); }}><Folder size={17} /><span>Projects</span></button>
                <button type="button" role="menuitem" onClick={() => { setChatActionsOpen(false); fileInputRef.current?.click(); }}><Files size={17} /><span>Upload files</span></button>
              </div>}
            </div>
          </div>}
        </div>

                {section === "Chat" && <>
                    <section className="chat-shell" aria-label="Chat">
            {messages.length === 0 ? <div className="welcome">
              <div className="welcome-hen" data-state={assistantVisualState}><img className="hen-image" src="/logo.png" alt="KOPLI AI" /></div>
              <h1>What can I help you with?</h1><p>Think, create, explore and discover with KOPLI AI.</p>
              <div className="suggestions">
                {["Explain a topic simply", "Help me plan a project", "Write or improve code", "Research a topic"].map((item, index) => <button key={item} onClick={() => { setPrompt(item); textareaRef.current?.focus(); }}><span>{item}</span>{index === 2 ? <Code2 size={17} /> : index === 3 ? <Globe2 size={17} /> : <Sparkles size={17} />}</button>)}
              </div>
            </div> : <div className="messages" ref={messagesRef} aria-live="polite" onScroll={event => {
              const element = event.currentTarget;
              const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
              stickToBottomRef.current = isAtBottom;
              if (isAtBottom) setShowScrollToLatest(false);
            }}>
              {messages.map(message => <MessageView key={message.id} message={message} onFeedback={(item, rating) => void rateMessage(item, rating)} onCopy={text => void copyText(text)} onSpeak={speak} />)}
            </div>}
            {showScrollToLatest && messages.length > 0 && <button className="scroll-to-latest" type="button" onClick={scrollToLatest} aria-label="Scroll to latest message">
              <ChevronDown size={16} aria-hidden="true" /><span>Latest Message</span><i aria-label="New messages" />
            </button>}
                    <div className="composer-wrap">
              {(uploadedFiles.length > 0 || uploadBusy) && <div className="attachments" aria-label="Attached files">
                {uploadedFiles.map(file => <div className="attachment-preview" key={file.id}>
                  {file.previewUrl ? <img src={file.previewUrl} alt="" /> : <FileText size={20} />}
                  <span className="attachment-details"><strong title={file.fileName}>{file.fileName}</strong><small>{file.mimeType.split("/").pop()?.toUpperCase()} · {(file.size / 1024).toFixed(0)} KB</small></span>
                  <button type="button" aria-label={`Remove ${file.fileName}`} onClick={() => removeUploadedFile(file)}><X size={15} /></button>
                </div>)}
                {uploadBusy && <div className="attachment-progress" role="status"><span>Uploading attachments</span><progress max={100} value={uploadProgress} /><small>{uploadProgress}%</small></div>}
              </div>}
              <form className="composer" onSubmit={event => void sendMessage(event)}>
                <textarea ref={textareaRef} className="composer-input" value={prompt} disabled={streaming || chatLocked} onChange={event => setPrompt(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
                }} placeholder="Work with KOPLI AI" aria-label="Message KOPLI AI" rows={2} disabled={streaming} />
                <div className="composer-toolbar">
                  <div className="composer-toolbar-left">
                    <div className="attachment-menu-wrap" ref={attachmentMenuRef}>
                      <input ref={fileInputRef} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.zip,.rtf,.md,.png,.jpg,.jpeg,.webp,.gif,application/pdf,application/zip" onChange={uploadFiles} aria-label="Choose files" />
                      <input ref={photoInputRef} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={uploadFiles} aria-label="Choose photos" />
                      <input ref={cameraFallbackInputRef} type="file" hidden accept="image/*" capture="environment" onChange={uploadFiles} aria-label="Take a photo with device camera" />
                      <button className="composer-button attach-button" type="button" aria-label="Add attachment" title="Add attachment" aria-expanded={attachmentMenuOpen} onClick={() => setAttachmentMenuOpen(value => !value)}><Plus size={21} /></button>
                      {attachmentMenuOpen && <div className="attachment-menu" role="menu" aria-label="Add to chat">
                        <button type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); setCameraError(""); setCapturedPhoto(null); setCameraOpen(true); }}><Camera size={18} /><span><strong>Camera</strong><small>Capture a photo</small></span></button>
                        <button type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); photoInputRef.current?.click(); }}><Images size={18} /><span><strong>Photos</strong><small>Choose images</small></span></button>
                        <button type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); fileInputRef.current?.click(); }}><Files size={18} /><span><strong>Files</strong><small>Documents and archives</small></span></button>
                        <div className="attachment-menu-unavailable" aria-disabled="true"><Code2 size={18} /><span><strong>Plugins</strong><small>No plugin integrations are configured</small></span></div>
                        <button type="button" role="menuitem" aria-pressed={mode === "reasoning"} onClick={() => { setMode("reasoning"); setAttachmentMenuOpen(false); }}><Brain size={18} /><span><strong>Think Harder</strong><small>Use deeper reasoning</small></span></button>
                      </div>}
                    </div>
                    <button className={`composer-button${mode === "research" ? " search-on" : ""}`} type="button" aria-label="Toggle research mode" title="Research mode" onClick={() => setMode(value => value === "research" ? "smart" : "research")}><Globe2 size={18} /></button>
                  </div>
                  <div className="composer-toolbar-right">
                    <div className="composer-mode-wrap">
                      <button className="composer-mode" type="button" aria-expanded={composerModeOpen} onClick={() => setComposerModeOpen(value => !value)}><ModeIcon size={16} /><span>{currentMode.label}</span><ChevronDown size={14} /></button>
                      {composerModeOpen && <div className="composer-mode-menu">{modes.map(option => {
                        const Icon = option.icon;
                        return <button key={option.id} type="button" className={mode === option.id ? "selected" : ""} onClick={() => { setMode(option.id); setComposerModeOpen(false); }}><Icon size={16} /><div><strong>{option.label}</strong><span>{option.detail}</span></div></button>;
                      })}</div>}
                    </div>
                    <button className={`composer-button${voiceActive ? " selected" : ""}`} type="button" aria-label={voiceActive ? "Stop voice input" : "Start voice input"} title="Voice input" onClick={toggleVoice}><Mic size={18} /></button>
                    {streaming
                      ? <button className="send-button" type="button" aria-label="Stop response" onClick={() => abortRef.current?.abort()}><X size={18} /></button>
                      : <button className="send-button" type="submit" disabled={uploadBusy || (!prompt.trim() && !uploadedFiles.length)} aria-label="Send message"><Send size={18} /></button>}
                  </div>
                </div>
              </form>
              <div className="disclaimer">KOPLI AI can make mistakes. Check important information.</div>
            </div>
          </section>
        </>}

        {section === "Search" && <section className="page">
          <header className="page-heading"><h1>Search the web</h1><p>Find current sources and explore useful information.</p></header>
          <form onSubmit={event => void runWebSearch(event)} role="search">
            <input className="chat-search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search a topic…" aria-label="Search the web" />
            <button className="auth-submit" type="submit" disabled={searchBusy || !searchQuery.trim()}>{searchBusy ? "Searching…" : "Search"}</button>
          </form>
          <div className="search-results">{searchResults.map((item, index) => <a className="search-results-card" key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer"><strong>{item.title || item.url}</strong><span>{item.url}</span><p>{item.content}</p></a>)}</div>
        </section>}

        {section === "Explore" && <section className="page">
          <header className="page-heading"><h1>Explore</h1><p>Create useful content with KOPLI AI tools.</p></header>
          <div className="tool-grid explore-tool-grid">
            {([
              ["image", ImageIcon, "Image generation", "Create an image from a text description.", "/tools/explore-image.svg"],
              ["docx", FileText, "Documents", "Draft, edit, preview, and export your document.", "/tools/explore-documents.svg"],
              ["pdf", FileText, "PDF reports", "Generate a polished, printable report.", "/tools/explore-pdf.svg"],
              ["pptx", Library, "Presentations", "Generate a professional slide deck.", "/tools/explore-presentations.svg"],
              ["xlsx", Library, "Spreadsheets", "Turn a request into a structured workbook.", "/tools/explore-spreadsheet.svg"]
            ] as const).map(([type, Icon, title, description, image]) => <button type="button" className={`tool-card explore-tool-card${toolType === type ? " selected" : ""}`} key={type} aria-pressed={toolType === type} onClick={() => { setToolType(type); setToolResult(null); }}>
              <img className="explore-tool-image" src={image} alt="" loading="lazy" />
              <span className="tool-icon"><Icon size={19} /></span><h3>{title}</h3><p>{description}</p><span className="explore-open-label">Open tool <ChevronRight size={14} /></span>
            </button>)}
          </div>
          <div className="settings-card modern explore-workspace" aria-label={`${toolType} tool`}>
            {!user && <div className="explore-provider-note"><strong>Sign in to create and download files</strong><span>Generated files are private to your account.</span><button type="button" onClick={() => openAccountAuth()}>Sign in</button></div>}
            {user && toolProviders && ((toolType === "image" && !toolProviders.cloudflareAi) || (toolType !== "image" && !toolProviders.groq)) && <div className="explore-provider-note" role="status">
              <strong>{toolType === "image" ? "Image generation needs provider setup" : "AI file generation needs provider setup"}</strong>
              <span>{toolType === "image" ? "Configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Render to enable image generation." : "Configure GROQ_API_KEY in the existing service to enable document generation."}</span>
            </div>}
            <div className="explore-form-heading"><div><span className="eyebrow">KOPLI AI TOOL</span><h2>{({image:"Image generation",docx:"Documents",pdf:"PDF reports",pptx:"Presentations",xlsx:"Spreadsheets"})[toolType]}</h2></div>{toolResult && <button type="button" className="explore-text-action" onClick={() => { setToolResult(null); setToolPreview(false); }}>Clear result</button>}</div>
            <form onSubmit={event => void generateContent(event)}>
              {toolType !== "image" && <label className="explore-field"><span>Title <small>(optional)</small></span><input className="chat-search" value={toolTitle} onChange={event => setToolTitle(event.target.value)} maxLength={160} placeholder="Give your file a title" /></label>}
              {toolType === "image" && <div className="explore-image-options">
                <label className="explore-field"><span>Style</span><select className="chat-search" value={toolStyle} onChange={event => setToolStyle(event.target.value)}><option value="">Automatic</option><option value="photographic">Photographic</option><option value="digital-art">Digital art</option><option value="3d-model">3D</option><option value="cinematic">Cinematic</option><option value="anime">Anime</option><option value="isometric">Isometric</option><option value="line-art">Line art</option></select></label>
                <label className="explore-field"><span>Aspect ratio</span><select className="chat-search" value={toolAspect} onChange={event => setToolAspect(event.target.value)}>{["1:1","16:9","3:2","4:5","2:3","9:16","21:9","5:4"].map(value => <option key={value}>{value}</option>)}</select></label>
                <label className="explore-field"><span>File type</span><select className="chat-search" value={toolImageFormat} onChange={event => setToolImageFormat(event.target.value)}><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label>
              </div>}
              <label className="explore-field" htmlFor="tool-prompt"><span>{toolType === "image" ? "Describe the image" : "What should KOPLI AI create?"}</span>
                <textarea id="tool-prompt" className="chat-search" value={toolPrompt} onChange={event => setToolPrompt(event.target.value)} maxLength={10000} placeholder={toolType === "image" ? "Describe the subject, composition, lighting, and mood…" : "Describe the content, audience, key points, and any details to include…"} />
              </label>
              <div className="explore-form-footer"><span>{toolPrompt.length.toLocaleString()} / 10,000</span><button className="auth-submit" type="submit" disabled={!user || toolBusy || !toolPrompt.trim() || (toolProviders ? toolType === "image" ? !toolProviders.cloudflareAi : !toolProviders.groq : false)}>{toolBusy ? "Creating…" : toolType === "image" && toolResult ? "Regenerate image" : `Create ${toolType.toUpperCase()}`}</button></div>
            </form>
            {toolBusy && <p className="explore-status" role="status">KOPLI AI is creating your {toolType === "image" ? "image" : toolType === "docx" ? "document draft" : toolType.toUpperCase()}…</p>}
            {toolResult && <div className="generated-image-card explore-result">
              {toolType === "image" && toolResult.previewUrl && <img className="generated-image-preview" src={toolResult.previewUrl} alt={toolPrompt || "AI generated image"} />}
              {toolType === "pdf" && toolResult.previewUrl && <iframe className="explore-pdf-preview" src={toolResult.previewUrl} title={toolResult.fileName} />}
              {toolType === "docx" && toolResult.content !== undefined && <>
                <div className="explore-result-tabs"><button type="button" className={!toolPreview ? "active" : ""} onClick={() => setToolPreview(false)}>Edit</button><button type="button" className={toolPreview ? "active" : ""} onClick={() => setToolPreview(true)}>Preview</button></div>
                {toolPreview ? <div className="explore-document-preview"><ReactMarkdown remarkPlugins={[remarkGfm]}>{toolResult.content}</ReactMarkdown></div> : <textarea aria-label="Edit document content" className="explore-document-editor" value={toolResult.content} onChange={event => setToolResult(previous => previous ? { ...previous, content: event.target.value } : previous)} />}
                <div className="explore-export-actions">{(["docx","pdf","txt"] as const).map(format => <button key={format} type="button" onClick={() => void exportDocument(format)}><Download size={15} /> Download {format.toUpperCase()}</button>)}<button type="button" onClick={() => void copyText(toolResult.content || "")}><Copy size={15} /> Copy</button></div>
              </>}
              <div className="generated-image-toolbar"><span>{toolResult.fileName}</span><div>{toolType !== "docx" && toolResult.previewUrl && <a href={toolResult.previewUrl} download={toolResult.fileName} aria-label="Download generated file"><Download size={17} /> Download</a>}</div></div>
            </div>}
            {toolType === "image" && imageHistory.length > 0 && <div className="explore-history"><strong>Recent images</strong><div>{imageHistory.map(item => <button key={item.fileName} type="button" title={item.prompt} onClick={() => { setToolResult({ fileName: item.fileName, previewUrl: item.previewUrl }); setToolPrompt(item.prompt); }}><img src={item.previewUrl} alt="" /><span>{item.prompt}</span></button>)}</div></div>}
          </div>
        </section>}

        {section === "Library" && <section className="page">
          <header className="page-heading"><h1>Library</h1><p>Your uploaded and generated files.</p></header>
          {libraryBusy ? <p role="status">Loading your files…</p> : libraryFiles.length ? <div className="tool-grid">
            {libraryFiles.map(file => <article className="tool-card library-card" key={file.fileName}>
              <a href={file.url} target="_blank" rel="noreferrer"><span className="tool-icon"><FileText size={20} /></span><h3>{file.fileName}</h3><p>{file.type} · {(file.size / 1024).toFixed(1)} KB</p></a>
              <div className="library-actions"><a href={file.url} download={file.fileName}>Download</a><button onClick={() => void removeLibraryFile(file.fileName)}>Delete</button></div>
            </article>)}
          </div> : <div className="library-empty"><Library size={30} /><h3>Your library is empty</h3><p>Generated and uploaded files will appear here.</p></div>}
        </section>}

        {section === "Settings" && <section className="settings-page-modern">
          <header className="settings-header-modern"><button className="settings-back" aria-label="Back to chat" onClick={() => chooseSection("Chat")}><ArrowLeft size={19} /></button><h1>Settings</h1><Settings size={19} /></header>
          {!settingsDetail ? <div className="settings-mobile-body">
            <button className="settings-customize" onClick={() => setSettingsDetail("Personalization")}><span className="settings-gift"><Sparkles size={19} /></span><div><strong>Personalization</strong><span>Customize how KOPLI AI works for you</span></div><ChevronRight size={18} /></button>
            <div className="settings-main-card">
              <button className="settings-neutral-row-button" onClick={() => setSettingsDetail("Appearance")}><Sun size={18} /><span>Appearance</span><ChevronRight size={17} /></button>
              <button className="settings-neutral-row-button" onClick={() => setSettingsDetail("Data & memory")}><Brain size={18} /><span>Data &amp; memory</span><ChevronRight size={17} /></button>
              <button className="settings-neutral-row-button" onClick={() => setSettingsDetail("About KOPLI AI")}><CircleHelp size={18} /><span>About KOPLI AI</span><ChevronRight size={17} /></button>
              <button className="settings-neutral-row-button" onClick={() => user ? void signOut() : openAccountAuth()}>{user ? <LogOut size={18} /> : <LogIn size={18} />}<span>{user ? "Sign out" : "Sign in or create account"}</span><ChevronRight size={17} /></button>
            </div>
          </div> : <div className="settings-detail">
            <button className="settings-detail-back" onClick={() => setSettingsDetail("")}><ChevronLeft size={17} /> Settings</button><h2>{settingsDetail}</h2>
            {settingsDetail === "Appearance" && <div className="settings-card-neutral">
              <div className="settings-neutral-row"><div><strong>Theme</strong><span>Choose light or dark appearance</span></div><button className={`switch ${dark ? "toggle-active" : ""}`} aria-label={dark ? "Use light theme" : "Use dark theme"} aria-pressed={dark} onClick={() => setDark(value => !value)}><span className={dark ? "on" : ""} /></button></div>
              <div className="settings-neutral-row"><div><strong>Reduce motion</strong><span>Turn off orb and card animations</span></div><button className={`switch ${reduceEffects ? "toggle-active" : ""}`} aria-label="Toggle reduced visual effects" aria-pressed={reduceEffects} onClick={() => setReduceEffects(value => !value)}><span className={reduceEffects ? "on" : ""} /></button></div>
            </div>}
            {settingsDetail === "Personalization" && <div className="settings-card-neutral">
              <div className="settings-neutral-row"><div><strong>Improve responses</strong><span>Remember corrections and preferences for this account</span></div><button className={`switch ${preferences.learning ? "toggle-active" : ""}`} aria-label="Toggle response personalization" aria-pressed={preferences.learning} onClick={() => void updatePreferences({ learning: !preferences.learning })}><span className={preferences.learning ? "on" : ""} /></button></div>
              <div className="settings-neutral-row"><div><strong>Use past conversations</strong><span>Allow KOPLI AI to recall relevant chats when asked</span></div><button className={`switch ${preferences.crossChat ? "toggle-active" : ""}`} aria-label="Toggle cross-chat memory" aria-pressed={preferences.crossChat} onClick={() => void updatePreferences({ crossChat: !preferences.crossChat })}><span className={preferences.crossChat ? "on" : ""} /></button></div>
            </div>}
            {settingsDetail === "Data & memory" && <div className="settings-card-neutral">
              <div className="settings-neutral-row"><div><strong>Saved memory</strong><span>Review or remove saved preferences and summaries</span></div><button className="settings-action" onClick={() => void openMemoryManager()}>Manage</button></div>
              <div className="settings-neutral-row"><div><strong>Export my data</strong><span>Download memory, preferences, and conversations</span></div><button className="settings-action" onClick={() => void exportData()} disabled={!user}>Export</button></div>
            </div>}
            {settingsDetail === "Account" && <div className="settings-card-neutral">
              <div className="settings-neutral-row"><div><strong>{user?.email || "Guest session"}</strong><span>{user ? "Your account is signed in" : "Sign in to sync your history"}</span></div><button className="settings-action" onClick={() => user ? void signOut() : openAccountAuth()}>{user ? "Sign out" : "Sign in"}</button></div>
              <div className="settings-neutral-row"><div><strong>Account storage</strong><span>{connectionStatus === "connected" ? "Connected" : connectionStatus === "checking" ? "Checking connection…" : connectionStatus === "offline" ? "Server unavailable" : "Database unavailable"}</span></div><button className="settings-action" onClick={() => void checkServerConnection()}>Retry</button></div>
            </div>}
            {settingsDetail === "About KOPLI AI" && <div className="settings-card-neutral about-brand"><span className="brand-mark"><img src="/logo.png" alt="KOPLI AI" /></span><div><strong>KOPLI AI</strong><span>Your personal AI workspace</span></div></div>}
          </div>}
          <div className="settings-search-wrap"><Search size={17} /><input value={settingsSearch} onChange={event => setSettingsSearch(event.target.value)} placeholder="Search settings" aria-label="Search settings" />
            {settingsSearch && <div className="settings-search-results" role="listbox">{settingsLinks.map(item => <button key={item} onClick={() => { setSettingsDetail(item); setSettingsSearch(""); }}>{item}</button>)}{!settingsLinks.length && <span>No matching settings.</span>}</div>}
          </div>
        </section>}

      </main>

      {notice && <div className="feedback-toast" role="status">{notice}</div>}

      {authOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeAuthDialog(); }}>
        <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="dialog-close" aria-label="Close sign in" onClick={closeAuthDialog}><X size={19} /></button>
          <div className="auth-brand">KOPLI <span>AI</span></div>
          <h1 id="auth-title">{authStage === "forgot" ? "Reset your password" : authStage === "reset" ? "Create new password" : authStage === "verify" ? "Verify your email" : registering ? "Create your account" : "Welcome back"}</h1>
          <p>{authStage === "forgot" ? "Enter the email for your KOPLI AI account." : authStage === "reset" ? "Choose a new password for your account." : authStage === "verify" ? "Confirm your email address to finish setting up your account." : registering ? "Create an account to sync conversations and files." : "Sign in to your KOPLI AI account."}</p>
          {authStage === "account" && <form onSubmit={event => void submitAuth(event)}>
            {registering && <label>Name<input autoComplete="name" value={authName} onChange={event => setAuthName(event.target.value)} required maxLength={100} /></label>}
            <label>Email<input type="email" autoComplete="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} required /></label>
            <label>Password<span className="auth-password-field"><input type={showAuthPassword ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} value={authPassword} onChange={event => setAuthPassword(event.target.value)} required minLength={registering ? 12 : 1} /><button type="button" aria-label={showAuthPassword ? "Hide password" : "Show password"} aria-pressed={showAuthPassword} onClick={() => setShowAuthPassword(value => !value)}>{showAuthPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            {registering && <label>Confirm password<input type={showAuthPassword ? "text" : "password"} autoComplete="new-password" value={authPasswordConfirmation} onChange={event => setAuthPasswordConfirmation(event.target.value)} required minLength={12} /></label>}
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            {authMessage && <p className="auth-success" role="status">{authMessage}</p>}
            <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
          </form>}
          {authStage === "forgot" && <form onSubmit={event => void submitPasswordRecovery(event)}>
            <label>Email<input type="email" autoComplete="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} required /></label>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            {authMessage && <p className="auth-success" role="status">{authMessage}</p>}
            <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? "Sending…" : "Send recovery email"}</button>
            <button className="auth-mode-toggle" type="button" onClick={() => { setAuthStage("account"); setAuthError(""); setAuthMessage(""); }}>Back to sign in</button>
          </form>}
          {authStage === "verify" && <div className="auth-verification">
            <label>Email<input type="email" autoComplete="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} required /></label>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            {authMessage && <p className="auth-success" role="status">{authMessage}</p>}
            <button className="auth-submit" type="button" disabled={authBusy || !authEmail.trim()} onClick={() => void resendVerificationEmail()}>{authBusy ? "Please wait…" : "Send verification email"}</button>
            <button className="auth-mode-toggle" type="button" onClick={() => { setAuthStage("account"); setRegistering(false); setAuthError(""); setAuthMessage(""); setAuthPassword(""); }}>Back to sign in</button>
          </div>}
          {authStage === "reset" && <form onSubmit={event => void submitPasswordReset(event)}>
            {!resetToken && <p className="auth-error" role="alert">This reset link is missing or invalid. Request a new recovery email.</p>}
            <label>New password<span className="auth-password-field"><input type={showAuthPassword ? "text" : "password"} autoComplete="new-password" value={authPassword} onChange={event => setAuthPassword(event.target.value)} required minLength={12} /><button type="button" aria-label={showAuthPassword ? "Hide password" : "Show password"} aria-pressed={showAuthPassword} onClick={() => setShowAuthPassword(value => !value)}>{showAuthPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            <label>Confirm new password<input type={showAuthPassword ? "text" : "password"} autoComplete="new-password" value={authPasswordConfirmation} onChange={event => setAuthPasswordConfirmation(event.target.value)} required minLength={12} /></label>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            {authMessage && <p className="auth-success" role="status">{authMessage}</p>}
            <button className="auth-submit" type="submit" disabled={authBusy || !resetToken}>{authBusy ? "Saving…" : "Save new password"}</button>
            {!resetToken && <button className="auth-mode-toggle" type="button" onClick={() => { setAuthStage("forgot"); setAuthError(""); }}>Request a new reset link</button>}
          </form>}
          {authStage === "account" && <div className="auth-links">
            {!registering && <button className="auth-mode-toggle" type="button" onClick={() => { setAuthStage("forgot"); setAuthError(""); setAuthMessage(""); setAuthPassword(""); setAuthPasswordConfirmation(""); setShowAuthPassword(false); }}>Forgot password?</button>}
            <button className="auth-mode-toggle" type="button" onClick={() => { setRegistering(value => !value); setAuthError(""); setAuthMessage(""); setAuthPassword(""); setAuthPasswordConfirmation(""); }}>{registering ? "Already have an account? Sign in" : "New to KOPLI AI? Create an account"}</button>
          </div>}
        </section>
      </div>}

      {cameraOpen && <div className="dialog-backdrop camera-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeCamera(); }}>
        <section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title">
          <button className="dialog-close" aria-label="Close camera" onClick={closeCamera}><X size={19} /></button>
          <h2 id="camera-title">Take a photo</h2>
          {capturedPhotoUrl
            ? <img className="camera-preview" src={capturedPhotoUrl} alt="Captured photo preview" />
            : <video ref={cameraVideoRef} className="camera-preview" autoPlay muted playsInline aria-label="Camera preview" />}
          {cameraError && <p className="camera-error" role="alert">{cameraError}</p>}
          <div className="camera-actions">
            {capturedPhoto
              ? <><button type="button" className="camera-secondary" onClick={() => { if (capturedPhotoUrl) { URL.revokeObjectURL(capturedPhotoUrl); objectUrlsRef.current.delete(capturedPhotoUrl); } setCapturedPhotoUrl(""); setCapturedPhoto(null); setCameraError(""); }} disabled={uploadBusy}>Retake</button><button type="button" className="auth-submit" onClick={() => void useCameraPhoto()} disabled={uploadBusy}>{uploadBusy ? `Uploading ${uploadProgress}%…` : "Use photo"}</button></>
              : <><button type="button" className="camera-secondary" onClick={closeCamera}>Cancel</button><button type="button" className="auth-submit" onClick={captureCameraPhoto}><Camera size={17} /> Capture photo</button></>}
          </div>
          {cameraError && <button type="button" className="camera-fallback" onClick={() => { cameraFallbackInputRef.current?.click(); closeCamera(); }}>Open device camera picker</button>}
        </section>
      </div>}

      {memoryOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setMemoryOpen(false); }}>
        <section className="memory-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-title">
          <button className="dialog-close" aria-label="Close memory manager" onClick={() => setMemoryOpen(false)}><X size={19} /></button>
          <header><h2 id="memory-title">Memory &amp; learning</h2><p>Review and control information used to personalize your conversations.</p></header>
          <div className="learning-dashboard">
            <div><strong>{memoryStats.memoryCount}</strong><span>Saved memories</span></div><div><strong>{memoryStats.projectCount}</strong><span>Project memories</span></div>
            <div><strong>{memoryStats.summaryCount}</strong><span>Chat summaries</span></div><div><strong>{memoryStats.feedback.helpful || 0}</strong><span>Helpful ratings</span></div>
          </div>
          <form className="memory-search" onSubmit={event => void searchPastChats(event)}><input className="chat-search" value={memoryQuery} onChange={event => setMemoryQuery(event.target.value)} placeholder="Search past conversations…" aria-label="Search past conversations" /><button className="settings-action" type="submit">Search</button></form>
          {!!memoryResults.length && <div className="search-results">{memoryResults.map(result => <button key={result.conversationId} onClick={() => {
            const conversation = conversations.find(item => item.id === result.conversationId);
            if (conversation) { selectConversation(conversation); setMemoryOpen(false); }
            else setNotice("That conversation is not in the currently loaded history.");
          }}><strong>{result.title}</strong><span>{result.summary || new Date(result.updatedAt).toLocaleString()}</span></button>)}</div>}
          {memories.length ? <div className="memory-list">{memories.map(memory => <article className="memory-item" key={memory.id}>
            <div><span className="memory-category">{memory.category}</span>{editingMemoryId === memory.id
              ? <input className="chat-search" value={memoryDraft} onChange={event => setMemoryDraft(event.target.value)} aria-label="Edit saved memory" maxLength={500} />
              : <p>{memory.content}</p>}<time dateTime={memory.updatedAt}>{new Date(memory.updatedAt).toLocaleDateString()}</time></div>
            <div className="memory-item-actions">{editingMemoryId === memory.id
              ? <><button onClick={() => void editMemory(memory.id)}>Save</button><button onClick={() => setEditingMemoryId(null)}>Cancel</button></>
              : <><button onClick={() => { setEditingMemoryId(memory.id); setMemoryDraft(memory.content); }}>Edit</button><button className="danger" aria-label="Delete memory" onClick={() => void deleteMemory(memory.id)}><Trash2 size={15} /></button></>}</div>
          </article>)}</div> : <div className="memory-empty">No saved memories yet. Personalization only uses information from your signed-in conversations.</div>}
          <div className="memory-footer-actions"><button className="settings-action" onClick={() => void exportData()}><Download size={15} /> Export data</button><button className="settings-action danger" onClick={() => void clearMemories()}><Trash2 size={15} /> Clear saved memory</button></div>
        </section>
      </div>}
    </div>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("KOPLI AI root element was not found.");
createRoot(rootElement).render(<App />);
