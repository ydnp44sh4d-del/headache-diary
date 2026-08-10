import React, { useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

// A pinch-to-zoom, drag-to-pan image viewer for checking a receipt/PDF
// scan against the extracted fields before saving. Single finger (or
// mouse) drags the image around; two fingers pinch to zoom; double-tap
// (or double-click) toggles between fit and 2x zoom.
export default function ZoomableImage({ src, alt, height = 260 }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map());
  const pinchStart = useRef(null); // { dist, scale }
  const dragStart = useRef(null); // { x, y, posX, posY }

  const reset = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      pinchStart.current = {
        dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        scale,
      };
      dragStart.current = null;
    } else if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [p1, p2] = [...pointers.current.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      setScale(clampScale(pinchStart.current.scale * (dist / pinchStart.current.dist)));
    } else if (pointers.current.size === 1 && dragStart.current) {
      setPos({
        x: dragStart.current.posX + (e.clientX - dragStart.current.x),
        y: dragStart.current.posY + (e.clientY - dragStart.current.y),
      });
    }
  };

  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);
    pinchStart.current = null;
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      dragStart.current = { x: p.x, y: p.y, posX: pos.x, posY: pos.y };
    } else {
      dragStart.current = null;
    }
  };

  const toggleZoom = () => (scale > 1 ? reset() : setScale(2));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        overflow: "hidden",
        borderRadius: 8,
        marginBottom: 14,
        background: "#000",
        touchAction: "none",
        cursor: scale > 1 ? "grab" : "zoom-in",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={toggleZoom}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 6,
          right: 8,
          fontSize: 10,
          color: "#C9C9CC",
          background: "rgba(0,0,0,0.5)",
          padding: "2px 7px",
          borderRadius: 20,
          pointerEvents: "none",
        }}
      >
        Pinch or drag to inspect
      </div>
      {scale > 1 && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            background: "rgba(0,0,0,0.6)",
            color: "#F5F5F4",
            border: "1px solid #33333A",
            borderRadius: 20,
            padding: "3px 10px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}
