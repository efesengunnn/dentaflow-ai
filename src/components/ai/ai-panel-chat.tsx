"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowUp, Loader2, Sparkles } from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const SUGGESTED_PROMPTS = [
  "Bugün kimler geliyor?",
  "Takip edilmesi gereken hastalar kimler?",
  "Paketi bitmek üzere olan hasta var mı?",
]

/**
 * The chat surface inside the AI panel Sheet. Talks only to
 * `/api/ai/chat` (`src/app/api/ai/chat/route.ts`) — identity/role/permission
 * resolution happens server-side there from the session cookie, never from
 * anything sent by this component, so there is nothing sensitive to pass in
 * the request body here.
 */
function AIPanelChat() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  })
  const [input, setInput] = useState("")

  const isBusy = status === "submitted" || status === "streaming"

  function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isBusy) return
    sendMessage({ text: trimmed })
    setInput("")
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Bugünkü randevular, hasta takibi ve paket durumu hakkında sorabilirsiniz.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm shadow-xs transition-colors hover:bg-muted"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex gap-2.5", message.role === "user" && "flex-row-reverse")}
          >
            {message.role === "assistant" && (
              <Avatar size="sm" className="mt-0.5">
                <AvatarFallback className="from-primary to-primary/70 bg-gradient-to-br text-primary-foreground">
                  <Sparkles className="size-3" />
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              {message.parts.map((part, index) =>
                part.type === "text" ? <span key={index} className="whitespace-pre-wrap">{part.text}</span> : null,
              )}
            </div>
          </div>
        ))}

        {isBusy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Klinik verileri kontrol ediliyor…
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            Bir sorun oluştu, lütfen tekrar deneyin.
          </p>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSend(input)
        }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              handleSend(input)
            }
          }}
          placeholder="Bir soru sorun…"
          className="min-h-9 flex-1 resize-none py-1.5"
          rows={1}
          disabled={isBusy}
        />
        <Button type="submit" size="icon" disabled={isBusy || !input.trim()}>
          <ArrowUp />
          <span className="sr-only">Gönder</span>
        </Button>
      </form>
    </div>
  )
}

export { AIPanelChat }
