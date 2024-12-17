import TelegramBot from "node-telegram-bot-api";
import { Configuration, OpenAIApi } from "openai";
import dotenv from "dotenv";
import { connectDB } from "./database";
import ChatSchema from "./models/chat";

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN as string, {
  polling: true,
});

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY as string })
);

connectDB();

interface UserState {
  step: number;
}
const userState: Record<string, UserState> = {};

const steps: string[] = [
  "What is your name?",
  "Where are you from?",
  "What is your nationality?",
  "What is your age?",
];

async function callOpenAIWithRetry(
  prompt: string,
  retries = 3,
  delayMs = 5000
) {
  for (let i = 0; i < retries; i++) {
    try {
      const gptResponse = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      });
      return gptResponse.data.choices[0]?.message?.content || "No response.";
    } catch (error: any) {
      if (error.response && error.response.status === 429) {
        console.warn(`Rate limit hit. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
  console.warn(
    "Rate limit exceeded after retries, returning fallback message."
  );
  return "Sorry, I am currently unavailable due to high traffic. Please try again later.";
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";

  if (!userState[chatId]) userState[chatId] = { step: 0 };

  try {
    let response: string;

    if (userState[chatId].step < steps.length) {
      response = steps[userState[chatId].step];
      userState[chatId].step++;
    } else {
      let gptResponse;
      try {
        gptResponse = await callOpenAIWithRetry(text);
      } catch (error) {
        console.error("Error with OpenAI API:", error);
        response =
          "Sorry, I encountered an error while processing your message.";
      }

      response = gptResponse || "I did not understand that.";

      try {
        await ChatSchema.create({
          userId: chatId,
          userMessage: text,
          botResponse: response,
        });
      } catch (dbError) {
        console.error("Error saving to database:", dbError);
      }
    }
    console.log("RESPONSE", chatId, response);

    // Send response back to Telegram
    await bot.sendMessage(chatId, response);
  } catch (error) {
    console.error("Error handling message:", error);
    await bot.sendMessage(chatId, "An error occurred. Please try again.");
  }
});
