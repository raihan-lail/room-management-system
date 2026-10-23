import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import FlexibleButton from "./FlexibleButtons";

const MENU_WIDTH = 150;
const MENU_GAP = 8;

export default function TableRowActions({
  label,
  rowLabel = "",
  onView,
  onEdit,
  onDelete,
  permission = "rooms.manage",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const hasMenu = Boolean(onEdit || onDelete);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
  }, []);

  /*
   * The table scrolls, so an in-flow menu would be
   * clipped by the scroll container. The menu is portalled
   * to the body and placed against the trigger instead.
   */
  useLayoutEffect(() => {
    if (!isOpen) return;

    const rect = triggerRef.current?.getBoundingClientRect();

    if (!rect) return;

    const height = menuRef.current?.offsetHeight ?? 0;
    const fitsBelow = rect.bottom + MENU_GAP + height <= window.innerHeight;

    const top = fitsBelow
      ? rect.bottom + MENU_GAP
      : Math.max(MENU_GAP, rect.top - MENU_GAP - height);

    const left = Math.min(
      Math.max(MENU_GAP, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - MENU_GAP,
    );

    setPosition({ top, left });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event) => {
      const isInsideMenu = menuRef.current?.contains(event.target);
      const isTrigger = triggerRef.current?.contains(event.target);

      if (!isInsideMenu && !isTrigger) closeMenu();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [isOpen, closeMenu]);

  const title = `${label}${rowLabel ? ` ${rowLabel}` : ""}`;

  return (
    <div className="table-actions">
      {onView && (
        <button
          type="button"
          className="btn btn-neutral"
          title={`View ${title}`}
          aria-label={`View ${title}`}
          onClick={onView}
        >
          <i className="bi bi-eye" aria-hidden="true" />
        </button>
      )}

      {hasMenu && (
        <FlexibleButton
          ref={triggerRef}
          permission={permission}
          className="btn btn-neutral"
          title={onEdit ? `Edit or delete ${title}` : `Delete ${title}`}
          aria-label={onEdit ? `Edit or delete ${title}` : `Delete ${title}`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => (isOpen ? closeMenu() : setIsOpen(true))}
        >
          <i
            className={
              onEdit
                ? "bi bi-pencil-square"
                : "bi bi-trash"
            }
            aria-hidden="true"
          />
        </FlexibleButton>
      )}

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="table-action-menu"
            role="menu"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
          >
            {onEdit && (
              <button
                type="button"
                role="menuitem"
                className="table-action-menu__item"
                onClick={() => {
                  closeMenu();
                  onEdit();
                }}
              >
                <i className="bi bi-pencil-square" aria-hidden="true" />
                Edit
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                role="menuitem"
                className="table-action-menu__item table-action-menu__item--danger"
                onClick={() => {
                  closeMenu();
                  onDelete();
                }}
              >
                <i className="bi bi-trash" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
