import { BookOpen, ShoppingBag, Coffee, PenLine, Circle } from "lucide-react";
import type { Block } from "@/lib/plan";
import { CATEGORY_LABELS } from "../planner-category";

const blockIcons = {
  blue: BookOpen,
  peach: ShoppingBag,
  green: Coffee,
  yellow: PenLine,
};

export function BlockContent({
  block,
  showCategory = true,
}: {
  block: Block;
  showCategory?: boolean;
}) {
  const Icon = block.color ? blockIcons[block.color] : Circle;
  return (
    <>
      <span className={`block-icon ${block.color ? "" : "neutral"}`}>
        <Icon size={23} />
      </span>
      <span className="block-copy">
        {showCategory && block.color && (
          <span className="category">{CATEGORY_LABELS[block.color]}</span>
        )}
        <span className="block-title">{block.title}</span>
      </span>
    </>
  );
}
