import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, Code2,
  Copy, Download, Eye, FileText, Globe2, Image as ImageIcon, Library,
  LogIn, LogOut, Menu, Mic, Moon, MoreHorizontal, Paperclip, Plus, Search,
  Send, Settings, Shield, Sparkles, Sun, ThumbsDown, ThumbsUp, Trash2,
  UserRound, Volume2, X, Zap
} from "lucide-react";
import "./styles.css";

type Mode = "fast" | "smart" | "reasoning" | "coding" | "research" | "vision";
type Section = "Chat" | "Search" | "Explore" | "Library" | "Settings" | "Admin";
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
  streaming?: boolean;
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

interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
}

interface ApiErrorBody {
  error?: string;
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
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...init, credentials: "include", headers });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? String((body as ApiErrorBody).error || `Request failed (${response.status}).`)
      : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return body as T;
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
    return value.filter((item): item is Conversation =>
      item && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.messages)
    );
  } catch (error) {
    console.error("Could not read local chat history:", error);
    return [];
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

const modes: Array<{ id: Mode; label: string; detail: string; icon: IconComponent }> = [
  { id: "fast", label: "Fast", detail: "Quick response", icon: Zap },
  { id: "smart", label: "Smart", detail: "Balanced assistant", icon: Sparkles },
  { id: "reasoning", label: "Reasoning", detail: "Complex analysis", icon: Brain },
  { id: "coding", label: "Coding", detail: "Programming assistant", icon: Code2 },
  { id: "research", label: "Research", detail: "Real web sources", icon: Globe2 },
  { id: "vision", label: "Vision", detail: "Image-aware workflow", icon: Eye }
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
      {!isUser && <div className="message-avatar" aria-hidden="true"><img className="hen-image hen-small" src="/hen-logo-4k.png" alt="" /></div>}
      <div className="message-user-content">
        <div className="message-content">
          {message.content
            ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            : <div className="thinking-state" role="status"><span className="thinking-orb" /><span className="thinking-wave"><i /><i /><i /></span><span>Thinking</span></div>}
          {!!message.sources?.length && <div className="sources" aria-label="Sources">
            {message.sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">[{index + 1}] {source.title || source.url}</a>)}
          </div>}
        </div>
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
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [section, setSection] = useState<Section>("Chat");
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [mode, setMode] = useState<Mode>("smart");
  const [headerModeOpen, setHeaderModeOpen] = useState(false);
  const [composerModeOpen, setComposerModeOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("kopli.theme") === "dark"; }
    catch (error) { console.error("Could not read theme preference:", error); return false; }
  });
  const [conversations, setConversations] = useState<Conversation[]>(() => getGuestHistory());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
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
  const [toolResult, setToolResult] = useState<{ url: string; fileName: string; image?: boolean } | null>(null);
  const [toolBusy, setToolBusy] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [adminStatus, setAdminStatus] = useState<Record<string, boolean> | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [settingsDetail, setSettingsDetail] = useState("");
  const [settingsSearch, setSettingsSearch] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickToBottomRef = useRef(true);

  const currentMode = useMemo(() => modes.find(item => item.id === mode) || modes[1], [mode]);
  const ModeIcon = currentMode.icon;

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations(getGuestHistory());
      return;
    }
    setConversations(await request<Conversation[]>("/api/conversations"));
  }, [user]);

  useEffect(() => {
    let active = true;
    request<{ authenticated: boolean; user?: User }>("/api/auth/me")
      .then(result => { if (active && result.authenticated && result.user) setUser(result.user); })
      .catch(error => {
        if (active && (!(error instanceof ApiError) || error.status !== 401)) setNotice(errorText(error));
      })
      .finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 900px)");
    const update = () => setMobileViewport(viewport.matches);
    viewport.addEventListener("change", update);
    return () => viewport.removeEventListener("change", update);
  }, []);

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
    try { localStorage.setItem("kopli.theme", dark ? "dark" : "light"); }
    catch (error) { console.error("Could not save theme preference:", error); }
  }, [dark]);

  useEffect(() => {
    const element = messagesRef.current;
    if (element && stickToBottomRef.current) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        if (memoryOpen) setMemoryOpen(false);
        else if (authOpen) setAuthOpen(false);
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
  }, [authOpen, composerModeOpen, headerModeOpen, memoryOpen, mobileViewport]);

  function newChat() {
    abortRef.current?.abort();
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

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!selected.length) return;
    const form = new FormData();
    selected.slice(0, 10).forEach(file => form.append("files", file));
    try {
      const result = await request<{ files: UploadedFile[] }>("/api/upload", { method: "POST", body: form });
      setUploadedFiles(previous => [...previous, ...result.files].slice(0, 10));
    } catch (error) { setNotice(errorText(error)); }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = prompt.trim();
    if ((!text && !uploadedFiles.length) || streaming) return;
    let submittedText = text || "Please review the attached file.";
    const files = uploadedFiles;
    setPrompt("");
    setUploadedFiles([]);
    setStreaming(true);
    const conversationId = activeId || makeId();
    const userMessage: ChatMessage = { id: makeId(), role: "user", content: text || "Please review the attached file.", createdAt: new Date().toISOString() };
    const assistantId = makeId();
    setActiveId(conversationId);
    setSection("Chat");
    setMessages(previous => [...previous, userMessage, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      for (const file of files) {
        if (file.mimeType.startsWith("image/")) {
          submittedText += `\n\n[Attached image: ${file.fileName}. Image bytes are not sent to this chat endpoint.]`;
          continue;
        }
        const analysis = await request<{ text: string; truncated: boolean }>(
          `/api/files/${encodeURIComponent(file.id)}/analyze`,
          jsonRequest("POST", { mimeType: file.mimeType })
        );
        submittedText += `\n\n[Text extracted from ${file.fileName}${analysis.truncated ? " (truncated)" : ""}]\n${analysis.text.slice(0, 30000)}`;
      }
      if (mode === "research") {
        const result = await request<{ answer: string; sources: Source[] }>("/api/chat/search", jsonRequest("POST", { message: submittedText }));
        setMessages(previous => previous.map(message => message.id === assistantId
          ? { ...message, content: result.answer, sources: result.sources, streaming: false }
          : message));
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId,
            message: submittedText,
            mode,
            history: [...messages, userMessage].map(message => ({ role: message.role, content: message.content }))
          })
        });
        if (!response.ok) {
          const failure: unknown = await response.json().catch(() => null);
          const message = failure && typeof failure === "object" && "error" in failure
            ? String((failure as ApiErrorBody).error || `Request failed (${response.status}).`)
            : `Request failed (${response.status}).`;
          throw new ApiError(message, response.status);
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
      setMessages(previous => previous.map(message => message.id === assistantId
        ? { ...message, content: aborted ? (message.content || "Response stopped.") : `Unable to complete the request: ${errorText(error)}`, streaming: false }
        : message));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const path = registering ? "/api/auth/register" : "/api/auth/login";
      const result = await request<{ user: User }>(path, jsonRequest("POST", {
        ...(registering ? { name: authName } : {}),
        email: authEmail,
        password: authPassword
      }));
      setUser(result.user);
      setActiveId(null);
      setMessages([]);
      setAuthOpen(false);
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
    } catch (error) { setAuthError(errorText(error)); }
    finally { setAuthBusy(false); }
  }

  async function signOut() {
    try { await request("/api/auth/logout", { method: "POST" }); }
    catch (error) { setNotice(errorText(error)); return; }
    setUser(null);
    setConversations([]);
    setActiveId(null);
    setMessages([]);
    setSection("Chat");
  }

  async function updatePreferences(update: Partial<Preference>) {
    if (!user) { setAuthOpen(true); return; }
    const previous = preferences;
    setPreferences(current => ({ ...current, ...update }));
    try { setPreferences(await request<Preference>("/api/memory/preferences", jsonRequest("PATCH", update))); }
    catch (error) { setPreferences(previous); setNotice(errorText(error)); }
  }

  async function openMemoryManager() {
    if (!user) { setAuthOpen(true); setNotice("Sign in to manage saved memory."); return; }
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
    if (!user) { setAuthOpen(true); return; }
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
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
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
        const result = await request<{ url: string; fileName: string }>("/api/images/generate", jsonRequest("POST", { prompt: toolPrompt }));
        setToolResult({ ...result, image: true });
      } else {
        const endpoint = toolType === "pdf" ? "/api/pdf/generate" : toolType === "pptx" ? "/api/presentations/generate" : "/api/documents/generate";
        const result = await request<{ url: string; fileName: string }>(endpoint, jsonRequest("POST", { content: toolPrompt, format: toolType }));
        setToolResult(result);
      }
    } catch (error) { setNotice(errorText(error)); }
    finally { setToolBusy(false); }
  }

  async function loadAdmin() {
    setSection("Admin");
    setAdminBusy(true);
    try { setAdminStatus((await request<{ providerStatus: Record<string, boolean> }>("/api/admin/status")).providerStatus); }
    catch (error) { setNotice(errorText(error)); }
    finally { setAdminBusy(false); }
  }

  function chooseSection(next: Section) {
    setSection(next);
    setSidebarOpen(false);
    setSettingsDetail("");
    if (next === "Library") void loadLibrary();
  }

  const currentHistory = conversations.filter(item => !item.archived);
  const settingsLinks = ["Appearance", "Personalization", "Data & memory", "Account"]
    .filter(item => item.toLowerCase().includes(settingsSearch.toLowerCase()));

  return (
    <div className={`app${dark ? " dark" : ""}`}>
      {mobileViewport && sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`} aria-label="Main navigation">
        <div className="brand"><span className="brand-mark"><img className="hen-image hen-small" src="/hen-logo-4k.png" alt="" /></span><strong>KOPLI <b>AI</b></strong></div>
        <button className="new-chat" onClick={newChat}><Plus size={18} /> New chat</button>
        <nav className="nav" aria-label="Workspace">
          {navigation.map(item => {
            const Icon = item.icon;
            return <button key={item.label} className={section === item.label ? "active" : ""} aria-current={section === item.label ? "page" : undefined} onClick={() => chooseSection(item.label)}><Icon size={18} /><span>{item.label}</span></button>;
          })}
          {user?.role === "owner" && <button className={section === "Admin" ? "active" : ""} onClick={() => void loadAdmin()}><Shield size={18} /><span>Admin</span></button>}
        </nav>
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
        <button className="profile" onClick={() => user ? chooseSection("Settings") : setAuthOpen(true)}>
          <span className="avatar">{user ? (user.name || user.email).slice(0, 2).toUpperCase() : <UserRound size={16} />}</span>
          <span><strong>{user?.name || "Guest"}</strong><span>{user?.email || "Sign in to sync memory"}</span></span>
          {user ? <Settings size={16} /> : <LogIn size={16} />}
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className={`icon-button ${mobileViewport ? "mobile-menu" : "dashboard-toggle"}`} aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"} onClick={() => setSidebarOpen(value => !value)}><Menu size={19} /></button>
          <div className="mode-selector">
            <button className="mode-selector-trigger" aria-expanded={headerModeOpen} onClick={() => setHeaderModeOpen(value => !value)}><ModeIcon size={16} /><span>{currentMode.label}</span><ChevronDown size={15} /></button>
            {headerModeOpen && <div className="mode-selector-menu" role="menu">
              {modes.map(option => {
                const Icon = option.icon;
                return <button key={option.id} className={mode === option.id ? "selected" : ""} role="menuitemradio" aria-checked={mode === option.id} onClick={() => { setMode(option.id); setHeaderModeOpen(false); }}>
                  <Icon size={17} /><div><strong>{option.label}</strong><span>{option.detail}</span></div>{mode === option.id && <Check size={15} />}
                </button>;
              })}
            </div>}
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search" title="Search" onClick={() => chooseSection("Search")}><Search size={17} /></button>
            <button className="icon-button" aria-label={dark ? "Use light theme" : "Use dark theme"} title="Toggle theme" onClick={() => setDark(value => !value)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button className="icon-button" aria-label={user ? "Open settings" : "Sign in"} title={user ? "Settings" : "Sign in"} onClick={() => user ? chooseSection("Settings") : setAuthOpen(true)}>{user ? <UserRound size={17} /> : <LogIn size={17} />}</button>
          </div>
        </header>

        {section === "Chat" && <>
          {mode !== "smart" && <div className={`workspace-banner workspace-${mode}`}><span className="workspace-icon"><ModeIcon size={23} /></span><div><h1>{currentMode.label} workspace</h1><p>{currentMode.detail}. Change modes at any time.</p></div><button onClick={() => setMode("smart")}>Switch to Smart <X size={15} /></button></div>}
          <section className="chat-shell" aria-label="Chat">
            {messages.length === 0 ? <div className="welcome">
              <div className="welcome-hen"><img className="hen-image" src="/hen-logo-4k.png" alt="KOPLI AI" /></div>
              <h1>What can I help with?</h1><p>Ask a question, explore an idea, or start a project.</p>
              <div className="suggestions">
                {["Explain a topic simply", "Help me plan a project", "Write or improve code", "Research a topic"].map((item, index) => <button key={item} onClick={() => { setPrompt(item); textareaRef.current?.focus(); }}><span>{item}</span>{index === 2 ? <Code2 size={17} /> : index === 3 ? <Globe2 size={17} /> : <Sparkles size={17} />}</button>)}
              </div>
            </div> : <div className="messages" ref={messagesRef} aria-live="polite" onScroll={event => {
              const element = event.currentTarget;
              stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
            }}>
              {messages.map(message => <MessageView key={message.id} message={message} onFeedback={(item, rating) => void rateMessage(item, rating)} onCopy={text => void copyText(text)} onSpeak={speak} />)}
            </div>}
            <div className="composer-wrap">
              {uploadedFiles.length > 0 && <div className="attachments" aria-label="Attached files">
                {uploadedFiles.map(file => <div key={file.id}><FileText size={14} /><span title={file.fileName}>{file.fileName}</span><button aria-label={`Remove ${file.fileName}`} onClick={() => setUploadedFiles(previous => previous.filter(item => item.id !== file.id))}><X size={14} /></button></div>)}
              </div>}
              <form className="composer" onSubmit={event => void sendMessage(event)}>
                <textarea ref={textareaRef} className="composer-input" value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
                }} placeholder="Message KOPLI AI…" aria-label="Message KOPLI AI" rows={2} disabled={streaming} />
                <div className="composer-toolbar">
                  <div className="composer-toolbar-left">
                    <input ref={fileInputRef} type="file" multiple hidden onChange={event => void uploadFiles(event)} aria-label="Choose files" />
                    <button className="composer-button" type="button" aria-label="Attach files" title="Attach files" onClick={() => fileInputRef.current?.click()}><Paperclip size={19} /></button>
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
                      : <button className="send-button" type="submit" disabled={!prompt.trim() && !uploadedFiles.length} aria-label="Send message"><Send size={18} /></button>}
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
          <div className="tool-grid">
            {([
              ["image", ImageIcon, "Image generation", "Create an image from a text description."],
              ["docx", FileText, "Documents", "Generate a formatted Word document."],
              ["pdf", FileText, "PDF reports", "Create a printable PDF report."],
              ["pptx", Library, "Presentations", "Generate a PowerPoint presentation."],
              ["xlsx", Library, "Spreadsheets", "Create a structured workbook."]
            ] as const).map(([type, Icon, title, description]) => <button className="tool-card" key={type} onClick={() => { setToolType(type); setToolResult(null); }}>
              <span className="tool-icon"><Icon size={21} /></span><h3>{title}</h3><p>{description}</p><span>Open tool <ChevronRight size={14} /></span>
            </button>)}
          </div>
          <div className="settings-card modern" style={{ maxWidth: 760, marginTop: 18, padding: 18 }}>
            <form onSubmit={event => void generateContent(event)}>
              <label htmlFor="tool-prompt"><strong>{toolType === "image" ? "Describe the image" : "Describe the content"}</strong></label>
              <textarea id="tool-prompt" className="chat-search" style={{ width: "100%", height: 110, padding: 12, marginTop: 8 }} value={toolPrompt} onChange={event => setToolPrompt(event.target.value)} placeholder="Describe what you want KOPLI AI to create…" />
              <button className="auth-submit" type="submit" disabled={toolBusy || !toolPrompt.trim()}>{toolBusy ? "Creating…" : `Create ${toolType.toUpperCase()}`}</button>
            </form>
            {toolResult && <div className="generated-image-card">
              {toolResult.image && <img className="generated-image-preview" src={toolResult.url} alt={toolPrompt} />}
              <div className="generated-image-toolbar"><span>{toolResult.fileName}</span><div><a href={toolResult.url} download={toolResult.fileName} aria-label="Download generated file"><Download size={17} /></a></div></div>
            </div>}
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
              <button className="settings-neutral-row-button" onClick={() => user ? void signOut() : setAuthOpen(true)}>{user ? <LogOut size={18} /> : <LogIn size={18} />}<span>{user ? "Sign out" : "Sign in or create account"}</span><ChevronRight size={17} /></button>
              {user?.role === "owner" && <button className="settings-neutral-row-button" onClick={() => void loadAdmin()}><Shield size={18} /><span>Admin status</span><ChevronRight size={17} /></button>}
            </div>
          </div> : <div className="settings-detail">
            <button className="settings-detail-back" onClick={() => setSettingsDetail("")}><ChevronLeft size={17} /> Settings</button><h2>{settingsDetail}</h2>
            {settingsDetail === "Appearance" && <div className="settings-card-neutral"><div className="settings-neutral-row"><div><strong>Theme</strong><span>Choose light or dark appearance</span></div><button className={`switch ${dark ? "toggle-active" : ""}`} aria-label={dark ? "Use light theme" : "Use dark theme"} aria-pressed={dark} onClick={() => setDark(value => !value)}><span className={dark ? "on" : ""} /></button></div></div>}
            {settingsDetail === "Personalization" && <div className="settings-card-neutral">
              <div className="settings-neutral-row"><div><strong>Improve responses</strong><span>Remember corrections and preferences for this account</span></div><button className={`switch ${preferences.learning ? "toggle-active" : ""}`} aria-label="Toggle response personalization" aria-pressed={preferences.learning} onClick={() => void updatePreferences({ learning: !preferences.learning })}><span className={preferences.learning ? "on" : ""} /></button></div>
              <div className="settings-neutral-row"><div><strong>Use past conversations</strong><span>Allow KOPLI AI to recall relevant chats when asked</span></div><button className={`switch ${preferences.crossChat ? "toggle-active" : ""}`} aria-label="Toggle cross-chat memory" aria-pressed={preferences.crossChat} onClick={() => void updatePreferences({ crossChat: !preferences.crossChat })}><span className={preferences.crossChat ? "on" : ""} /></button></div>
            </div>}
            {settingsDetail === "Data & memory" && <div className="settings-card-neutral">
              <div className="settings-neutral-row"><div><strong>Saved memory</strong><span>Review or remove saved preferences and summaries</span></div><button className="settings-action" onClick={() => void openMemoryManager()}>Manage</button></div>
              <div className="settings-neutral-row"><div><strong>Export my data</strong><span>Download memory, preferences, and conversations</span></div><button className="settings-action" onClick={() => void exportData()} disabled={!user}>Export</button></div>
            </div>}
            {settingsDetail === "Account" && <div className="settings-card-neutral"><div className="settings-neutral-row"><div><strong>{user?.email || "Guest session"}</strong><span>{user ? "Your account is signed in" : "Sign in to sync your history"}</span></div><button className="settings-action" onClick={() => user ? void signOut() : setAuthOpen(true)}>{user ? "Sign out" : "Sign in"}</button></div></div>}
          </div>}
          <div className="settings-search-wrap"><Search size={17} /><input value={settingsSearch} onChange={event => setSettingsSearch(event.target.value)} placeholder="Search settings" aria-label="Search settings" />
            {settingsSearch && <div className="settings-search-results" role="listbox">{settingsLinks.map(item => <button key={item} onClick={() => { setSettingsDetail(item); setSettingsSearch(""); }}>{item}</button>)}{!settingsLinks.length && <span>No matching settings.</span>}</div>}
          </div>
        </section>}

        {section === "Admin" && <section className="page"><header className="page-heading"><h1>Admin status</h1><p>Provider configuration for this deployment.</p></header>
          {adminBusy ? <p role="status">Checking provider status…</p> : adminStatus ? <div className="settings-card">{Object.entries(adminStatus).map(([key, enabled]) => <div className="settings-row" key={key}><div><strong>{key.toUpperCase()}</strong><span>{enabled ? "Configured" : "Not configured"}</span></div><span>{enabled ? "Ready" : "Unavailable"}</span></div>)}</div> : <p>Admin status is unavailable.</p>}
        </section>}
      </main>

      {notice && <div className="feedback-toast" role="status">{notice}</div>}

      {authOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
        <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="dialog-close" aria-label="Close sign in" onClick={() => setAuthOpen(false)}><X size={19} /></button>
          <div className="auth-brand">KOPLI <span>AI</span></div><h1 id="auth-title">{registering ? "Create your account" : "Welcome back"}</h1>
          <p>Sign in to sync conversations and manage private memory.</p>
          <form onSubmit={event => void submitAuth(event)}>
            {registering && <label>Name<input autoComplete="name" value={authName} onChange={event => setAuthName(event.target.value)} required maxLength={100} /></label>}
            <label>Email<input type="email" autoComplete="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={registering ? "new-password" : "current-password"} value={authPassword} onChange={event => setAuthPassword(event.target.value)} required minLength={registering ? 12 : 1} /></label>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
          </form>
          <button className="auth-mode-toggle" onClick={() => { setRegistering(value => !value); setAuthError(""); }}>{registering ? "Already have an account? Sign in" : "New to KOPLI AI? Create an account"}</button>
          <p className="oauth-note">Email and password sign-in are available. Google and GitHub sign-in are not configured.</p>
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
