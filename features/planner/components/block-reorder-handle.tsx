import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BlockDragGripProps } from "../use-block-drag";

type Props = {
  index: number;
  count: number;
  disabled: boolean;
  label: string;
  getGripProps(onClick: () => void): BlockDragGripProps;
  onMove(target: number): void;
};

export function BlockReorderHandle({
  index,
  count,
  disabled,
  label,
  getGripProps,
  onMove,
}: Props) {
  const [open, setOpen] = useState(false);
  const gripProps = getGripProps(() => setOpen((current) => !current));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="grip-button"
          data-planner-focus-target={index === 0 ? "first-block" : undefined}
          aria-label={label}
          disabled={disabled}
          {...gripProps}
        >
          <GripVertical className="grip" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6}>
        <DropdownMenuLabel>블록 순서</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={index === 0}
          onSelect={() => onMove(index - 1)}
        >
          <ArrowUp size={15} />
          앞으로
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index === count - 1}
          onSelect={() => onMove(index + 1)}
        >
          <ArrowDown size={15} />
          뒤로
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
