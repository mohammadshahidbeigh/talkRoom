import {Server} from "socket.io";
import prisma from "../models";

// Add interface at the top
interface ChatParticipant {
  userId: string;
}

interface CreatedChat {
  id: string;
  participants: ChatParticipant[];
}

export default (io: Server) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    socket.on("disconnect", (reason) => {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
      if (reason === "transport close" || reason === "transport error") {
        // Instead of socket.connect(), use socket.connect event
        socket.once("connect", () => {
          console.log("Socket reconnected automatically");
        });
      }
    });

    // Join a specific chat room
    socket.on("join-chat", (chatId: string) => {
      if (typeof chatId === "string") {
        socket.join(chatId);
        console.log(`User ${socket.id} joined chat ${chatId}`);
      } else {
        console.error("Invalid chatId:", chatId);
      }
    });

    // Add a join-room handler for video rooms
    socket.on("join-room", (roomId: string) => {
      if (typeof roomId === "string") {
        socket.join(roomId);
        console.log(`User ${socket.id} joined video room ${roomId}`);

        // Notify others in the room
        socket.to(roomId).emit("user-joined", {
          userId: socket.id,
          roomId: roomId,
        });
      } else {
        console.error("Invalid roomId:", roomId);
      }
    });

    // Leave a chat room
    socket.on("leave-chat", (chatId: string) => {
      socket.leave(chatId);
      console.log(`User ${socket.id} left chat ${chatId}`);
    });

    // Add a leave-room handler
    socket.on("leave-room", (roomId: string) => {
      if (typeof roomId === "string") {
        socket.leave(roomId);
        console.log(`User ${socket.id} left video room ${roomId}`);

        // Notify others in the room
        socket.to(roomId).emit("user-left", {
          userId: socket.id,
          roomId: roomId,
        });
      } else {
        console.error("Invalid roomId:", roomId);
      }
    });

    // Handle participant leaving chat
    socket.on("participant-left", async ({chatId, userId, username}) => {
      try {
        console.log(`User ${username} is leaving chat ${chatId}`);

        // Check if chat still exists before creating system message
        const chatExists = await prisma.chat.findUnique({
          where: {id: chatId},
        });

        if (chatExists) {
          // Create system message about user leaving
          const systemMessage = await prisma.message.create({
            data: {
              chatId,
              content: `${username} left the chat`,
              type: "system",
              senderId: userId,
            },
            include: {
              sender: true,
            },
          });

          console.log("Created system message:", systemMessage);

          // Broadcast the system message to the chat room
          io.to(chatId).emit("message", systemMessage);
          console.log("Emitted system message to room:", chatId);

          // Get updated chat after participant left
          const updatedChat = await prisma.chat.findUnique({
            where: {id: chatId},
            include: {
              participants: {
                include: {
                  user: true,
                },
              },
              messages: {
                include: {
                  sender: true,
                },
                orderBy: {
                  createdAt: "desc",
                },
                take: 1,
              },
            },
          });

          // Broadcast updates to all clients
          if (updatedChat) {
            io.emit("chat-updated", updatedChat);
            console.log("Emitted chat update");
          }
        }

        // Always emit the participant left event
        io.emit("participant-left", {chatId, userId, username});
        console.log("Emitted participant-left event");
      } catch (error) {
        console.error("Error handling participant leaving:", error);
      }
    });

    // Handle new message
    socket.on("message", async (message) => {
      try {
        // Get updated chat with latest message
        const updatedChat = await prisma.chat.findUnique({
          where: {id: message.chatId},
          include: {
            participants: {
              include: {
                user: true,
              },
            },
            messages: {
              include: {
                sender: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        });

        // Broadcast both the message and updated chat
        io.emit("message", message);
        if (updatedChat) {
          io.emit("chat-updated", updatedChat);
        }
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    // Handle message deletion
    socket.on("message-deleted", async (data) => {
      try {
        const updatedChat = await prisma.chat.findUnique({
          where: {id: data.chatId},
          include: {
            participants: {
              include: {
                user: true,
              },
            },
            messages: {
              include: {
                sender: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        });

        // Broadcast to all users in the chat except the sender
        socket.to(data.chatId).emit("message-deleted", {
          ...data,
          notificationMessage: `${
            data.sender?.username || "Someone"
          } deleted a message`,
        });

        if (updatedChat) {
          io.emit("chat-updated", updatedChat);
        }
      } catch (error) {
        console.error("Error handling message deletion:", error);
      }
    });

    // Inside your socket initialization
    socket.on("message-deleted", async (message) => {
      try {
        // Broadcast the deleted message to all users in the chat
        socket.to(message.chatId).emit("message-deleted", message);
      } catch (error) {
        console.error("Socket message deletion error:", error);
      }
    });

    // Update the chat-created handler
    socket.on("chat-created", async (chat: CreatedChat) => {
      try {
        // Get the full chat details with user info
        const fullChat = await prisma.chat.findUnique({
          where: {id: chat.id},
          include: {
            participants: {
              include: {
                user: true,
              },
            },
            messages: {
              include: {
                sender: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        });

        if (fullChat) {
          // Only emit to participants of this chat
          fullChat.participants.forEach((participant) => {
            // Find socket(s) for this user and emit to them
            const userSockets = Array.from(io.sockets.sockets.values()).filter(
              (socket) => socket.data.userId === participant.userId
            );

            userSockets.forEach((userSocket) => {
              userSocket.emit("chat-created", fullChat);
            });
          });
        }
      } catch (error) {
        console.error("Error handling chat creation:", error);
      }
    });

    // Add this connection handler at the start of the socket connection
    socket.on("authenticate", (userId: string) => {
      socket.data.userId = userId;
      console.log(`Socket ${socket.id} authenticated for user ${userId}`);
    });
  });
};
