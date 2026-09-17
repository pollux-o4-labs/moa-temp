import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConflictRecoveryActions } from "./conflict-recovery-actions";
import type { BlockField } from "@/lib/block-fields";
import type { ConflictState } from "../planner-session";
import { plannerDateContext } from "../planner-date";

type Props = {
  open: boolean;
  targetDate: string | null;
  saving: boolean;
  error: string;
  conflict: ConflictState | null;
  onResolve(choice: "save" | "discard" | "cancel"): void;
  onResolveConflict(choice: "reload" | "reapply"): void;
  onResolveConflictField(
    blockId: string,
    field: BlockField,
    choice: "local" | "latest"
  ): void;
};
export function DateChangeDialog({
  open,
  targetDate,
  saving,
  error,
  conflict,
  onResolve,
  onResolveConflict,
  onResolveConflictField,
}: Props) {
  const targetName = plannerDateContext(targetDate ?? "").name;
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onResolve("cancel");
      }}
    >
      <DialogContent
        className="block-dialog"
        showCloseButton={!saving}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle>변경사항이 있어요</DialogTitle>
        <DialogDescription>
          저장하지 않은 변경사항이 있습니다. {targetName}로 이동할까요?
        </DialogDescription>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {conflict && (
          <>
            <span>최신 내용과 변경 내용을 먼저 확인해주세요.</span>
            <ConflictRecoveryActions
              onReload={() => onResolveConflict("reload")}
              onReapply={() => onResolveConflict("reapply")}
              conflict={conflict}
              onResolveField={onResolveConflictField}
            />
          </>
        )}
        <div className="navigation-actions">
          <button
            autoFocus
            data-planner-focus-target="date-dialog-primary"
            className="cancel-button"
            disabled={saving}
            onClick={() => onResolve("cancel")}
          >
            계속 편집
          </button>
          <button
            className="save-button"
            disabled={saving}
            onClick={() => onResolve("discard")}
          >
            저장하지 않고 이동
          </button>
          <button
            className="primary"
            disabled={saving}
            onClick={() => onResolve("save")}
          >
            {saving ? "저장 중" : "저장하고 이동"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
