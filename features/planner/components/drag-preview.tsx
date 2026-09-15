import { createPortal } from "react-dom";
import { Check, GripVertical } from "lucide-react";
import type { Block } from "@/lib/plan";
import { durationLabel } from "@/lib/plan-schedule";
import type { DragPreview as Preview } from "../use-drag-preview";
import { BlockContent } from "./block-content";

export function DragPreview({
  block,
  preview,
  compact,
  setElement,
  setImage,
}: {
  block: Block | undefined;
  preview: Preview | null;
  compact: boolean;
  setElement(node: HTMLDivElement | null): void;
  setImage(node: HTMLImageElement | null): void;
}) {
  return (
    <>
      {/* A connected pixel suppresses the browser ghost; the portal is the visible preview. */}
      <img
        ref={setImage}
        className="native-drag-image"
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {preview &&
        block &&
        createPortal(
          <div
            ref={setElement}
            aria-hidden="true"
            className={`drag-preview-layer ${compact ? "compact-list" : ""}`}
            style={{
              width: preview.width,
              height: preview.height,
            }}
          >
            <div
              className={`clay-block ${block.color ?? "neutral"} ${block.done ? "is-done" : ""}`}
            >
              <span className="grip-button">
                <GripVertical className="grip" size={18} />
              </span>
              <span className="edit-block">
                <BlockContent block={block} />
              </span>
              <span className="duration">{durationLabel(block.minutes)}</span>
              <span
                className="done-check"
                data-state={block.done ? "checked" : "unchecked"}
              >
                {block.done && <Check size={16} />}
              </span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
