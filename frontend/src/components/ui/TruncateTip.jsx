import React, { useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * Wrap a single element that is visually truncated (e.g. `truncate` / `line-clamp`).
 * Shows the full text in a tooltip above it, but only when the text is actually cut off.
 * Positioning is handled by Radix (flips and shifts so it never leaves the viewport) and the
 * tooltip is portal-rendered, so table / card overflow can not clip it.
 *
 *   <TruncateTip text={svc.name}>
 *     <span className="block truncate max-w-[300px]">{svc.name}</span>
 *   </TruncateTip>
 */
export default function TruncateTip({ text, children, side = 'top', delayDuration = 250 }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const label = String(text ?? '');

  const onOpenChange = (next) => {
    if (next) {
      const el = ref.current;
      // Only open when the content is really truncated (horizontal or multi-line clamp)
      const truncated = el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      if (!truncated || !label) return;
    }
    setOpen(next);
  };

  return (
    <Tooltip open={open} onOpenChange={onOpenChange} delayDuration={delayDuration}>
      <TooltipTrigger asChild ref={ref}>
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="z-[70] max-w-[min(420px,calc(100vw-2rem))] whitespace-normal break-words rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-xl duration-150 motion-reduce:animate-none"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
