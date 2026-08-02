import { askConnie } from "../../server/connie-ai.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS,
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  try {
    const { reply, model } = await askConnie(input);
    return respond(200, { reply, model });
  } catch (err) {
    if (err.code === "NO_KEY") {
      return respond(503, { error: "Connie AI is not configured", code: "NO_KEY" });
    }
    if (err.code === "BAD_REQUEST") {
      return respond(400, { error: err.message, code: "BAD_REQUEST" });
    }
    console.error("Connie AI error:", err.message || err);
    return respond(502, {
      error: "Connie could not reach the AI right now",
      code: err.code || "OPENAI",
    });
  }
}
