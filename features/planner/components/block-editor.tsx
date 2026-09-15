import { useRef, useState, type FormEvent } from "react";
import { Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { blockSchema, sameBlock, type Plan, type Block } from "@/lib/plan";
import {
  BlockEditorFields,
  type EditorErrorField,
} from "./block-editor-fields";
import type { PlannerView } from "../planner-location";

type Props = {
  initial: Block;
  error: string;
  errorScope: "request" | "command" | null;
  plan: Plan;
  view: PlannerView;
  initialFocus?: "title" | "minutes";
  onClose(): void;
  onApply(block: Block): boolean;
  onRemove(id: string): void;
};

function toEditableBlock(initial: Block): Block {
  return { ...initial };
}

export function BlockEditor({
  initial,
  error,
  errorScope,
  plan,
  view,
  initialFocus = "title",
  onClose,
  onApply,
  onRemove,
}: Props) {
  const initialBlock = toEditableBlock(initial);
  const [editor, setEditor] = useState(initialBlock);
  const [formError, setFormError] = useState("");
  const [errorField, setErrorField] = useState<EditorErrorField>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const exists = plan.blocks.some((b) => b.id === editor.id);
  const hasConfiguredTimelineDetails =
    initialBlock.startMinute !== null || initialBlock.minutes !== null;
  const changed = !sameBlock(editor, initialBlock);
  function requestClose() {
    if (changed) setConfirmClose(true);
    else onClose();
  }
  function clearFormError() {
    setFormError("");
    setErrorField(null);
  }
  function showFormError(
    message: string,
    field: Exclude<EditorErrorField, null>
  ) {
    setFormError(message);
    setErrorField(field);
    requestAnimationFrame(() => {
      (field === "title"
        ? titleInputRef
        : field === "minutes"
          ? minutesInputRef
          : startInputRef
      ).current?.focus();
    });
  }
  function updateEditor(changes: Partial<Block>) {
    clearFormError();
    setEditor((current) => ({ ...current, ...changes }));
  }
  function submitEditor(event: FormEvent) {
    event.preventDefault();
    const result = blockSchema.safeParse({
      ...editor,
      title: editor.title.trim(),
    });
    if (!result.success) {
      const issue = result.error.issues[0];
      showFormError(
        issue.message,
        issue.path[0] === "minutes"
          ? "minutes"
          : issue.path[0] === "startMinute"
            ? "startMinute"
            : "title"
      );
      return;
    }
    const applied = onApply(result.data);
    const unchanged = sameBlock(result.data, initialBlock);
    if (applied || (unchanged && !changed)) onClose();
  }
  function removeBlock() {
    onRemove(editor.id);
    onClose();
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <DialogContent
          className="block-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (initialFocus === "minutes"
              ? minutesInputRef
              : titleInputRef
            ).current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <DialogTitle>
            {exists ? "블록 다듬기" : "새로운 블록 놓기"}
          </DialogTitle>
          <DialogDescription>
            {view === "timeline"
              ? "제목과 시간·종류를 다듬어요."
              : hasConfiguredTimelineDetails
                ? "제목과 설정한 시간·소요 시간을 다듬어요."
                : "제목과 블록 종류를 다듬어요."}
          </DialogDescription>
          <form noValidate onSubmit={submitEditor}>
            <BlockEditorFields
              editor={editor}
              initial={initialBlock}
              view={view}
              errorField={errorField}
              titleInputRef={titleInputRef}
              minutesInputRef={minutesInputRef}
              startInputRef={startInputRef}
              onChange={updateEditor}
            />
            {(formError || (errorScope === "command" && error)) && (
              <p id="block-editor-error" className="form-error" role="alert">
                {formError || error}
              </p>
            )}
            <div className="dialog-actions">
              {exists && (
                <button
                  className="delete-button"
                  type="button"
                  onClick={removeBlock}
                >
                  <Trash2 size={16} />
                  삭제
                </button>
              )}
              <button className="primary" type="submit">
                {exists ? "변경 적용" : "블록 추가"}
                <Plus size={16} />
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => titleInputRef.current?.focus());
          }}
        >
          <AlertDialogTitle>변경 내용을 닫을까요?</AlertDialogTitle>
          <AlertDialogDescription>
            아직 적용하지 않은 내용이 있어요. 닫으면 입력한 내용이 사라집니다.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>계속 편집</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                onClose();
              }}
            >
              변경 버리고 닫기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
