import { z } from "zod";

export const ChatIdSchema = z.string().trim().min(1).max(128);
