import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { searchQuery } from "../functions/companies";
import { LogoTile, plainName, shortName } from "./logo-tile";
import {
  certainOf,
  kindOf,
  type Offer,
  offersFor,
  sameMentions,
  type Word,
  worthOffering,
} from "./mention-rules";

export type Mention = {
  readonly cik: number;
  readonly ticker: string;
  readonly name: string;
};

const wordAtEnd = /([A-Za-z][A-Za-z0-9&-]*)$/;
const wordChar = /[A-Za-z0-9&-]/;
const boundary = /[\s.,!?;:'")]/;

const letterOf = (name: string) =>
  name
    .replace(/[^A-Za-z0-9]/g, "")
    .charAt(0)
    .toUpperCase();

const isChip = (node: Node | null): node is HTMLElement =>
  node instanceof HTMLElement && node.classList.contains("mention");

const chipFor = (mention: Mention, ready: boolean) => {
  const chip = document.createElement("span");
  chip.className = "mention";
  chip.contentEditable = "false";
  chip.dataset["cik"] = String(mention.cik);
  chip.dataset["ticker"] = mention.ticker;
  chip.dataset["name"] = mention.name;
  const tile = document.createElement("span");
  tile.className = "logo-tile";
  tile.setAttribute("aria-hidden", "true");
  tile.textContent = letterOf(plainName(mention.name));
  if (ready) {
    const image = document.createElement("img");
    image.alt = "";
    image.draggable = false;
    image.addEventListener("load", () => {
      tile.replaceChildren(image);
      tile.classList.add("has-logo");
    });
    image.src = `/logos/${mention.cik}`;
    tile.append(image);
  }
  chip.append(tile, shortName(mention.name));
  return chip;
};

const read = (editor: HTMLElement) => {
  let text = "";
  const mentions: Array<Mention> = [];
  const walk = (parent: Node) => {
    for (const node of parent.childNodes) {
      if (node instanceof Text) text += node.data;
      else if (isChip(node)) {
        const mention = {
          cik: Number(node.dataset["cik"]),
          ticker: node.dataset["ticker"] ?? "",
          name: node.dataset["name"] ?? "",
        };
        mentions.push(mention);
        text += shortName(mention.name);
      } else if (node instanceof HTMLElement) {
        // Browsers keep a last line break of their own so an empty last line shows.
        if (node.tagName === "BR") text += node === editor.lastChild ? "" : "\n";
        else {
          if (node.tagName === "DIV" && text !== "") text += "\n";
          walk(node);
        }
      }
    }
  };
  walk(editor);
  return { text: text.replaceAll(" ", " "), mentions };
};

const write = (
  editor: HTMLElement,
  value: string,
  mentions: ReadonlyArray<Mention>,
  ready: (cik: number) => boolean,
) => {
  const nodes: Array<Node> = [];
  const pushText = (text: string) =>
    text.split("\n").forEach((line, index) => {
      if (index > 0) nodes.push(document.createElement("br"));
      if (line !== "") nodes.push(document.createTextNode(line));
    });
  let rest = value;
  for (const mention of mentions) {
    const name = shortName(mention.name);
    const at = rest.indexOf(name);
    if (at === -1) continue;
    pushText(rest.slice(0, at));
    nodes.push(chipFor(mention, ready(mention.cik)));
    rest = rest.slice(at + name.length);
  }
  pushText(rest);
  if (value.endsWith("\n")) nodes.push(document.createElement("br"));
  editor.replaceChildren(...nodes);
};

const placeCaret = (node: Node, offset: number) => {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const caretToEnd = (element: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const wordIn = (node: Text, end: number): Word | null => {
  const before = node.data.slice(0, end);
  const match = wordAtEnd.exec(before);
  if (match?.[1] === undefined) return null;
  const start = end - match[1].length;
  const prior = before.slice(0, start);
  const first = (prior.trim() === "" && node.previousSibling === null) || /[.!?]\s+$/.test(prior);
  return { node, start, end, text: match[1], first };
};

const wordAtCaret = (editor: HTMLElement): Word | null => {
  const selection = getSelection();
  const node = selection?.anchorNode ?? null;
  if (selection === null || !selection.isCollapsed || !(node instanceof Text)) return null;
  if (!editor.contains(node)) return null;
  const next = node.data.charAt(selection.anchorOffset);
  if (next !== "" && wordChar.test(next)) return null;
  return wordIn(node, selection.anchorOffset);
};

// A question field that recognises companies as they are typed and turns
// them into chips. The text it gives back reads as a sentence: each chip is
// the company's short name.
export function MentionInput({
  id,
  label,
  value,
  mentions,
  companies,
  placeholder,
  onChange,
  onSubmit,
  ref,
}: {
  readonly id?: string;
  readonly label: string;
  readonly value: string;
  readonly mentions: ReadonlyArray<Mention>;
  readonly companies: ReadonlyArray<Mention>;
  readonly placeholder?: string;
  readonly onChange: (text: string, mentions: Array<Mention>) => void;
  readonly onSubmit: () => void;
  readonly ref?: RefObject<HTMLDivElement | null>;
}) {
  const own = useRef<HTMLDivElement>(null);
  const editor = ref ?? own;
  const field = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const shown = useRef<{
    text: string;
    mentions: ReadonlyArray<Mention>;
  } | null>(null);
  const declined = useRef(new Set<string>());
  const automatic = useRef<{ chip: HTMLElement; text: string } | null>(null);
  const [word, setWord] = useState<Word | null>(null);
  const [pointer, setPointer] = useState({ text: "", index: 0 });
  const [ghostAt, setGhostAt] = useState<{
    left: number;
    top: number;
    height: number;
  } | null>(null);
  const listId = useId();

  const readyCiks = new Set(companies.map((company) => company.cik));
  const kind = word === null ? null : kindOf(word);
  const wanted =
    word !== null &&
    kind !== null &&
    !declined.current.has(word.text.toLowerCase()) &&
    worthOffering(word, kind);
  const search = useQuery({
    ...searchQuery(word?.text ?? ""),
    enabled: wanted,
    placeholderData: keepPreviousData,
  });
  const offers =
    word === null || !wanted || search.data === undefined
      ? []
      : offersFor(word, companies, search.data);
  const single = offers.length === 1 ? offers[0] : undefined;
  const ghost =
    single !== undefined &&
    word !== null &&
    shortName(single.name).toLowerCase().startsWith(word.text.toLowerCase())
      ? shortName(single.name).slice(word.text.length)
      : "";
  const listed = offers.length > 1 || (single !== undefined && ghost === "");
  const active =
    word !== null && pointer.text === word.text
      ? Math.min(pointer.index, Math.max(0, offers.length - 1))
      : 0;

  useLayoutEffect(() => {
    const element = editor.current;
    if (element === null) return;
    const last = shown.current;
    if (last !== null && last.text === value && sameMentions(last.mentions, mentions)) return;
    write(element, value, mentions, (cik) => readyCiks.has(cik));
    shown.current = { text: value, mentions };
    if (value === "") declined.current.clear();
    if (document.activeElement === element) caretToEnd(element);
  });

  useLayoutEffect(() => {
    const box = field.current;
    if (ghost === "" || word === null || box === null) {
      if (ghostAt !== null) setGhostAt(null);
      return;
    }
    const range = document.createRange();
    range.setStart(word.node, word.end);
    range.collapse(true);
    const caret = range.getBoundingClientRect();
    const outer = box.getBoundingClientRect();
    const next = {
      left: Math.round(caret.left - outer.left),
      top: Math.round(caret.top - outer.top),
      height: Math.round(caret.height),
    };
    if (
      ghostAt === null ||
      ghostAt.left !== next.left ||
      ghostAt.top !== next.top ||
      ghostAt.height !== next.height
    )
      setGhostAt(next);
  }, [ghost, word, ghostAt]);

  const detect = () => {
    const element = editor.current;
    if (element !== null) setWord(wordAtCaret(element));
  };

  useEffect(() => {
    const onSelection = () => {
      const element = editor.current;
      if (element === null || document.activeElement !== element) return;
      // A caret inside a chip could type nothing, so it moves to just after it.
      const selection = getSelection();
      const anchor = selection?.anchorNode ?? null;
      const chip = anchor?.parentElement?.closest(".mention") ?? null;
      if (selection?.isCollapsed === true && chip !== null && element.contains(chip)) {
        const after = document.createRange();
        after.setStartAfter(chip);
        after.collapse(true);
        selection.removeAllRanges();
        selection.addRange(after);
        return;
      }
      detect();
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  });

  const emit = () => {
    const element = editor.current;
    if (element === null) return;
    const next = read(element);
    shown.current = next;
    onChange(next.text, next.mentions);
  };

  const replaceWord = (target: Word, offer: Offer) => {
    const range = document.createRange();
    const afterAt = target.node.data.charAt(target.start - 1) === "@";
    range.setStart(target.node, afterAt ? target.start - 1 : target.start);
    range.setEnd(target.node, target.end);
    range.deleteContents();
    const chip = chipFor(offer, offer.ready || readyCiks.has(offer.cik));
    range.insertNode(chip);
    return chip;
  };

  const pick = (offer: Offer) => {
    if (word === null) return;
    const chip = replaceWord(word, offer);
    const space = document.createTextNode(" ");
    chip.after(space);
    placeCaret(space, 1);
    automatic.current = null;
    setWord(null);
    emit();
  };

  // Once the word ends and only one company can be meant, it becomes a chip.
  const completeBehind = (node: Text, end: number) => {
    const target = wordIn(node, end);
    if (target === null || declined.current.has(target.text.toLowerCase())) return;
    const targetKind = kindOf(target);
    if (!worthOffering(target, targetKind)) return;
    void queryClient
      .fetchQuery(searchQuery(target.text))
      .then((found) => {
        const element = editor.current;
        const offer = certainOf(target, offersFor(target, companies, found));
        if (offer === undefined || element === null || !element.contains(target.node)) return;
        if (target.node.data.slice(target.start, target.end) !== target.text) return;
        if (declined.current.has(target.text.toLowerCase())) return;
        const chip = replaceWord(target, offer);
        automatic.current = { chip, text: target.text };
        emit();
        detect();
      })
      .catch(() => undefined);
  };

  const undoAutomatic = () => {
    const last = automatic.current;
    const selection = getSelection();
    automatic.current = null;
    if (last === null || !last.chip.isConnected || selection === null) return false;
    const after = last.chip.nextSibling;
    if (!(after instanceof Text) || selection.anchorNode !== after) return false;
    if (!selection.isCollapsed || selection.anchorOffset !== 1) return false;
    const typed = document.createTextNode(last.text);
    last.chip.replaceWith(typed);
    after.deleteData(0, 1);
    placeCaret(typed, typed.length);
    declined.current.add(last.text.toLowerCase());
    emit();
    detect();
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Backspace" && undoAutomatic()) {
      event.preventDefault();
      return;
    }
    if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) automatic.current = null;
    const chosen = offers[active];
    if (listed && (event.key === "ArrowDown" || event.key === "ArrowUp") && word !== null) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setPointer({
        text: word.text,
        index: (active + step + offers.length) % offers.length,
      });
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && chosen !== undefined) {
      event.preventDefault();
      pick(chosen);
      return;
    }
    if (event.key === "Enter" && listed && chosen !== undefined) {
      event.preventDefault();
      pick(chosen);
      return;
    }
    if (event.key === "Escape" && offers.length > 0 && word !== null) {
      event.preventDefault();
      declined.current.add(word.text.toLowerCase());
      setWord(null);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) document.execCommand("insertLineBreak");
      else onSubmit();
      return;
    }
    if (event.key === " ") {
      const selection = getSelection();
      const node = selection?.anchorNode ?? null;
      if (
        selection?.isCollapsed === true &&
        node instanceof Text &&
        selection.anchorOffset === 1 &&
        node.data.startsWith(" ") &&
        isChip(node.previousSibling)
      )
        event.preventDefault();
    }
  };

  const onInput = () => {
    emit();
    detect();
    const selection = getSelection();
    const node = selection?.anchorNode ?? null;
    if (selection === null || !selection.isCollapsed || !(node instanceof Text)) return;
    const end = selection.anchorOffset - 1;
    if (end > 0 && boundary.test(node.data.charAt(end))) completeBehind(node, end);
  };

  return (
    <div className="mention-field" ref={field}>
      {value === "" && (
        <span className="mention-placeholder" aria-hidden="true">
          {placeholder}
        </span>
      )}
      <div
        ref={editor}
        id={id}
        className="mention-editor"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-autocomplete="list"
        aria-controls={listed ? listId : undefined}
        aria-activedescendant={listed ? `${listId}-${active}` : undefined}
        spellCheck={false}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onBlur={() => setWord(null)}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
        }}
        onDrop={(event) => event.preventDefault()}
      />
      {ghost !== "" && ghostAt !== null && (
        <span
          className="mention-ghost"
          aria-hidden="true"
          style={{
            left: ghostAt.left,
            top: ghostAt.top,
            height: ghostAt.height,
            lineHeight: `${ghostAt.height}px`,
          }}
        >
          {ghost}
          <kbd>Tab</kbd>
        </span>
      )}
      {listed && word !== null && (
        <ul className="ask-menu mention-list" id={listId} role="listbox" aria-label="Companies">
          {offers.map((offer, index) => (
            <li
              key={offer.cik}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="ask-menu-item"
              data-highlighted={index === active ? "" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setPointer({ text: word.text, index })}
              onClick={() => pick(offer)}
            >
              <LogoTile
                name={plainName(offer.name)}
                cik={offer.ready ? offer.cik : undefined}
                size={24}
              />
              <span className="ask-menu-name">
                {shortName(offer.name)}
                {!offer.ready && <span className="mention-note">Not collected yet</span>}
              </span>
              <span className="ask-menu-ticker">{offer.ticker}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
