import {
  addResponse,
  setRetryResponse,
  setErrorForResponse,
  loader,
  addOtherUserMessage,
  addUserMessage,
} from "./chat.js";
let isGeneratingResponse = false;

const API_URL = "http://localhost:3000";
const converter = new showdown.Converter();

async function getAccessToken() {
  try {
    const response = await fetch("/api/auth/token", { credentials: "include" });
    if (response.ok) {
      const { access_token } = await response.json();
      console.log("Access token fetched:", access_token);
      return access_token;
    } else {
      throw new Error("Failed to get access token");
    }
  } catch (error) {
    console.error("Error getting access token:", error);
  }
  return null;
}

export async function getGPTResult(_promptToRetry, _uniqueIdToRetry) {
  const prompt = _promptToRetry ?? promptInput.textContent;

  if (isGeneratingResponse || !prompt || !window.conversationId) {
    return;
  }

  submitButton.classList.add("loading");
  promptInput.textContent = "";

  // Add the user's message to the display before the bot's response
  addUserMessage(prompt);

  const uniqueId = addResponse(false);
  const responseElement = document.getElementById(uniqueId);

  loader(responseElement);
  isGeneratingResponse = true;

  try {
    const model = "gpt-4";

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("Access token is not available");
      return;
    }

    const response = await fetch(API_URL + "/api/get-prompt-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        prompt,
        model,
        conversationId: window.conversationId,
      }),
    });

    if (!response.ok) {
      setRetryResponse(prompt, uniqueId);
      setErrorForResponse(
        responseElement,
        `HTTP Error: ${await response.text()}`
      );
      return;
    }

    const result = await response.json();
    const generatedResponse = converter.makeHtml(result.choices[0].text.trim());
    responseElement.innerHTML = generatedResponse;

    promptToRetry = null;
    uniqueIdToRetry = null;
    regenerateResponseButton.style.display = "none";
  } catch (err) {
    setRetryResponse(prompt, uniqueId);
    setErrorForResponse(responseElement, `Error: ${err.message}`);
  } finally {
    isGeneratingResponse = false;
    submitButton.classList.remove("loading");
    clearInterval(loadInterval);
  }
}

export function subscribeToChatChannel(conversationId) {
  const pusherAppKey = document.querySelector(
    'meta[name="pusher-app-key"]'
  ).content;
  const pusherCluster = document.querySelector(
    'meta[name="pusher-cluster"]'
  ).content;
  const pusher = new Pusher(pusherAppKey, {
    cluster: pusherCluster,
  });
  console.log("Subscribing to chat channel:", `chat-${conversationId}`);
  const channel = pusher.subscribe(`chat-${conversationId}`);

  pusher.connection.bind("pusher:connection_established", () => {
    console.log("Pusher connected");
  });

  pusher.connection.bind("state_change", (states) => {
    console.log("Pusher state changed:", states);
  });

  channel.bind("pusher:subscription_succeeded", () => {
    console.log("Subscription to chat channel succeeded");
  });

  channel.bind("pusher:subscription_error", (statusCode) => {
    console.error(
      `Subscription to chat channel failed with status code: ${statusCode}`
    );
  });

  channel.bind("new-message", (message) => {
    console.log("New message received:", message);
    if (message.role === "assistant") {
      addResponse(false, pusher.makeHtml(message.content));
    } else if (message.role === "user") {
      addOtherUserMessage(converter.makeHtml(message.content));
    }
  });

  console.log("channel:", channel);
}
