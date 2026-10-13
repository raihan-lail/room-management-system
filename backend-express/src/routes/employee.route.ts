import  { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createEmployee, deleteEmployee, getEmployee, listEmployees, updateEmployee } from "../controllers/employee.controller.js";


const employeeRouter = Router();
employeeRouter.use(authenticate)

employeeRouter.get("/", requirePermission("employee.read"), listEmployees);
employeeRouter.get("/:id", requirePermission("employee.read"), getEmployee);
employeeRouter.post("/", requirePermission("employee.manage"), createEmployee);
employeeRouter.patch("/:id", requirePermission("employee.manage"), updateEmployee);
employeeRouter.delete("/:id", requirePermission("employee.manage"), deleteEmployee);




export default employeeRouter;