import { Router } from "express";
import {
  getComplaintFeedback,
  submitComplaintFeedback,
} from "../controllers/feedback.controller";

const feedbackRouter = Router();

feedbackRouter.get("/complaints/:bookingId/:token", getComplaintFeedback);
feedbackRouter.post("/complaints/:bookingId/:token", submitComplaintFeedback);

export default feedbackRouter;
