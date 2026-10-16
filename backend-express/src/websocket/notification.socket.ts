
import type { Server as HttpServer } from "node:http";
import {
  WebSocket,
  WebSocketServer,
} from "ws";

import { consumeSocketTicket } from "./socket-ticket";

const connections = new Map<string, Set<WebSocket>>();

export function setupNotificationSocket(server: HttpServer) {
  const wss = new WebSocketServer({
    noServer: true,
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(
      request.url ?? "/",
      "http://localhost"
    );

    if (url.pathname !== "/ws/notifications") {
      socket.write(
        "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n"
      );
      socket.destroy();
      return;
    }

    const ticket = url.searchParams.get("ticket");

    if (!ticket) {
      socket.write(
        "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
      );
      socket.destroy();
      return;
    }

    // Consume and validate the single-use ticket.
    const userId = consumeSocketTicket(ticket);

    if (!userId) {
      socket.write(
        "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
      );
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      let userConnections = connections.get(userId);

      if (!userConnections) {
        userConnections = new Set<WebSocket>();
        connections.set(userId, userConnections);
      }

      userConnections.add(ws);

      ws.send(
        JSON.stringify({
          event: "connected",
          message: "Notification connection established",
        })
      );

      const removeConnection = () => {
        userConnections.delete(ws);

        if (userConnections.size === 0) {
          connections.delete(userId);
        }
      };

      ws.on("close", removeConnection);

      ws.on("error", () => {
        removeConnection();
        ws.terminate();
      });
    });
  });
}

export function sendNotificationToUser(
  userId: string,
  notification: unknown
) {
  const userConnections = connections.get(userId);

  if (!userConnections) {
    // The notification can still be read from PostgreSQL later.
    return;
  }

  const message = JSON.stringify({
    event: "notification:new",
    data: notification,
  });

  for (const ws of userConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message, (error) => {
        if (error) {
          console.error(
            "Failed to send WebSocket notification:",
            error.message
          );
        }
      });
    }
  }
}
