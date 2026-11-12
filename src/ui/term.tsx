import { Popover } from "@base-ui/react/popover";
import { createContext, type ReactNode, useContext, useRef } from "react";
import { findTerm } from "../glossary/glossary";
import { Icon } from "./icons";
import { learnTerm, useLearnedTerms } from "./learned-terms";

type Payload = { readonly name: string; readonly own: ReactNode };

const termCard = Popover.createHandle<Payload>();

// Each company screen says what this company's own figure is for a term, for
// the fiscal year it shows. Screens without a company give nothing.
export type OwnFigure = (termName: string) => ReactNode;

const OwnFigureContext = createContext<OwnFigure>(() => null);

export function OwnFigures({
  figure,
  children,
}: {
  readonly figure: OwnFigure;
  readonly children: ReactNode;
}) {
  return <OwnFigureContext.Provider value={figure}>{children}</OwnFigureContext.Provider>;
}

// A term the glossary does not hold opens nothing, rather than the wrong card.
// A term whose card was opened before reads as plain text.
export function Term({ name, children }: { readonly name: string; readonly children?: ReactNode }) {
  const own = useContext(OwnFigureContext);
  const learned = useLearnedTerms();
  const entry = findTerm(name);
  if (entry === undefined || learned.has(entry.name)) return <>{children ?? name}</>;
  return (
    <Popover.Trigger
      handle={termCard}
      payload={{ name: entry.name, own: own(entry.name) }}
      className="term"
    >
      {children ?? name}
    </Popover.Trigger>
  );
}

export function TermCard() {
  const shown = useRef<string | null>(null);
  return (
    <Popover.Root
      handle={termCard}
      onOpenChangeComplete={(open) => {
        if (!open && shown.current !== null) learnTerm(shown.current);
      }}
    >
      {({ payload }) => {
        shown.current = payload?.name ?? null;
        const entry = payload === undefined ? undefined : findTerm(payload.name);
        return (
          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="start"
              sideOffset={10}
              collisionPadding={16}
              className="z-50"
            >
              <Popover.Popup className="card">
                {entry !== undefined && payload !== undefined && (
                  <>
                    <Popover.Close className="close" aria-label="Close">
                      <Icon name="close" className="h-4 w-4" />
                    </Popover.Close>
                    <Popover.Title render={<h3 />}>{entry.name}</Popover.Title>
                    <Popover.Description render={<div />}>
                      <p>{entry.definition}</p>
                      <p className="text-text-3">{entry.example}</p>
                    </Popover.Description>
                    {payload.own}
                  </>
                )}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        );
      }}
    </Popover.Root>
  );
}
