import { sidebarMenu } from "../data/sidebar";

// A "manage"/"create"/"update" permission implies its "read" counterpart,
// so granting e.g. `permissions.manage` alone is enough to view pages
// and call APIs guarded by `permissions.read`.
export const PERMISSION_IMPLICATIONS = {
  "site.manage": ["site.read"],
  "location.manage": ["location.read"],
  "roles.manage": ["roles.read"],
  "permissions.manage": ["permissions.read"],
  "employees.create": ["employees.read"],
  "employees.update": ["employees.read"],
  "employees.deactivate": ["employees.read"],
};

// Legacy/alternate names that mean the same permission.
// Checked in both directions so old role assignments keep working.
export const PERMISSION_ALIASES = {
  "calendar.view": ["bookings.calendar"],
  "bookings.calendar": ["calendar.view"],
  "home.leave": ["home.leaves"],
  "home.leaves": ["home.leave"],
  "bookings.read": ["bookings.table"],
  "bookings.table": ["bookings.read"],
};

export function expandPermissions(permissions) {
  const expanded = new Set(permissions ?? []);

  for (const name of [...expanded]) {
    for (const implied of PERMISSION_IMPLICATIONS[name] ?? []) {
      expanded.add(implied);
    }

    for (const alias of PERMISSION_ALIASES[name] ?? []) {
      expanded.add(alias);
    }
  }

  return expanded;
}

export function createPermissionChecker(rawPermissions, isSuperadmin) {
  const expanded = expandPermissions(rawPermissions);

  return (permission) => {
    if (!permission) return true;
    if (isSuperadmin) return true;

    if (Array.isArray(permission)) {
      if (permission.length === 0) return true;
      return permission.some((name) => expanded.has(name));
    }

    return expanded.has(permission);
  };
}

function collectLeafPaths(items) {
  const leaves = [];

  for (const item of items ?? []) {
    if (Array.isArray(item.items) && item.items.length > 0) {
      leaves.push(...collectLeafPaths(item.items));
    } else if (item.path) {
      leaves.push(item);
    }
  }

  return leaves;
}

// Landing-page priority: dashboard -> frontdesk -> nearest allowed page
// in sidebar order. Public pages (no permission) act as final fallback.
export function getDefaultRoute(hasPermission) {
  if (hasPermission("dashboard")) return "/dashboard";
  if (hasPermission("frontdesk")) return "/frontdesk";

  const leaves = collectLeafPaths(sidebarMenu);
  const allowed = leaves.find((item) => {
    const required = item.permission ?? item.permissions ?? null;
    return !required || hasPermission(required);
  });

  return allowed ? allowed.path : "/unauthorized";
}

export function getDefaultRouteForUser(user) {
  const roles = user?.roles ?? user?.employee?.roles ?? [];
  const isSuperadmin =
    user?.isSuperadmin ||
    user?.isGlobalSuperadmin ||
    roles.includes("superadmin");

  return getDefaultRoute(
    createPermissionChecker(
      user?.permissions ?? user?.employee?.permissions,
      isSuperadmin
    )
  );
}
