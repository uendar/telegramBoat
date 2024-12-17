import mongoose, { Schema, Document } from "mongoose";

export interface ChatProps extends Document {
  userId: string;
  userMessage: string;
  botResponse: string;
  timestamp: Date;
}

const ChatSchema: Schema = new Schema({
  userId: { type: String, required: true },
  userMessage: { type: String, required: true },
  botResponse: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<ChatProps>("Chat", ChatSchema);
