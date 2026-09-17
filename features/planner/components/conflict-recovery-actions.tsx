import { useRef, useState } from "react";
import type { Block } from "@/lib/plan";
import { timeLabel } from "@/lib/plan-schedule";
import type { BlockField } from "@/lib/block-fields";
import type { ConflictState } from "../planner-session";
import { CATEGORY_LABELS } from "../planner-category";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  onReload(): void;
  onReapply(): void;
  conflict?: ConflictState | null;
  onResolveField?(
    blockId: string,
    field: BlockField,
    choice: "local" | "latest"
  ): void;
};

function fieldLabel(field: BlockField) {
  return {
    title: "제목",
    startMinute: "시작 시각",
    minutes: "소요 시간",
    color: "종류",
    done: "완료 상태",
  }[field];
}

function fieldValue(block: Block, field: BlockField) {
  if (field === "startMinute")
    return block.startMinute === null
      ? "지정하지 않음"
      : timeLabel(block.startMinute);
  if (field === "minutes")
    return block.minutes === null ? "지정하지 않음" : `${block.minutes}분`;
  if (field === "color")
    return block.color === null ? "종류 없음" : CATEGORY_LABELS[block.color];
  if (field === "done") return block.done ? "완료" : "미완료";
  return block.title;
}

export function ConflictRecoveryActions({
  onReload,
  onReapply,
  conflict,
  onResolveField,
}: Props) {
  const [confirmReload, setConfirmReload] = useState(false);
  const reloadButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div className="conflict-actions" role="group" aria-label="충돌 복구">
        <button
          ref={reloadButtonRef}
          data-planner-focus-target="recovery"
          onClick={() => setConfirmReload(true)}
        >
          최신 내용 불러오기
        </button>
        <button onClick={onReapply}>내 변경 다시 적용</button>
      </div>
      {conflict?.latest &&
        conflict.details.some((item) => item.kind === "block") && (
          <div className="conflict-details" aria-label="충돌한 필드 선택">
            <strong>충돌한 필드를 어떻게 남길까요?</strong>
            {conflict.details.map((item) =>
              item.kind === "block"
                ? item.fields.map((field) => (
                    <div className="conflict-field" key={`${item.id}-${field}`}>
                      <span>
                        {fieldLabel(field)} · {item.local.title}
                      </span>
                      <span>내 변경: {fieldValue(item.local, field)}</span>
                      <span>최신 내용: {fieldValue(item.latest, field)}</span>
                      <div>
                        <button
                          onClick={() =>
                            onResolveField?.(item.id, field, "local")
                          }
                        >
                          내 값 사용
                        </button>
                        <button
                          onClick={() =>
                            onResolveField?.(item.id, field, "latest")
                          }
                        >
                          최신 값 사용
                        </button>
                      </div>
                    </div>
                  ))
                : null
            )}
          </div>
        )}
      <AlertDialog open={confirmReload} onOpenChange={setConfirmReload}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => reloadButtonRef.current?.focus());
          }}
        >
          <AlertDialogTitle>
            내 변경을 버리고 최신 내용을 불러올까요?
          </AlertDialogTitle>
          <AlertDialogDescription>
            현재 창의 저장되지 않은 변경이 사라집니다. 보존하려면 취소한 뒤 내
            변경 다시 적용을 선택해주세요.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmReload(false);
                onReload();
              }}
            >
              내 변경 버리고 최신 내용 불러오기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
