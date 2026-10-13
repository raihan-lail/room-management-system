import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";
import { createSite, deleteSite, getSite, listSites, updateSite } from "../controllers/site.controller";

const siteRouter = Router();

siteRouter.use(authenticate);

siteRouter.get("/", requirePermission("site.read"), listSites);
siteRouter.get("/:id", requirePermission("site.read"), getSite);
siteRouter.post("/", requirePermission("site.manage"), createSite);
siteRouter.patch("/:id", requirePermission("site.manage"), updateSite);
siteRouter.delete("/:id", requirePermission("site.manage"), deleteSite);

export default siteRouter