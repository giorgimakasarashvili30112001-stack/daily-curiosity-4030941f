import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { syncWidgetStreak } from "@/lib/widget-bridge";
import { deleteAccount } from "@/lib/user.functions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * "Delete my account" button + confirmation dialog (required by Google Play).
 * The user must type DELETE. On success all data is erased server-side, the local
 * session and cache are cleared, and the page returns to the home screen.
 */
export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const remove = useServerFn(deleteAccount);
  const queryClient = useQueryClient();

  const onDelete = async () => {
    setBusy(true);
    try {
      await remove({ data: { confirm: "DELETE" } });
      await queryClient.cancelQueries();
      queryClient.clear();
      try {
        localStorage.clear();
      } catch {
        // storage unavailable: nothing to clear
      }
      await syncWidgetStreak(null);
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      toast.success("Your account and data were deleted");
      window.location.assign("/");
    } catch {
      toast.error("Could not delete your account. Please try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setText("");
          setOpen(true);
        }}
        className="w-full rounded-full border border-destructive/60 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        Delete my account
      </button>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent className="max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently erases your account, streak, coins, quiz history and saved
              explainers. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor="confirm-delete" className="text-xs text-muted-foreground">
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-destructive"
          />
          <div className="mt-2 flex gap-2">
            <AlertDialogCancel disabled={busy} className="mt-0 flex-1 rounded-full">
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              disabled={busy || text.trim() !== "DELETE"}
              onClick={() => void onDelete()}
              className="flex-1 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
