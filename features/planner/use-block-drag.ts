import {
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { Block } from "@/lib/plan";
import { useDragPreview } from "./use-drag-preview";

export type BlockDragGripProps = {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

type Gesture =
  | { kind: "native"; id: string }
  | { kind: "pointer"; id: string; startY: number; moved: boolean };

const DRAG_MOVE_THRESHOLD_PX = 5;

export function useBlockDrag(
  blocks: Block[],
  enabled: boolean,
  reorder: (id: string, target: number) => void
) {
  const preview = useDragPreview();
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  function reset() {
    preview.clear();
    gesture.current = null;
    setDragId(null);
    setOverId(null);
  }
  function move(id: string, target: number) {
    if (
      enabled &&
      blocks.some((block) => block.id === id) &&
      target >= 0 &&
      target < blocks.length
    )
      reorder(id, target);
  }
  function finish(id: string, target: number) {
    reset();
    move(id, target);
  }
  function blockAt(event: PointerEvent) {
    return document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-block-id]")?.dataset.blockId;
  }
  return {
    dragId,
    overId,
    preview: preview.preview,
    setDragImage: preview.setImage,
    setPreviewElement: preview.setElement,
    dropAfter:
      blocks.findIndex((block) => block.id === dragId) <
      blocks.findIndex((block) => block.id === overId),
    rowProps(id: string, index: number) {
      return {
        onDragOver(event: DragEvent) {
          if (enabled && gesture.current?.kind === "native") {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setOverId(id);
          }
        },
        onDrop(event: DragEvent) {
          event.preventDefault();
          const source = gesture.current;
          if (source?.kind !== "native") return;
          event.dataTransfer.dropEffect = "move";
          finish(source.id, index);
        },
      };
    },
    blockProps(id: string) {
      return {
        draggable: enabled,
        onDragStart(event: DragEvent<HTMLElement>) {
          if (!enabled || gesture.current) {
            event.preventDefault();
            return;
          }
          gesture.current = { kind: "native", id };
          event.dataTransfer.setData("text/plain", id);
          event.dataTransfer.effectAllowed = "move";
          preview.start(id, event);
          setDragId(id);
        },
        onDragEnd: reset,
      };
    },
    gripProps(
      id: string,
      index: number,
      onClick: () => void = () => undefined
    ): BlockDragGripProps {
      return {
        onPointerDown(event: PointerEvent<HTMLButtonElement>) {
          if (!enabled || gesture.current) return;
          event.preventDefault();
          gesture.current = {
            kind: "pointer",
            id,
            startY: event.clientY,
            moved: false,
          };
          const card = event.currentTarget.closest<HTMLElement>(".clay-block");
          if (card)
            preview.startPointer(id, card, event.clientX, event.clientY);
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragId(id);
        },
        onPointerMove(event: PointerEvent<HTMLButtonElement>) {
          const active = gesture.current;
          if (active?.kind !== "pointer") return;
          preview.movePointer(event.clientX, event.clientY);
          if (
            Math.abs(event.clientY - active.startY) > DRAG_MOVE_THRESHOLD_PX
          ) {
            active.moved = true;
            suppressClick.current = true;
          }
          setOverId(blockAt(event) ?? null);
        },
        onPointerUp(event: PointerEvent<HTMLButtonElement>) {
          const active = gesture.current;
          if (active?.kind !== "pointer") return;
          if (active.moved)
            finish(
              active.id,
              blocks.findIndex((block) => block.id === blockAt(event))
            );
          else reset();
        },
        onPointerCancel() {
          suppressClick.current = false;
          reset();
        },
        onClick() {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onClick();
        },
        onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            move(id, index + (event.key === "ArrowUp" ? -1 : 1));
          }
        },
      };
    },
  };
}
