type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatOptions = { json?: boolean; maxTokens?: number; stream?: boolean };

function deepseekError(status: number): Error {
  if (status === 401) return new Error("DeepSeek 密钥无效");
  if (status === 402) return new Error("DeepSeek 余额不足");
  return new Error(`DeepSeek 请求失败（${status}）`);
}

async function deepseekRequest(messages: ChatMessage[], options?: ChatOptions) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY");
  }

  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.json ? 0 : 0.3,
      max_tokens: options?.maxTokens ?? 800,
      stream: Boolean(options?.stream),
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw deepseekError(response.status);
  }
  return response;
}

export async function deepseekChat(
  messages: ChatMessage[],
  options?: { json?: boolean; maxTokens?: number },
): Promise<string> {
  const response = await deepseekRequest(messages, options);
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("DeepSeek 没有返回内容");
  }
  return content;
}

export function deepseekTextStream(
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            let delta = "";
            try {
              const json = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              delta = json.choices?.[0]?.delta?.content ?? "";
            } catch {
              continue;
            }
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

export async function openDeepseekStream(messages: ChatMessage[]) {
  const response = await deepseekRequest(messages, { stream: true });
  if (!response.body) {
    throw new Error("DeepSeek 没有返回内容");
  }
  return deepseekTextStream(response.body);
}
