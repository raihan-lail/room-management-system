import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.route";

const app = express();

app.use(cors(
    {
         origin: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
        credentials: true
    }
));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);


app.get("/", (_req, res) => {
  res.json({
    message: "API is running"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});