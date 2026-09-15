import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

export type DragPreview = {
  id: string;
  width: number;
  height: number;
};

// The browser owns the drag operation; this hook owns only its visible preview.
export function useDragPreview() {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const element = useRef<HTMLDivElement | null>(null);
  const active = useRef<{
    offsetX: number;
    offsetY: number;
    left: number;
    top: number;
  } | null>(null);
  const frame = useRef(0);

  const paint = useCallback(() => {
    if (element.current && active.current)
      element.current.style.transform = `translate3d(${active.current.left}px, ${active.current.top}px, 0)`;
  }, []);
  const cancelFrame = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);
  const moveTo = useCallback(
    (clientX: number, clientY: number) => {
      if (!active.current) return;
      active.current.left = clientX - active.current.offsetX;
      active.current.top = clientY - active.current.offsetY;
      if (!frame.current)
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          paint();
        });
    },
    [paint]
  );
  function begin(id: string, rect: DOMRect, clientX: number, clientY: number) {
    active.current = {
      offsetX: Math.max(0, Math.min(rect.width, clientX - rect.left)),
      offsetY: Math.max(0, Math.min(rect.height, clientY - rect.top)),
      left: rect.left,
      top: rect.top,
    };
    setPreview({ id, width: rect.width, height: rect.height });
  }
  function clear() {
    active.current = null;
    cancelFrame();
    // Hide before the reorder can commit, rather than waiting for portal unmount.
    if (element.current) element.current.style.visibility = "hidden";
    setPreview(null);
  }
  useEffect(() => {
    function follow(event: globalThis.DragEvent) {
      moveTo(event.clientX, event.clientY);
    }
    document.addEventListener("dragover", follow);
    return () => {
      document.removeEventListener("dragover", follow);
      cancelFrame();
      active.current = null;
    };
  }, [cancelFrame, moveTo]);

  return {
    preview,
    clear,
    start(id: string, event: DragEvent<HTMLElement>) {
      const rect = event.currentTarget.getBoundingClientRect();
      begin(id, rect, event.clientX, event.clientY);
      if (image.current) event.dataTransfer.setDragImage(image.current, 0, 0);
    },
    startPointer(
      id: string,
      element: HTMLElement,
      clientX: number,
      clientY: number
    ) {
      begin(id, element.getBoundingClientRect(), clientX, clientY);
    },
    movePointer(clientX: number, clientY: number) {
      moveTo(clientX, clientY);
    },
    setImage(node: HTMLImageElement | null) {
      image.current = node;
    },
    setElement(node: HTMLDivElement | null) {
      element.current = node;
      paint();
    },
  };
}
