
import { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import apiRequest from "../../api/client";

export default function ManagePermissions() {
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [selectedRole, setSelectedRole] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingPermission, setSavingPermission] = useState("");
  const [error, setError] = useState("");

  // Load the master data once.
  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setLoading(true);
      setError("");

      try {
        const [rolesResponse, employeesResponse, permissionsResponse] =
          await Promise.all([
            apiRequest("/api/role"),
            apiRequest("/api/employee"),
            apiRequest("/api/permission"),
          ]);

        if (!active) return;

        const roleData = rolesResponse.data ?? [];
        const employeeData = employeesResponse.data ?? [];
        const permissionData = permissionsResponse.data ?? [];

        setRoles(roleData);
        setEmployees(employeeData);
        setPermissions(permissionData);

        setSelectedRole((current) => current || roleData[0]?.id || "");
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load permissions.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  const currentRole = roles.find(
    (role) => role.id === selectedRole
  );

  // Filter employees assigned to the selected role.
  const filteredEmployees = useMemo(() => {
    if (!selectedRole) return [];

    return employees.filter((employee) =>
      (employee.roles ?? []).some(
        ({ role }) => role.id === selectedRole
      )
    );
  }, [employees, selectedRole]);

  // Load assignment state for the currently selected target.
  const [assignedPermissions, setAssignedPermissions] = useState(
    new Set()
  );

  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const targetId = selectedEmployee || selectedRole;
  const targetType = selectedEmployee ? "employee" : "role";

  useEffect(() => {
    let active = true;

    async function loadAssignments() {
      if (!targetId) {
        setAssignedPermissions(new Set());
        return;
      }

      setLoadingAssignments(true);
      setError("");
      setAssignedPermissions(new Set());

      try {
        const response = await apiRequest(
          `/api/${targetType === "role" ? "role" : "employee"}/${targetId}/permissions`
        );

        if (!active) return;

        const assignedIds = (response.data ?? [])
          .filter((permission) => permission.assigned)
          .map((permission) => permission.id);

        setAssignedPermissions(new Set(assignedIds));
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load assignments.");
        }
      } finally {
        if (active) setLoadingAssignments(false);
      }
    }

    loadAssignments();

    return () => {
      active = false;
    };
  }, [targetId, targetType]);

  function handleRoleChange(roleId) {
    setSelectedRole(roleId);
    setSelectedEmployee("");
  }

  const handleToggle = useCallback(
    async (permission) => {
      if (!targetId || savingPermission) return;

      const permissionId = permission.id;
      const wasAssigned = assignedPermissions.has(permissionId);

      const endpoint =
        `/api/${targetType === "role" ? "role" : "employee"}` +
        `/${targetId}/permissions/${permissionId}`;

      setSavingPermission(permissionId);
      setError("");

      try {
        await apiRequest(endpoint, {
          method: wasAssigned ? "DELETE" : "PUT",
        });

        // Update the UI only after the server confirms success.
        setAssignedPermissions((previous) => {
          const next = new Set(previous);

          if (wasAssigned) {
            next.delete(permissionId);
          } else {
            next.add(permissionId);
          }

          return next;
        });
      } catch (err) {
        setError(err.message || "Failed to update permission.");
      } finally {
        setSavingPermission("");
      }
    },
    [targetId, targetType, assignedPermissions, savingPermission]
  );

  const targetLabel = selectedEmployee
    ? employees.find((employee) => employee.id === selectedEmployee)
        ?.name ?? "Selected employee"
    : currentRole?.name ?? "Selected role";

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Manage Permissions
            </h1>
            <p className="dashboard-header__subtitle">
              Configure access permissions by role and inspect assigned staff.
            </p>
          </div>
        </div>

        <div className="bookings-toolbar form-actions">
          <div
            className="permissions-filters"
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "center",
            }}
          >
            <div className="page-permission-role-selector">
              <label htmlFor="permission-role">Role</label>
              <select
                id="permission-role"
                className="permission-role-selector"
                value={selectedRole}
                onChange={(event) => handleRoleChange(event.target.value)}
                disabled={loading}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="page-permission-role-selector">
              <label htmlFor="permission-employee">Employee</label>
              <select
                id="permission-employee"
                className="permission-role-selector"
                value={selectedEmployee}
                onChange={(event) =>
                  setSelectedEmployee(event.target.value)
                }
                disabled={loading || !selectedRole}
              >
                <option value="">
                  All {currentRole?.name ?? "employees"}s (
                  {filteredEmployees.length})
                </option>

                {filteredEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.site?.name
                      ? ` (${employee.site.name})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading || loadingAssignments ? (
                  <tr>
                    <td colSpan={4} className="muted text-center">
                      Loading permissions...
                    </td>
                  </tr>
                ) : permissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted text-center">
                      No permissions found.
                    </td>
                  </tr>
                ) : (
                  permissions.map((permission, index) => {
                    const isEnabled = assignedPermissions.has(
                      permission.id
                    );

                    const isSaving =
                      savingPermission === permission.id;

                    return (
                      <tr key={permission.id}>
                        <td className="table-col-no">{index + 1}</td>

                        <td>
                          <strong>{permission.name}</strong>
                        </td>

                        <td>
                          {permission.description || "—"}
                        </td>

                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isEnabled}
                              aria-label={`${permission.name} for ${targetLabel}`}
                              className={`driver-availability-toggle ${
                                isEnabled ? "is-on" : "is-off"
                              }`}
                              disabled={
                                isSaving ||
                                Boolean(savingPermission) ||
                                loadingAssignments
                              }
                              onClick={() => handleToggle(permission)}
                              title={
                                isEnabled
                                  ? `Turn ${permission.name} off for ${targetLabel}`
                                  : `Turn ${permission.name} on for ${targetLabel}`
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
                              <span>
                                {isSaving
                                  ? "Saving..."
                                  : isEnabled
                                    ? "On"
                                    : "Off"}
                              </span>
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
