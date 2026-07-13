import React from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  maxWidthClass?: string; // defaults to 'max-w-md'
  glowClass?: string; // defaults to 'bg-blue-900/10'
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  maxWidthClass = "max-w-md",
  glowClass = "bg-blue-900/10",
  children,
  headerExtra,
}) => {
  const [shouldRender, setShouldRender] = React.useState(isOpen);
  const [isAnimated, setIsAnimated] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Trigger animation on next frame to ensure the transition is captured
      const timer = setTimeout(() => setIsAnimated(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsAnimated(false);
      // Wait for exit transition (200ms) before unmounting
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!shouldRender || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-100 overflow-y-auto bg-theme-page-bg/80 backdrop-blur-md transition-opacity duration-200 ease-out ${
        isAnimated ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`bg-theme-card-bg border border-theme-border-input shadow-2xl rounded-2xl w-full ${maxWidthClass} p-6 relative font-sans my-8 transform transition-all duration-200 ease-out ${
            isAnimated
              ? "scale-100 opacity-100 translate-y-0"
              : "scale-95 opacity-0 translate-y-4"
          }`}
        >
          {/* Abstract glowing bubble wrapper to prevent clipping of absolute children like select menus */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-0">
            <div
              className={`absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full ${glowClass} blur-[80px]`}
            />
          </div>

          {/* Header */}
          <div className="relative z-10 flex justify-between items-center border-b border-theme-border-input/80 pb-3 mb-5">
            <h3 className="text-base font-bold text-theme-text-primary flex items-center gap-2">
              {icon}
              {title}
            </h3>
            <div className="flex items-center gap-3">
              {headerExtra}
              <button
                type="button"
                onClick={onClose}
                className="text-theme-text-muted hover:text-theme-text-primary text-sm cursor-pointer focus:outline-none"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
