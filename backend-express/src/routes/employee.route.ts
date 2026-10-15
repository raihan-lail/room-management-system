import  { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createEmployee, deleteEmployee, getEmployee, listEmployees, updateEmployee } from "../controllers/employee.controller.js";
import { disableEmployeePermission, enableEmployeePermission, getEmployeePermissions } from "../controllers/permission-assignment.controller.js";


const employeeRouter = Router();
employeeRouter.use(authenticate)

employeeRouter.get("/", requirePermission("employees.read"), listEmployees);
employeeRouter.get("/:id", requirePermission("employees.read"), getEmployee);
employeeRouter.post("/", requirePermission("employees.create"), createEmployee);
employeeRouter.patch("/:id", requirePermission("employees.update"), updateEmployee);
employeeRouter.delete("/:id", requirePermission("employees.update"), deleteEmployee);

// permissions
employeeRouter.get("/:id/permissions", requirePermission("permissions.read"), getEmployeePermissions);
employeeRouter.put("/:id/permissions/:permissionId",  requirePermission("permissions.manage"), enableEmployeePermission);
employeeRouter.delete("/:id/permissions/:permissionId",  requirePermission("permissions.manage"), disableEmployeePermission)


export default employeeRouter;