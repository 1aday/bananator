# 🍌 Banana Designer Page

## Overview

Created an AI-powered interior design workspace that transforms any room photo into a professionally styled concept. Users upload a photo, describe their vision in plain English, and the AI generates a complete design specification with materials, colors, and style tags—then renders a photorealistic "after" image showing the redesigned space.

---

## Main Features

### 1. AI Design Generation from Natural Language
- Built a prompt input that accepts descriptions like "Modern minimalist with warm wood tones"
- Integrated GPT-4o vision to analyze uploaded room photos and understand the existing space
- Created a structured output system that organizes designs into Shell (architecture) and Interior (decor) categories

### 2. Multi-Model Image Rendering
- Added three AI rendering engines users can choose from: Nano Banana Pro, Google Nano Banana, and Seedream 4.5 Edit
- Built automatic prompt generation that converts the design JSON into detailed image instructions
- Implemented photorealistic rendering that applies all specified materials and colors to the room

### 3. Before/After Comparison Slider
- Created an interactive drag-to-compare component showing original vs. rendered image side by side
- Added smooth touch and mouse support with a centered divider handle
- Built loading states with skeleton animations while images render

### 4. Hierarchical Design Structure
- Organized designs into Shell (Ceiling, Walls, Floor, Windows, Doors, Built-ins) and Interior (Layout, Furniture, Lighting, Textiles, Decor)
- Each category contains overall materials plus individual items with their own materials and colors
- Added collapsible accordion UI to browse the full design tree

### 5. Project & Room Organization
- Built room management within projects (Living Room, Kitchen, Bedroom, etc.)
- Each room stores its own design concept with images
- Added persistent storage with auto-save when designs are generated

---

## Side Features

### 1. Inline Tag & Label Editing
- Made all material, color, and style tags clickable to edit in place
- Added `+` buttons to add new tags anywhere
- Built cascading deletion so removing a material from the category removes it from all items too
- Made section labels (category names like "Ceiling", "Walls", "Furniture") editable by clicking
- Made item labels (like "Modern Sofa", "Pendant Light") editable by clicking
- Labels convert to inline inputs on click with Enter to save, Escape to cancel
- Editing works in both the sidebar panel AND the main area grid cards

### 2. Design Element Cards
- Created a grid view showing all design items at a glance
- Added color-coded icons (amber for shell elements, violet for interior)
- Built hover-to-reveal delete buttons for quick removal

### 3. JSON Import/Export
- Added ability to paste raw JSON to import existing designs
- Built one-click copy to clipboard for backup or sharing
- Added validation with friendly error messages for bad JSON

### 4. Multiple Reference Images
- Enabled uploading multiple room photos as reference
- Built drag-and-drop plus click-to-browse file uploading
- Added thumbnail previews with individual remove buttons

### 5. Regenerate Design
- Built a "Regenerate" mode that refines the current design without needing a new prompt
- Useful for iterating and exploring variations

---

## Quality of Life Features

### 1. Fully Responsive Layout
- Designed mobile-first with a slide-out panel on small screens
- Made the panel persistent on desktop for easier workflow
- Added larger touch targets and safe area padding for notched phones

### 2. Rich Loading States
- Built skeleton loaders with shimmer animation during design generation
- Created an animated spinner overlay during image rendering
- Added real-time status text ("Generating...", "Rendering...", "Ready")

### 3. Auto-Save with Indicators
- Made designs auto-save when generation completes
- Added a visual badge showing when there are unsaved changes
- Built a manual save button that's always accessible

### 4. Keyboard Support
- Added Enter key to submit prompts
- Built Escape key to close modals and cancel inputs

### 5. Confirmation Dialogs
- Created a reusable confirm dialog for destructive actions
- Added animated backdrop blur and smooth entry animation
- Built proper focus trapping and escape-to-dismiss

### 6. Helpful Empty States
- Designed onboarding screens when no project or room is selected
- Added quick-start style chips ("Modern minimalist", "Cozy Scandinavian", etc.)
- Wrote clear instructions guiding users through each step

### 7. Error Handling
- Built graceful error display with clear messages
- Added file validation before upload (type and size checks)
- Created parse error feedback for invalid JSON imports

### 8. Smart Defaults
- Made categories with content auto-expand on load
- Kept both Shell and Interior sections open by default
- Built a collapsible model selector to reduce visual clutter
