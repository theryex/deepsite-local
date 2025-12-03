/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { InferenceClient } from "@huggingface/inference";

import { getMODELS } from "@/lib/providers";
import {
  FOLLOW_UP_SYSTEM_PROMPT,
  FOLLOW_UP_SYSTEM_PROMPT_LIGHT,
  INITIAL_SYSTEM_PROMPT,
  INITIAL_SYSTEM_PROMPT_LIGHT,
  MAX_REQUESTS_PER_IP,
  PROMPT_FOR_PROJECT_NAME,
} from "@/lib/prompts";
import MY_TOKEN_KEY from "@/lib/get-cookie-name";
import { Page } from "@/types";
import { isAuthenticated } from "@/lib/auth";
import { getBestProvider } from "@/lib/best-provider";

const ipAddresses = new Map();

export async function POST(request: NextRequest) {
  const authHeaders = await headers();
  const tokenInHeaders = authHeaders.get("Authorization");
  const userToken = tokenInHeaders ? tokenInHeaders.replace("Bearer ", "") : request.cookies.get(MY_TOKEN_KEY())?.value;

  const body = await request.json();
  const { prompt, provider, model, redesignMarkdown, enhancedSettings, pages } = body;

  // 🛠️ FIX 1: Fetch models at the start
  const MODELS = await getMODELS();

  // 🛠️ FIX 2: Single declaration of selectedModel
  const selectedModel = MODELS.find(
    (m) => m.value === model || m.label === model
  );

  if (!model || (!prompt && !redesignMarkdown)) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!selectedModel) {
    return NextResponse.json(
      { ok: false, error: "Invalid model selected" },
      { status: 400 }
    );
  }

  let token: string | null = null;
  if (userToken) token = userToken;
  let billTo: string | null = null;

  /**
   * Handle local usage token...
   */
  if (process.env.HF_TOKEN && process.env.HF_TOKEN.length > 0) {
    token = process.env.HF_TOKEN;
  }

  const ip = authHeaders.get("x-forwarded-for")?.includes(",")
    ? authHeaders.get("x-forwarded-for")?.split(",")[1].trim()
    : authHeaders.get("x-forwarded-for");

  if (!token || token === "null" || token === "") {
    ipAddresses.set(ip, (ipAddresses.get(ip) || 0) + 1);
    if (ipAddresses.get(ip) > MAX_REQUESTS_PER_IP) {
      return NextResponse.json(
        {
          ok: false,
          openLogin: true,
          message: "Log In to continue using the service",
        },
        { status: 429 }
      );
    }

    token = process.env.DEFAULT_HF_TOKEN as string;
    billTo = "huggingface";
  }

  try {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const response = new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    (async () => {
      try {
        // 🛠️ PATCH 1: Configure the client for local LLMs
        let clientConfig = {};
        // 🛑 FIX: Cast to 'any' to bypass Type error: Property 'id' does not exist on type 'Model | { ... }'
        const isLocalVLLM = (selectedModel as any).id === 'local-vllm';
        const isLocalOllama = (selectedModel as any).id === 'local-ollama';

        let clientToken = token;

        if (isLocalVLLM) {
          clientConfig = {
            // Use the static IP directly
            baseUrl: 'http://192.168.76.96:8000/v1',
          };
          // 🛠️ FIX: Do not pass HF token to local provider to avoid "Cannot use endpointUrl with a third-party provider" error
          clientToken = undefined as unknown as string;
        } else if (isLocalOllama) {
          clientConfig = {
            // Use the static IP directly
            baseUrl: 'http://192.168.76.96:11434/v1',
          };
          // 🛠️ FIX: Do not pass HF token to local provider to avoid "Cannot use endpointUrl with a third-party provider" error
          clientToken = undefined as unknown as string;
        }

        const client = new InferenceClient(clientToken, clientConfig);
        // END PATCH

        const systemPrompt = selectedModel.value.includes('MiniMax')
          ? INITIAL_SYSTEM_PROMPT_LIGHT
          : INITIAL_SYSTEM_PROMPT;

        const userPrompt = prompt;

        // 🛠️ FIX 2: Determine the model name without the provider suffix for local
        const modelName = isLocalVLLM || isLocalOllama
          ? selectedModel.value // Local models use the model name from the value field (which is the actual model name)
          : selectedModel.value + (provider !== "auto" ? `:${provider}` : ""); // Remote models use provider suffix

        const chatCompletion = client.chatCompletionStream(
          {
            model: modelName, // 🛠️ Using modelName to fix the "model does not exist" error
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              ...(redesignMarkdown ? [{
                role: "assistant",
                content: `User will ask you to redesign the site based on this markdown. Use the same images as the site, but you can improve the content and the design. Here is the markdown: ${redesignMarkdown}`
              }] : []),
              {
                role: "user",
                content: userPrompt + (enhancedSettings.isActive ? `1. I want to use the following primary color: ${enhancedSettings.primaryColor} (eg: bg-${enhancedSettings.primaryColor}-500).
2. I want to use the following secondary color: ${enhancedSettings.secondaryColor} (eg: bg-${enhancedSettings.secondaryColor}-500).
3. I want to use the following theme: ${enhancedSettings.theme} mode.` : "")
              },
            ],
            // 🛑 FINAL FIX: Cast to any for optional parameters to stop compiler from whining
            ...((selectedModel as any).top_k ? { top_k: (selectedModel as any).top_k } : {}),
            ...((selectedModel as any).temperature ? { temperature: (selectedModel as any).temperature } : {}),
            ...((selectedModel as any).top_p ? { top_p: (selectedModel as any).top_p } : {}),
            max_tokens: 32000,
          },
          billTo ? { billTo } : {}
        );

        while (true) {
          const { done, value } = await chatCompletion.next()
          if (done) {
            break;
          }

          const chunk = value.choices[0]?.delta?.content;
          if (chunk) {
            await writer.write(encoder.encode(chunk));
          }
        }

        await writer.close();
      } catch (error: any) {
        // 🛠️ Log the actual inference error from the local model
        console.error("Inference Error:", error);

        if (error.message?.includes("exceeded your monthly included credits")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openProModal: true,
                message: error.message,
              })
            )
          );
        } else if (error?.message?.includes("inference provider information")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openSelectProvider: true,
                message: error.message,
              })
            )
          );
        }
        else {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                message:
                  error.message ||
                  "An error occurred while processing your request.",
              })
            )
          );
        }
      } finally {
        try {
          await writer?.close();
        } catch {
        }
      }
    })();

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        openSelectProvider: true,
        message:
          error?.message || "An error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await isAuthenticated();
  if (user instanceof NextResponse || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authHeaders = await headers();

  const body = await request.json();
  const { prompt, provider, selectedElementHtml, model, pages, files, repoId, isNew } =
    body;

  // 🛠️ NEW: Fetch dynamic models list
  const MODELS = await getMODELS();

  const selectedModel = MODELS.find(
    (m) => m.value === model || m.label === model
  );

  if (!prompt || pages.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!selectedModel) {
    return NextResponse.json(
      { ok: false, error: "Invalid model selected" },
      { status: 400 }
    );
  }

  let token = user.token as string;
  let billTo: string | null = null;

  /**
   * Handle local usage token...
   */
  if (process.env.HF_TOKEN && process.env.HF_TOKEN.length > 0) {
    token = process.env.HF_TOKEN;
  }

  const ip = authHeaders.get("x-forwarded-for")?.includes(",")
    ? authHeaders.get("x-forwarded-for")?.split(",")[1].trim()
    : authHeaders.get("x-forwarded-for");

  if (!token || token === "null" || token === "") {
    ipAddresses.set(ip, (ipAddresses.get(ip) || 0) + 1);
    if (ipAddresses.get(ip) > MAX_REQUESTS_PER_IP) {
      return NextResponse.json(
        {
          ok: false,
          openLogin: true,
          message: "Log In to continue using the service",
        },
        { status: 429 }
      );
    }

    token = process.env.DEFAULT_HF_TOKEN as string;
    billTo = "huggingface";
  }

  try {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const response = new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    (async () => {
      try {
        // 🛠️ PATCH 1: Configure the client for local LLMs
        let clientConfig = {};
        // 🛑 FIX: Cast to 'any' to bypass Type error: Property 'id' does not exist on type 'Model | { ... }'
        const isLocalVLLM = (selectedModel as any).id === 'local-vllm';
        const isLocalOllama = (selectedModel as any).id === 'local-ollama';

        let clientToken = token;

        if (isLocalVLLM) {
            clientConfig = {
                // Use the static IP directly
                baseUrl: 'http://192.168.76.96:8000/v1',
            };
            // 🛠️ FIX: Do not pass HF token to local provider
            clientToken = undefined as unknown as string;
        } else if (isLocalOllama) {
            clientConfig = {
                // Use the static IP directly
                baseUrl: 'http://192.168.76.96:11434/v1',
            };
            // 🛠️ FIX: Do not pass HF token to local provider
            clientToken = undefined as unknown as string;
        }

        const client = new InferenceClient(clientToken, clientConfig);
        // END PATCH

        const basePrompt = selectedModel.value.includes('MiniMax')
          ? FOLLOW_UP_SYSTEM_PROMPT_LIGHT
          : FOLLOW_UP_SYSTEM_PROMPT;
        const systemPrompt = basePrompt + (isNew ? PROMPT_FOR_PROJECT_NAME : "");
        // const userContext = "You are modifying the HTML file based on the user's request.";

        const allPages = pages || [];
        const pagesContext = allPages
          .map((p: Page) => `- ${p.path}\n${p.html}`)
          .join("\n\n");

        const assistantContext = `${selectedElementHtml
            ? `\n\nYou have to update ONLY the following element, NOTHING ELSE: \n\n\`\`\`html\n${selectedElementHtml}\n\`\`\` Could be in multiple pages, if so, update all the pages.`
            : ""
          }. Current pages (${allPages.length} total): ${pagesContext}. ${files?.length > 0 ? `Available images: ${files?.map((f: string) => f).join(', ')}.` : ""}`;

        // 🛠️ FIX 2: Determine the model name without the provider suffix for local
        const modelName = isLocalVLLM || isLocalOllama
          ? selectedModel.value // Local models use the model name from the value field
          : selectedModel.value + (provider !== "auto" ? `:${provider}` : ""); // Remote models use provider suffix

        const chatCompletion = client.chatCompletionStream(
          {
            model: modelName, // 🛠️ Using modelName to fix the "model does not exist" error
            messages: [
              {
                role: "system",
                content: systemPrompt + assistantContext
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            // 🛑 FINAL FIX: Cast to any for optional parameters to stop compiler from whining
            ...((selectedModel as any).top_k ? { top_k: (selectedModel as any).top_k } : {}),
            ...((selectedModel as any).temperature ? { temperature: (selectedModel as any).temperature } : {}),
            ...((selectedModel as any).top_p ? { top_p: (selectedModel as any).top_p } : {}),
            max_tokens: 32000,
          },
          billTo ? { billTo } : {}
        );

        // Stream the response chunks to the client
        while (true) {
          const { done, value } = await chatCompletion.next();
          if (done) {
            break;
          }

          const chunk = value.choices[0]?.delta?.content;
          if (chunk) {
            await writer.write(encoder.encode(chunk));
          }
        }

        await writer.write(encoder.encode(`\n___METADATA_START___\n${JSON.stringify({
          repoId,
          isNew,
          userName: user.name,
        })}\n___METADATA_END___\n`));

        await writer.close();
      } catch (error: any) {
        // 🛠️ Log the actual inference error from the local model
        console.error("Inference Error:", error);

        if (error.message?.includes("exceeded your monthly included credits")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openProModal: true,
                message: error.message,
              })
            )
          );
        } else if (error?.message?.includes("inference provider information")) {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                openSelectProvider: true,
                message: error.message,
              })
            )
          );
        } else {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                ok: false,
                message:
                  error.message || "An error occurred while processing your request.",
              })
            )
          );
        }
      } finally {
        try {
          await writer?.close();
        } catch {
          // ignore
        }
      }
    })();

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        openSelectProvider: true,
        message:
          error.message || "An error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}
