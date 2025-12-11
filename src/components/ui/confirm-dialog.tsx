"use client";

import { useCallback, useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  icon?: React.ReactNode;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  icon,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: "bg-red-500/10",
      iconColor: "text-red-400",
      buttonBg: "bg-red-500 hover:bg-red-600",
      icon: icon || <Trash2 className="w-6 h-6" />,
    },
    warning: {
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      buttonBg: "bg-amber-500 hover:bg-amber-600",
      icon: icon || <AlertTriangle className="w-6 h-6" />,
    },
    default: {
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
      buttonBg: "bg-violet-500 hover:bg-violet-600",
      icon: icon || <AlertTriangle className="w-6 h-6" />,
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-200"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mb-4",
            styles.iconBg,
            styles.iconColor
          )}>
            {styles.icon}
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-white mb-2">
            {title}
          </h3>

          {/* Description */}
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            {description}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors",
                styles.buttonBg
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

