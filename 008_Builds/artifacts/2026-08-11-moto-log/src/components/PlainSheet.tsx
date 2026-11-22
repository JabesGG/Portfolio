import { useEffect, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** A sheet that shows something rather than saving something: no form, one Close. */
export function PlainSheet({
  title, onClose, children,
}: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  // Radix locks background scroll with an injected <style>, which the site's
  // style-src 'self' blocks; this class does the same from our own stylesheet.
  useEffect(() => {
    document.body.classList.add("sheet-open");
    return () => document.body.classList.remove("sheet-open");
  }, []);

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined}>
        <div className="sheet__body">
          <div className="sheet__head">
            <DialogTitle className="sheet__title">{title}</DialogTitle>
          </div>
          {children}
          <div className="sheet__foot">
            <button type="button" className="btn btn--ghost flex-1" onClick={onClose}>Close</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
