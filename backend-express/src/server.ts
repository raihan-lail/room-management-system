import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.route";
import employeeRouter from "./routes/employee.route";
import roleRouter from "./routes/role.route";
import siteRouter from "./routes/site.route";
import permissionRouter from "./routes/permission.route";
import locationRouter from "./routes/location.route";
import notificationRouter from "./routes/notification.route";
import auditRouter from "./routes/audit.route";
import { setupNotificationSocket } from "./websocket/notification.socket";
import { createServer } from "node:http";


const app = express();

const server = createServer(app);

setupNotificationSocket(server);

app.use(cors(
    {
         origin: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
        credentials: true
    }
));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/employee", employeeRouter);
app.use("/api/role", roleRouter);
app.use("/api/site", siteRouter);
app.use("/api/permission", permissionRouter);
app.use("/api/location", locationRouter);
app.use("/api/notification", notificationRouter);
app.use("/api/audit", auditRouter);



app.get("/", (_req, res) => {
  res.json({
    message: "API is running"
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});