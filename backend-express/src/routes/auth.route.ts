import { Router } from "express";

import {
  changePassword,
  login,
  logout,
  me,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", me);
authRouter.post("/change-password", authenticate, changePassword);

export default authRouter;