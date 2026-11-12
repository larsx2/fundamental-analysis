import { useEffect, useRef, useState } from "react";

// The company's official logo, fetched from Wikidata when it was collected
// and kept on this computer. Until it loads, and for a company without one,
// the tile shows the first letter of the company's name.
export function LogoTile({
  name,
  cik,
  size = 40,
}: {
  readonly name: string;
  readonly cik?: number | undefined;
  readonly size?: number;
}) {
  const letter = name
    .replace(/[^A-Za-z0-9]/g, "")
    .charAt(0)
    .toUpperCase();
  const image = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState<number | null>(null);

  // A picture already loaded before the screen came alive fires no event.
  useEffect(() => {
    const element = image.current;
    if (element !== null && cik !== undefined && element.complete && element.naturalWidth > 0)
      setLoaded(cik);
  }, [cik]);

  const shown = cik !== undefined && loaded === cik;
  return (
    <span
      className={`logo-tile ${shown ? "has-logo" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {!shown && letter}
      {cik !== undefined && (
        <img
          ref={image}
          src={`/logos/${cik}`}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(cik)}
          onError={() => setLoaded(null)}
        />
      )}
    </span>
  );
}

// "COSTCO WHOLESALE CORP /NEW" reads as "Costco Wholesale Corp". The SEC
// writes some names in capitals and adds its own suffixes.
export const plainName = (name: string) => {
  const trimmed = name
    .replace(/\s+\/[A-Z]+\/?$/, "")
    .replace(/\s*\/[A-Z]{2}\/?$/, "")
    .trim();
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word) =>
      word.length <= 3 && /^(llc|plc|ag|nv|sa|se)$/.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ")
    .replace(/\bInc$/, "Inc.");
};

// "Apple Inc." reads as "Apple" in a sentence.
export const shortName = (name: string) =>
  plainName(name)
    .replace(/,?\s+(Inc\.?|Corp\.?|Corporation|Co\.?|Company|Ltd\.?|LLC|PLC|Holdings|Group)$/i, "")
    .trim();
