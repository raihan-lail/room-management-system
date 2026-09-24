import { useState } from "react";
import MainLayout from "../../components/MainLayout";
import { permissions } from "../../data/permissions";

export default function ManagePermissions() {
  const [selectedRole, setSelectedRole] = useState("employee");

  // Track enabled permission IDs/routes for each role
  const [enabledPermissions, setEnabledPermissions] = useState({
    employee: permissions.map((p) => p.id || p.route), // Default all ON for employee
    reporting: [], // Default all OFF for reporting
  });

  const roles = [
    { value: "employee", label: "Employee" },
    { value: "reporting", label: "Analytics & Reporting" },
  ];

  const handleToggle = (permissionIdentifier) => {
    setEnabledPermissions((prev) => {
      const currentRolePermissions = prev[selectedRole] || [];
      const isAlreadyEnabled = currentRolePermissions.includes(permissionIdentifier);

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
              Configure access permissions for each role.
            </p>
          </div>
        </div>

        <div className="bookings-toolbar form-actions">
          <div className="page-permission-role-selector">
            <label htmlFor="permission-role">Role</label>
            <select
              id="permission-role"
              value={selectedRole}
              className="permission-role-selector"
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
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
                    <td colSpan="4" className="muted">
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
                        <td>{permission.name}</td>
                        <td>{permission.route}</td>
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
                                  ? `Turn ${permission.name} Off`
                                  : `Turn ${permission.name} On`
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