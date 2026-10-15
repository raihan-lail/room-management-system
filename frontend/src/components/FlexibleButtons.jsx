
import useAuth from "../contexts/useAuth";

export default function FlexibleButton({
  permission,
  children,
  fallback = null,
  ...buttonProps
}) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return fallback;
  }

  return (
    <button {...buttonProps}>
      {children}
    </button>
  );
}
