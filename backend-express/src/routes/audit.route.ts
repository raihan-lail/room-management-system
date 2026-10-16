import { Router } from "express";
import { getAuditLogs } from "../controllers/audit.controller";


const auditRouter = Router();

auditRouter.get("/", getAuditLogs);

export default auditRouter;
