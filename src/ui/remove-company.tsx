import { Dialog } from "@base-ui/react/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { type RefObject, useState } from "react";
import { type ListedCompany, removeCompany } from "../functions/companies";
import { plainName } from "./logo-tile";
import { useNotice } from "./notices";

export function RemoveDialog({
  company,
  open,
  onOpenChange,
  returnFocusTo,
}: {
  readonly company: ListedCompany;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const queryClient = useQueryClient();
  const notice = useNotice();
  const name = plainName(company.name);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Popup className="sheet" initialFocus={true} finalFocus={returnFocusTo ?? true}>
          <Dialog.Title render={<h2 />}>Remove {name}?</Dialog.Title>
          <Dialog.Description>
            This deletes the filings and numbers collected for {name} from this computer. It goes
            back to not collected, and you can collect it again at any time.
          </Dialog.Description>
          <div className="actions">
            <Dialog.Close className="button">Keep it</Dialog.Close>
            <Dialog.Close
              className="button primary"
              onClick={async () => {
                await removeCompany({ data: { cik: company.cik } });
                await queryClient.invalidateQueries({
                  queryKey: ["companies"],
                });
                await queryClient.invalidateQueries({ queryKey: ["company"] });
                notice({ company, text: `${name} was removed.`, link: null });
              }}
            >
              Remove {name}
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function RemoveButton({ company }: { readonly company: ListedCompany }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="quiet-button"
        aria-label={`Remove ${plainName(company.name)}`}
        onClick={() => setOpen(true)}
      >
        Remove
      </button>
      <RemoveDialog company={company} open={open} onOpenChange={setOpen} />
    </>
  );
}
