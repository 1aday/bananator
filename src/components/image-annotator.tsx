"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Check, Undo2, Redo2, Pencil, Type, ArrowRight, Circle, Eraser, ChevronDown, Move } from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "select" | "pen" | "arrow" | "circle" | "text" | "eraser";
type HandleType = "nw" | "ne" | "sw" | "se" | "start" | "end" | null;

type DrawAction = {
  id: string;
  type: Exclude<Tool, "select" | "eraser">;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  text?: string;
  color: string;
  lineWidth: number;
};

// Extended color palette
const colorPalette = {
  primary: [
    "#ef4444", // Red
    "#f97316", // Orange
    "#eab308", // Yellow
    "#22c55e", // Green
    "#14b8a6", // Teal
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ec4899", // Pink
  ],
  neutral: [
    "#ffffff", // White
    "#d4d4d4", // Light Gray
    "#737373", // Gray
    "#000000", // Black
  ],
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

const HANDLE_SIZE = 12;
const HANDLE_HIT_RADIUS = 16;

interface InlineAnnotatorProps {
  imageUrl: string;
  onSave: (annotatedImageUrl: string) => void;
  onCancel: () => void;
  className?: string;
}

export function InlineAnnotator({ imageUrl, onSave, onCancel, className }: InlineAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [currentColor, setCurrentColor] = useState("#ef4444"); // Red
  const [lineWidth, setLineWidth] = useState(15); // Bigger default size
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandleType>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizeInitialAction, setResizeInitialAction] = useState<DrawAction | null>(null);
  const [hoveringHandle, setHoveringHandle] = useState<HandleType>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load image and setup canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Setup canvas context
  useEffect(() => {
    if (canvasRef.current && imageLoaded) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (context) {
        context.lineCap = "round";
        context.lineJoin = "round";
        setCtx(context);
      }
    }
  }, [imageLoaded]);

  // Get bounding box for an action (for selection)
  const getActionBounds = useCallback((action: DrawAction): { x: number; y: number; width: number; height: number } | null => {
    switch (action.type) {
      case "pen":
        if (action.points && action.points.length > 0) {
          const xs = action.points.map(p => p.x);
          const ys = action.points.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          return { x: minX, y: minY, width: maxX - minX || 20, height: maxY - minY || 20 };
        }
        break;
      case "arrow":
        if (action.start && action.end) {
          const minX = Math.min(action.start.x, action.end.x);
          const maxX = Math.max(action.start.x, action.end.x);
          const minY = Math.min(action.start.y, action.end.y);
          const maxY = Math.max(action.start.y, action.end.y);
          return { x: minX, y: minY, width: maxX - minX || 20, height: maxY - minY || 20 };
        }
        break;
      case "circle":
        if (action.start && action.end) {
          const radius = Math.sqrt(
            Math.pow(action.end.x - action.start.x, 2) + 
            Math.pow(action.end.y - action.start.y, 2)
          );
          return { 
            x: action.start.x - radius, 
            y: action.start.y - radius, 
            width: radius * 2, 
            height: radius * 2 
          };
        }
        break;
      case "text":
        if (action.start && action.text && ctx) {
          ctx.font = `bold ${action.lineWidth * 8}px sans-serif`;
          const metrics = ctx.measureText(action.text);
          const height = action.lineWidth * 8;
          return { 
            x: action.start.x, 
            y: action.start.y - height, 
            width: metrics.width || 50, 
            height: height 
          };
        }
        break;
    }
    return null;
  }, [ctx]);

  // Redraw canvas when actions change
  useEffect(() => {
    if (!ctx || !canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all completed actions
    actions.forEach(action => drawAction(ctx, action, action.id === selectedActionId));
    
    // Draw current action
    if (currentAction) {
      drawAction(ctx, currentAction, false);
    }
  }, [ctx, actions, currentAction, selectedActionId, getActionBounds, hoveringHandle]);

  const drawAction = (context: CanvasRenderingContext2D, action: DrawAction, isSelected: boolean) => {
    context.strokeStyle = action.color;
    context.fillStyle = action.color;
    context.lineWidth = action.lineWidth;

    // Draw selection highlight and handles
    if (isSelected) {
      context.save();
      
      // Draw subtle bounding box only for pen strokes
      if (action.type === "pen") {
        const bounds = getActionBounds(action);
        if (bounds) {
          context.strokeStyle = "rgba(163, 230, 53, 0.3)"; // lime-400 with low opacity
          context.lineWidth = 1;
          context.setLineDash([4, 4]);
          context.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
        }
      }
      
      // Draw handles directly on the shape
      context.setLineDash([]);
      const handles = getShapeHandles(action);
      handles.forEach(h => {
        const isHovered = hoveringHandle === h.type;
        drawHandle(context, h.x, h.y, isHovered);
      });
      
      context.restore();
    }

    // Reset styles for drawing the actual shape
    context.strokeStyle = action.color;
    context.fillStyle = action.color;
    context.lineWidth = action.lineWidth;
    context.setLineDash([]);

    switch (action.type) {
      case "pen":
        if (action.points && action.points.length > 1) {
          context.beginPath();
          context.moveTo(action.points[0].x, action.points[0].y);
          for (let i = 1; i < action.points.length; i++) {
            context.lineTo(action.points[i].x, action.points[i].y);
          }
          context.stroke();
        }
        break;
      case "arrow":
        if (action.start && action.end) {
          const headLength = 20 + action.lineWidth;
          const dx = action.end.x - action.start.x;
          const dy = action.end.y - action.start.y;
          const angle = Math.atan2(dy, dx);
          
          // Line
          context.beginPath();
          context.moveTo(action.start.x, action.start.y);
          context.lineTo(action.end.x, action.end.y);
          context.stroke();
          
          // Arrowhead
          context.beginPath();
          context.moveTo(action.end.x, action.end.y);
          context.lineTo(
            action.end.x - headLength * Math.cos(angle - Math.PI / 6),
            action.end.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          context.moveTo(action.end.x, action.end.y);
          context.lineTo(
            action.end.x - headLength * Math.cos(angle + Math.PI / 6),
            action.end.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          context.stroke();
        }
        break;
      case "circle":
        if (action.start && action.end) {
          const radius = Math.sqrt(
            Math.pow(action.end.x - action.start.x, 2) + 
            Math.pow(action.end.y - action.start.y, 2)
          );
          context.beginPath();
          context.arc(action.start.x, action.start.y, radius, 0, 2 * Math.PI);
          context.stroke();
        }
        break;
      case "text":
        if (action.start && action.text) {
          context.font = `bold ${action.lineWidth * 8}px sans-serif`;
          context.fillText(action.text, action.start.x, action.start.y);
        }
        break;
    }
  };

  const drawHandle = (context: CanvasRenderingContext2D, x: number, y: number, isHovered: boolean = false) => {
    const size = isHovered ? HANDLE_SIZE + 4 : HANDLE_SIZE;
    // Draw circular handle with clear styling
    context.beginPath();
    context.arc(x, y, size / 2, 0, Math.PI * 2);
    context.fillStyle = isHovered ? "#ffffff" : "#a3e635";
    context.fill();
    context.strokeStyle = isHovered ? "#a3e635" : "#ffffff";
    context.lineWidth = 2;
    context.stroke();
  };

  // Get handles positioned directly on the shape
  const getShapeHandles = (action: DrawAction): { type: HandleType; x: number; y: number }[] => {
    switch (action.type) {
      case "arrow":
        if (action.start && action.end) {
          return [
            { type: "start", x: action.start.x, y: action.start.y },
            { type: "end", x: action.end.x, y: action.end.y },
          ];
        }
        break;
      case "circle":
        if (action.start && action.end) {
          const radius = Math.sqrt(
            Math.pow(action.end.x - action.start.x, 2) + 
            Math.pow(action.end.y - action.start.y, 2)
          );
          // Single handle on the edge of the circle (at the end point direction)
          const angle = Math.atan2(action.end.y - action.start.y, action.end.x - action.start.x);
          return [
            { type: "se", x: action.start.x + radius * Math.cos(angle), y: action.start.y + radius * Math.sin(angle) },
          ];
        }
        break;
      case "text":
        if (action.start && ctx) {
          ctx.font = `bold ${action.lineWidth * 8}px sans-serif`;
          const metrics = ctx.measureText(action.text || "");
          const height = action.lineWidth * 8;
          // Single handle at bottom-right of text
          return [
            { type: "se", x: action.start.x + metrics.width, y: action.start.y },
          ];
        }
        break;
      case "pen":
        const bounds = getActionBounds(action);
        if (bounds) {
          // 4 corner handles on the actual bounding box
          return [
            { type: "nw", x: bounds.x, y: bounds.y },
            { type: "ne", x: bounds.x + bounds.width, y: bounds.y },
            { type: "sw", x: bounds.x, y: bounds.y + bounds.height },
            { type: "se", x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          ];
        }
        break;
    }
    return [];
  };

  // Check if point is on a resize handle
  const getHandleAtPoint = (x: number, y: number, action: DrawAction): HandleType => {
    const handles = getShapeHandles(action);
    for (const handle of handles) {
      const dist = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
      if (dist < HANDLE_HIT_RADIUS) {
        return handle.type;
      }
    }
    return null;
  };

  // Check if a point is inside an action's bounds
  const isPointInAction = (x: number, y: number, action: DrawAction): boolean => {
    const bounds = getActionBounds(action);
    if (!bounds) return false;
    
    const padding = 15; // Make it easier to select
    return (
      x >= bounds.x - padding &&
      x <= bounds.x + bounds.width + padding &&
      y >= bounds.y - padding &&
      y <= bounds.y + bounds.height + padding
    );
  };

  // Find action at a point (for selection)
  const findActionAtPoint = (x: number, y: number): DrawAction | null => {
    // Search in reverse order (top-most first)
    for (let i = actions.length - 1; i >= 0; i--) {
      if (isPointInAction(x, y, actions[i])) {
        return actions[i];
      }
    }
    return null;
  };

  // Move an action by delta
  const moveAction = (actionId: string, deltaX: number, deltaY: number) => {
    setActions(prev => prev.map(action => {
      if (action.id !== actionId) return action;

      switch (action.type) {
        case "pen":
          if (action.points) {
            return {
              ...action,
              points: action.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY })),
            };
          }
          break;
        case "arrow":
        case "circle":
          if (action.start && action.end) {
            return {
              ...action,
              start: { x: action.start.x + deltaX, y: action.start.y + deltaY },
              end: { x: action.end.x + deltaX, y: action.end.y + deltaY },
            };
          }
          break;
        case "text":
          if (action.start) {
            return {
              ...action,
              start: { x: action.start.x + deltaX, y: action.start.y + deltaY },
            };
          }
          break;
      }
      return action;
    }));
  };

  // Resize an action using absolute positioning from initial state
  const resizeAction = (actionId: string, handle: HandleType, currentPos: { x: number; y: number }) => {
    if (!resizeInitialAction || !dragStart) return;
    
    setActions(prev => prev.map(action => {
      if (action.id !== actionId) return action;
      const initial = resizeInitialAction;

      switch (action.type) {
        case "arrow":
          // Move just the start or end point - simple and direct
          if (handle === "start" && initial.end) {
            return { ...action, start: currentPos };
          }
          if (handle === "end" && initial.start) {
            return { ...action, end: currentPos };
          }
          break;

        case "circle":
          // Drag the edge handle to resize - radius follows the handle directly
          if (initial.start) {
            const newRadius = Math.sqrt(
              Math.pow(currentPos.x - initial.start.x, 2) + 
              Math.pow(currentPos.y - initial.start.y, 2)
            );
            // Keep the end point at the cursor position
            return {
              ...action,
              end: currentPos,
            };
          }
          break;

        case "text":
          // Drag handle away to scale text - distance from start determines size
          if (initial.start && ctx) {
            ctx.font = `bold ${initial.lineWidth * 8}px sans-serif`;
            const initialMetrics = ctx.measureText(initial.text || "");
            const initialWidth = initialMetrics.width || 50;
            
            // Calculate scale based on how far the handle moved from start
            const initialEndX = initial.start.x + initialWidth;
            const dragDistance = currentPos.x - dragStart.x;
            const scale = Math.max(0.3, (initialWidth + dragDistance) / initialWidth);
            const newLineWidth = Math.max(2, Math.min(30, initial.lineWidth * scale));
            
            return { ...action, lineWidth: newLineWidth };
          }
          break;

        case "pen":
          // Scale from the opposite corner anchor point
          if (initial.points && initial.points.length > 0) {
            const initialBounds = getActionBounds(initial);
            if (initialBounds && initialBounds.width > 0 && initialBounds.height > 0) {
              // Anchor is the opposite corner
              let anchorX: number, anchorY: number;
              if (handle === "se") {
                anchorX = initialBounds.x;
                anchorY = initialBounds.y;
              } else if (handle === "sw") {
                anchorX = initialBounds.x + initialBounds.width;
                anchorY = initialBounds.y;
              } else if (handle === "ne") {
                anchorX = initialBounds.x;
                anchorY = initialBounds.y + initialBounds.height;
              } else { // nw
                anchorX = initialBounds.x + initialBounds.width;
                anchorY = initialBounds.y + initialBounds.height;
              }
              
              // Calculate scale based on cursor distance from anchor
              const initialDragDist = {
                x: Math.abs(dragStart.x - anchorX),
                y: Math.abs(dragStart.y - anchorY),
              };
              const currentDist = {
                x: Math.abs(currentPos.x - anchorX),
                y: Math.abs(currentPos.y - anchorY),
              };
              
              const scaleX = initialDragDist.x > 10 ? currentDist.x / initialDragDist.x : 1;
              const scaleY = initialDragDist.y > 10 ? currentDist.y / initialDragDist.y : 1;
              
              // Clamp scale
              const clampedScaleX = Math.max(0.2, Math.min(5, scaleX));
              const clampedScaleY = Math.max(0.2, Math.min(5, scaleY));

              return {
                ...action,
                points: initial.points.map(p => ({
                  x: anchorX + (p.x - anchorX) * clampedScaleX,
                  y: anchorY + (p.y - anchorY) * clampedScaleY,
                })),
              };
            }
          }
          break;
      }
      return action;
    }));
  };

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the actual displayed size accounting for object-fit: contain
    const displayAspect = rect.width / rect.height;
    const canvasAspect = canvas.width / canvas.height;
    
    let displayWidth: number, displayHeight: number;
    let offsetX = 0, offsetY = 0;
    
    if (canvasAspect > displayAspect) {
      // Canvas is wider - letterboxed top/bottom
      displayWidth = rect.width;
      displayHeight = rect.width / canvasAspect;
      offsetY = (rect.height - displayHeight) / 2;
    } else {
      // Canvas is taller - letterboxed left/right
      displayHeight = rect.height;
      displayWidth = rect.height * canvasAspect;
      offsetX = (rect.width - displayWidth) / 2;
    }
    
    const scaleX = canvas.width / displayWidth;
    const scaleY = canvas.height / displayHeight;
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Adjust for the letterboxing offset
    const x = (clientX - rect.left - offsetX) * scaleX;
    const y = (clientY - rect.top - offsetY) * scaleY;
    
    return { x, y };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    // Select tool - find and select action, or start dragging/resizing
    if (currentTool === "select") {
      // First check if clicking on a handle of selected action
      if (selectedActionId) {
        const selectedAction = actions.find(a => a.id === selectedActionId);
        if (selectedAction) {
          const handle = getHandleAtPoint(coords.x, coords.y, selectedAction);
          if (handle) {
            setIsResizing(true);
            setActiveHandle(handle);
            setDragStart(coords);
            // Store initial state for absolute resize calculations
            setResizeInitialAction(JSON.parse(JSON.stringify(selectedAction)));
            return;
          }
        }
      }

      // Then check if clicking on an action
      const clickedAction = findActionAtPoint(coords.x, coords.y);
      if (clickedAction) {
        setSelectedActionId(clickedAction.id);
        // Check if clicking on a handle
        const handle = getHandleAtPoint(coords.x, coords.y, clickedAction);
        if (handle) {
          setIsResizing(true);
          setActiveHandle(handle);
          // Store initial state for absolute resize calculations
          setResizeInitialAction(JSON.parse(JSON.stringify(clickedAction)));
        } else {
          setIsDragging(true);
        }
        setDragStart(coords);
      } else {
        setSelectedActionId(null);
      }
      return;
    }

    // Deselect when using other tools
    setSelectedActionId(null);
    setIsDrawing(true);
    setRedoStack([]); // Clear redo stack on new action

    if (currentTool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        const newAction: DrawAction = {
          id: generateId(),
          type: "text",
          start: coords,
          text,
          color: currentColor,
          lineWidth,
        };
        setActions(prev => [...prev, newAction]);
      }
      setIsDrawing(false);
      return;
    }

    if (currentTool === "eraser") {
      // Eraser removes actions it touches
      return;
    }

    const newAction: DrawAction = {
      id: generateId(),
      type: currentTool as Exclude<Tool, "select" | "eraser">,
      points: currentTool === "pen" ? [coords] : undefined,
      start: coords,
      color: currentColor,
      lineWidth,
    };
    setCurrentAction(newAction);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    // Handle resizing selected action (uses initial state, not cumulative)
    if (currentTool === "select" && isResizing && selectedActionId && activeHandle) {
      resizeAction(selectedActionId, activeHandle, coords);
      return;
    }

    // Handle dragging selected action
    if (currentTool === "select" && isDragging && selectedActionId && dragStart) {
      const deltaX = coords.x - dragStart.x;
      const deltaY = coords.y - dragStart.y;
      moveAction(selectedActionId, deltaX, deltaY);
      setDragStart(coords);
      return;
    }

    // Update hover state for handles when not dragging/resizing
    if (currentTool === "select" && !isDragging && !isResizing) {
      if (selectedActionId) {
        const selectedAction = actions.find(a => a.id === selectedActionId);
        if (selectedAction) {
          const handle = getHandleAtPoint(coords.x, coords.y, selectedAction);
          setHoveringHandle(handle);
        }
      } else {
        setHoveringHandle(null);
      }
    }

    if (!isDrawing) return;

    // Eraser - remove actions that are touched
    if (currentTool === "eraser") {
      const hitAction = findActionAtPoint(coords.x, coords.y);
      if (hitAction) {
        setActions(prev => prev.filter(a => a.id !== hitAction.id));
      }
      return;
    }

    if (!currentAction) return;

    if (currentTool === "pen") {
      setCurrentAction(prev => prev ? {
        ...prev,
        points: [...(prev.points || []), coords],
      } : null);
    } else {
      setCurrentAction(prev => prev ? {
        ...prev,
        end: coords,
      } : null);
    }
  };

  const handleEnd = () => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      setActiveHandle(null);
      setDragStart(null);
      setResizeInitialAction(null);
      return;
    }

    if (currentAction) {
      setActions(prev => [...prev, currentAction]);
      setCurrentAction(null);
    }
    setIsDrawing(false);
  };

  const handleUndo = () => {
    if (actions.length === 0) return;
    const lastAction = actions[actions.length - 1];
    setActions(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastAction]);
    setSelectedActionId(null);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const actionToRedo = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setActions(prev => [...prev, actionToRedo]);
  };

  // Delete selected action
  const handleDeleteSelected = useCallback(() => {
    if (selectedActionId) {
      setActions(prev => prev.filter(a => a.id !== selectedActionId));
      setSelectedActionId(null);
    }
  }, [selectedActionId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedActionId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
      if (e.key === "Escape") {
        setSelectedActionId(null);
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedActionId, onCancel, handleDeleteSelected]);

  const handleSave = useCallback(() => {
    if (!canvasRef.current || !imageRef.current) return;

    // Deselect before saving
    setSelectedActionId(null);

    // Create a new canvas to composite image + annotations
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = imageDimensions.width;
    exportCanvas.height = imageDimensions.height;
    const exportCtx = exportCanvas.getContext("2d");
    
    if (!exportCtx) return;

    // Draw original image
    exportCtx.drawImage(imageRef.current, 0, 0);
    
    // Draw annotations on top (without selection highlight)
    exportCtx.lineCap = "round";
    exportCtx.lineJoin = "round";
    actions.forEach(action => drawAction(exportCtx, action, false));

    // Export as data URL
    const dataUrl = exportCanvas.toDataURL("image/png");
    onSave(dataUrl);
  }, [imageDimensions, onSave, actions]);

  // Get cursor based on what's under it
  const getCursor = (): string => {
    if (currentTool !== "select") return "crosshair";
    
    // Active resize
    if (isResizing && activeHandle) {
      if (activeHandle === "nw" || activeHandle === "se") return "nwse-resize";
      if (activeHandle === "ne" || activeHandle === "sw") return "nesw-resize";
      if (activeHandle === "start" || activeHandle === "end") return "crosshair";
      return "nwse-resize";
    }
    
    // Active drag
    if (isDragging) return "grabbing";
    
    // Hovering over handle
    if (hoveringHandle) {
      if (hoveringHandle === "nw" || hoveringHandle === "se") return "nwse-resize";
      if (hoveringHandle === "ne" || hoveringHandle === "sw") return "nesw-resize";
      if (hoveringHandle === "start" || hoveringHandle === "end") return "crosshair";
      return "nwse-resize";
    }
    
    // Hovering over selected action
    if (selectedActionId) return "grab";
    
    return "default";
  };

  const tools = [
    { id: "select" as Tool, icon: Move, label: "Select, Move & Resize" },
    { id: "pen" as Tool, icon: Pencil, label: "Draw" },
    { id: "arrow" as Tool, icon: ArrowRight, label: "Arrow" },
    { id: "circle" as Tool, icon: Circle, label: "Circle" },
    { id: "text" as Tool, icon: Type, label: "Text" },
    { id: "eraser" as Tool, icon: Eraser, label: "Eraser" },
  ];

  if (!imageLoaded) {
    return (
      <div className={cn("relative flex items-center justify-center bg-zinc-900 rounded-xl min-h-[200px]", className)}>
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative flex flex-col", className)}>
      {/* Image container - contained to viewport */}
      <div className="relative w-full flex items-center justify-center">
        {/* Container that wraps both image and canvas with matching size */}
        <div className="relative max-w-full max-h-[70vh]" style={{ aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}` }}>
          {/* Image as background */}
          <img
            src={imageUrl}
            alt="Annotate"
            className="w-full h-full object-contain rounded-xl"
            draggable={false}
          />
          
          {/* Canvas overlay for annotations - exactly matches image */}
          <canvas
            ref={canvasRef}
            width={imageDimensions.width}
            height={imageDimensions.height}
            className="absolute inset-0 w-full h-full rounded-xl touch-none"
            style={{ cursor: getCursor() }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        {/* Floating toolbar - positioned at top center of image */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1 p-1.5 bg-zinc-900/95 backdrop-blur-sm rounded-xl border border-zinc-700 shadow-xl max-w-[95%]">
          {/* Tools */}
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setCurrentTool(tool.id);
                if (tool.id !== "select") {
                  setSelectedActionId(null);
                  setHoveringHandle(null);
                }
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                currentTool === tool.id
                  ? "bg-lime-400/20 text-lime-400"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
              title={tool.label}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
          
          <div className="w-px h-6 bg-zinc-700 mx-1 hidden sm:block" />
          
          {/* Color picker with dropdown */}
          <div className="relative" ref={colorPickerRef}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-zinc-800 transition-all"
              title="Pick color"
            >
              <div 
                className="w-5 h-5 rounded-full border-2 border-white/50"
                style={{ backgroundColor: currentColor }}
              />
              <ChevronDown className={cn(
                "w-3 h-3 text-zinc-400 transition-transform",
                showColorPicker && "rotate-180"
              )} />
            </button>
            
            {/* Color dropdown */}
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-2 p-3 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 min-w-[180px]">
                <div className="text-xs text-zinc-500 mb-2">Colors</div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {colorPalette.primary.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setCurrentColor(color);
                        setShowColorPicker(false);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-lg border-2 transition-all hover:scale-110",
                        currentColor === color ? "border-white" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <div className="text-xs text-zinc-500 mb-2">Neutral</div>
                <div className="grid grid-cols-4 gap-2">
                  {colorPalette.neutral.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setCurrentColor(color);
                        setShowColorPicker(false);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-lg border-2 transition-all hover:scale-110",
                        currentColor === color ? "border-lime-400" : "border-zinc-600"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-zinc-700 mx-1 hidden sm:block" />

          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={actions.length === 0}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-zinc-700 mx-1 hidden sm:block" />

          {/* Cancel/Save */}
          <button
            onClick={onCancel}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            className="p-2 text-lime-400 hover:bg-lime-400/20 rounded-lg transition-all"
            title="Save"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>

        {/* Size slider - bottom left */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 p-2 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-zinc-700">
          <span className="text-xs text-zinc-400">Size:</span>
          <input
            type="range"
            min="2"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 accent-lime-400"
          />
          <span className="text-xs text-zinc-500 w-4">{lineWidth}</span>
        </div>

        {/* Selection hint - bottom right */}
        {selectedActionId && (
          <div className="absolute bottom-2 right-2 flex items-center gap-2 px-3 py-2 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-lime-400/30 text-xs text-zinc-400">
            <span className="text-lime-400">●</span>
            <span>Drag shape to move</span>
            <span>•</span>
            <span>Drag handles to resize</span>
            <span className="hidden sm:inline">• Del to remove</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper component that toggles between normal image view and annotation mode
interface AnnotatableImageProps {
  imageUrl: string;
  onAnnotated: (annotatedImageUrl: string) => void;
  className?: string;
  imageClassName?: string;
  children?: React.ReactNode;
  showAnnotateButton?: boolean;
}

export function AnnotatableImage({ 
  imageUrl, 
  onAnnotated, 
  className,
  imageClassName,
  children,
  showAnnotateButton = true,
}: AnnotatableImageProps) {
  const [isAnnotating, setIsAnnotating] = useState(false);

  const handleSave = useCallback((annotatedUrl: string) => {
    onAnnotated(annotatedUrl);
    setIsAnnotating(false);
  }, [onAnnotated]);

  if (isAnnotating) {
    return (
      <InlineAnnotator
        imageUrl={imageUrl}
        onSave={handleSave}
        onCancel={() => setIsAnnotating(false)}
        className={className}
      />
    );
  }

  return (
    <div className={cn("relative group", className)}>
      <img src={imageUrl} alt="" className={imageClassName} />
      {children}
      {showAnnotateButton && (
        <button
          onClick={() => setIsAnnotating(true)}
          className="absolute top-2 right-2 p-2 bg-violet-500/90 hover:bg-violet-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"
          title="Annotate image"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Simple button to trigger annotation (for backward compatibility)
interface AnnotateButtonProps {
  imageUrl: string;
  onAnnotated: (annotatedImageUrl: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function AnnotateButton({ imageUrl, onAnnotated, className, children }: AnnotateButtonProps) {
  const [isAnnotating, setIsAnnotating] = useState(false);

  const handleSave = useCallback((annotatedUrl: string) => {
    onAnnotated(annotatedUrl);
    setIsAnnotating(false);
  }, [onAnnotated]);

  return (
    <>
      <button
        onClick={() => setIsAnnotating(true)}
        className={className}
        title="Annotate image"
      >
        {children || <Pencil className="w-4 h-4" />}
      </button>

      {isAnnotating && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="w-full h-full flex items-center justify-center">
            <InlineAnnotator
              imageUrl={imageUrl}
              onSave={handleSave}
              onCancel={() => setIsAnnotating(false)}
              className="w-full max-w-5xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
