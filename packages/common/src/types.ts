import { z } from "zod";

export const CreateUserSchema = z.object({
    username: z.string().min(3).max(20),
    password: z.string(),
    name: z.string()
})

export const SigninSchema = z.object({
    username: z.string().min(3).max(20),
    password: z.string(),
})

export const CreateRoomSchema = z.object({
    name: z.string().min(3).max(20),
})

export const WsMessageSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("join_room"),
        roomId: z.string(),
    }),
    z.object({
        type: z.literal("leave_room"),
        roomId: z.string(),
    }),
    z.object({
        type: z.literal("chat"),
        roomId: z.string(),
        message: z.string(),
    }),
]);
