import { useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import { permissions } from "../../data/permissions";
import { employee } from "../../data/employee";

export default function ManagePermissions() {
  // Extract unique roles dynamically from employee data
  const roles = useMemo(() => {
    const uniqueRoles = Array.from(
      new Set(employee.map((emp) => emp.Role).filter(Boolean))
    );
    return uniqueRoles.map((role) => ({
      value: role,
      label: role,
    }));
  }, []);

  // Default selected role to the first role found, or fallback to 'Employee'
  const [selectedRole, setSelectedRole] = useState(
    roles[0]?.value || "Employee"
  );
  const [selectedEmployee, setSelectedEmployee] = useState("");

  // Filter employees matching the currently selected role
  const filteredEmployees = useMemo(() => {
    return employee.filter(
      (emp) => emp.Role.toLowerCase() === selectedRole.toLowerCase()
    );
  }, [selectedRole]);

  // Track enabled permission IDs/routes for each role
  const [enabledPermissions, setEnabledPermissions] = useState({
    // Default all ON for Receptionist, all OFF for others (customizable)
    Receptionist: permissions.map((p) => p.id || p.route),
  });

  // Handle switching role -> reset selected employee and update view
  const handleRoleChange = (newRole) => {
    setSelectedRole(newRole);
    setSelectedEmployee(""); // Reset employee selection when role changes
  };

  const handleToggle = (permissionIdentifier) => {
    setEnabledPermissions((prev) => {
      const currentRolePermissions = prev[selectedRole] || [];
      const isAlreadyEnabled =
        currentRolePermissions.includes(permissionIdentifier);

      const updatedRolePermissions = isAlreadyEnabled
        ? currentRolePermissions.filter((id) => id !== permissionIdentifier)
        : [...currentRolePermissions, permissionIdentifier];

      return {
        ...prev,
        [selectedRole]: updatedRolePermissions,
      };
    });
  };

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Manage Permissions</h1>
            <p className="dashboard-header__subtitle">
              Configure access permissions by role and inspect assigned staff.
            </p>
          </div>
        </div>

        <div className="bookings-toolbar form-actions">
          <div
            className="permissions-filters"
            style={{ display: "flex", gap: "16px", alignItems: "center" }}
          >
            {/* Role Selector */}
            <div className="page-permission-role-selector">
              <label htmlFor="permission-role">Role</label>
              <select
                id="permission-role"
                value={selectedRole}
                className="permission-role-selector"
                onChange={(e) => handleRoleChange(e.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Employee Selector (Filtered by Role) */}
            <div className="page-permission-role-selector">
              <label htmlFor="permission-employee">Employee</label>
              <select
                id="permission-employee"
                value={selectedEmployee}
                className="permission-role-selector"
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="">
                  All {selectedRole}s ({filteredEmployees.length})
                </option>
                {filteredEmployees.map((emp, index) => (
                  <option key={`${emp.Email}-${index}`} value={emp.Email}>
                    {emp.name} ({emp.Site})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>Name</th>
                  <th>Path</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="muted text-center">
                      No permissions found.
                    </td>
                  </tr>
                ) : (
                  permissions.map((permission, index) => {
                    const permissionId = permission.id || permission.route;
                    const isEnabled = (
                      enabledPermissions[selectedRole] || []
                    ).includes(permissionId);

                    return (
                      <tr key={permissionId || index}>
                        <td className="table-col-no">{index + 1}</td>
                        <td>
                          <strong>{permission.name}</strong>
                        </td>
                        <td>
                          <code>{permission.route}</code>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isEnabled}
                              className={`driver-availability-toggle ${
                                isEnabled ? "is-on" : "is-off"
                              }`}
                              onClick={() => handleToggle(permissionId)}
                              title={
                                isEnabled
                                  ? `Turn ${permission.name} Off for ${selectedRole}`
                                  : `Turn ${permission.name} On for ${selectedRole}`
                              }
                            >
                              <i
                                className={`bi ${
                                  isEnabled
                                    ? "bi-toggle-on"
                                    : "bi-toggle-off"
                                }`}
                                aria-hidden="true"
                              />
                              <span>{isEnabled ? "On" : "Off"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}