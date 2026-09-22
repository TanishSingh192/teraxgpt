import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AUTO, getModel, MODELS } from "@/lib/models";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ScheduleRow = {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  frequency: string;
  run_at_minute: number;
  model_id: string;
  last_run_at: string | null;
};

/** True when this action's slot has come round again since its last run. */
function isDue(row: ScheduleRow, now: Date) {
  const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();
  const last = row.last_run_at ? new Date(row.last_run_at) : null;
  const sinceLast = last ? now.getTime() - last.getTime() : Number.POSITIVE_INFINITY;

  if (row.frequency === "hourly") return sinceLast >= 55 * 60 * 1000;
  if (row.frequency === "weekly") {
    return minutesNow >= row.run_at_minute && sinceLast >= 6.5 * 24 * 60 * 60 * 1000;
  }
  return minutesNow >= row.run_at_minute && sinceLast >= 20 * 60 * 60 * 1000;
}

async function runOne(row: ScheduleRow, apiKey: string) {
  const modelId =
    row.model_id === AUTO ? "google/gemini-3.8-flash" : getModel(row.model_id).id;
  const usable = MODELS.find((m) => m.id === modelId && m.endpoint !== "image");
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: usable ? usable.id : "google/gemini-3.8-flash",
      messages: [
        {
          role: "system",
          content:
            "You are Multiform running a scheduled action for the user. Answer completely in markdown; there is nobody to ask follow-up questions.",
        },
        { role: "user", content: row.prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI request failed [${response.status}]: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return payload.choices?.[0]?.message?.content ?? "";
}

export const Route = createFileRoute("/api/public/run-schedules")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Either the platform cron secret or this app's own scheduler key.
        const runnerSecret = process.env["SCHEDULE_RUNNER_SECRET"];
        const bearer = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!runnerSecret || bearer !== runnerSecret) {
          const unauthorized = await authenticateCronRequest(request);
          if (unauthorized) return unauthorized;
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        const { data } = await supabaseAdmin
          .from("scheduled_actions")
          .select("id,user_id,title,prompt,frequency,run_at_minute,model_id,last_run_at")
          .eq("enabled", true);

        const now = new Date();
        const due = ((data ?? []) as ScheduleRow[]).filter((row) => isDue(row, now));
        let completed = 0;

        for (const row of due) {
          try {
            const text = await runOne(row, apiKey);
            const { data: conversation } = await supabaseAdmin
              .from("conversations")
              .insert({ user_id: row.user_id, title: `${row.title} · scheduled` })
              .select("id")
              .single();
            if (conversation) {
              await supabaseAdmin.from("messages").insert([
                {
                  conversation_id: conversation.id,
                  user_id: row.user_id,
                  role: "user",
                  content: [{ type: "text", text: row.prompt }],
                },
                {
                  conversation_id: conversation.id,
                  user_id: row.user_id,
                  role: "assistant",
                  content: [{ type: "text", text }],
                },
              ]);
            }
            await supabaseAdmin
              .from("scheduled_actions")
              .update({ last_run_at: now.toISOString(), last_result: text.slice(0, 4000) })
              .eq("id", row.id);
            completed += 1;
          } catch (error) {
            await supabaseAdmin
              .from("scheduled_actions")
              .update({
                last_run_at: now.toISOString(),
                last_result: error instanceof Error ? error.message : "The action failed.",
              })
              .eq("id", row.id);
          }
        }

        return Response.json({ checked: data?.length ?? 0, ran: due.length, completed });
      },
    },
  },
});
